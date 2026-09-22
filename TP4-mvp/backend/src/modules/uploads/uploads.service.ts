import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { UPLOAD_CONFIG } from './upload.config';
import {
  UPLOAD_PROVIDER,
  UploadProvider,
  UploadType,
} from './providers/upload-provider.interface';

@Injectable()
export class UploadsService {
  constructor(
    @Inject(UPLOAD_PROVIDER)
    private readonly uploadProvider: UploadProvider,
  ) {}

  uploadImage(file: Express.Multer.File, request: Request) {
    return this.upload(file, 'image', request);
  }

  uploadAudio(file: Express.Multer.File, request: Request) {
    return this.upload(file, 'audio', request);
  }

  private upload(
    file: Express.Multer.File,
    type: UploadType,
    request: Request,
  ) {
    if (!file) {
      throw new BadRequestException(UPLOAD_CONFIG[type].missingFileMessage);
    }

    return this.uploadProvider.buildResponse(file, type, request);
  }
}
