import { Inject, Injectable } from '@nestjs/common';
import { STORE_REPOSITORY, StoreRepository } from '../store.repository';
import { UpsertMyStoreDto } from '../../dto/upsert-my-store.dto';

@Injectable()
export class SaveStoreProfileUseCase {
  constructor(
    @Inject(STORE_REPOSITORY) private readonly stores: StoreRepository,
  ) {}

  execute(ownerId: string, dto: UpsertMyStoreDto) {
    return this.stores.upsertProfile(ownerId, dto);
  }
}
