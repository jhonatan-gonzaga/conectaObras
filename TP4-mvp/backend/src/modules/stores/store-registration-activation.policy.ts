export type StoreStatus = 'DRAFT' | 'INACTIVE' | 'ACTIVE';

export type StoreWeekDay =
  | 'SUNDAY'
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY';

export type StoreBusinessHours = {
  dayOfWeek: StoreWeekDay | string;
  openingTime?: string | null;
  closingTime?: string | null;
  closed?: boolean;
};

export type StoreRegistration = {
  name?: string | null;
  cnpj?: string | null;
  phone?: string | null;
  businessHours?: readonly StoreBusinessHours[] | null;
};

export type StoreActivationPending =
  | 'TRANSITION_NOT_ALLOWED'
  | 'STORE_NAME_REQUIRED'
  | 'CNPJ_REQUIRED'
  | 'CNPJ_INVALID'
  | 'PHONE_REQUIRED'
  | 'PHONE_INVALID'
  | 'BUSINESS_HOURS_REQUIRED'
  | 'BUSINESS_DAY_INVALID'
  | 'BUSINESS_HOURS_REQUIRED_FOR_OPEN_DAY'
  | 'BUSINESS_HOURS_NOT_ALLOWED_FOR_CLOSED_DAY'
  | 'BUSINESS_HOURS_INVALID'
  | 'CLOSING_TIME_MUST_FOLLOW_OPENING_TIME'
  | 'DUPLICATE_BUSINESS_DAY'
  | 'OVERLAPPING_BUSINESS_HOURS';

export type StoreActivationDecision = {
  allowed: boolean;
  pending: StoreActivationPending[];
};

export type StoreStatusTransition = {
  currentStatus: StoreStatus;
  targetStatus: StoreStatus;
  registration: StoreRegistration;
};

const weekDays = new Set<StoreWeekDay>([
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
]);

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Pure registration and activation rules for a store.
 *
 * These rules compare supplied weekly times only; they do not depend on the
 * current instant. A future rule that does must receive a clock port instead
 * of reading the system clock here.
 */
export class StoreRegistrationActivationPolicy {
  evaluate({ currentStatus, targetStatus, registration }: StoreStatusTransition): StoreActivationDecision {
    if (currentStatus === 'ACTIVE' && targetStatus === 'INACTIVE') {
      return { allowed: true, pending: [] };
    }

    if (
      targetStatus !== 'ACTIVE' ||
      (currentStatus !== 'DRAFT' && currentStatus !== 'INACTIVE')
    ) {
      return { allowed: false, pending: ['TRANSITION_NOT_ALLOWED'] };
    }

    const pending = this.registrationPending(registration);
    return { allowed: pending.length === 0, pending };
  }

  private registrationPending(registration: StoreRegistration): StoreActivationPending[] {
    const pending = new Set<StoreActivationPending>();

    if (!hasText(registration.name)) {
      pending.add('STORE_NAME_REQUIRED');
    }

    if (!hasText(registration.cnpj)) {
      pending.add('CNPJ_REQUIRED');
    } else if (!isValidCnpj(registration.cnpj)) {
      pending.add('CNPJ_INVALID');
    }

    if (!hasText(registration.phone)) {
      pending.add('PHONE_REQUIRED');
    } else if (!isValidBrazilianPhone(registration.phone)) {
      pending.add('PHONE_INVALID');
    }

    if (!registration.businessHours?.length) {
      pending.add('BUSINESS_HOURS_REQUIRED');
      return [...pending];
    }

    const entriesByDay = new Map<string, StoreBusinessHours[]>();

    for (const hours of registration.businessHours) {
      if (!weekDays.has(hours.dayOfWeek as StoreWeekDay)) {
        pending.add('BUSINESS_DAY_INVALID');
        continue;
      }

      const dayEntries = entriesByDay.get(hours.dayOfWeek) ?? [];
      dayEntries.push(hours);
      entriesByDay.set(hours.dayOfWeek, dayEntries);
      this.validateBusinessHours(hours, pending);
    }

    for (const dayEntries of entriesByDay.values()) {
      if (dayEntries.length > 1) {
        pending.add('DUPLICATE_BUSINESS_DAY');
      }

      if (hasOverlappingBusinessHours(dayEntries)) {
        pending.add('OVERLAPPING_BUSINESS_HOURS');
      }
    }

    return [...pending];
  }

  private validateBusinessHours(
    hours: StoreBusinessHours,
    pending: Set<StoreActivationPending>,
  ) {
    const hasOpeningTime = hasText(hours.openingTime);
    const hasClosingTime = hasText(hours.closingTime);

    if (hours.closed) {
      if (hasOpeningTime || hasClosingTime) {
        pending.add('BUSINESS_HOURS_NOT_ALLOWED_FOR_CLOSED_DAY');
      }
      return;
    }

    if (!hasOpeningTime || !hasClosingTime) {
      pending.add('BUSINESS_HOURS_REQUIRED_FOR_OPEN_DAY');
      return;
    }

    if (!isValidTime(hours.openingTime) || !isValidTime(hours.closingTime)) {
      pending.add('BUSINESS_HOURS_INVALID');
      return;
    }

    if (hours.closingTime <= hours.openingTime) {
      pending.add('CLOSING_TIME_MUST_FOLLOW_OPENING_TIME');
    }
  }
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidTime(value: string | null | undefined): value is string {
  return hasText(value) && timePattern.test(value);
}

function hasOverlappingBusinessHours(entries: readonly StoreBusinessHours[]) {
  const openEntries = entries.filter(
    (entry): entry is StoreBusinessHours & { openingTime: string; closingTime: string } =>
      !entry.closed && isValidTime(entry.openingTime) && isValidTime(entry.closingTime),
  );

  return openEntries.some((entry, index) =>
    openEntries.slice(index + 1).some(
      (other) => entry.openingTime < other.closingTime && other.openingTime < entry.closingTime,
    ),
  );
}

function isValidBrazilianPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  const nationalNumber =
    digits.startsWith('55') && (digits.length === 12 || digits.length === 13)
      ? digits.slice(2)
      : digits;

  if (!/^[1-9]\d(?:9\d{8}|[2-5]\d{7})$/.test(nationalNumber)) {
    return false;
  }

  return true;
}

function isValidCnpj(value: string) {
  const cnpj = value.replace(/\D/g, '');

  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) {
    return false;
  }

  const calculateDigit = (base: string, weights: readonly number[]) => {
    const sum = [...base].reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calculateDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondDigit = calculateDigit(cnpj.slice(0, 12) + firstDigit, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return cnpj === cnpj.slice(0, 12) + firstDigit + secondDigit;
}
