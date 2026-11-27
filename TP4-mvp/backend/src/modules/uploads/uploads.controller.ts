import {
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { createUploadOptions } from './upload.config';
import { UploadsService } from './uploads.service';

@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', createUploadOptions('image')),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File, @Req() request: Request) {
    return this.uploadsService.uploadImage(file, `${request.protocol}://${request.get('host')}`);
  }

  @Post('audio')
  @UseInterceptors(
    FileInterceptor('file', createUploadOptions('audio')),
  )
  uploadAudio(@UploadedFile() file: Express.Multer.File, @Req() request: Request) {
    return this.uploadsService.uploadAudio(file, `${request.protocol}://${request.get('host')}`);
  }
}
