import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { EffectivePriceService, isPromotionOverlapping, validatePromotion } from '../src/modules/stores/promotion.policy';

const startAt = new Date('2026-10-01T10:00:00.000Z');
const endAt = new Date('2026-10-02T10:00:00.000Z');

test('requires exactly one discount and strictly valid values and dates', () => {
  const base = { startAt, endAt };
  assert.throws(() => validatePromotion(base, '10.00'), BadRequestException);
  assert.throws(() => validatePromotion({ ...base, promotionalPrice: 8, discountPercent: 10 }, '10'), BadRequestException);
  assert.throws(() => validatePromotion({ ...base, promotionalPrice: 10 }, '10'), BadRequestException);
  assert.throws(() => validatePromotion({ ...base, discountPercent: 100 }, '10'), BadRequestException);
  assert.throws(() => validatePromotion({ ...base, discountPercent: 0 }, '10'), BadRequestException);
  assert.throws(() => validatePromotion({ ...base, discountPercent: 10, endAt: startAt }, '10'), BadRequestException);
  assert.doesNotThrow(() => validatePromotion({ ...base, promotionalPrice: '9.99' }, '10.00'));
  assert.doesNotThrow(() => validatePromotion({ ...base, discountPercent: '99.99' }, '10.00'));
});

test('uses UTC instants and treats start as inclusive and end as exclusive', () => {
  const service = new EffectivePriceService(() => new Date('2026-10-01T10:00:00.000Z'));
  const promotion = { discountPercent: '10', enabled: true, startAt, endAt };
  assert.equal(service.getEffectivePrice('100', promotion).toFixed(2), '90.00');
  assert.equal(service.getEffectivePrice('100', promotion, startAt).toFixed(2), '90.00');
  assert.equal(service.getEffectivePrice('100', promotion, endAt).toFixed(2), '100.00');
  assert.equal(service.getEffectivePrice('100', { ...promotion, startAt: new Date('2026-10-01T13:00:00.000Z') }, new Date('2026-10-01T12:00:00.000Z')).toFixed(2), '100.00');
});

test('uses fixed promotional price and rounds percentage discounts to cents', () => {
  const service = new EffectivePriceService();
  const at = new Date('2026-10-01T12:00:00.000Z');
  const common = { enabled: true, startAt, endAt };
  assert.equal(service.getEffectivePrice('19.99', { ...common, promotionalPrice: '12.50' }, at).toFixed(2), '12.50');
  assert.equal(service.getEffectivePrice('10.00', { ...common, promotionalPrice: '12.50' }, at).toFixed(2), '10.00');
  assert.equal(service.getEffectivePrice('10.01', { ...common, discountPercent: '10' }, at).toFixed(2), '9.01');
});

test('does not apply promotion to disabled, inactive, or out of stock products', () => {
  const service = new EffectivePriceService();
  const at = new Date('2026-10-01T12:00:00.000Z');
  const promotion = { discountPercent: '10', enabled: true, startAt, endAt };
  assert.equal(service.getEffectivePrice('10', { ...promotion, enabled: false }, at).toFixed(2), '10.00');
  assert.equal(service.getEffectivePrice('10', promotion, at, false).toFixed(2), '10.00');
});

test('rejects intersecting promotion intervals but allows adjacent boundaries', () => {
  const existing = [{ startAt, endAt }];
  assert.equal(isPromotionOverlapping(new Date('2026-10-02T09:59:59.999Z'), new Date('2026-10-03T00:00:00.000Z'), existing), true);
  assert.equal(isPromotionOverlapping(endAt, new Date('2026-10-03T10:00:00.000Z'), existing), false);
  assert.equal(isPromotionOverlapping(new Date('2026-09-30T10:00:00.000Z'), startAt, existing), false);
});
