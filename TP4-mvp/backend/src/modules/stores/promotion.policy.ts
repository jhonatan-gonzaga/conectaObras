import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type PromotionTerms = {
  promotionalPrice?: Prisma.Decimal | string | number | null;
  discountPercent?: Prisma.Decimal | string | number | null;
  startAt: Date;
  endAt: Date;
};

export type EffectivePromotion = PromotionTerms & { enabled: boolean };

export function validatePromotion(terms: PromotionTerms, basePrice: Prisma.Decimal | string | number) {
  const hasPrice = terms.promotionalPrice !== undefined && terms.promotionalPrice !== null;
  const hasPercent = terms.discountPercent !== undefined && terms.discountPercent !== null;
  if (hasPrice === hasPercent) throw new BadRequestException('Informe exatamente um tipo de desconto.');

  const base = new Prisma.Decimal(basePrice);
  if (hasPrice) {
    const promotionalPrice = new Prisma.Decimal(terms.promotionalPrice!);
    if (!promotionalPrice.gt(0) || !promotionalPrice.lt(base)) {
      throw new BadRequestException('O preço promocional deve ser positivo e menor que o preço base.');
    }
  }
  if (hasPercent) {
    const discountPercent = new Prisma.Decimal(terms.discountPercent!);
    if (!discountPercent.gt(0) || !discountPercent.lt(100)) {
      throw new BadRequestException('O percentual deve ser maior que zero e menor que 100.');
    }
  }
  if (!(terms.startAt instanceof Date) || Number.isNaN(terms.startAt.getTime())
    || !(terms.endAt instanceof Date) || Number.isNaN(terms.endAt.getTime())
    || terms.startAt >= terms.endAt) {
    throw new BadRequestException('O início da promoção deve ser anterior ao fim.');
  }
}

export function isPromotionOverlapping(startAt: Date, endAt: Date, existing: { startAt: Date; endAt: Date }[]) {
  return existing.some((promotion) => startAt < promotion.endAt && endAt > promotion.startAt);
}

export class EffectivePriceService {
  constructor(private readonly clock: () => Date = () => new Date()) {}

  // SQL counterpart for filtering before pagination; verified against Decimal pricing.
  getEffectivePriceSql(base: Prisma.Sql, price: Prisma.Sql, percent: Prisma.Sql, available: Prisma.Sql): Prisma.Sql {
    return Prisma.sql`CASE WHEN ${available} THEN CASE
      WHEN ${price} IS NOT NULL THEN CASE WHEN ${price} > 0 AND ${price} < ${base}
        THEN ROUND(${price}, 2) ELSE ${base} END
      WHEN ${percent} IS NOT NULL THEN ROUND(${base} * (100 - ${percent}) / 100, 2)
      ELSE ${base} END ELSE ${base} END`;
  }

  getEffectivePrice(
    basePrice: Prisma.Decimal | string | number,
    promotion: EffectivePromotion | null,
    at: Date = this.clock(),
    available = true,
  ): Prisma.Decimal {
    const base = new Prisma.Decimal(basePrice);
    if (!available || !promotion || !promotion.enabled || at < promotion.startAt || at >= promotion.endAt) return base;
    if (promotion.promotionalPrice != null) {
      const promotionalPrice = new Prisma.Decimal(promotion.promotionalPrice);
      return promotionalPrice.gt(0) && promotionalPrice.lt(base) ? promotionalPrice.toDecimalPlaces(2) : base;
    }
    if (promotion.discountPercent != null) {
      return base.mul(new Prisma.Decimal(100).sub(promotion.discountPercent)).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    }
    return base;
  }
}

export const currentPromotionWhere = (at: Date) => ({
  enabled: true, startAt: { lte: at }, endAt: { gt: at },
});

// Writes reject overlaps. Latest start and unique id also make legacy overlaps deterministic.
export const promotionOrder = [{ startAt: 'desc' as const }, { id: 'desc' as const }];
