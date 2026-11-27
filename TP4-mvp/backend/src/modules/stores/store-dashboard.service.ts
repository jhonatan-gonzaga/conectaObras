import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StoreOrderStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStoreOrderDto } from './dto/create-store-order.dto';
import { CreateClientStoreOrderDto } from './dto/create-client-store-order.dto';
import { CreateStorePromotionDto } from './dto/create-store-promotion.dto';
import { randomUUID } from 'node:crypto';
import { EffectivePriceService, currentPromotionWhere, isPromotionOverlapping, promotionOrder, validatePromotion } from './promotion.policy';
import { canTransitionOrder } from './application/orders/order-status-policy';

export type StoreDashboardList = 'active-products' | 'low-stock' | 'promotions' | 'orders' | 'messages';
const LOW_STOCK_LIMIT = 5;
export type PromotionStatus = 'CURRENT' | 'SCHEDULED' | 'ENDED';

@Injectable()
export class StoreDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(ownerId: string) {
    const store = await this.prisma.storeProfile.findUnique({ where: { ownerId }, select: { id: true } });
    if (!store) return { hasStore: false, activeProducts: 0, lowStockProducts: 0, activePromotions: 0, ordersByStatus: {}, unreadMessages: 0, latestOrder: null };

    const now = new Date();
    const activePromotionWhere = {
      storeId: store.id,
      enabled: true,
      startAt: { lte: now },
      endAt: { gt: now },
      product: { status: 'ACTIVE' as const, stock: { gt: 0 } },
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
      case 'promotions': {
        return this.prisma.storePromotion.findMany({ where: {
          storeId: store.id,
        }, include: { product: { select: { id: true, name: true, price: true, status: true, stock: true } } }, orderBy: { createdAt: 'desc' } });
      }
      case 'orders':
        return this.prisma.storeOrder.findMany({ where: { storeId: store.id, status: status ? status as StoreOrderStatus : undefined }, include: { items: true }, orderBy: { createdAt: 'desc' } });
      case 'messages':
        return this.prisma.notification.findMany({ where: { userId: ownerId, type: 'NEW_MESSAGE', readAt: null }, orderBy: { createdAt: 'desc' } });
    }
  }

  async createPromotion(ownerId: string, dto: CreateStorePromotionDto) {
    const store = await this.prisma.storeProfile.findUnique({ where: { ownerId }, select: { id: true } });
    if (!store) throw new NotFoundException('Loja nao encontrada.');
    const product = await this.prisma.product.findFirst({ where: { id: dto.productId, storeId: store.id }, select: { id: true, price: true, status: true, stock: true } });
    if (!product) {
      throw new BadRequestException('O produto informado nao pertence a sua loja.');
    }
    if (product.status !== 'ACTIVE' || product.stock < 1) {
      throw new BadRequestException('Somente produtos ativos e com estoque podem entrar em promocao.');
    }
    validatePromotion(dto, product.price);
    if (dto.endAt <= new Date()) throw new BadRequestException('A promoção precisa terminar no futuro.');
    const overlaps = await this.prisma.storePromotion.findMany({
      where: { productId: product.id, enabled: true, startAt: { lt: dto.endAt }, endAt: { gt: dto.startAt } },
      select: { startAt: true, endAt: true },
    });
    if (isPromotionOverlapping(dto.startAt, dto.endAt, overlaps)) {
      throw new ConflictException('O produto ja possui promocao em periodo sobreposto.');
    }
    return this.prisma.storePromotion.create({
      data: {
        storeId: store.id,
        productId: product.id,
        promotionalPrice: dto.promotionalPrice == null ? null : new Prisma.Decimal(dto.promotionalPrice),
        discountPercent: dto.discountPercent == null ? null : new Prisma.Decimal(dto.discountPercent),
        startAt: dto.startAt,
        endAt: dto.endAt,
      },
    });
  }

  async listPromotions(ownerId: string, status?: PromotionStatus) {
    const store = await this.prisma.storeProfile.findUnique({ where: { ownerId }, select: { id: true } });
    if (!store) throw new NotFoundException('Loja nao encontrada.');
    const now = new Date();
    const promotions = await this.prisma.storePromotion.findMany({
      where: { storeId: store.id },
      include: { product: { select: { id: true, name: true, price: true, status: true, stock: true } } },
      orderBy: [{ startAt: 'desc' }, { id: 'desc' }],
    });
    return promotions.map((promotion) => {
      const lifecycle: PromotionStatus = promotion.endAt <= now ? 'ENDED'
        : promotion.startAt > now ? 'SCHEDULED' : 'CURRENT';
      const available = promotion.product.status === 'ACTIVE' && promotion.product.stock > 0;
      return {
        id: promotion.id,
        productId: promotion.productId,
        productName: promotion.product.name,
        basePrice: promotion.product.price.toFixed(2),
        effectivePrice: new EffectivePriceService(() => now).getEffectivePrice(promotion.product.price, promotion, now, available).toFixed(2),
        promotionalPrice: promotion.promotionalPrice?.toFixed(2) ?? null,
        discountPercent: promotion.discountPercent?.toFixed(2) ?? null,
        startAt: promotion.startAt,
        endAt: promotion.endAt,
        enabled: promotion.enabled,
        status: lifecycle,
      };
    }).filter((promotion) => !status || promotion.status === status);
  }

  async updatePromotion(ownerId: string, promotionId: string, dto: Partial<CreateStorePromotionDto>) {
    const store = await this.prisma.storeProfile.findUnique({ where: { ownerId }, select: { id: true } });
    if (!store) throw new NotFoundException('Loja nao encontrada.');
    const current = await this.prisma.storePromotion.findFirst({ where: { id: promotionId, storeId: store.id } });
    if (!current) throw new NotFoundException('Promocao nao encontrada.');
    if (dto.productId !== undefined && current.productId !== dto.productId) throw new BadRequestException('A promocao nao pode ser transferida para outro produto.');
    if (dto.promotionalPrice === undefined && dto.discountPercent === undefined && dto.startAt === undefined && dto.endAt === undefined) {
      throw new BadRequestException('Informe ao menos um campo para atualizar.');
    }
    const product = await this.prisma.product.findFirst({ where: { id: current.productId, storeId: store.id }, select: { id: true, price: true, status: true, stock: true } });
    if (!product) throw new NotFoundException('Produto nao encontrado.');
    if (product.status !== 'ACTIVE' || product.stock < 1) {
      throw new BadRequestException('Somente produtos ativos e com estoque podem ter promocao.');
    }
    const terms = {
      promotionalPrice: dto.promotionalPrice !== undefined ? dto.promotionalPrice : dto.discountPercent != null ? null : current.promotionalPrice,
      discountPercent: dto.discountPercent !== undefined ? dto.discountPercent : dto.promotionalPrice != null ? null : current.discountPercent,
      startAt: dto.startAt ?? current.startAt,
      endAt: dto.endAt ?? current.endAt,
    };
    validatePromotion(terms, product.price);
    if (terms.endAt <= new Date()) throw new BadRequestException('A promoção precisa terminar no futuro.');
    const overlaps = await this.prisma.storePromotion.findMany({
      where: { id: { not: current.id }, productId: product.id, enabled: true, startAt: { lt: terms.endAt }, endAt: { gt: terms.startAt } },
      select: { startAt: true, endAt: true },
    });
    if (isPromotionOverlapping(terms.startAt, terms.endAt, overlaps)) {
      throw new ConflictException('O produto ja possui promocao em periodo sobreposto.');
    }
    return this.prisma.storePromotion.update({
      where: { id: current.id, storeId: store.id },
      data: {
        promotionalPrice: terms.promotionalPrice == null ? null : new Prisma.Decimal(terms.promotionalPrice),
        discountPercent: terms.discountPercent == null ? null : new Prisma.Decimal(terms.discountPercent),
        startAt: terms.startAt,
        endAt: terms.endAt,
      },
    });
  }

  async setPromotionEnabled(ownerId: string, promotionId: string, enabled: boolean) {
    const store = await this.prisma.storeProfile.findUnique({ where: { ownerId }, select: { id: true } });
    if (!store) throw new NotFoundException('Loja nao encontrada.');
    const promotion = await this.prisma.storePromotion.findFirst({
      where: { id: promotionId, storeId: store.id },
      include: { product: { select: { id: true, status: true, stock: true } } },
    });
    if (!promotion) throw new NotFoundException('Promocao nao encontrada.');
    if (enabled) {
      if (promotion.product.status !== 'ACTIVE' || promotion.product.stock < 1) {
        throw new BadRequestException('Somente produtos ativos e com estoque podem entrar em promocao.');
      }
      if (promotion.endAt <= new Date()) throw new BadRequestException('Nao e possivel ativar uma promocao encerrada.');
      const overlaps = await this.prisma.storePromotion.findMany({
        where: { id: { not: promotion.id }, productId: promotion.productId, enabled: true, startAt: { lt: promotion.endAt }, endAt: { gt: promotion.startAt } },
        select: { startAt: true, endAt: true },
      });
      if (isPromotionOverlapping(promotion.startAt, promotion.endAt, overlaps)) {
        throw new ConflictException('O produto ja possui promocao em periodo sobreposto.');
      }
    }
    return this.prisma.storePromotion.update({ where: { id: promotionId, storeId: store.id }, data: { enabled } });
  }


