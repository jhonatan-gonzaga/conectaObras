import { Controller, Get, Param } from '@nestjs/common';
import { PublicProductsService } from './public-products.service';

@Controller('products')
export class PublicProductsController {
  constructor(private readonly products: PublicProductsService) {}

  @Get()
  list() {
    return this.products.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.products.get(id);
  }
}
