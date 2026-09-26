import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { StoresController } from './stores.controller';
import { STORE_REPOSITORY } from './application/store.repository';
import { ChangeStoreStatusUseCase } from './application/use-cases/change-store-status.use-case';
import { GetMyStoreUseCase } from './application/use-cases/get-my-store.use-case';
import { SaveStoreProfileUseCase } from './application/use-cases/save-store-profile.use-case';
import { SetStoreLogoUseCase } from './application/use-cases/set-store-logo.use-case';
import { PrismaStoreRepository } from './infrastructure/prisma-store.repository';
import { LocalUploadProvider } from '../uploads/providers/local-upload.provider';
import { UPLOAD_PROVIDER } from '../uploads/providers/upload-provider.interface';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [StoresController],
  providers: [
    GetMyStoreUseCase,
    SaveStoreProfileUseCase,
    ChangeStoreStatusUseCase,
    SetStoreLogoUseCase,
    PrismaStoreRepository,
    { provide: STORE_REPOSITORY, useExisting: PrismaStoreRepository },
    LocalUploadProvider,
    { provide: UPLOAD_PROVIDER, useExisting: LocalUploadProvider },
  ],
  exports: [GetMyStoreUseCase, SaveStoreProfileUseCase, ChangeStoreStatusUseCase],
})
export class StoresModule {}
