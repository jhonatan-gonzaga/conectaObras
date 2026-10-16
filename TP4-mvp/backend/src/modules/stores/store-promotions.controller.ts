import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreatePromotionRequestDto, PromotionEnabledRequestDto, UpdatePromotionRequestDto } from './dto/store-promotion-request.dto';
import { PromotionStatus, StoreDashboardService } from './store-dashboard.service';

@Controller('store-promotions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.LOJISTA)
export class StorePromotionsController {
  constructor(private readonly promotions: StoreDashboardService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePromotionRequestDto) {
    return this.promotions.createPromotion(user.id, {
      ...dto,
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
    });
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('status') status?: string) {
    if (status && !['CURRENT', 'SCHEDULED', 'ENDED'].includes(status)) {
      throw new BadRequestException('Status de promoção inválido.');
    }
    return this.promotions.listPromotions(user.id, status as PromotionStatus | undefined);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdatePromotionRequestDto) {
    return this.promotions.updatePromotion(user.id, id, {
      ...dto,
      startAt: dto.startAt === undefined ? undefined : new Date(dto.startAt),
      endAt: dto.endAt === undefined ? undefined : new Date(dto.endAt),
    });
  }

  @Patch(':id/enabled')
  setEnabled(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: PromotionEnabledRequestDto) {
    return this.promotions.setPromotionEnabled(user.id, id, dto.enabled);
  }
}
