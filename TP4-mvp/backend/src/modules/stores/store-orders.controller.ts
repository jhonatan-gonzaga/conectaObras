import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateStoreOrderDto } from './dto/create-store-order.dto';
import { StoreDashboardService } from './store-dashboard.service';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENTE)
export class StoreOrdersController {
  constructor(private readonly orders: StoreDashboardService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStoreOrderDto) {
    return this.orders.createOrder(user.id, dto);
  }
}
