import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { isStoreOpen, storeTimeZone } from '../src/modules/stores/public-store.policy';

test('store hours use the address time zone and inclusive opening/exclusive closing', () => {
  const hours = [{ dayOfWeek: 'MONDAY', openingTime: '08:00', closingTime: '12:00', closed: false }];
  assert.equal(isStoreOpen(hours, { state: 'AM' }, new Date('2026-10-12T12:00:00Z')), true);
  assert.equal(isStoreOpen(hours, { state: 'AM' }, new Date('2026-10-12T11:59:59Z')), false);
  assert.equal(isStoreOpen(hours, { state: 'AM' }, new Date('2026-10-12T16:00:00Z')), false);
  assert.equal(isStoreOpen(hours, { state: 'SP' }, new Date('2026-10-12T11:00:00Z')), true);
  assert.equal(isStoreOpen(hours, { state: 'AC' }, new Date('2026-10-12T12:00:00Z')), false);
  assert.equal(storeTimeZone({ state: 'am', city: ' Eirunepé ' }), 'America/Rio_Branco');
  assert.equal(storeTimeZone({ state: 'PE', city: 'Fernando de Noronha' }), 'America/Noronha');
});

test('store hours handle missing/closed days, midnight, overnight shifts and week rollover', () => {
  const sunday = [{ dayOfWeek: 'SUNDAY', openingTime: '22:00', closingTime: '02:00', closed: false }];
  assert.equal(isStoreOpen(sunday, { state: 'AM' }, new Date('2026-10-12T02:00:00Z')), true);
  assert.equal(isStoreOpen(sunday, { state: 'AM' }, new Date('2026-10-12T04:00:00Z')), true);
  assert.equal(isStoreOpen(sunday, { state: 'AM' }, new Date('2026-10-12T05:59:59Z')), true);
  assert.equal(isStoreOpen(sunday, { state: 'AM' }, new Date('2026-10-12T06:00:00Z')), false);
  assert.equal(isStoreOpen(sunday, { state: 'AM' }, new Date('2026-10-11T16:00:00Z')), false);
  assert.equal(isStoreOpen([{ ...sunday[0], closed: true }], { state: 'AM' }, new Date('2026-10-12T04:00:00Z')), false);
  assert.equal(isStoreOpen([], null, new Date('2026-10-12T04:00:00Z')), false);
  assert.equal(isStoreOpen([{ dayOfWeek: 'MONDAY', openingTime: null, closingTime: null }], null, new Date('2026-10-12T04:00:00Z')), false);
  assert.equal(isStoreOpen([{ ...sunday[0], closingTime: '22:00' }], null, new Date('2026-10-12T04:00:00Z')), false);
});
