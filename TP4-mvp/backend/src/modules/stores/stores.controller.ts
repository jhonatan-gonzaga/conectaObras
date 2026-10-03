import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { LocalUploadProvider } from '../uploads/providers/local-upload.provider';
import { UPLOAD_PROVIDER, UploadProvider } from '../uploads/providers/upload-provider.interface';
import { ChangeStoreStatusDto } from './dto/change-store-status.dto';
import { UpsertMyStoreDto } from './dto/upsert-my-store.dto';
import { ChangeStoreStatusUseCase } from './application/use-cases/change-store-status.use-case';
import { GetMyStoreUseCase } from './application/use-cases/get-my-store.use-case';
import { SaveStoreProfileUseCase } from './application/use-cases/save-store-profile.use-case';
import { SetStoreLogoUseCase } from './application/use-cases/set-store-logo.use-case';
import { StoreDashboardList, StoreDashboardService } from './store-dashboard.service';
import { CreateStorePromotionDto } from './dto/create-store-promotion.dto';
import { CreateStoreOrderDto } from './dto/create-store-order.dto';
import { ChangeStoreOrderStatusDto } from './dto/change-store-order-status.dto';

@Controller('stores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.LOJISTA)
export class StoresController {
  constructor(
    private readonly getMyStore: GetMyStoreUseCase,
    private readonly saveStoreProfile: SaveStoreProfileUseCase,
    private readonly changeStoreStatus: ChangeStoreStatusUseCase,
    private readonly setStoreLogo: SetStoreLogoUseCase,
    private readonly dashboard: StoreDashboardService,
    @Inject(UPLOAD_PROVIDER) private readonly uploadProvider: UploadProvider,
  ) {}

  @Get('me')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.getMyStore.execute(user.id);
  }

  @Get('me/dashboard')
  dashboardSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.summary(user.id);
  }

  @Get('me/dashboard/:kind')
  dashboardList(@CurrentUser() user: AuthenticatedUser, @Param('kind') kind: string, @Query('status') status?: string) {
    const allowed: StoreDashboardList[] = ['active-products', 'low-stock', 'promotions', 'orders', 'messages'];
    if (!allowed.includes(kind as StoreDashboardList)) throw new BadRequestException('Filtro de painel invalido.');
    if (status && !['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELED'].includes(status)) throw new BadRequestException('Status de pedido invalido.');
    return this.dashboard.list(user.id, kind as StoreDashboardList, status);
  }

  @Post('me/promotions')
  createPromotion(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStorePromotionDto) {
    return this.dashboard.createPromotion(user.id, dto);
  }

  @Post('me/orders')
  createOrder(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStoreOrderDto) {
    return this.dashboard.createOrder(user.id, dto);
  }

  @Patch('me/orders/:id/status')
  changeOrderStatus(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ChangeStoreOrderStatusDto) {
    return this.dashboard.changeOrderStatus(user.id, id, dto.status);
  }

  @Put('me')
  upsertMine(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertMyStoreDto,
  ) {
    return this.saveStoreProfile.execute(user.id, dto);
  }

  @Get('me/activation-readiness')
  activationReadiness(@CurrentUser() user: AuthenticatedUser) {
    return this.changeStoreStatus.readiness(user.id);
  }

  @Patch('me/status')
  changeMineStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangeStoreStatusDto,
  ) {
    return this.changeStoreStatus.execute(user.id, dto.status);
  }

  @Post('me/logo')
  @UseInterceptors(
    FileInterceptor('file', LocalUploadProvider.createMulterOptions('image')),
  )
  async uploadLogo(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Req() request: Request,
  ) {
    if (!file) throw new BadRequestException('Envie um arquivo de imagem.');
    const upload = this.uploadProvider.buildResponse(file, 'image', request);
    return this.setStoreLogo.execute(user.id, upload.url);
  }
}
