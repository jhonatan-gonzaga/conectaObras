import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { StoreOpeningHourDto } from './dto/upsert-my-store.dto';
import { StoreRegistrationActivationPolicy } from './store-registration-activation.policy';

type StoredStore = Prisma.StoreProfileGetPayload<{
  include: { address: true; openingHours: true };
}>;

export function validateOpeningHours(hours: readonly StoreOpeningHourDto[]) {
  const days = new Set<string>();
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  for (const hour of hours) {
    if (days.has(hour.dayOfWeek)) {
      throw new BadRequestException('Informe apenas um horario por dia da semana.');
    }
    days.add(hour.dayOfWeek);
    if (hour.closed) {
      if (hour.openingTime != null || hour.closingTime != null) {
        throw new BadRequestException('Dia fechado deve ter horarios nulos.');
      }
    } else if (
      !hour.openingTime || !hour.closingTime ||
      !time.test(hour.openingTime) || !time.test(hour.closingTime) ||
      hour.openingTime >= hour.closingTime
    ) {
      throw new BadRequestException('Dia aberto exige abertura e fechamento validos em HH:mm.');
    }
  }
}

export function validatePersistedStore(store: Pick<StoredStore,
  'status' | 'name' | 'cnpj' | 'phone' | 'address' | 'openingHours'
>) {
  if (store.status === 'DRAFT') return;

  const decision = new StoreRegistrationActivationPolicy().evaluate({
    currentStatus: 'DRAFT',
    targetStatus: 'ACTIVE',
    registration: { ...store, businessHours: store.openingHours },
  });
  const address = store.address;
  const completeAddress = address &&
    [address.street, address.number, address.neighborhood, address.city,
      address.state, address.zipCode].every((value) => value?.trim());
  if (!decision.allowed || !completeAddress || !store.openingHours.some((hour) => !hour.closed)) {
    throw new BadRequestException({
      code: 'STORE_INCOMPLETE',
      message: 'Somente lojas DRAFT podem ter cadastro incompleto.',
    });
  }
}
