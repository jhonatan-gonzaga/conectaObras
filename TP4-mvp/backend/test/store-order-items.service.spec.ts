import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { StoreOrdersService } from '../src/modules/stores/store-orders.service';

function fixture() {
  const product = {
    storeId: 'store-a', name: 'Tijolo atual', sku: 'SKU-NOVO', description: 'Descrição do catálogo',
    price: '15.00', stock: 20, status: 'ARCHIVED', category: { name: 'Alvenaria' },
    images: [{ id: 'image-a', url: '/image.jpg', altText: 'Tijolo', position: 0, isCover: true }],
  };
  const item = { id: 'item-a', name: 'Tijolo comprado', sku: 'SKU-ANTIGO', quantity: 2, unitPrice: '10.00', lineTotal: '20.00' };
  const record = { orderId: 'order-a', storeId: 'store-a', customerId: 'customer-a', item, product: product as typeof product | null };
  const prisma = {
    storeProfile: { findUnique: async ({ where }: any) => ({ id: where.ownerId === 'owner-a' ? 'store-a' : 'store-b' }) },
    storeOrderItem: {
      findFirst: async ({ where }: any) => {
        if (where.id !== record.item.id || where.order.id !== record.orderId ||
          (where.order.storeId && where.order.storeId !== record.storeId) ||
          (where.order.customerId && where.order.customerId !== record.customerId)) return null;
        return { ...record.item, order: { storeId: record.storeId }, product: record.product };
      },
    },
  };
  return { service: new StoreOrdersService(prisma as unknown as PrismaService), record };
}

test('LOJA-022: detalhe do item exige propriedade do pedido e vínculo com o item', async () => {
  const { service } = fixture();
  const owner = await service.getItem('owner-a', 'order-a', 'item-a');
  assert.equal(owner.item.unitPrice, '10.00');
  assert.equal(owner.product?.price, '15.00');
  assert.equal(owner.product?.stock, 20);
  assert.equal(owner.product?.categoryName, 'Alvenaria');
  await assert.rejects(service.getItem('owner-b', 'order-a', 'item-a'), NotFoundException);
  await assert.rejects(service.getItem('owner-a', 'other-order', 'item-a'), NotFoundException);
  await assert.rejects(service.getItem('owner-a', 'order-a', 'other-item'), NotFoundException);
  await assert.rejects(service.getClientItem('customer-b', 'order-a', 'item-a'), NotFoundException);
  await assert.rejects(service.getClientItem('customer-a', 'other-order', 'item-a'), NotFoundException);
  await assert.rejects(service.getClientItem('customer-a', 'order-a', 'other-item'), NotFoundException);
});

test('LOJA-022: cliente consulta produto comprado arquivado sem dados internos de gestão', async () => {
  const { service } = fixture();
  const result = await service.getClientItem('customer-a', 'order-a', 'item-a');
  assert.deepEqual(result.item, { id: 'item-a', name: 'Tijolo comprado', sku: 'SKU-ANTIGO', quantity: 2, unitPrice: '10.00', lineTotal: '20.00' });
  assert.deepEqual(result.product, {
    name: 'Tijolo atual', sku: 'SKU-NOVO', description: 'Descrição do catálogo', price: '15.00', categoryName: 'Alvenaria',
    images: [{ id: 'image-a', url: '/image.jpg', altText: 'Tijolo', position: 0, isCover: true }],
  });
  assert.equal('productId' in result.item, false);
  assert.equal('order' in result.item, false);
});

test('LOJA-022: produto removido ou de outra loja preserva somente o snapshot da compra', async () => {
  const { service, record } = fixture();
  record.product!.storeId = 'store-b';
  const foreign = await service.getClientItem('customer-a', 'order-a', 'item-a');
  assert.equal(foreign.product, null);
  assert.equal(foreign.item.name, 'Tijolo comprado');
  record.product = null;
  const removed = await service.getItem('owner-a', 'order-a', 'item-a');
  assert.equal(removed.product, null);
  assert.equal(removed.item.lineTotal, '20.00');
});
