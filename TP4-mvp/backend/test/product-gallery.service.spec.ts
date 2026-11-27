import { strict as assert } from 'node:assert';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, it } from 'node:test';
import { ProductGalleryRepository } from '../src/modules/products/application/product-gallery.repository';
import { GalleryError } from '../src/modules/products/domain/gallery.error';
import { ProductGalleryService } from '../src/modules/products/application/product-gallery.service';
import { UploadsService } from '../src/modules/uploads/uploads.service';

const file = { originalname: 'a.jpg', mimetype: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), size: 4 };

describe('ProductGalleryService', () => {
  it('remove upload persistido se a associacao falha por limite', async () => {
    const removed: string[] = [];
    const uploads = {
      uploadImage: async () => ({ url: '/a.jpg', objectKey: 'images/a.jpg' }),
      remove: async (key: string) => { removed.push(key); },
    } as unknown as UploadsService;
    const gallery = {
      assertWritable: async () => {},
      add: async () => { throw new GalleryError('LIMIT'); },
    } as unknown as ProductGalleryRepository;
    const service = new ProductGalleryService(gallery, uploads);
    await assert.rejects(service.add('owner-a', 'product-a', file, 'http://localhost'), ConflictException);
    assert.deepEqual(removed, ['images/a.jpg']);
  });

  it('nao persiste bytes antes de verificar propriedade', async () => {
    let saved = false;
    const uploads = {
      uploadImage: async () => { saved = true; throw new Error('unexpected'); },
    } as unknown as UploadsService;
    const gallery = {
      assertWritable: async () => { throw new GalleryError('NOT_FOUND'); },
    } as unknown as ProductGalleryRepository;
    const service = new ProductGalleryService(gallery, uploads);
    await assert.rejects(service.add('owner-b', 'product-a', file, 'http://localhost'), NotFoundException);
    assert.equal(saved, false);
  });

  it('remove objeto apenas apos transacao de exclusao ter concluido', async () => {
    const calls: string[] = [];
    const uploads = { remove: async () => { calls.push('storage'); } } as unknown as UploadsService;
    const gallery = { remove: async () => { calls.push('database'); return 'images/a.jpg'; } } as unknown as ProductGalleryRepository;
    await new ProductGalleryService(gallery, uploads).remove('owner-a', 'product-a', 'image-a');
    assert.deepEqual(calls, ['database', 'storage']);
  });
});
