import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DeliveryStatus, StoreOrderStatus } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { StoreOrdersService } from '../src/modules/stores/store-orders.service';

function fixture(initialStatus: StoreOrderStatus = StoreOrderStatus.PENDING) {
  const order: any = {
    id: 'order-a', storeId: 'store-a', orderNumber: 'PED-A', customerId: 'customer-a',
    status: initialStatus, stockReserved: false, subtotal: '20.00', discount: '0.00', total: '20.00',
    addressSnapshot: { street: 'Rua A', number: '10' }, createdAt: new Date('2026-10-20T12:00:00Z'), updatedAt: new Date(),
    customer: { id: 'customer-a', name: 'Cliente A', phone: '1111' },
    store: { id: 'store-a', name: 'Loja A', whatsapp: '5592999999999' },
    items: [{ id: 'item-a', name: 'Tijolo', quantity: 2, unitPrice: '10.00', lineTotal: '20.00', sku: null, productId: null }],
    statusHistory: [], delivery: null,
  };
  const orderB = { ...order, id: 'order-b', storeId: 'store-b', orderNumber: 'PED-B' };
  const notifications: any[] = [];
  const stock = new Map([['product-a', 8]]);
  let sequence = 0;
  const tx: any = {
    storeOrder: {
      count: async ({ where }: any) => (await tx.storeOrder.findMany({ where })).length,
      findMany: async ({ where, skip = 0, take = 100 }: any) => [order, orderB].filter((item) => (!where.storeId || item.storeId === where.storeId) && (!where.customerId || item.customerId === where.customerId) && (!where.status || (typeof where.status === 'string' ? item.status === where.status : !where.status.notIn.includes(item.status))) && (!where.createdAt.gte || item.createdAt >= where.createdAt.gte) && (!where.createdAt.lte || item.createdAt <= where.createdAt.lte)).slice(skip, skip + take),
      findFirst: async ({ where }: any) => [order, orderB].find((item) => item.id === where.id && (!where.storeId || item.storeId === where.storeId) && (!where.customerId || item.customerId === where.customerId)) ?? null,
      updateMany: async ({ where, data }: any) => {
        if (where.id !== order.id || where.storeId !== order.storeId || where.status !== order.status) return { count: 0 };
        if (data.status) order.status = data.status;
        if (data.updatedAt) order.updatedAt = data.updatedAt;
        return { count: 1 };
      },
    },
    delivery: {
      create: async ({ data }: any) => {
        order.delivery = { id: 'delivery-a', status: DeliveryStatus.PENDING, trackingCode: data.trackingCode ?? null, carrier: data.carrier ?? null, estimatedDate: data.estimatedDate ?? null, deliveredAt: null, createdAt: new Date(), updatedAt: new Date(), statusHistory: [] };
        return order.delivery;
      },
      updateMany: async ({ where, data }: any) => {
        if (!order.delivery || order.delivery.id !== where.id || order.delivery.status !== where.status) return { count: 0 };
        if (where.updatedAt && order.delivery.updatedAt !== where.updatedAt) return { count: 0 };
        Object.assign(order.delivery, data);
        order.delivery.updatedAt = new Date();
        return { count: 1 };
      },
    },
    orderStatusHistory: { create: async ({ data }: any) => order.statusHistory.push({ id: `oh-${++sequence}`, ...data, createdAt: new Date() }) },
    deliveryStatusHistory: { create: async ({ data }: any) => order.delivery.statusHistory.push({ id: `dh-${++sequence}`, ...data, createdAt: new Date() }) },
    notification: { create: async ({ data }: any) => notifications.push(data) },
    product: { update: async ({ where, data }: any) => { stock.set(where.id, (stock.get(where.id) ?? 0) + data.stock.increment); } },
  };
  const prisma: any = {
    ...tx,
    storeProfile: { findUnique: async ({ where }: any) => ({ id: where.ownerId === 'owner-a' ? 'store-a' : 'store-b' }) },
    $transaction: async (callback: (transaction: any) => Promise<unknown>) => callback(tx),
  };
  return { service: new StoreOrdersService(prisma as PrismaService), order, notifications, stock };
}

test('LOJA-020: dois lojistas, filtros, cliente permitido e isolamento', async () => {
  const { service } = fixture();
  const results = await service.list('owner-a', { status: StoreOrderStatus.PENDING, from: '2026-10-20T00:00:00Z', to: '2026-10-21T00:00:00Z' });
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'order-a');
  assert.deepEqual(results[0].customer, { id: 'customer-a', name: 'Cliente A', phone: '1111' });
  assert.equal((results[0].addressSnapshot as { street: string }).street, 'Rua A');
  assert.equal(results[0].items.length, 1);
  assert.equal((await service.list('owner-a', { status: StoreOrderStatus.READY })).length, 0);
  assert.equal((await service.list('owner-a', { from: '2026-10-21T00:00:00Z' })).length, 0);
  assert.equal((await service.list('owner-b', {}))[0].id, 'order-b');
  await assert.rejects(service.get('owner-b', 'order-a'), NotFoundException);
  await assert.rejects(service.list('owner-a', { from: '2026-10-22T00:00:00Z', to: '2026-10-20T00:00:00Z' }), /Periodo invalido/);
});

