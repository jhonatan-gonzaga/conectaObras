import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateProductInput, ProductRecord, ProductRepository, ProductStatus } from '../application/product.repository';
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

  async archive(storeId: string, productId: string): Promise<boolean> {
    const result = await this.prisma.product.updateMany({
      where: { id: productId, storeId },
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
