import { Injectable } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { Request } from 'express';
import { createFileFilter, UPLOAD_CONFIG } from '../upload.config';
import {
  UploadProvider,
  UploadResponse,
  UploadType,
} from './upload-provider.interface';

@Injectable()
export class LocalUploadProvider implements UploadProvider {
  static createMulterOptions(type: UploadType): MulterOptions {
    const config = UPLOAD_CONFIG[type];

    return {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', config.directory),
        filename: (_request, file, callback) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          callback(null, `${unique}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      fileFilter: createFileFilter(type),
      limits: { fileSize: config.maxFileSize },
    };
  }

  buildResponse(
    file: Express.Multer.File,
    type: UploadType,
    request: Request,
  ): UploadResponse {
    const { directory } = UPLOAD_CONFIG[type];
    const hostUrl = `${request.protocol}://${request.get('host')}`;

    return {
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: `${hostUrl}/uploads/${directory}/${file.filename}`,
    };
  }
}
