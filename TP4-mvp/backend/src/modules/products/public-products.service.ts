import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EffectivePriceService } from '../stores/promotion.policy';

const publicProductSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  images: {
    select: { url: true, altText: true, isCover: true },
    orderBy: { position: 'asc' as const },
  },
  promotions: {
    where: { enabled: true },
    select: { promotionalPrice: true, discountPercent: true, startAt: true, endAt: true, enabled: true },
  },
} satisfies Prisma.ProductSelect;

type PublicProductRow = Prisma.ProductGetPayload<{ select: typeof publicProductSelect }>;

@Injectable()
export class PublicProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const products = await this.prisma.product.findMany({
      where: { status: 'ACTIVE', stock: { gt: 0 }, store: { status: 'ACTIVE' }, category: { active: true } },
      select: publicProductSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return products.map((product) => this.view(product));
  }

  async get(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, status: 'ACTIVE', stock: { gt: 0 }, store: { status: 'ACTIVE' }, category: { active: true } },
      select: publicProductSelect,
    });
    if (!product) throw new NotFoundException('Produto nao encontrado.');
    return this.view(product);
  }

  private view(product: PublicProductRow) {
    const now = new Date();
    const active = product.promotions.find((promotion) => promotion.startAt <= now && promotion.endAt > now) ?? null;
    const effectivePrice = new EffectivePriceService(() => now).getEffectivePrice(product.price, active, now);
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      basePrice: product.price.toFixed(2),
      effectivePrice: effectivePrice.toFixed(2),
      images: product.images,
    };
  }
}
