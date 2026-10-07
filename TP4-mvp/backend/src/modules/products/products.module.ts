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
import { StoresModule } from '../stores/stores.module';
import { ProductUseCases } from './application/product.use-cases';
import { ProductsController } from './products.controller';
import { UpdateInventoryUseCase } from './application/update-inventory.use-case';

@Module({
  imports: [PrismaModule, AuthModule, UploadsModule, StoresModule],
  controllers: [ProductsController, ProductGalleryController],
  providers: [
    { provide: ProductRepository, useClass: PrismaProductRepository },
    ProductUseCases,
    UpdateInventoryUseCase,
    { provide: ProductGalleryRepository, useClass: PrismaProductGalleryRepository },
    ProductGalleryService,
  ],
  exports: [ProductRepository],
})
export class ProductsModule {}
