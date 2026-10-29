import { Body, Controller, Get, Param, Patch, Put, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ChangeStoreOrderStatusDto } from './dto/change-store-order-status.dto';
import { ChangeDeliveryStatusDto } from './dto/change-delivery-status.dto';
import { StoreOrdersQueryDto } from './dto/store-orders-query.dto';
import { UpsertDeliveryDto } from './dto/upsert-delivery.dto';
import { StoreOrdersService } from './store-orders.service';

@Controller('store-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.LOJISTA)
export class StoreOrdersController {
  constructor(private readonly orders: StoreOrdersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: StoreOrdersQueryDto) {
    return query.page !== undefined || query.limit !== undefined
      ? this.orders.listPage(user.id, query)
      : this.orders.list(user.id, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.orders.get(user.id, id);
  }

  @Patch(':id/status')
  changeStatus(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ChangeStoreOrderStatusDto) {
    return this.orders.changeStatus(user.id, id, dto.status);
  }

  @Put(':id/delivery')
  upsertDelivery(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpsertDeliveryDto) {
    return this.orders.upsertDelivery(user.id, id, dto);
  }

  @Patch(':id/delivery/status')
  changeDeliveryStatus(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ChangeDeliveryStatusDto) {
    return this.orders.changeDeliveryStatus(user.id, id, dto.status);
  }
}
