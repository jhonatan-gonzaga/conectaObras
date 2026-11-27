import { strict as assert } from 'node:assert';
import { BadRequestException } from '@nestjs/common';
import { describe, it } from 'node:test';
import { UploadFile, UploadProvider, UploadResponse } from '../src/modules/uploads/providers/upload-provider.interface';
import { UploadsService } from '../src/modules/uploads/uploads.service';

const jpeg: UploadFile = {
  originalname: 'foto.txt', mimetype: 'image/jpeg',
  buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), size: 4,
};

describe('UploadsService', () => {
  it('persiste bytes pelo provider, sem depender da extensao', async () => {
    const expected: UploadResponse = {
      filename: 'arquivo.jpg', originalName: 'foto.txt', mimeType: 'image/jpeg',
      size: 4, url: 'https://api.example.com/uploads/images/arquivo.jpg', objectKey: 'images/arquivo.jpg',
    };
    let received: unknown;
    const provider: UploadProvider = {
      save: async (file, type, baseUrl) => {
        received = { file, type, baseUrl };
        return expected;
      },
      remove: async () => {},
    };
    const result = await new UploadsService(provider).uploadImage(jpeg, 'https://api.example.com');
    assert.deepEqual(received, { file: jpeg, type: 'image', baseUrl: 'https://api.example.com' });
    assert.deepEqual(result, expected);
  });

  it('rejeita arquivo ausente, MIME falso, assinatura falsa e tamanho acima de 5 MB', async () => {
    let calls = 0;
    const service = new UploadsService({
      save: async () => { calls++; throw new Error('Nao deveria persistir.'); },
      remove: async () => {},
    });
    for (const file of [
      undefined,
      { ...jpeg, mimetype: 'image/gif' },
      { ...jpeg, buffer: Buffer.from('fake'), size: 4 },
      { ...jpeg, size: 5 * 1024 * 1024 + 1 },
    ]) {
      assert.throws(() => service.uploadImage(file, 'http://localhost'), BadRequestException);
    }
    assert.equal(calls, 0);
  });

  it('aceita PNG pela assinatura e MIME correspondentes', async () => {
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const service = new UploadsService({
      save: async (file) => ({ filename: 'x.png', originalName: file.originalname, mimeType: file.mimetype,
        size: file.size, url: '/x.png', objectKey: 'images/x.png' }),
      remove: async () => {},
    });
    assert.equal((await service.uploadImage({ ...jpeg, mimetype: 'image/png', buffer: png, size: png.length }, '')).mimeType, 'image/png');
  });
});
