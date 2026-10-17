import { Prisma, WeekDay } from '@prisma/client';
import { StoreBusinessHours } from './store-registration-activation.policy';

export const publicStoreWhere = { status: 'ACTIVE' } satisfies Prisma.StoreProfileWhereInput;

export const publicAddressSelect = {
  street: true, number: true, neighborhood: true, city: true, state: true,
  zipCode: true, complement: true, latitude: true, longitude: true,
} satisfies Prisma.StoreAddressSelect;

export const publicStoreSummarySelect = {
  id: true, name: true, logoUrl: true, backgroundUrl: true,
  address: { select: publicAddressSelect },
} satisfies Prisma.StoreProfileSelect;

export const weekDays: WeekDay[] = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const westernAmazonCities = [
  'Atalaia do Norte', 'Benjamin Constant', 'Eirunepe', 'Envira', 'Guajara', 'Ipixuna',
  'Itamarati', 'Jutai', 'Labrea', 'Pauini', 'Sao Paulo de Olivenca', 'Tabatinga',
];
const stateTimeZones: Record<string, string> = {
  AM: 'America/Manaus', RR: 'America/Boa_Vista', RO: 'America/Porto_Velho',
  MT: 'America/Cuiaba', MS: 'America/Campo_Grande',
};
const normalize = (value?: string | null) => (value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
type Location = { state?: string | null; city?: string | null } | null;

// The domain stores Brazilian addresses, but has no explicit time-zone column.
export function storeTimeZone(address: Location): string {
  const state = normalize(address?.state);
  const city = normalize(address?.city);
  if (state === 'AC' || (state === 'AM' && westernAmazonCities.some((name) => normalize(name) === city))) return 'America/Rio_Branco';
  if (state === 'PE' && city === 'FERNANDO DE NORONHA') return 'America/Noronha';
  return stateTimeZones[state] ?? 'America/Sao_Paulo';
}

export function localStoreTime(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(at);
  const value = (type: string) => parts.find((part) => part.type === type)!.value;
  const day = weekDays.indexOf(value('weekday').toUpperCase() as WeekDay);
  return { day: weekDays[day], previousDay: weekDays[(day + 6) % 7], time: `${value('hour')}:${value('minute')}` };
}

export function isStoreOpen(hours: readonly StoreBusinessHours[], address: Location, at: Date): boolean {
  const { day, previousDay, time } = localStoreTime(at, storeTimeZone(address));
  return hours.some((hour) => {
    const { openingTime: start, closingTime: end } = hour;
    if (hour.closed || !start || !end || start === end) return false;
    if (start < end) return hour.dayOfWeek === day && start <= time && time < end;
    return (hour.dayOfWeek === day && start <= time) || (hour.dayOfWeek === previousDay && time < end);
  });
}

// The same location groups drive the SQL filter and the public open/closed view.
export function storeTimeZoneScopes(): { timeZone: string; where: Prisma.StoreProfileWhereInput }[] {
  const west: Prisma.StoreProfileWhereInput = { OR: [
    { address: { state: 'AC' } },
    { address: { state: 'AM', city: { in: westernAmazonCities } } },
  ] };
  const islands: Prisma.StoreProfileWhereInput = { address: { state: 'PE', city: 'Fernando de Noronha' } };
  const regions = Object.entries(stateTimeZones).map(([state, timeZone]) => ({
    timeZone,
    where: { AND: [{ address: { state } }, { NOT: west }] } satisfies Prisma.StoreProfileWhereInput,
  }));
  return [
    { timeZone: 'America/Rio_Branco', where: west },
    { timeZone: 'America/Noronha', where: islands },
    ...regions,
    { timeZone: 'America/Sao_Paulo', where: { NOT: { OR: [west, islands, ...regions.map((region) => region.where)] } } },
  ];
}