test('LOJA-022: paginação mantém filtros e total da loja, inclusive após a última página', async () => {
  const { service } = fixture();
  const first = await service.listPage('owner-a', { status: StoreOrderStatus.PENDING, page: 1, limit: 1 });
  assert.equal(first.total, 1);
  assert.equal(first.page, 1);
  assert.equal(first.limit, 1);
  assert.deepEqual(first.items.map((item) => item.id), ['order-a']);
  const last = await service.listPage('owner-a', { page: 2, limit: 1 });
  assert.equal(last.total, 1);
  assert.deepEqual(last.items, []);
  assert.equal((await service.listPage('owner-b', {})).items[0].id, 'order-b');
  assert.equal((await service.listPage('owner-a', { from: '2026-10-21T00:00:00Z' })).total, 0);
  await assert.rejects(service.listPage('owner-a', { from: '2026-10-22T00:00:00Z', to: '2026-10-20T00:00:00Z' }), /Periodo invalido/);
});

test('LOJA-022: ações disponíveis seguem as policies e os estados da entrega', async () => {
  const { service, order } = fixture();
  assert.deepEqual((await service.get('owner-a', order.id)).allowedActions, {
    orderStatuses: ['CONFIRMED', 'CANCELED'], deliveryStatuses: [], canEditDelivery: false,
  });
  order.status = StoreOrderStatus.READY;
  await service.upsertDelivery('owner-a', order.id, { carrier: 'Local' });
  assert.deepEqual((await service.get('owner-a', order.id)).allowedActions, {
    orderStatuses: ['CANCELED'], deliveryStatuses: ['PREPARING', 'CANCELED'], canEditDelivery: true,
  });
  await service.changeDeliveryStatus('owner-a', order.id, DeliveryStatus.PREPARING);
  await service.changeDeliveryStatus('owner-a', order.id, DeliveryStatus.IN_TRANSIT);
  assert.deepEqual((await service.get('owner-a', order.id)).allowedActions.orderStatuses, []);
  assert.deepEqual((await service.get('owner-a', order.id)).allowedActions.deliveryStatuses, ['DELIVERED', 'FAILED']);
  await service.changeDeliveryStatus('owner-a', order.id, DeliveryStatus.DELIVERED);
  assert.deepEqual((await service.get('owner-a', order.id)).allowedActions, {
    orderStatuses: [], deliveryStatuses: [], canEditDelivery: false,
  });
});

test('LOJA-022: cliente lê apenas seus pedidos, com loja e sem campos internos nem ações de gestão', async () => {
  const { service, order } = fixture();
  const result = await service.listClient('customer-a', { group: 'OPEN', page: 1, limit: 1 });
  assert.equal(result.total, 2);
  assert.equal(result.items.length, 1);
  const detail = await service.getClient('customer-a', order.id);
  assert.equal(detail.store?.name, 'Loja A');
  assert.equal('stockReserved' in detail, false);
  assert.equal('customerId' in detail, false);
  assert.equal('productId' in detail.items[0], false);
  assert.deepEqual(detail.allowedActions, { orderStatuses: [], deliveryStatuses: [], canEditDelivery: false });
  assert.equal((await service.listClient('other-customer', {})).total, 0);
  await assert.rejects(service.getClient('other-customer', order.id), NotFoundException);
  order.status = StoreOrderStatus.COMPLETED;
  assert.equal((await service.listClient('customer-a', { group: 'OPEN' })).items.some((item) => item.id === order.id), false);
  assert.equal((await service.listClient('customer-a', { group: 'COMPLETED' })).total, 1);
  await assert.rejects(service.listClient('customer-a', { group: 'OPEN', status: StoreOrderStatus.READY }), /Use status ou grupo/);
});

test('LOJA-020: policy de pedido, histórico, notificação e idempotência', async () => {
  const { service, order, notifications } = fixture();
  await assert.rejects(service.changeStatus('owner-a', order.id, StoreOrderStatus.READY), (error: unknown) => error instanceof ConflictException && error.getStatus() === 409);
  assert.equal(order.statusHistory.length, 0);
  const updated = await service.changeStatus('owner-a', order.id, StoreOrderStatus.CONFIRMED);
  assert.equal(updated.status, StoreOrderStatus.CONFIRMED);
  assert.equal(updated.timeline[0].toStatus, StoreOrderStatus.CONFIRMED);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].userId, 'customer-a');
  await service.changeStatus('owner-a', order.id, StoreOrderStatus.CONFIRMED);
  assert.equal(order.statusHistory.length, 1);
  assert.equal(notifications.length, 1);
  await assert.rejects(service.changeStatus('owner-b', order.id, StoreOrderStatus.PREPARING), NotFoundException);
});

