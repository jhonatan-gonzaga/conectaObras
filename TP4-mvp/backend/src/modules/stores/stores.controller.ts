import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Patch,
  Post,
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

@Controller('stores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.LOJISTA)
export class StoresController {
  constructor(
    private readonly getMyStore: GetMyStoreUseCase,
    private readonly saveStoreProfile: SaveStoreProfileUseCase,
    private readonly changeStoreStatus: ChangeStoreStatusUseCase,
    private readonly setStoreLogo: SetStoreLogoUseCase,
    @Inject(UPLOAD_PROVIDER) private readonly uploadProvider: UploadProvider,
  ) {}

  @Get('me')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.getMyStore.execute(user.id);
  }

  @Put('me')
  upsertMine(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertMyStoreDto,
  ) {
    return this.saveStoreProfile.execute(user.id, dto);
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
