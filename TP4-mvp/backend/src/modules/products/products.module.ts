import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProductRepository } from './application/product.repository';
import { PrismaProductRepository } from './infrastructure/prisma-product.repository';
import { AuthModule } from '../auth/auth.module';
import { UploadsModule } from '../uploads/uploads.module';
import { ProductGalleryRepository } from './application/product-gallery.repository';
import { ProductGalleryService } from './application/product-gallery.service';
import { PrismaProductGalleryRepository } from './infrastructure/prisma-product-gallery.repository';
import { ProductGalleryController } from './presentation/product-gallery.controller';

@Module({
  imports: [PrismaModule, AuthModule, UploadsModule],
  controllers: [ProductGalleryController],
  providers: [
    { provide: ProductRepository, useClass: PrismaProductRepository },
    { provide: ProductGalleryRepository, useClass: PrismaProductGalleryRepository },
    ProductGalleryService,
  ],
  exports: [ProductRepository],
})
export class ProductsModule {}
