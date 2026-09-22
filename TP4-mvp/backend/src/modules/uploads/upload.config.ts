import { BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { UploadType } from './providers/upload-provider.interface';

export interface UploadConfiguration {
  directory: string;
  maxFileSize: number;
  mimeTypePrefix: string;
  missingFileMessage: string;
  invalidFileMessage: string;
}

export const UPLOAD_CONFIG: Record<UploadType, UploadConfiguration> = {
  image: {
    directory: 'images',
    maxFileSize: 5 * 1024 * 1024,
    mimeTypePrefix: 'image/',
    missingFileMessage: 'Imagem nao enviada.',
    invalidFileMessage: 'Envie apenas arquivos de imagem.',
  },
  audio: {
    directory: 'audio',
    maxFileSize: 10 * 1024 * 1024,
    mimeTypePrefix: 'audio/',
    missingFileMessage: 'Audio nao enviado.',
    invalidFileMessage: 'Envie apenas arquivos de audio.',
  },
};

export function createFileFilter(type: UploadType) {
  const { invalidFileMessage, mimeTypePrefix } = UPLOAD_CONFIG[type];

  return (
    _request: Request,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!file.mimetype.startsWith(mimeTypePrefix)) {
      callback(new BadRequestException(invalidFileMessage), false);
      return;
    }

    callback(null, true);
  };
}
