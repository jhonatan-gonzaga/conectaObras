import { Inject, Injectable } from '@nestjs/common';
import { validateUpload } from './upload.config';
import {
  UPLOAD_PROVIDER,
  UploadFile,
  UploadProvider,
  UploadType,
} from './providers/upload-provider.interface';

@Injectable()
export class UploadsService {
  constructor(
    @Inject(UPLOAD_PROVIDER)
    private readonly uploadProvider: UploadProvider,
  ) {}

  uploadImage(file: UploadFile | undefined, publicBaseUrl: string) {
    return this.upload(file, 'image', publicBaseUrl);
  }

  uploadAudio(file: UploadFile | undefined, publicBaseUrl: string) {
    return this.upload(file, 'audio', publicBaseUrl);
  }

  remove(objectKey: string) {
    return this.uploadProvider.remove(objectKey);
  }

  private upload(file: UploadFile | undefined, type: UploadType, publicBaseUrl: string) {
    validateUpload(file, type);
    return this.uploadProvider.save(file, type, publicBaseUrl);
  }
}