async createOrder(ownerId: string, dto: CreateStoreOrderDto) {
  const store = await this.prisma.storeProfile.findUnique({
    where: { ownerId },
    select: { id: true },
  });

  if (!store) {
    throw new NotFoundException('Loja nao encontrada.');
  }
  if (dto.customerId) {
    const customer = await this.prisma.user.findUnique({
      where: { id: dto.customerId },
      select: { id: true, role: true },
    });

    if (!customer || customer.role !== UserRole.CLIENTE) {
      throw new BadRequestException('Cliente invalido ou nao encontrado.');
    }
  }
  const items = dto.items.map((item) => {
    const unitPrice = new Prisma.Decimal(item.unitPrice);

    if (unitPrice.lte(0)) {
      throw new BadRequestException('O preco dos itens deve ser positivo.');
    }

    const lineTotal = unitPrice.mul(item.quantity);
    if (lineTotal.gt(new Prisma.Decimal('99999999.99'))) {
      throw new BadRequestException(
        'O valor total do item excede o limite permitido.',
      );
    }

    return {
      productId: item.productId ?? null,
      name: item.name.trim(),
      sku: item.sku ?? null,
      quantity: item.quantity,
      unitPrice,
      lineTotal,
    };
  });
  const subtotal = items.reduce(
    (sum, item) => sum.add(item.lineTotal),
    new Prisma.Decimal(0),
  );
  if (subtotal.gt(new Prisma.Decimal('99999999.99'))) {
    throw new BadRequestException(
      'O subtotal do pedido excede o limite permitido.',
    );
  }

  const discount = new Prisma.Decimal(0);
  const total = subtotal.sub(discount);

  return this.prisma.storeOrder.create({
    data: {
      orderNumber: `PED-${randomUUID()}`,
      storeId: store.id,
      customerId: dto.customerId ?? null,
      status: StoreOrderStatus.PENDING,
      subtotal,
      discount,
      total,
            addressSnapshot: dto.address
        ? {
            street: dto.address.street,
            number: dto.address.number,
            neighborhood: dto.address.neighborhood,
            city: dto.address.city,
            state: dto.address.state,
            zipCode: dto.address.zipCode,
            complement: dto.address.complement ?? null,
          }
        : Prisma.JsonNull,
      items: { create: items },
      statusHistory: {
        create: {
          fromStatus: null,
          toStatus: StoreOrderStatus.PENDING,
          actorId: ownerId,
          note: 'Pedido criado.',
        },
      },
    },
    include: { items: true },
  });
}


  async createClientOrder(customerId: string, dto: CreateClientStoreOrderDto) {
    const quantities = new Map<string, number>();
    for (const item of dto.items) {
      const quantity = (quantities.get(item.productId) ?? 0) + item.quantity;
      if (!Number.isSafeInteger(quantity) || quantity > 2147483647) {
        throw new BadRequestException('Quantidade de produto invalida.');
      }
      quantities.set(item.productId, quantity);
    }
    const productIds = [...quantities.keys()];
    if (!productIds.length) throw new BadRequestException('Informe ao menos um produto.');

    return this.prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, status: 'ACTIVE' },
      });
      if (products.length !== productIds.length) {
        throw new BadRequestException('Um ou mais produtos nao estao disponiveis.');
      }
      const storeId = products[0].storeId;
      if (products.some((product) => product.storeId !== storeId)) {
        throw new BadRequestException('Todos os produtos devem pertencer a mesma loja.');
      }

      const now = new Date();
      const promotions = await tx.storePromotion.findMany({
        where: { productId: { in: productIds }, ...currentPromotionWhere(now) },
        orderBy: promotionOrder,
      });
      const pricing = new EffectivePriceService(() => now);
      const orderItems = productIds.map((productId) => {
        const product = products.find((candidate) => candidate.id === productId)!;
        const quantity = quantities.get(productId)!;
        const promotion = promotions.find((candidate) => candidate.productId === productId) ?? null;
        const unitPrice = pricing.getEffectivePrice(product.price, promotion, now);
        const lineTotal = unitPrice.mul(quantity);
        if (lineTotal.greaterThan('99999999.99')) {
          throw new BadRequestException('O valor total do item excede o limite permitido.');
        }
        return { productId, name: product.name, sku: product.sku, quantity, unitPrice, lineTotal, baseTotal: new Prisma.Decimal(product.price).mul(quantity) };
      });
      const subtotal = orderItems.reduce((sum, item) => sum.add(item.baseTotal), new Prisma.Decimal(0));
      const total = orderItems.reduce((sum, item) => sum.add(item.lineTotal), new Prisma.Decimal(0));
      if (subtotal.greaterThan('99999999.99') || total.lte(0)) {
        throw new BadRequestException('Total do pedido invalido.');
      }

      for (const item of orderItems) {
        const updated = await tx.product.updateMany({
          where: { id: item.productId, storeId, status: 'ACTIVE', stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (updated.count !== 1) {
          throw new ConflictException('Estoque insuficiente para um ou mais produtos.');
        }
      }

      return tx.storeOrder.create({
        data: {
          orderNumber: `PED-${randomUUID()}`,
          storeId,
          customerId,
          status: StoreOrderStatus.PENDING,
          stockReserved: true,
          subtotal,
          discount: subtotal.sub(total),
          total,
          addressSnapshot: {
            street: dto.address.street,
            number: dto.address.number,
            neighborhood: dto.address.neighborhood,
            city: dto.address.city,
            state: dto.address.state,
            zipCode: dto.address.zipCode,
            complement: dto.address.complement ?? null,
          },
          note: dto.observation?.trim() || null,
          items: { create: orderItems.map(({ baseTotal, ...item }) => item) },
          statusHistory: {
            create: { fromStatus: null, toStatus: StoreOrderStatus.PENDING, actorId: customerId, note: 'Pedido criado.' },
          },
        },
        include: { items: true, statusHistory: true },
      });
    });
  }

  async changeOrderStatus(ownerId: string, orderId: string, status: StoreOrderStatus) {
    const store = await this.prisma.storeProfile.findUnique({ where: { ownerId }, select: { id: true } });
    if (!store) throw new NotFoundException('Loja nao encontrada.');

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.storeOrder.findFirst({
        where: { id: orderId, storeId: store.id },
        include: {
          items: { select: { productId: true, quantity: true } },
        },
      });
      if (!order) throw new NotFoundException('Pedido nao encontrado.');
      if (status === StoreOrderStatus.CANCELED && order.status === StoreOrderStatus.CANCELED) {
        return tx.storeOrder.findFirstOrThrow({
          where: { id: orderId, storeId: store.id },
          include: { items: true, statusHistory: true },
        });
      }
      if (!canTransitionOrder({ currentStatus: order.status, targetStatus: status, actor: UserRole.LOJISTA })) {
        throw new BadRequestException('Transicao de pedido invalida.');
      }
      const changed = await tx.storeOrder.updateMany({
        where: { id: orderId, storeId: store.id, status: order.status },
        data: { status },
      });
      if (changed.count !== 1) throw new ConflictException('O pedido mudou durante a atualizacao.');

      if (status === StoreOrderStatus.CANCELED && order.stockReserved) {
        for (const item of order.items) {
          if (!item.productId) continue;
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }
      await tx.orderStatusHistory.create({
        data: { orderId, fromStatus: order.status, toStatus: status, actorId: ownerId },
      });
      return tx.storeOrder.findFirstOrThrow({
        where: { id: orderId, storeId: store.id },
        include: { items: true, statusHistory: true },
      });
    });
  }
}
