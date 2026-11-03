import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateStoreReviewDto } from './dto/create-store-review.dto';
import { StoreReviewsQueryDto } from './dto/store-reviews-query.dto';
import { StoreReviewsService } from './store-reviews.service';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENTE)
export class ClientStoreReviewsController {
  constructor(private readonly reviews: StoreReviewsService) {}

  @Post(':orderId/review')
  create(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string, @Body() dto: CreateStoreReviewDto) {
    return this.reviews.create(user.id, orderId, dto);
  }
}

@Controller('stores/me/reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.LOJISTA)
export class OwnerStoreReviewsController {
  constructor(private readonly reviews: StoreReviewsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: StoreReviewsQueryDto) {
    return this.reviews.listMine(user.id, query);
  }
}

@Controller('stores/:storeId/reviews')
export class PublicStoreReviewsController {
  constructor(private readonly reviews: StoreReviewsService) {}

  @Get()
  list(@Param('storeId') storeId: string, @Query() query: StoreReviewsQueryDto) {
    return this.reviews.listPublic(storeId, query);
  }
}
