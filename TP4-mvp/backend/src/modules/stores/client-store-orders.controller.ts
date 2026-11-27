import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateClientStoreOrderDto } from './dto/create-client-store-order.dto';
import { StoreDashboardService } from './store-dashboard.service';
import { StoreOrdersService } from './store-orders.service';
import { StoreOrdersQueryDto } from './dto/store-orders-query.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENTE)
export class ClientStoreOrdersController {
  constructor(private readonly orders: StoreDashboardService, private readonly tracking: StoreOrdersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: StoreOrdersQueryDto) {
    return this.tracking.listClient(user.id, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tracking.getClient(user.id, id);
  }

  @Get(':id/items/:itemId')
  getItem(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('itemId') itemId: string) {
    return this.tracking.getClientItem(user.id, id, itemId);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateClientStoreOrderDto) {
    return this.orders.createClientOrder(user.id, dto);
  }
}
