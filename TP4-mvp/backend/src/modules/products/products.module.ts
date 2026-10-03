import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProductRepository } from './application/product.repository';
import { PrismaProductRepository } from './infrastructure/prisma-product.repository';
import { StoresModule } from '../stores/stores.module';
import { ProductUseCases } from './application/product.use-cases';
import { ProductsController } from './products.controller';

@Module({
  imports: [PrismaModule, StoresModule],
  controllers: [ProductsController],
  providers: [ProductUseCases, { provide: ProductRepository, useClass: PrismaProductRepository }],
  exports: [ProductRepository],
})
export class ProductsModule {}
