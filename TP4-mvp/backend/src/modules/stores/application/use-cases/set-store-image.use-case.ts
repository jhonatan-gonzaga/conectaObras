import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { STORE_REPOSITORY, StoreImageKind, StoreRepository } from '../store.repository';

@Injectable()
export class SetStoreImageUseCase {
  constructor(
    @Inject(STORE_REPOSITORY) private readonly stores: StoreRepository,
  ) {}

  async execute(ownerId: string, kind: StoreImageKind, url: string) {
    if (!(await this.stores.findByOwner(ownerId))) {
      throw new NotFoundException('Loja nao encontrada. Salve o perfil antes de enviar a imagem.');
    }
    return this.stores.updateImage(ownerId, kind, url);
  }
}
