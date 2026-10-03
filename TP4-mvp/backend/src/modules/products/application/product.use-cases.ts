import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GetMyStoreUseCase } from '../../stores/application/use-cases/get-my-store.use-case';
import { CreateProductDto } from '../dto/create-product.dto';
import { ProductQueryDto } from '../dto/product-query.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { activationPending, canChangeProductStatus } from './product.policy';
import { ProductRecord, ProductRepository, ProductStatus } from './product.repository';

@Injectable()
export class ProductUseCases {
  constructor(
    private readonly stores: GetMyStoreUseCase,
    private readonly products: ProductRepository,
  ) {}

  async create(ownerId: string, dto: CreateProductDto): Promise<ProductRecord> {
    const storeId = await this.storeId(ownerId);
    await this.requireActiveCategory(dto.categoryId);
    const name = this.name(dto.name);
    this.price(dto.price);
    this.stock(dto.stock);
    try {
      return await this.products.create(storeId, { ...dto, name, sku: dto.sku?.trim() || null });
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async list(ownerId: string, query: ProductQueryDto) {
    const storeId = await this.storeId(ownerId);
    return this.products.listPage(storeId, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      q: query.q?.trim() || undefined,
      categoryId: query.categoryId,
      status: query.status,
      stock: query.stock,
    });
  }

  async get(ownerId: string, productId: string): Promise<ProductRecord> {
    const storeId = await this.storeId(ownerId);
    return this.requireProduct(storeId, productId);
  }

  async update(ownerId: string, productId: string, dto: UpdateProductDto): Promise<ProductRecord> {
    const storeId = await this.storeId(ownerId);
    const current = await this.requireProduct(storeId, productId);
    this.requireEditable(current);
    if (Object.keys(dto).length === 0) throw new BadRequestException('Informe ao menos um campo para atualizar.');
    if (dto.categoryId !== undefined) await this.requireActiveCategory(dto.categoryId);
    if (dto.price !== undefined) this.price(dto.price);
    if (dto.stock !== undefined) this.stock(dto.stock);
    const input = { ...dto, name: dto.name === undefined ? undefined : this.name(dto.name) };
    const priceChanged = dto.price !== undefined && !new Prisma.Decimal(dto.price).eq(current.price);
    try {
      if (!await this.products.update(storeId, productId, current.status, input, priceChanged)) {
        throw new ConflictException('O produto mudou durante a atualizacao.');
      }
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
    return this.requireProduct(storeId, productId);
  }

  async changeStatus(ownerId: string, productId: string, status: ProductStatus): Promise<ProductRecord> {
    const storeId = await this.storeId(ownerId);
    const current = await this.requireProduct(storeId, productId);
    if (!canChangeProductStatus(current.status, status)) {
      throw new ConflictException('Transicao de status do produto invalida.');
    }
    if (current.status === status) return current;
    if (status === 'ACTIVE') {
      const pending = activationPending(current, await this.products.categoryIsActive(current.categoryId));
      if (pending.length) throw new BadRequestException({ message: 'O produto nao pode ser ativado.', pending });
    }
    if (!await this.products.changeStatus(storeId, productId, current.status, status)) {
      throw new ConflictException('O produto mudou durante a atualizacao.');
    }
    return this.requireProduct(storeId, productId);
  }

  async archive(ownerId: string, productId: string): Promise<ProductRecord> {
    const storeId = await this.storeId(ownerId);
    const current = await this.requireProduct(storeId, productId);
    this.requireEditable(current);
    if (!await this.products.archive(storeId, productId)) {
      throw new ConflictException('O produto mudou durante a atualizacao.');
    }
    return this.requireProduct(storeId, productId);
  }

  private async storeId(ownerId: string): Promise<string> {
    return (await this.stores.execute(ownerId)).id;
  }

  private async requireProduct(storeId: string, productId: string): Promise<ProductRecord> {
    const product = await this.products.findByStore(storeId, productId);
    if (!product) throw new NotFoundException('Produto nao encontrado.');
    return product;
  }

  private async requireActiveCategory(categoryId: string): Promise<void> {
    if (!await this.products.categoryIsActive(categoryId)) {
      throw new BadRequestException('Categoria de produto inexistente ou inativa.');
    }
  }

  private requireEditable(product: ProductRecord): void {
    if (product.status === 'ARCHIVED') throw new ConflictException('Produto arquivado nao pode ser alterado.');
  }

  private name(value: string): string {
    const name = value?.trim();
    if (!name) throw new BadRequestException('Nome do produto e obrigatorio.');
    return name;
  }

  private price(value: string): void {
    if (!/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/.test(value) || new Prisma.Decimal(value).lte(0)) {
      throw new BadRequestException('Preco deve ser positivo, com ate duas casas decimais.');
    }
  }

  private stock(value: number): void {
    if (!Number.isInteger(value) || value < 0) {
      throw new BadRequestException('Estoque deve ser um inteiro maior ou igual a zero.');
    }
  }

  private rethrowPersistenceError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') throw new ConflictException('SKU ja cadastrado nesta loja.');
      if (error.code === 'P2003') throw new BadRequestException('Categoria de produto invalida.');
    }
    throw error;
  }
}
