import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { PrismaService } from '../src/prisma/prisma.service';
import { GalleryError } from '../src/modules/products/domain/gallery.error';
import { PrismaProductGalleryRepository } from '../src/modules/products/infrastructure/prisma-product-gallery.repository';

type Image = {
  id: string; productId: string; url: string; objectKey: string | null;
  altText: string | null; position: number; isCover: boolean;
};

function setup() {
  const images: Image[] = [];
  let sequence = 0;
  let transactions = 0;
  const tx = {
    $queryRaw: async (query: { values: string[] }) =>
      query.values[0] === 'product-a' && query.values[1] === 'owner-a' ? [{ id: 'product-a' }] : [],
    productImage: {
      count: async ({ where }: any) => where.objectKey
        ? images.filter((image) => image.objectKey === where.objectKey).length
        : images.length,
      create: async ({ data }: any) => {
        const image = { ...data, id: `image-${++sequence}` };
        images.push(image);
        return image;
      },
      findMany: async () => [...images].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)),
      update: async ({ where, data }: any) => {
        const image = images.find((item) => item.id === where.id)!;
        Object.assign(image, data);
        return image;
      },
      updateMany: async ({ data }: any) => {
        images.forEach((image) => Object.assign(image, data));
        return { count: images.length };
      },
      delete: async ({ where }: any) => {
        images.splice(images.findIndex((image) => image.id === where.id), 1);
      },
    },
  };
  const prisma = {
    product: { findFirst: async ({ where }: any) =>
      where.id === 'product-a' && where.store.ownerId === 'owner-a' ? { id: 'product-a' } : null },
    $transaction: async (callback: any) => { transactions++; return callback(tx); },
  };
  return { repository: new PrismaProductGalleryRepository(prisma as unknown as PrismaService), images, get transactions() { return transactions; } };
}

describe('Galeria do produto (adapter Prisma)', () => {
  it('verifica propriedade antes de escrita e dentro da transacao', async () => {
    const { repository, images } = setup();
    await assert.rejects(repository.assertWritable('owner-b', 'product-a'), (error: unknown) =>
      error instanceof GalleryError && error.reason === 'NOT_FOUND');
    await assert.rejects(repository.add('owner-b', 'product-a', { url: '/a', objectKey: 'a', altText: null }), GalleryError);
    assert.equal(images.length, 0);
  });

  it('limita a oito imagens, define uma capa e reordena com posicoes deterministicas', async () => {
    const fixture = setup();
    const { repository, images } = fixture;
    for (let index = 0; index < 8; index++) {
      const image = await repository.add('owner-a', 'product-a', {
        url: `/image-${index}`, objectKey: `images/${index}`, altText: null,
      });
      assert.equal(image.position, index);
      assert.equal(image.isCover, index === 0);
    }
    await assert.rejects(repository.add('owner-a', 'product-a', {
      url: '/ninth', objectKey: 'images/ninth', altText: null,
    }), (error: unknown) => error instanceof GalleryError && error.reason === 'LIMIT');
    assert.equal(images.length, 8);
    await assert.rejects(repository.reorder('owner-a', 'product-a', ['image-1', 'image-1']), GalleryError);
    const reversed = images.map((image) => image.id).reverse();
    const ordered = await repository.reorder('owner-a', 'product-a', reversed);
    assert.deepEqual(ordered.map((image) => image.id), reversed);
    assert.deepEqual(ordered.map((image) => image.position), [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.equal(ordered.filter((image) => image.isCover).length, 1);
    assert(fixture.transactions >= 10);
  });

  it('troca a capa e promove a primeira restante quando ela e removida', async () => {
    const { repository, images } = setup();
    const first = await repository.add('owner-a', 'product-a', { url: '/a', objectKey: 'images/a', altText: null });
    const second = await repository.add('owner-a', 'product-a', { url: '/b', objectKey: 'images/b', altText: null });
    const third = await repository.add('owner-a', 'product-a', { url: '/c', objectKey: 'images/c', altText: null });
    const covered = await repository.setCover('owner-a', 'product-a', third.id);
    assert.deepEqual(covered.filter((image) => image.isCover).map((image) => image.id), [third.id]);
    await assert.rejects(repository.setCover('owner-a', 'product-a', 'foreign'), GalleryError);
    assert.equal(await repository.remove('owner-a', 'product-a', third.id), 'images/c');
    assert.deepEqual(images.map((image) => [image.id, image.position, image.isCover]), [
      [first.id, 0, true], [second.id, 1, false],
    ]);
    await assert.rejects(repository.remove('owner-a', 'product-a', 'foreign'), GalleryError);
  });

  it('preserva objeto ainda referenciado por outra imagem', async () => {
    const { repository } = setup();
    const first = await repository.add('owner-a', 'product-a', { url: '/shared', objectKey: 'images/shared', altText: null });
    await repository.add('owner-a', 'product-a', { url: '/shared', objectKey: 'images/shared', altText: null });
    assert.equal(await repository.remove('owner-a', 'product-a', first.id), null);
  });
});
