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

  async readiness(ownerId: string, targetStatus: StoreStatus = StoreStatus.ACTIVE) {
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

    if (targetStatus === StoreStatus.ACTIVE) {
      const address = store.address;
      if (!address || ![
        address.street,
        address.number,
        address.neighborhood,
        address.city,
        address.state,
        address.zipCode,
      ].every((value) => value?.trim())) {
        decision.pending.push('ADDRESS_REQUIRED');
      }
      if (!store.openingHours.some((hours) => !hours.closed)) {
        decision.pending.push('BUSINESS_OPEN_DAY_REQUIRED');
      }
    }

    return { allowed: decision.pending.length === 0, pending: decision.pending };
  }

  async execute(ownerId: string, targetStatus: StoreStatus) {
    const decision = await this.readiness(ownerId, targetStatus);
    if (decision.pending.length) {
      throw new BadRequestException({
        message: 'A loja nao pode assumir o status solicitado.',
        pending: decision.pending,
      });
    }

    return this.stores.changeStatus(ownerId, targetStatus);
  }
}
