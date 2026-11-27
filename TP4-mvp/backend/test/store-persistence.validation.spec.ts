import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { StoreStatus, WeekDay } from '@prisma/client';
import { validateOpeningHours, validatePersistedStore } from '../src/modules/stores/store-persistence.validation';

const now = new Date();
const complete = {
  status: StoreStatus.ACTIVE,
  name: 'Loja', cnpj: '11222333000181', phone: '92991234567',
  address: {
    id: 'address', storeId: 'store', street: 'Rua A', number: '1', neighborhood: 'Centro',
    city: 'Manaus', state: 'AM', zipCode: '69000000', complement: null,
    latitude: null, longitude: null, createdAt: now, updatedAt: now,
  },
  openingHours: [{
    id: 'hours', storeId: 'store', dayOfWeek: WeekDay.MONDAY,
    openingTime: '08:00', closingTime: '18:00', closed: false,
    createdAt: now, updatedAt: now,
  }],
};

describe('Store persistence validation', () => {
  it('aceita rascunho incompleto e cadastro completo sem campos opcionais', () => {
    validatePersistedStore({ ...complete, status: StoreStatus.DRAFT, name: null, address: null, openingHours: [] });
    validatePersistedStore(complete);
    validatePersistedStore({ ...complete, status: StoreStatus.INACTIVE });
  });

  for (const status of [StoreStatus.ACTIVE, StoreStatus.INACTIVE]) {
    for (const patch of [
      { name: ' ' }, { cnpj: null }, { phone: null }, { address: null },
      { address: { ...complete.address, street: null } },
      { address: { ...complete.address, zipCode: null } },
      { openingHours: [] },
      { openingHours: [{ ...complete.openingHours[0], closed: true, openingTime: null, closingTime: null }] },
    ]) {
      it(`rejeita cadastro incompleto ${status}: ${JSON.stringify(patch)}`, () => {
        assert.throws(() => validatePersistedStore({ ...complete, status, ...patch }), BadRequestException);
      });
    }
  }

  it('aceita dia fechado com horas ausentes ou nulas', () => {
    validateOpeningHours([{ dayOfWeek: WeekDay.SUNDAY, closed: true }]);
    validateOpeningHours([{ ...complete.openingHours[0], closed: true, openingTime: null, closingTime: null }]);
  });

  for (const patch of [
    { openingTime: undefined }, { closingTime: undefined },
    { openingTime: '24:00' }, { closingTime: '08:00' },
    { closed: true },
  ]) {
    it(`rejeita horario inconsistente: ${JSON.stringify(patch)}`, () => {
      assert.throws(() => validateOpeningHours([{ ...complete.openingHours[0], ...patch }]), BadRequestException);
    });
  }

  it('rejeita dias duplicados antes de persistir', () => {
    assert.throws(() => validateOpeningHours([complete.openingHours[0], complete.openingHours[0]]), BadRequestException);
  });
});
