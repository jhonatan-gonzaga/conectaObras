import { Module } from '@nestjs/common';
import { LocalUploadProvider } from './providers/local-upload.provider';
import { UPLOAD_PROVIDER } from './providers/upload-provider.interface';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  controllers: [UploadsController],
  providers: [
    UploadsService,
    LocalUploadProvider,
    { provide: UPLOAD_PROVIDER, useExisting: LocalUploadProvider },
  ],
})
export class UploadsModule {}
