import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PublicStoresQueryDto } from './dto/public-stores-query.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { currentPromotionWhere, EffectivePriceService, promotionOrder } from './promotion.policy';
import { isStoreOpen, localStoreTime, publicStoreSummarySelect, publicStoreWhere, storeTimeZone, storeTimeZoneScopes, weekDays } from './public-store.policy';
import { publicProductWhere } from '../products/application/product.policy';

const storeSelect = {
  ...publicStoreSummarySelect,
  description: true, phone: true, whatsapp: true,
  openingHours: { select: { dayOfWeek: true, openingTime: true, closingTime: true, closed: true } },
} satisfies Prisma.StoreProfileSelect;
type PublicStore = Prisma.StoreProfileGetPayload<{ select: typeof storeSelect }>;

@Injectable()
export class PublicStoresService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PublicStoresQueryDto = {}) {
    const now = new Date();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.StoreProfileWhereInput = {
      ...publicStoreWhere,
      ...(query.q ? { OR: [{ name: { contains: query.q } }, { description: { contains: query.q } }] } : {}),
      ...(query.city || query.neighborhood ? { address: { city: query.city, neighborhood: query.neighborhood } } : {}),
      ...(query.openNow === undefined ? {} : { AND: [query.openNow ? this.openNowWhere(now) : { NOT: this.openNowWhere(now) }] }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.storeProfile.findMany({
        where, select: storeSelect, skip: (page - 1) * limit, take: limit,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.storeProfile.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { items: items.map((item) => this.view(item, now)), total, page, limit };
  }

  async get(id: string) {
    const now = new Date();
    const store = await this.prisma.storeProfile.findFirst({
      where: { ...publicStoreWhere, id },
      select: {
        ...storeSelect,
        promotions: {
          where: { ...currentPromotionWhere(now), product: { ...publicProductWhere, storeId: id, stock: { gt: 0 } } },
          orderBy: promotionOrder,
          select: {
            id: true, productId: true, promotionalPrice: true, discountPercent: true,
            startAt: true, endAt: true, enabled: true,
            product: { select: { name: true, price: true } },
          },
        },
      },
    });
    if (!store) throw new NotFoundException('Loja nao encontrada.');
    const seen = new Set<string>();
    const promotions = store.promotions.filter((promotion) => {
      if (seen.has(promotion.productId)) return false;
      seen.add(promotion.productId);
      return true;
    }).map((promotion) => ({
      id: promotion.id, productId: promotion.productId, productName: promotion.product.name,
      promotionalPrice: promotion.promotionalPrice?.toFixed(2) ?? null,
      discountPercent: promotion.discountPercent?.toFixed(2) ?? null,
      startAt: promotion.startAt, endAt: promotion.endAt,
      effectivePrice: new EffectivePriceService().getEffectivePrice(promotion.product.price, promotion, now).toFixed(2),
    }));
    return { ...this.view(store, now), promotions };
  }

  private view(store: PublicStore, now: Date) {
    return {
      id: store.id, name: store.name, description: store.description,
      logoUrl: store.logoUrl, coverUrl: store.logoUrl, backgroundUrl: store.backgroundUrl,
      phone: store.phone, whatsapp: store.whatsapp, address: store.address,
      openingHours: [...store.openingHours].sort((a, b) => weekDays.indexOf(a.dayOfWeek) - weekDays.indexOf(b.dayOfWeek)),
      timeZone: storeTimeZone(store.address), openNow: isStoreOpen(store.openingHours, store.address, now),
    };
  }

  private openNowWhere(at: Date): Prisma.StoreProfileWhereInput {
    const fields = this.prisma.storeOpeningHour.fields;
    return { OR: storeTimeZoneScopes().map(({ timeZone, where }) => {
      const { day, previousDay, time } = localStoreTime(at, timeZone);
      return { AND: [where, { openingHours: { some: {
        closed: false,
        OR: [
          { dayOfWeek: day, openingTime: { lte: time }, closingTime: { gt: time } },
          { dayOfWeek: day, openingTime: { lte: time }, AND: [{ closingTime: { lt: fields.openingTime } }] },
          { dayOfWeek: previousDay, closingTime: { gt: time }, openingTime: { gt: fields.closingTime } },
        ],
      } } }] };
    }) };
  }
}
