import { Controller, Get } from '@nestjs/common';
import { ProductCategoriesService } from './product-categories.service';

@Controller('product-categories')
export class ProductCategoriesController {
  constructor(private readonly productCategoriesService: ProductCategoriesService) {}

  @Get()
  findAll() {
    return this.productCategoriesService.findAllActive();
  }
}
