import { Controller, Get, Param, Query } from '@nestjs/common';
import { PublicStoresQueryDto } from './dto/public-stores-query.dto';
import { PublicStoresService } from './public-stores.service';

@Controller('stores')
export class PublicStoresController {
  constructor(private readonly stores: PublicStoresService) {}

  @Get()
  list(@Query() query: PublicStoresQueryDto) {
    return this.stores.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.stores.get(id);
  }
}
