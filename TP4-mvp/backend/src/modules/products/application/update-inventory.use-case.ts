import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GetMyStoreUseCase } from '../../stores/application/use-cases/get-my-store.use-case';
import { PRICE_PATTERN } from '../dto/create-product.dto';
import { UpdateInventoryDto } from '../dto/update-inventory.dto';
import { MAX_PRODUCT_STOCK } from './product.policy';
import { ProductRepository } from './product.repository';

@Injectable()
export class UpdateInventoryUseCase {
  constructor(
    private readonly stores: GetMyStoreUseCase,
    private readonly products: ProductRepository,
  ) {}

  async execute(ownerId: string, productId: string, input: UpdateInventoryDto) {
    if (input.price === undefined && input.stock === undefined) {
      throw new BadRequestException('Informe price ou stock.');
    }
    if (input.price !== undefined &&
      (typeof input.price !== 'string' || !PRICE_PATTERN.test(input.price) || new Prisma.Decimal(input.price).lte(0))) {
      throw new BadRequestException({ message: 'Preco deve ser positivo, numerico e ter ate duas casas decimais.', field: 'price' });
    }
    if (input.stock !== undefined && (!Number.isInteger(input.stock) || input.stock < 0 || input.stock > MAX_PRODUCT_STOCK)) {
      throw new BadRequestException({ message: 'Estoque deve ser um inteiro nao negativo.', field: 'stock' });
    }

    const store = await this.stores.execute(ownerId);
    const current = await this.products.findByStore(store.id, productId);
    if (!current) throw new NotFoundException('Produto nao encontrado.');
    if (current.status === 'ARCHIVED') throw new ConflictException('Produto arquivado nao pode ser alterado.');

    const updated = await this.products.updateInventory(store.id, ownerId, current, input);
    if (!updated) throw new ConflictException('O produto mudou durante a atualizacao. Atualize a pagina e tente novamente.');
    return { ...updated, available: updated.status === 'ACTIVE' && updated.stock > 0 };
  }
}
