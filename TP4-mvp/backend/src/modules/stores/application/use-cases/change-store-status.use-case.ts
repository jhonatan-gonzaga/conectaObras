import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StoreStatus } from '@prisma/client';
import {
  StoreRegistrationActivationPolicy,
} from '../../store-registration-activation.policy';
import { STORE_REPOSITORY, StoreRepository } from '../store.repository';

@Injectable()
export class ChangeStoreStatusUseCase {
  private readonly activationPolicy = new StoreRegistrationActivationPolicy();

  constructor(
    @Inject(STORE_REPOSITORY) private readonly stores: StoreRepository,
  ) {}

  async execute(ownerId: string, targetStatus: StoreStatus) {
    const store = await this.stores.findByOwner(ownerId);
    if (!store) throw new NotFoundException('Loja nao encontrada.');

    const decision = this.activationPolicy.evaluate({
      currentStatus: store.status,
      targetStatus,
      registration: {
        name: store.name,
        cnpj: store.cnpj,
        phone: store.phone,
        businessHours: store.openingHours,
      },
    });

    if (!decision.allowed) {
      throw new BadRequestException({
        message: 'A loja nao pode assumir o status solicitado.',
        pending: decision.pending,
      });
    }

    return this.stores.changeStatus(ownerId, targetStatus);
  }
}
