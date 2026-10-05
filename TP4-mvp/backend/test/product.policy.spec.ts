import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { activationPending, canChangeProductStatus } from '../src/modules/products/application/product.policy';
import { ProductRecord, ProductStatus } from '../src/modules/products/application/product.repository';

const product = (): ProductRecord => ({
  id: 'p', storeId: 's', categoryId: 'c', sku: null, name: 'Cimento', description: null,
  price: '12.50', stock: 0, status: 'DRAFT', lastPriceUpdateAt: new Date(),
  createdAt: new Date(), updatedAt: new Date(),
  images: [{ id: 'i', url: '/cover.jpg', objectKey: null, altText: null, position: 0, isCover: true }],
});

describe('Product policy', () => {
  it('requires a complete product and active category before activation', () => {
    assert.deepEqual(activationPending(product(), true), []);
    const incomplete = product();
    incomplete.name = ' ';
    incomplete.price = '0.00';
    incomplete.stock = -1;
    incomplete.images = [];
    assert.deepEqual(activationPending(incomplete, false), [
      'NAME_REQUIRED', 'ACTIVE_CATEGORY_REQUIRED', 'PRICE_REQUIRED', 'STOCK_REQUIRED', 'COVER_IMAGE_REQUIRED',
    ]);
  });

  it('keeps archived products terminal and reserves archive for DELETE', () => {
    for (const target of ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'] as ProductStatus[]) {
      assert.equal(canChangeProductStatus('ARCHIVED', target), false);
      assert.equal(canChangeProductStatus('ACTIVE', 'ARCHIVED'), false);
    }
    assert.equal(canChangeProductStatus('DRAFT', 'ACTIVE'), true);
    assert.equal(canChangeProductStatus('INACTIVE', 'ACTIVE'), true);
    assert.equal(canChangeProductStatus('ACTIVE', 'DRAFT'), false);
  });
});
