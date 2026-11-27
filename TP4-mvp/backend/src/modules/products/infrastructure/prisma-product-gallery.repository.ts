import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { GalleryImage, ProductGalleryRepository, StoredProductImage } from '../application/product-gallery.repository';
import { GalleryError } from '../domain/gallery.error';
import { assertCanAdd, assertExactOrder, coverAfterRemoval } from '../domain/gallery.policy';

type Transaction = Prisma.TransactionClient;

@Injectable()
export class PrismaProductGalleryRepository implements ProductGalleryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async assertWritable(ownerId: string, productId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, store: { ownerId }, status: { not: 'ARCHIVED' } },
      select: { id: true },
    });
    if (!product) throw new GalleryError('NOT_FOUND');
  }

  async add(ownerId: string, productId: string, image: StoredProductImage): Promise<GalleryImage> {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, ownerId, productId);
      const count = await tx.productImage.count({ where: { productId } });
      assertCanAdd(count);
      return this.response(await tx.productImage.create({
        data: { productId, ...image, position: count, isCover: count === 0 },
      }));
    });
  }

  async reorder(ownerId: string, productId: string, imageIds: string[]): Promise<GalleryImage[]> {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, ownerId, productId);
      const images = await this.list(tx, productId);
      assertExactOrder(images.map((image) => image.id), imageIds);
      for (let position = 0; position < imageIds.length; position++) {
        await tx.productImage.update({ where: { id: imageIds[position] }, data: { position } });
      }
      return this.listResponse(tx, productId);
    });
  }

  async setCover(ownerId: string, productId: string, imageId: string): Promise<GalleryImage[]> {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, ownerId, productId);
      const images = await this.list(tx, productId);
      if (!images.some((image) => image.id === imageId)) throw new GalleryError('IMAGE_NOT_FOUND');
      await tx.productImage.updateMany({ where: { productId }, data: { isCover: false } });
      await tx.productImage.update({ where: { id: imageId }, data: { isCover: true } });
      return this.listResponse(tx, productId);
    });
  }

  async remove(ownerId: string, productId: string, imageId: string): Promise<string | null> {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, ownerId, productId);
      const images = await this.list(tx, productId);
      const coverId = coverAfterRemoval(images, imageId);
      const removed = images.find((image) => image.id === imageId)!;
      await tx.productImage.delete({ where: { id: imageId } });
      const remaining = images.filter((image) => image.id !== imageId);
      for (let position = 0; position < remaining.length; position++) {
        await tx.productImage.update({
          where: { id: remaining[position].id },
          data: { position, isCover: remaining[position].id === coverId },
        });
      }
      if (!removed.objectKey) return null;
      const references = await tx.productImage.count({ where: { objectKey: removed.objectKey } });
      return references === 0 ? removed.objectKey : null;
    });
  }

  private async lock(tx: Transaction, ownerId: string, productId: string): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT p.id FROM products p
      INNER JOIN store_profiles s ON s.id = p.storeId
      WHERE p.id = ${productId} AND s.ownerId = ${ownerId} AND p.status <> 'ARCHIVED'
      FOR UPDATE
    `);
    if (!rows.length) throw new GalleryError('NOT_FOUND');
  }

  private list(tx: Transaction, productId: string) {
    return tx.productImage.findMany({ where: { productId }, orderBy: [{ position: 'asc' }, { id: 'asc' }] });
  }

  private async listResponse(tx: Transaction, productId: string): Promise<GalleryImage[]> {
    return (await this.list(tx, productId)).map((image) => this.response(image));
  }

  private response(image: { id: string; url: string; altText: string | null; position: number; isCover: boolean }): GalleryImage {
    return { id: image.id, url: image.url, altText: image.altText, position: image.position, isCover: image.isCover };
  }
}
