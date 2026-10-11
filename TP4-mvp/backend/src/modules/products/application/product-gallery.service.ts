import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { UploadFile } from '../../uploads/providers/upload-provider.interface';
import { validateUpload } from '../../uploads/upload.config';
import { UploadsService } from '../../uploads/uploads.service';
import { GalleryError } from '../domain/gallery.error';
import { ProductGalleryRepository } from './product-gallery.repository';

@Injectable()
export class ProductGalleryService {
  private readonly logger = new Logger(ProductGalleryService.name);

  constructor(
    private readonly gallery: ProductGalleryRepository,
    private readonly uploads: UploadsService,
  ) {}

  async add(ownerId: string, productId: string, file: UploadFile | undefined, publicBaseUrl: string, altText?: string) {
    validateUpload(file, 'image');
    try {
      await this.gallery.assertWritable(ownerId, productId);
    } catch (error) {
      throw this.httpError(error);
    }
    const upload = await this.uploads.uploadImage(file, publicBaseUrl);
    try {
      return await this.gallery.add(ownerId, productId, {
        url: upload.url,
        objectKey: upload.objectKey,
        altText: altText?.trim() || null,
      });
    } catch (error) {
      try {
        await this.uploads.remove(upload.objectKey);
      } catch (cleanupError) {
        this.logger.warn(`Upload orfao para reconciliacao: ${upload.objectKey}; ${String(cleanupError)}`);
      }
      throw this.httpError(error);
    }
  }

  async reorder(ownerId: string, productId: string, imageIds: string[]) {
    try {
      return await this.gallery.reorder(ownerId, productId, imageIds);
    } catch (error) {
      throw this.httpError(error);
    }
  }

  async setCover(ownerId: string, productId: string, imageId: string) {
    try {
      return await this.gallery.setCover(ownerId, productId, imageId);
    } catch (error) {
      throw this.httpError(error);
    }
  }

  async remove(ownerId: string, productId: string, imageId: string): Promise<void> {
    let objectKey: string | null;
    try {
      objectKey = await this.gallery.remove(ownerId, productId, imageId);
    } catch (error) {
      throw this.httpError(error);
    }
    if (objectKey) {
      try {
        await this.uploads.remove(objectKey);
      } catch (error) {
        this.logger.warn(`Upload orfao para reconciliacao: ${objectKey}; ${String(error)}`);
      }
    }
  }

  private httpError(error: unknown): unknown {
    if (!(error instanceof GalleryError)) return error;
    if (error.reason === 'NOT_FOUND' || error.reason === 'IMAGE_NOT_FOUND') {
      return new NotFoundException('Produto ou imagem nao encontrado nesta loja.');
    }
    if (error.reason === 'LIMIT') return new ConflictException('Limite de 8 imagens por produto.');
    return new BadRequestException('A ordem deve conter exatamente todas as imagens do produto uma vez.');
  }
}
