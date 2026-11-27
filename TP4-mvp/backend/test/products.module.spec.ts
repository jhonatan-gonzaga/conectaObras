import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { it } from 'node:test';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProductGalleryController } from '../src/modules/products/presentation/product-gallery.controller';
import { ProductsController } from '../src/modules/products/products.controller';
import { ProductsModule } from '../src/modules/products/products.module';

it('registers product CRUD, inventory and gallery controllers in the application module', async () => {
  const module = await Test.createTestingModule({ imports: [ProductsModule] })
    .overrideProvider(PrismaService).useValue({}).compile();
  assert(module.get(ProductsController));
  assert(module.get(ProductGalleryController));
  await module.close();
});
