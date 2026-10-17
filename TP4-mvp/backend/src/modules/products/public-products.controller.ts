import { Controller, Get, Param, Query } from '@nestjs/common';
import { PublicProductsService } from './public-products.service';
import { PublicProductsQueryDto } from './dto/public-products-query.dto';

@Controller('products')
export class PublicProductsController {
  constructor(private readonly products: PublicProductsService) {}

  @Get()
  list(@Query() query: PublicProductsQueryDto) {
    return this.products.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.products.get(id);
  }
}
