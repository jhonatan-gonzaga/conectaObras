import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { STORE_REPOSITORY, StoreRepository } from '../store.repository';

@Injectable()
export class SetStoreLogoUseCase {
  constructor(
    @Inject(STORE_REPOSITORY) private readonly stores: StoreRepository,
  ) {}

  async execute(ownerId: string, logoUrl: string) {
    if (!(await this.stores.findByOwner(ownerId))) {
      throw new NotFoundException('Loja nao encontrada. Salve o perfil antes de enviar a logo.');
    }
    return this.stores.updateLogo(ownerId, logoUrl);
  }
}
