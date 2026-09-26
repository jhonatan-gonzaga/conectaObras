import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { STORE_REPOSITORY, StoreRepository } from '../store.repository';

@Injectable()
export class GetMyStoreUseCase {
  constructor(
    @Inject(STORE_REPOSITORY) private readonly stores: StoreRepository,
  ) {}

  async execute(ownerId: string) {
    const store = await this.stores.findByOwner(ownerId);
    if (!store) throw new NotFoundException('Loja nao encontrada.');
    return store;
  }
}
