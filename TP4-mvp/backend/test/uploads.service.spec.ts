import { strict as assert } from 'node:assert';
import { BadRequestException } from '@nestjs/common';
import { describe, it } from 'node:test';
import { Request } from 'express';
import {
  UploadProvider,
  UploadResponse,
} from '../src/modules/uploads/providers/upload-provider.interface';
import { UploadsService } from '../src/modules/uploads/uploads.service';

describe('UploadsService', () => {
  it('delega a resposta de imagem ao provedor configurado', () => {
    const expectedResponse: UploadResponse = {
      filename: 'arquivo.jpeg',
      originalName: 'perfil.jpeg',
      mimeType: 'image/jpeg',
      size: 42,
      url: 'https://api.example.com/uploads/images/arquivo.jpeg',
    };
    let receivedType: string | undefined;
    const provider: UploadProvider = {
      buildResponse: (_file, type) => {
        receivedType = type;
        return expectedResponse;
      },
    };
    const service = new UploadsService(provider);

    const result = service.uploadImage(
      {
        filename: 'arquivo.jpeg',
        originalname: 'perfil.jpeg',
        mimetype: 'image/jpeg',
        size: 42,
      } as Express.Multer.File,
      {} as Request,
    );

    assert.equal(receivedType, 'image');
    assert.deepEqual(result, expectedResponse);
  });

  it('rejeita upload sem arquivo antes de chamar o provedor', () => {
    const service = new UploadsService({
      buildResponse: () => {
        throw new Error('O provedor nao deveria ser chamado.');
      },
    });

    assert.throws(
      () => service.uploadAudio(undefined as unknown as Express.Multer.File, {} as Request),
      (error: unknown) =>
        error instanceof BadRequestException && error.message === 'Audio nao enviado.',
    );
  });
});
