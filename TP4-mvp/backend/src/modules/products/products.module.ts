import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProductRepository } from './application/product.repository';
import { PrismaProductRepository } from './infrastructure/prisma-product.repository';

@Module({
  imports: [PrismaModule],
  providers: [{ provide: ProductRepository, useClass: PrismaProductRepository }],
  exports: [ProductRepository],
})
export class ProductsModule {}
