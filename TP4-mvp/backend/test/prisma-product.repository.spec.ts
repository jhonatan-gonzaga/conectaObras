import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaProductRepository } from '../src/modules/products/infrastructure/prisma-product.repository';

function setup() {
  const calls: Array<{ operation: string; args: any }> = [];
  const product = {
    id: 'product-a', storeId: 'store-a', categoryId: 'category', name: 'Cimento',
    sku: 'SKU', price: new Prisma.Decimal('49.90'), stock: 4, status: 'DRAFT',
    images: [], lastPriceUpdateAt: new Date(),
  };
  const prisma = { product: {
    create: async (args: any) => { calls.push({ operation: 'create', args }); return product; },
    findFirst: async (args: any) => { calls.push({ operation: 'findFirst', args }); return null; },
    findMany: async (args: any) => { calls.push({ operation: 'findMany', args }); return [product]; },
    updateMany: async (args: any) => { calls.push({ operation: 'updateMany', args }); return { count: 0 }; },
  } };
  return { calls, repository: new PrismaProductRepository(prisma as unknown as PrismaService) };
}

describe('Product persistence adapter', () => {
  it('normaliza SKU e persiste dinheiro sem ponto flutuante', async () => {
    const { repository, calls } = setup();
    const result = await repository.create('store-a', {
      categoryId: 'category', name: 'Cimento', sku: ' abc-01 ', price: '49.90', stock: 4,
      images: [{ url: '/image.jpg', position: 0, isCover: true }],
    });
    assert.equal(result.price, '49.90');
    assert.equal(calls[0].args.data.sku, 'ABC-01');
    assert.equal(calls[0].args.data.storeId, 'store-a');
    assert(calls[0].args.data.price instanceof Prisma.Decimal);
    assert.equal(calls[0].args.data.images.create[0].isCover, true);
  });

  it('persiste SKU ausente ou vazio como null', async () => {
    const { repository, calls } = setup();
    for (const sku of [undefined, null, '  ']) {
      await repository.create('store-a', { categoryId: 'category', name: 'Cimento', sku, price: '1', stock: 0 });
    }
    assert(calls.every((call) => call.args.data.sku === null));
  });

  for (const price of ['0', '-1', '1.001', '100000000', '1e2', 'NaN', '1,50', '']) {
    it(`rejeita preco invalido antes de gravar: ${price}`, async () => {
      const { repository, calls } = setup();
      await assert.rejects(repository.create('a', { categoryId: 'c', name: 'n', price, stock: 0 }), RangeError);
      await assert.rejects(repository.updatePrice('a', 'p', price), RangeError);
      assert.equal(calls.length, 0);
    });
  }

  it('filtra leitura e listagem por loja e ordena imagens com desempate', async () => {
    const { repository, calls } = setup();
    assert.equal(await repository.findByStore('store-b', 'product-a'), null);
    const products = await repository.listByStore('store-b', 'ACTIVE');
    assert.equal(products[0].price, '49.90');
    assert.deepEqual(calls[0].args.where, { id: 'product-a', storeId: 'store-b' });
    assert.deepEqual(calls[1].args.where, { storeId: 'store-b', status: 'ACTIVE' });
    for (const call of calls) {
      assert.deepEqual(call.args.include.images.orderBy, [{ position: 'asc' }, { id: 'asc' }]);
    }
  });

  it('arquiva com filtro atomico de loja sem executar delete', async () => {
    const { repository, calls } = setup();
    assert.equal(await repository.archive('store-b', 'product-a'), false);
    assert.deepEqual(calls, [{ operation: 'updateMany', args: {
      where: { id: 'product-a', storeId: 'store-b' }, data: { status: 'ARCHIVED' },
    } }]);
  });

  it('atualiza preco e data juntos, preservando arquivados e precos iguais', async () => {
    const { repository, calls } = setup();
    assert.equal(await repository.updatePrice('store-b', 'product-a', '12.30'), false);
    const { where, data } = calls[0].args;
    assert.equal(where.storeId, 'store-b');
    assert.equal(where.id, 'product-a');
    assert.deepEqual(where.status, { not: 'ARCHIVED' });
    assert.equal(where.price.not.toFixed(2), '12.30');
    assert.equal(data.price.toFixed(2), '12.30');
    assert(data.lastPriceUpdateAt instanceof Date);
  });
});
