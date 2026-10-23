import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryStatus, NotificationType, Prisma, StoreOrderStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { canTransitionOrder } from './application/orders/order-status-policy';
import { canTransitionDelivery } from './application/orders/delivery-status-policy';
import { StoreOrdersQueryDto } from './dto/store-orders-query.dto';
import { UpsertDeliveryDto } from './dto/upsert-delivery.dto';

const orderInclude = Prisma.validator<Prisma.StoreOrderInclude>()({
  customer: { select: { id: true, name: true, phone: true } },
  items: { select: { id: true, productId: true, name: true, sku: true, quantity: true, unitPrice: true, lineTotal: true } },
  statusHistory: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  delivery: { include: { statusHistory: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } } },
});

type OrderWithTracking = Prisma.StoreOrderGetPayload<{ include: typeof orderInclude }>;

@Injectable()
export class StoreOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private async storeId(ownerId: string) {
    const store = await this.prisma.storeProfile.findUnique({ where: { ownerId }, select: { id: true } });
    if (!store) throw new NotFoundException('Loja nao encontrada.');
    return store.id;
  }

  private present(order: OrderWithTracking) {
    const { statusHistory, delivery, ...fields } = order;
    const timeline = [
      ...statusHistory.map(({ id, fromStatus, toStatus, actorId, note, createdAt }) => ({ id, kind: 'ORDER' as const, fromStatus, toStatus, actorId, note, createdAt })),
      ...(delivery?.statusHistory ?? []).map(({ id, fromStatus, toStatus, actorId, createdAt }) => ({ id, kind: 'DELIVERY' as const, fromStatus, toStatus, actorId, note: null, createdAt })),
    ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
    return {
      ...fields,
      delivery: delivery ? { id: delivery.id, status: delivery.status, trackingCode: delivery.trackingCode, carrier: delivery.carrier, estimatedDate: delivery.estimatedDate, deliveredAt: delivery.deliveredAt, createdAt: delivery.createdAt, updatedAt: delivery.updatedAt } : null,
      isDelayed: !!delivery?.estimatedDate && delivery.estimatedDate.getTime() < Date.now() && delivery.status !== DeliveryStatus.DELIVERED && delivery.status !== DeliveryStatus.CANCELED,
      timeline,
    };
  }

  async list(ownerId: string, query: StoreOrdersQueryDto) {
    const storeId = await this.storeId(ownerId);
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to && from > to) throw new BadRequestException('Periodo invalido.');
    const orders = await this.prisma.storeOrder.findMany({
      where: { storeId, status: query.status, createdAt: { gte: from, lte: to } },
      include: orderInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return orders.map((order) => this.present(order));
  }

  async get(ownerId: string, id: string) {
    const storeId = await this.storeId(ownerId);
    const order = await this.prisma.storeOrder.findFirst({ where: { id, storeId }, include: orderInclude });
    if (!order) throw new NotFoundException('Pedido nao encontrado.');
    return this.present(order);
  }

  private async notify(tx: Prisma.TransactionClient, customerId: string | null, orderId: string, title: string, body: string) {
    if (!customerId) return;
    await tx.notification.create({ data: { userId: customerId, type: NotificationType.STORE_ORDER_UPDATED, title, body, data: { orderId } } });
  }

  async changeStatus(ownerId: string, id: string, status: StoreOrderStatus) {
    const storeId = await this.storeId(ownerId);
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.storeOrder.findFirst({ where: { id, storeId }, include: { delivery: true } });
      if (!order) throw new NotFoundException('Pedido nao encontrado.');
      if (order.status === status) return;
      if (!canTransitionOrder({ currentStatus: order.status, targetStatus: status, actor: UserRole.LOJISTA })) throw new ConflictException('Transicao de pedido invalida.');
      if (status === StoreOrderStatus.COMPLETED && order.delivery?.status !== DeliveryStatus.DELIVERED) throw new ConflictException('A entrega precisa estar concluida.');
      if (status === StoreOrderStatus.CANCELED && order.delivery && !canTransitionDelivery(order.delivery.status, DeliveryStatus.CANCELED, order.status)) throw new ConflictException('A entrega nao pode ser cancelada neste estado.');
      const changed = await tx.storeOrder.updateMany({ where: { id, storeId, status: order.status }, data: { status } });
      if (changed.count !== 1) throw new ConflictException('O pedido mudou durante a atualizacao.');
      await tx.orderStatusHistory.create({ data: { orderId: id, fromStatus: order.status, toStatus: status, actorId: ownerId } });
      if (status === StoreOrderStatus.CANCELED && order.delivery) {
        const updated = await tx.delivery.updateMany({ where: { id: order.delivery.id, status: order.delivery.status }, data: { status: DeliveryStatus.CANCELED } });
        if (updated.count !== 1) throw new ConflictException('A entrega mudou durante a atualizacao.');
        await tx.deliveryStatusHistory.create({ data: { deliveryId: order.delivery.id, fromStatus: order.delivery.status, toStatus: DeliveryStatus.CANCELED, actorId: ownerId } });
      }
      await this.notify(tx, order.customerId, id, 'Pedido atualizado', `O pedido ${order.orderNumber ?? id} mudou para ${status}.`);
    });
    return this.get(ownerId, id);
  }

  async upsertDelivery(ownerId: string, id: string, dto: UpsertDeliveryDto) {
    const storeId = await this.storeId(ownerId);
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.storeOrder.findFirst({ where: { id, storeId }, include: { delivery: true } });
      if (!order) throw new NotFoundException('Pedido nao encontrado.');
      if (order.status === StoreOrderStatus.PENDING || order.status === StoreOrderStatus.CANCELED || order.status === StoreOrderStatus.COMPLETED || order.delivery?.status === DeliveryStatus.DELIVERED || order.delivery?.status === DeliveryStatus.CANCELED) throw new ConflictException('Entrega nao pode ser configurada neste estado.');
      if (dto.trackingCode === undefined && dto.carrier === undefined && dto.estimatedDate === undefined) throw new BadRequestException('Informe dados da entrega.');
      const data = {
        trackingCode: dto.trackingCode?.trim(),
        carrier: dto.carrier?.trim(),
        estimatedDate: dto.estimatedDate ? new Date(dto.estimatedDate) : undefined,
      };
      const unchanged = order.delivery && Object.entries(data).every(([key, value]) => value === undefined || (value instanceof Date ? value.getTime() === order.delivery?.estimatedDate?.getTime() : value === order.delivery?.[key as 'carrier' | 'trackingCode']));
      if (unchanged) return;
      const locked = await tx.storeOrder.updateMany({ where: { id, storeId, status: order.status }, data: { updatedAt: new Date() } });
      if (locked.count !== 1) throw new ConflictException('O pedido mudou durante a atualizacao.');
      if (order.delivery) {
        const changed = await tx.delivery.updateMany({ where: { id: order.delivery.id, status: order.delivery.status, updatedAt: order.delivery.updatedAt }, data });
        if (changed.count !== 1) throw new ConflictException('A entrega mudou durante a atualizacao.');
      } else {
        const delivery = await tx.delivery.create({ data: { orderId: id, ...data } });
        await tx.deliveryStatusHistory.create({ data: { deliveryId: delivery.id, toStatus: DeliveryStatus.PENDING, actorId: ownerId } });
      }
      await this.notify(tx, order.customerId, id, 'Previsao de entrega atualizada', `A entrega do pedido ${order.orderNumber ?? id} foi atualizada.`);
    });
    return this.get(ownerId, id);
  }

  async changeDeliveryStatus(ownerId: string, id: string, status: DeliveryStatus) {
    const storeId = await this.storeId(ownerId);
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.storeOrder.findFirst({ where: { id, storeId }, include: { delivery: true } });
      if (!order) throw new NotFoundException('Pedido nao encontrado.');
      const delivery = order.delivery;
      if (!delivery) throw new ConflictException('Configure a entrega antes de alterar o status.');
      if (delivery.status === status) return;
      if (!canTransitionDelivery(delivery.status, status, order.status)) throw new ConflictException('Transicao de entrega invalida.');
      const locked = await tx.storeOrder.updateMany({ where: { id, storeId, status: order.status }, data: { updatedAt: new Date() } });
      if (locked.count !== 1) throw new ConflictException('O pedido mudou durante a atualizacao.');
      const changed = await tx.delivery.updateMany({ where: { id: delivery.id, status: delivery.status }, data: { status, deliveredAt: status === DeliveryStatus.DELIVERED ? new Date() : null } });
      if (changed.count !== 1) throw new ConflictException('A entrega mudou durante a atualizacao.');
      await tx.deliveryStatusHistory.create({ data: { deliveryId: delivery.id, fromStatus: delivery.status, toStatus: status, actorId: ownerId } });
      if (status === DeliveryStatus.DELIVERED || status === DeliveryStatus.CANCELED) {
        const target = status === DeliveryStatus.DELIVERED ? StoreOrderStatus.COMPLETED : StoreOrderStatus.CANCELED;
        if (!canTransitionOrder({ currentStatus: order.status, targetStatus: target, actor: UserRole.LOJISTA })) throw new ConflictException('O pedido nao permite esta transicao.');
        const updated = await tx.storeOrder.updateMany({ where: { id, storeId, status: order.status }, data: { status: target } });
        if (updated.count !== 1) throw new ConflictException('O pedido mudou durante a atualizacao.');
        await tx.orderStatusHistory.create({ data: { orderId: id, fromStatus: order.status, toStatus: target, actorId: ownerId } });
      }
      await this.notify(tx, order.customerId, id, 'Entrega atualizada', `A entrega do pedido ${order.orderNumber ?? id} mudou para ${status}.`);
    });
    return this.get(ownerId, id);
  }
}
