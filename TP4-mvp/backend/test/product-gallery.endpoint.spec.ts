import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { after, before, describe, it } from 'node:test';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../src/common/types/authenticated-user';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { ProductGalleryRepository } from '../src/modules/products/application/product-gallery.repository';
import { GalleryError } from '../src/modules/products/domain/gallery.error';
import { ProductGalleryService } from '../src/modules/products/application/product-gallery.service';
import { ProductGalleryController } from '../src/modules/products/presentation/product-gallery.controller';
import { UPLOAD_PROVIDER } from '../src/modules/uploads/providers/upload-provider.interface';
import { UploadsService } from '../src/modules/uploads/uploads.service';

describe('Galeria do produto (HTTP)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwt: JwtService;
  let saves = 0;
  const repository = {
    assertWritable: async (ownerId: string, productId: string) => {
      if (ownerId !== 'owner-a' || productId !== 'product-a') throw new GalleryError('NOT_FOUND');
    },
    add: async (ownerId: string, productId: string, image: any) => {
      await repository.assertWritable(ownerId, productId);
      return { id: 'image-a', url: image.url, altText: image.altText, position: 0, isCover: true };
    },
    reorder: async () => [],
    setCover: async () => [],
    remove: async () => null,
  };

  before(async () => {
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'gallery-test' })],
      controllers: [ProductGalleryController],
      providers: [
        JwtAuthGuard, RolesGuard, ProductGalleryService, UploadsService,
        { provide: ProductGalleryRepository, useValue: repository },
        { provide: UPLOAD_PROVIDER, useValue: {
          save: async (file: any, _type: string, baseUrl: string) => {
            saves++;
            return { filename: 'a.jpg', originalName: file.originalname, mimeType: file.mimetype,
              size: file.size, url: `${baseUrl}/uploads/images/a.jpg`, objectKey: 'images/a.jpg' };
          },
          remove: async () => {},
        } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
    jwt = module.get(JwtService);
  });
  after(async () => app.close());

  const token = (id: string, role: UserRole) => jwt.sign({
    id, role, email: `${id}@example.com`,
  } satisfies AuthenticatedUser);
  const upload = (path: string, authorization?: string, mime = 'image/jpeg') => {
    const form = new FormData();
    form.append('file', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0])], { type: mime }), 'photo.jpg');
    form.append('altText', '  Cimento  ');
    return fetch(`${baseUrl}/api/store-products/${path}/images`, {
      method: 'POST', headers: authorization ? { authorization: `Bearer ${authorization}` } : {}, body: form,
    });
  };

  it('exige JWT, papel LOJISTA e propriedade do produto', async () => {
    const beforeSaves = saves;
    assert.equal((await upload('product-a')).status, 401);
    assert.equal((await upload('product-a', token('client-a', UserRole.CLIENTE))).status, 403);
    assert.equal((await upload('product-a', token('owner-b', UserRole.LOJISTA))).status, 404);
    assert.equal(saves, beforeSaves);
  });

  it('persiste e associa imagem com resposta publica sem objectKey', async () => {
    const response = await upload('product-a', token('owner-a', UserRole.LOJISTA));
    assert.equal(response.status, 201);
    const image = await response.json() as any;
    assert.equal(image.altText, 'Cimento');
    assert.equal(image.isCover, true);
    assert.equal(image.position, 0);
    assert.equal('objectKey' in image, false);
  });

  it('rejeita MIME invalido e ordem duplicada', async () => {
    const owner = token('owner-a', UserRole.LOJISTA);
    assert.equal((await upload('product-a', owner, 'image/gif')).status, 400);
    const response = await fetch(`${baseUrl}/api/store-products/product-a/images/order`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${owner}`, 'content-type': 'application/json' },
      body: JSON.stringify({ imageIds: [1, 1] }),
    });
    assert.equal(response.status, 400);
  });
});
