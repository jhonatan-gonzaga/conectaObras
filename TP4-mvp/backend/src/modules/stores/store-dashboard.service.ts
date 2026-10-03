import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StoreOrderStatus, StorePromotionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStoreOrderDto } from './dto/create-store-order.dto';
import { CreateStorePromotionDto } from './dto/create-store-promotion.dto';

export type StoreDashboardList = 'active-products' | 'low-stock' | 'promotions' | 'orders' | 'messages';
const LOW_STOCK_LIMIT = 5;

@Injectable()
export class StoreDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(ownerId: string) {
    const store = await this.prisma.storeProfile.findUnique({ where: { ownerId }, select: { id: true } });
    if (!store) return { hasStore: false, activeProducts: 0, lowStockProducts: 0, activePromotions: 0, ordersByStatus: {}, unreadMessages: 0, latestOrder: null };

    const now = new Date();
    const activePromotionWhere = {
      storeId: store.id,
      status: 'ACTIVE' as const,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    };
    const [activeProducts, lowStockProducts, activePromotions, ordersByStatus, unreadMessages, latestOrder] = await Promise.all([
      this.prisma.product.count({ where: { storeId: store.id, status: 'ACTIVE' } }),
      this.prisma.product.count({ where: { storeId: store.id, status: 'ACTIVE', stock: { lte: LOW_STOCK_LIMIT } } }),
      this.prisma.storePromotion.count({ where: activePromotionWhere }),
      this.prisma.storeOrder.groupBy({ by: ['status'], where: { storeId: store.id }, _count: { _all: true } }),
      this.prisma.notification.count({ where: { userId: ownerId, type: 'NEW_MESSAGE', readAt: null } }),
      this.prisma.storeOrder.findFirst({ where: { storeId: store.id }, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, total: true, createdAt: true, items: { take: 1, select: { name: true } } } }),
    ]);

    return {
      hasStore: true,
      activeProducts,
      lowStockProducts,
      activePromotions,
      ordersByStatus: Object.fromEntries(ordersByStatus.map(({ status, _count }) => [status, _count._all])),
      unreadMessages,
      latestOrder: latestOrder ? { id: latestOrder.id, status: latestOrder.status, total: latestOrder.total, createdAt: latestOrder.createdAt, itemName: latestOrder.items[0]?.name ?? null } : null,
    };
  }

  async list(ownerId: string, type: StoreDashboardList, status?: string) {
    const store = await this.prisma.storeProfile.findUnique({ where: { ownerId }, select: { id: true } });
    if (!store) throw new NotFoundException('Loja nao encontrada.');

    switch (type) {
      case 'active-products':
        return this.prisma.product.findMany({ where: { storeId: store.id, status: 'ACTIVE' }, orderBy: { name: 'asc' } });
      case 'low-stock':
        return this.prisma.product.findMany({ where: { storeId: store.id, status: 'ACTIVE', stock: { lte: LOW_STOCK_LIMIT } }, orderBy: [{ stock: 'asc' }, { name: 'asc' }] });
      case 'promotions':
        return this.prisma.storePromotion.findMany({ where: {
          storeId: store.id,
          status: 'ACTIVE',
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
          ],
        }, include: { product: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } });
      case 'orders':
        return this.prisma.storeOrder.findMany({ where: { storeId: store.id, status: status ? status as StoreOrderStatus : undefined }, include: { items: true }, orderBy: { createdAt: 'desc' } });
      case 'messages':
        return this.prisma.notification.findMany({ where: { userId: ownerId, type: 'NEW_MESSAGE', readAt: null }, orderBy: { createdAt: 'desc' } });
    }
  }

  async createPromotion(ownerId: string, dto: CreateStorePromotionDto) {
    const store = await this.prisma.storeProfile.findUnique({ where: { ownerId }, select: { id: true } });
    if (!store) throw new NotFoundException('Loja nao encontrada.');
    if (dto.productId && !await this.prisma.product.findFirst({ where: { id: dto.productId, storeId: store.id } })) {
      throw new BadRequestException('O produto informado nao pertence a sua loja.');
    }
    return this.prisma.storePromotion.create({
      data: { storeId: store.id, productId: dto.productId, name: dto.name.trim(), discountPct: new Prisma.Decimal(dto.discountPct), status: dto.status ?? StorePromotionStatus.DRAFT },
    });
  }

  async createOrder(ownerId: string, dto: CreateStoreOrderDto) {
    const store = await this.prisma.storeProfile.findUnique({ where: { ownerId }, select: { id: true } });
    if (!store) throw new NotFoundException('Loja nao encontrada.');
    const items = dto.items.map((item) => {
      const unitPrice = new Prisma.Decimal(item.unitPrice);
      if (unitPrice.lte(0)) throw new BadRequestException('O preco dos itens deve ser positivo.');
      return { name: item.name.trim(), quantity: item.quantity, unitPrice };
    });
    const total = items.reduce((sum, item) => sum.add(item.unitPrice.mul(item.quantity)), new Prisma.Decimal(0));
    return this.prisma.storeOrder.create({
      data: {
        storeId: store.id,
        status: StoreOrderStatus.PENDING,
        total,
        items: { create: items },
      },
      include: { items: true },
    });
  }

  async changeOrderStatus(ownerId: string, orderId: string, status: StoreOrderStatus) {
    const store = await this.prisma.storeProfile.findUnique({ where: { ownerId }, select: { id: true } });
    if (!store) throw new NotFoundException('Loja nao encontrada.');
    const order = await this.prisma.storeOrder.findFirst({ where: { id: orderId, storeId: store.id }, select: { status: true } });
    if (!order) throw new NotFoundException('Pedido nao encontrado.');
    const next: Record<StoreOrderStatus, StoreOrderStatus[]> = {
      PENDING: ['CONFIRMED', 'CANCELED'], CONFIRMED: ['PREPARING', 'CANCELED'],
      PREPARING: ['READY', 'CANCELED'], READY: ['COMPLETED', 'CANCELED'],
      COMPLETED: [], CANCELED: [],
    };
    if (!next[order.status].includes(status)) throw new BadRequestException('Transicao de pedido invalida.');
    const changed = await this.prisma.storeOrder.updateMany({
      where: { id: orderId, storeId: store.id, status: order.status },
      data: { status },
    });
    if (changed.count !== 1) throw new ConflictException('O pedido mudou durante a atualizacao.');
    return this.prisma.storeOrder.findFirstOrThrow({ where: { id: orderId, storeId: store.id }, include: { items: true } });
  }
}
