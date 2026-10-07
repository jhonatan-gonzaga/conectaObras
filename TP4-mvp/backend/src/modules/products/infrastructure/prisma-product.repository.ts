import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateProductInput, InventoryUpdateInput, ProductListQuery, ProductPage, ProductRecord, ProductRepository, ProductStatus, UpdateProductInput } from '../application/product.repository';
import { MAX_PRODUCT_IMAGES } from '../domain/gallery.policy';

export const productInclude = {
  images: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.ProductInclude;

type StoredProduct = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

@Injectable()
export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(storeId: string, input: CreateProductInput): Promise<ProductRecord> {
    const images = input.images?.map((image, index) => ({ image, index }))
      .sort((a, b) => a.image.position - b.image.position || a.index - b.index);
    if (images && images.length > MAX_PRODUCT_IMAGES) throw new RangeError('Limite de 8 imagens por produto.');
    const coverIndex = images?.findIndex(({ image }) => image.isCover) ?? -1;
    const product = await this.prisma.product.create({
      data: {
        storeId,
        categoryId: input.categoryId,
        sku: input.sku?.trim().toUpperCase() || null,
        name: input.name,
        description: input.description,
        price: this.price(input.price),
        stock: input.stock,
        images: images ? { create: images.map(({ image }, position) => ({
          url: image.url,
          objectKey: image.objectKey,
          altText: image.altText,
          position,
          isCover: position === (coverIndex < 0 ? 0 : coverIndex),
        })) } : undefined,
      },
      include: productInclude,
    });
    return this.record(product);
  }

  async findByStore(storeId: string, productId: string): Promise<ProductRecord | null> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId },
      include: productInclude,
    });
    return product ? this.record(product) : null;
  }

  async listByStore(storeId: string, status?: ProductStatus): Promise<ProductRecord[]> {
    const products = await this.prisma.product.findMany({
      where: { storeId, status },
      include: productInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return products.map((product) => this.record(product));
  }

  async listPage(storeId: string, query: ProductListQuery): Promise<ProductPage> {
    const where: Prisma.ProductWhereInput = {
      storeId,
      status: query.status,
      categoryId: query.categoryId,
      stock: query.stock === 'IN_STOCK' ? { gt: 0 } : query.stock === 'OUT_OF_STOCK' ? 0 : undefined,
      OR: query.q ? [
        { name: { contains: query.q } },
        { sku: { contains: query.q } },
      ] : undefined,
    };
    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items: products.map((product) => this.record(product)), total, page: query.page, limit: query.limit };
  }

  async categoryIsActive(categoryId: string): Promise<boolean> {
    return (await this.prisma.productCategory.count({ where: { id: categoryId, active: true } })) > 0;
  }

  async update(storeId: string, productId: string, currentStatus: ProductStatus, input: UpdateProductInput, priceChanged: boolean): Promise<boolean> {
    const result = await this.prisma.product.updateMany({
      where: { id: productId, storeId, status: currentStatus },
      data: {
        categoryId: input.categoryId,
        sku: input.sku === undefined ? undefined : input.sku?.trim().toUpperCase() || null,
        name: input.name,
        description: input.description,
        price: input.price === undefined ? undefined : this.price(input.price),
        stock: input.stock,
        lastPriceUpdateAt: priceChanged ? new Date() : undefined,
      },
    });
    return result.count === 1;
  }

  async changeStatus(storeId: string, productId: string, currentStatus: ProductStatus, status: ProductStatus): Promise<boolean> {
    const result = await this.prisma.product.updateMany({
      where: { id: productId, storeId, status: currentStatus },
      data: { status },
    });
    return result.count === 1;
  }

  async archive(storeId: string, productId: string): Promise<boolean> {
    const result = await this.prisma.product.updateMany({
      where: { id: productId, storeId, status: { not: 'ARCHIVED' } },
      data: { status: 'ARCHIVED' },
    });
    return result.count > 0;
  }

  // Price and its timestamp change atomically; equal prices do not touch the timestamp.
  async updatePrice(storeId: string, productId: string, price: string): Promise<boolean> {
    const value = this.price(price);
    const result = await this.prisma.product.updateMany({
      where: { id: productId, storeId, status: { not: 'ARCHIVED' }, price: { not: value } },
      data: { price: value, lastPriceUpdateAt: new Date() },
    });
    return result.count > 0;
  }

  async updateInventory(storeId: string, actorId: string, expected: ProductRecord, input: InventoryUpdateInput): Promise<ProductRecord | null> {
    if (expected.status === 'ARCHIVED') return null;
    const nextPrice = input.price === undefined ? undefined : this.price(input.price);
    if (input.stock !== undefined && (!Number.isInteger(input.stock) || input.stock < 0)) {
      throw new RangeError('Estoque deve ser inteiro e nao negativo.');
    }
    const priceChanged = nextPrice !== undefined && !nextPrice.eq(expected.price);
    const stockChanged = input.stock !== undefined && input.stock !== expected.stock;
    if (!priceChanged && !stockChanged) {
      const unchanged = await this.prisma.product.findFirst({
        where: {
          id: expected.id,
          storeId,
          status: expected.status,
          updatedAt: expected.updatedAt,
          price: new Prisma.Decimal(expected.price),
          stock: expected.stock,
        },
        include: productInclude,
      });
      return unchanged ? this.record(unchanged) : null;
    }

    return this.prisma.$transaction(async (transaction) => {
      const result = await transaction.product.updateMany({
        where: {
          id: expected.id,
          storeId,
          status: expected.status,
          updatedAt: expected.updatedAt,
          price: new Prisma.Decimal(expected.price),
          stock: expected.stock,
        },
        data: {
          price: priceChanged ? nextPrice : undefined,
          stock: stockChanged ? input.stock : undefined,
          lastPriceUpdateAt: priceChanged ? new Date() : undefined,
        },
      });
      if (result.count !== 1) return null;
      await transaction.productInventoryEvent.create({
        data: { productId: expected.id, storeId, actorId, priceChanged, stockChanged },
      });
      const updated = await transaction.product.findUniqueOrThrow({
        where: { id: expected.id },
        include: productInclude,
      });
      return this.record(updated);
    });
  }

  private price(value: string): Prisma.Decimal {
    if (!/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/.test(value) || new Prisma.Decimal(value).lte(0)) {
      throw new RangeError('Preco deve ser positivo, com ate oito inteiros e duas casas decimais.');
    }
    return new Prisma.Decimal(value);
  }

  private record(product: StoredProduct): ProductRecord {
    return { ...product, price: product.price.toFixed(2) };
  }
}
