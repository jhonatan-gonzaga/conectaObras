import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpsertMyStoreDto } from './dto/upsert-my-store.dto';
import { StoresService } from './stores.service';

@Controller('stores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.LOJISTA)
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get('me')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.storesService.findMine(user.id);
  }

  @Put('me')
  upsertMine(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertMyStoreDto,
  ) {
    return this.storesService.upsertMine(user.id, dto);
  }
}
