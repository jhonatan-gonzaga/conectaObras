import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { Request } from 'express';
import { memoryStorage } from 'multer';
import { UploadFile, UploadType } from './providers/upload-provider.interface';

export interface UploadConfiguration {
  directory: string;
  maxFileSize: number;
  missingFileMessage: string;
  invalidFileMessage: string;
}

export const UPLOAD_CONFIG: Record<UploadType, UploadConfiguration> = {
  image: {
    directory: 'images',
    maxFileSize: 5 * 1024 * 1024,
    missingFileMessage: 'Imagem nao enviada.',
    invalidFileMessage: 'Envie apenas arquivos de imagem.',
  },
  audio: {
    directory: 'audio',
    maxFileSize: 10 * 1024 * 1024,
    missingFileMessage: 'Audio nao enviado.',
    invalidFileMessage: 'Envie apenas arquivos de audio.',
  },
};

export function validateUpload(file: UploadFile | undefined, type: UploadType): asserts file is UploadFile {
  const config = UPLOAD_CONFIG[type];
  if (!file) throw new BadRequestException(config.missingFileMessage);
  if (file.size > config.maxFileSize || file.size !== file.buffer.length) {
    throw new BadRequestException(`Arquivo excede ${config.maxFileSize / 1024 / 1024} MB ou esta incompleto.`);
  }
  if (type === 'image') {
    const jpeg = file.buffer.length >= 4 && file.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    const png = file.buffer.length >= 8 && file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (!((file.mimetype === 'image/jpeg' && jpeg) || (file.mimetype === 'image/png' && png))) {
      throw new BadRequestException(config.invalidFileMessage);
    }
  } else if (!file.mimetype.startsWith('audio/')) {
    throw new BadRequestException(config.invalidFileMessage);
  }
}

export function createUploadOptions(type: UploadType): MulterOptions {
  return {
    storage: memoryStorage(),
    limits: { fileSize: UPLOAD_CONFIG[type].maxFileSize },
    fileFilter: (_request: Request, file: Express.Multer.File, callback) => {
      const accepted = type === 'image'
        ? ['image/jpeg', 'image/png'].includes(file.mimetype)
        : file.mimetype.startsWith('audio/');
      callback(accepted ? null : new BadRequestException(UPLOAD_CONFIG[type].invalidFileMessage), accepted);
    },
  };
}