test('LOJA-020: datas, atraso derivado, entrega e sincronização terminal', async () => {
  const { service, order, notifications } = fixture(StoreOrderStatus.READY);
  const estimate = '2026-01-01T22:00:00.000Z';
  const future = await service.upsertDelivery('owner-a', order.id, { estimatedDate: '2099-01-01T22:00:00.000Z', carrier: 'Entrega local' });
  assert.equal(future.isDelayed, false);
  const configured = await service.upsertDelivery('owner-a', order.id, { estimatedDate: estimate, carrier: 'Entrega local' });
  assert.equal(configured.isDelayed, true);
  assert.equal(configured.delivery?.deliveredAt, null);
  assert.equal(configured.timeline[0].kind, 'DELIVERY');
  await service.upsertDelivery('owner-a', order.id, { estimatedDate: estimate, carrier: 'Entrega local' });
  assert.equal(notifications.length, 2);
  await assert.rejects(service.changeDeliveryStatus('owner-a', order.id, DeliveryStatus.IN_TRANSIT), (error: unknown) => error instanceof ConflictException && error.getStatus() === 409);
  await service.changeDeliveryStatus('owner-a', order.id, DeliveryStatus.PREPARING);
  await service.changeDeliveryStatus('owner-a', order.id, DeliveryStatus.IN_TRANSIT);
  assert.equal(order.delivery.deliveredAt, null);
  const delivered = await service.changeDeliveryStatus('owner-a', order.id, DeliveryStatus.DELIVERED);
  assert.equal(delivered.status, StoreOrderStatus.COMPLETED);
  assert.equal(delivered.delivery?.status, DeliveryStatus.DELIVERED);
  assert.ok(delivered.delivery?.deliveredAt instanceof Date);
  assert.equal(delivered.isDelayed, false);
  assert.equal(delivered.timeline.filter((event) => event.kind === 'DELIVERY').length, 4);
  assert.equal(delivered.timeline.filter((event) => event.kind === 'ORDER').length, 1);
  const notificationCount = notifications.length;
  await service.changeDeliveryStatus('owner-a', order.id, DeliveryStatus.DELIVERED);
  assert.equal(notifications.length, notificationCount);
  assert.equal(order.delivery.statusHistory.length, 4);
  await assert.rejects(service.upsertDelivery('owner-a', order.id, { carrier: 'Outra' }), ConflictException);
});

test('LOJA-020: cancelamento sincroniza entrega sem preencher deliveredAt', async () => {
  const { service, order } = fixture(StoreOrderStatus.PREPARING);
  await service.upsertDelivery('owner-a', order.id, { carrier: 'Entrega local' });
  const canceled = await service.changeStatus('owner-a', order.id, StoreOrderStatus.CANCELED);
  assert.equal(canceled.delivery?.status, DeliveryStatus.CANCELED);
  assert.equal(canceled.delivery?.deliveredAt, null);
  assert.equal(canceled.timeline.filter((event) => event.kind === 'DELIVERY').length, 2);
  assert.equal(canceled.isDelayed, false);
  await assert.rejects(service.changeDeliveryStatus('owner-a', order.id, DeliveryStatus.DELIVERED), ConflictException);
});

test('LOJA-020 + LOJA-019: cancelar pedido com reserva devolve estoque uma vez', async () => {
  const { service, order, stock } = fixture(StoreOrderStatus.PREPARING);
  order.stockReserved = true;
  order.items[0].productId = 'product-a';
  await service.changeStatus('owner-a', order.id, StoreOrderStatus.CANCELED);
  assert.equal(stock.get('product-a'), 10);
  await service.changeStatus('owner-a', order.id, StoreOrderStatus.CANCELED);
  assert.equal(stock.get('product-a'), 10);
});

test('LOJA-020 + LOJA-019: cancelar entrega devolve reserva do pedido', async () => {
  const { service, order, stock } = fixture(StoreOrderStatus.READY);
  order.stockReserved = true;
  order.items[0].productId = 'product-a';
  await service.upsertDelivery('owner-a', order.id, { carrier: 'Entrega local' });
  await service.changeDeliveryStatus('owner-a', order.id, DeliveryStatus.PREPARING);
  const result = await service.changeDeliveryStatus('owner-a', order.id, DeliveryStatus.CANCELED);
  assert.equal(result.status, StoreOrderStatus.CANCELED);
  assert.equal(stock.get('product-a'), 10);
  await service.changeDeliveryStatus('owner-a', order.id, DeliveryStatus.CANCELED);
  assert.equal(stock.get('product-a'), 10);
});
