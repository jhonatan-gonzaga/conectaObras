import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { StoresController } from './stores.controller';
import { STORE_REPOSITORY } from './application/store.repository';
import { ChangeStoreStatusUseCase } from './application/use-cases/change-store-status.use-case';
import { GetMyStoreUseCase } from './application/use-cases/get-my-store.use-case';
import { SaveStoreProfileUseCase } from './application/use-cases/save-store-profile.use-case';
import { SetStoreImageUseCase } from './application/use-cases/set-store-image.use-case';
import { PrismaStoreRepository } from './infrastructure/prisma-store.repository';
import { UploadsModule } from '../uploads/uploads.module';
import { StoreDashboardService } from './store-dashboard.service';
import { StorePromotionsController } from './store-promotions.controller';
import { PublicStoresController } from './public-stores.controller';
import { PublicStoresService } from './public-stores.service';

@Module({
  imports: [PrismaModule, AuthModule, UploadsModule],
  controllers: [StoresController, StorePromotionsController, PublicStoresController],
  providers: [
    GetMyStoreUseCase,
    SaveStoreProfileUseCase,
    ChangeStoreStatusUseCase,
    SetStoreImageUseCase,
    StoreDashboardService,
    PublicStoresService,
    PrismaStoreRepository,
    { provide: STORE_REPOSITORY, useExisting: PrismaStoreRepository },
  ],
  exports: [GetMyStoreUseCase, SaveStoreProfileUseCase, ChangeStoreStatusUseCase],
})
export class StoresModule {}
