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
import { LocalUploadProvider } from '../uploads/providers/local-upload.provider';
import { UPLOAD_PROVIDER } from '../uploads/providers/upload-provider.interface';
import { StoreDashboardService } from './store-dashboard.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [StoresController],
  providers: [
    GetMyStoreUseCase,
    SaveStoreProfileUseCase,
    ChangeStoreStatusUseCase,
    SetStoreImageUseCase,
    StoreDashboardService,
    PrismaStoreRepository,
    { provide: STORE_REPOSITORY, useExisting: PrismaStoreRepository },
    LocalUploadProvider,
    { provide: UPLOAD_PROVIDER, useExisting: LocalUploadProvider },
  ],
  exports: [GetMyStoreUseCase, SaveStoreProfileUseCase, ChangeStoreStatusUseCase],
})
export class StoresModule {}
