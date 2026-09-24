import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  StoreRegistration,
  StoreRegistrationActivationPolicy,
} from '../src/modules/stores/store-registration-activation.policy';

const policy = new StoreRegistrationActivationPolicy();

const validRegistration: StoreRegistration = {
  name: 'Casa do Construtor',
  cnpj: '11.222.333/0001-81',
  phone: '(92) 99123-4567',
  businessHours: [
    { dayOfWeek: 'MONDAY', openingTime: '00:00', closingTime: '23:59' },
    { dayOfWeek: 'SUNDAY', closed: true },
  ],
};

describe('StoreRegistrationActivationPolicy', () => {
  for (const currentStatus of ['DRAFT', 'INACTIVE', 'ACTIVE'] as const) {
    for (const targetStatus of ['DRAFT', 'INACTIVE', 'ACTIVE'] as const) {
      const allowed =
        ((currentStatus === 'DRAFT' || currentStatus === 'INACTIVE') &&
          targetStatus === 'ACTIVE') ||
        (currentStatus === 'ACTIVE' && targetStatus === 'INACTIVE');

      it(`${allowed ? 'permite' : 'bloqueia'} ${currentStatus} -> ${targetStatus}`, () => {
        const decision = policy.evaluate({ currentStatus, targetStatus, registration: validRegistration });

        assert.equal(decision.allowed, allowed);
        assert.deepEqual(decision.pending, allowed ? [] : ['TRANSITION_NOT_ALLOWED']);
      });
    }
  }

  it('permite ativar um cadastro completo com CNPJ e telefone validos', () => {
    const decision = policy.evaluate({
      currentStatus: 'DRAFT',
      targetStatus: 'ACTIVE',
      registration: validRegistration,
    });

    assert.deepEqual(decision, { allowed: true, pending: [] });
  });

  it('rejeita CNPJ com checksum invalido', () => {
    const decision = policy.evaluate({
      currentStatus: 'DRAFT',
      targetStatus: 'ACTIVE',
      registration: { ...validRegistration, cnpj: '11.222.333/0001-82' },
    });

    assert.deepEqual(decision.pending, ['CNPJ_INVALID']);
  });

  it('rejeita telefone brasileiro invalido', () => {
    const decision = policy.evaluate({
      currentStatus: 'DRAFT',
      targetStatus: 'ACTIVE',
      registration: { ...validRegistration, phone: '(92) 8123-4567' },
    });

    assert.deepEqual(decision.pending, ['PHONE_INVALID']);
  });

  it('aceita os horarios-limite e um dia fechado sem horarios', () => {
    const decision = policy.evaluate({
      currentStatus: 'INACTIVE',
      targetStatus: 'ACTIVE',
      registration: validRegistration,
    });

    assert.deepEqual(decision, { allowed: true, pending: [] });
  });

  it('rejeita horario fora de HH:mm e fechamento que nao segue a abertura', () => {
    const decision = policy.evaluate({
      currentStatus: 'DRAFT',
      targetStatus: 'ACTIVE',
      registration: {
        ...validRegistration,
        businessHours: [
          { dayOfWeek: 'MONDAY', openingTime: '24:00', closingTime: '23:59' },
          { dayOfWeek: 'TUESDAY', openingTime: '10:00', closingTime: '10:00' },
        ],
      },
    });

    assert.deepEqual(decision.pending, [
      'BUSINESS_HOURS_INVALID',
      'CLOSING_TIME_MUST_FOLLOW_OPENING_TIME',
    ]);
  });

  it('rejeita campos obrigatorios ausentes', () => {
    const decision = policy.evaluate({
      currentStatus: 'DRAFT',
      targetStatus: 'ACTIVE',
      registration: {},
    });

    assert.deepEqual(decision.pending, [
      'STORE_NAME_REQUIRED',
      'CNPJ_REQUIRED',
      'PHONE_REQUIRED',
      'BUSINESS_HOURS_REQUIRED',
    ]);
  });

  it('rejeita dia invalido, dia duplicado e horarios sobrepostos', () => {
    const decision = policy.evaluate({
      currentStatus: 'DRAFT',
      targetStatus: 'ACTIVE',
      registration: {
        ...validRegistration,
        businessHours: [
          { dayOfWeek: 'MONDAY', openingTime: '08:00', closingTime: '12:00' },
          { dayOfWeek: 'MONDAY', openingTime: '11:00', closingTime: '18:00' },
          { dayOfWeek: 'HOLIDAY', openingTime: '08:00', closingTime: '12:00' },
        ],
      },
    });

    assert.deepEqual(decision.pending, [
      'BUSINESS_DAY_INVALID',
      'DUPLICATE_BUSINESS_DAY',
      'OVERLAPPING_BUSINESS_HOURS',
    ]);
  });

  it('permite desativar uma loja ativa sem alterar o cadastro', () => {
    const registration = structuredClone(validRegistration);
    const decision = policy.evaluate({
      currentStatus: 'ACTIVE',
      targetStatus: 'INACTIVE',
      registration,
    });

    assert.deepEqual(decision, { allowed: true, pending: [] });
    assert.deepEqual(registration, validRegistration);
  });
});
