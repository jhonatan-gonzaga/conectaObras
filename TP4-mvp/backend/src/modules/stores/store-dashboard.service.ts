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
    if (!dto.address.trim()) throw new BadRequestException('O endereco de entrega e obrigatorio.');
    const quantities = new Map<string, number>();
    for (const item of dto.items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
    const productIds = [...quantities.keys()];

    return this.prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, status: 'ACTIVE' },
      });
      if (products.length !== productIds.length) throw new BadRequestException('Um ou mais produtos nao estao disponiveis.');
      const storeId = products[0].storeId;
      if (products.some((product) => product.storeId !== storeId)) {
        throw new BadRequestException('Todos os produtos devem pertencer a mesma loja.');
      }

      const now = new Date();
      const promotions = await tx.storePromotion.findMany({
        where: {
          storeId,
          status: StorePromotionStatus.ACTIVE,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          ],
          OR: [{ productId: null }, { productId: { in: productIds } }],
        },
        orderBy: { discountPct: 'desc' },
      });

      const orderItems = products.map((product) => {
        const quantity = quantities.get(product.id)!;
        const promotion = promotions.find((candidate) => candidate.productId === product.id)
          ?? promotions.find((candidate) => candidate.productId === null);
        const discount = promotion ? new Prisma.Decimal(promotion.discountPct) : new Prisma.Decimal(0);
        const unitPrice = new Prisma.Decimal(product.price)
          .mul(new Prisma.Decimal(100).sub(discount))
          .div(100)
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
        return { productId: product.id, name: product.name, quantity, unitPrice };
      });
      const total = orderItems.reduce((sum, item) => sum.add(item.unitPrice.mul(item.quantity)), new Prisma.Decimal(0));
      if (total.lte(0) || total.greaterThan('99999999.99')) throw new BadRequestException('Total do pedido invalido.');

      for (const item of orderItems) {
        const updated = await tx.product.updateMany({
          where: { id: item.productId, storeId, status: 'ACTIVE', stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (updated.count !== 1) throw new ConflictException('Estoque insuficiente para um ou mais produtos.');
      }

      return tx.storeOrder.create({
        data: {
          storeId,
          customerId: ownerId,
          status: StoreOrderStatus.PENDING,
          total,
          address: dto.address.trim(),
          observation: dto.observation?.trim() || null,
          items: { create: orderItems },
          history: { create: { fromStatus: null, toStatus: StoreOrderStatus.PENDING, changedById: ownerId } },
        },
        include: { items: true, history: true },
      });
    });
  }

  async changeOrderStatus(ownerId: string, orderId: string, status: StoreOrderStatus) {
    const store = await this.prisma.storeProfile.findUnique({ where: { ownerId }, select: { id: true } });
    if (!store) throw new NotFoundException('Loja nao encontrada.');
    const next: Record<StoreOrderStatus, StoreOrderStatus[]> = {
      PENDING: ['CONFIRMED', 'CANCELED'], CONFIRMED: ['PREPARING', 'CANCELED'],
      PREPARING: ['READY', 'CANCELED'], READY: ['COMPLETED', 'CANCELED'],
      COMPLETED: [], CANCELED: [],
    };
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.storeOrder.findFirst({
        where: { id: orderId, storeId: store.id },
        include: { items: { select: { productId: true, quantity: true } } },
      });
      if (!order) throw new NotFoundException('Pedido nao encontrado.');
      if (!next[order.status].includes(status)) throw new BadRequestException('Transicao de pedido invalida.');
      const changed = await tx.storeOrder.updateMany({
        where: { id: orderId, storeId: store.id, status: order.status },
        data: { status },
      });
      if (changed.count !== 1) throw new ConflictException('O pedido mudou durante a atualizacao.');

      if (status === StoreOrderStatus.CANCELED) {
        for (const item of order.items) {
          if (!item.productId) continue;
          await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
        }
      }

      await tx.storeOrderStatusHistory.create({
        data: { orderId, fromStatus: order.status, toStatus: status, changedById: ownerId },
      });
      return tx.storeOrder.findFirstOrThrow({ where: { id: orderId, storeId: store.id }, include: { items: true, history: true } });
    });
  }
}
