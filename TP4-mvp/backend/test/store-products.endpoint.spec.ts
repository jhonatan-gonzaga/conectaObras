import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { after, before, beforeEach, describe, it } from 'node:test';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../src/common/types/authenticated-user';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { ProductUseCases } from '../src/modules/products/application/product.use-cases';
import { UpdateInventoryUseCase } from '../src/modules/products/application/update-inventory.use-case';
import { CreateProductInput, InventoryUpdateInput, ProductListQuery, ProductPage, ProductRecord, ProductRepository, ProductStatus, UpdateProductInput } from '../src/modules/products/application/product.repository';
import { ProductsController } from '../src/modules/products/products.controller';
import { GetMyStoreUseCase } from '../src/modules/stores/application/use-cases/get-my-store.use-case';

class MemoryProducts implements ProductRepository {
  rows = new Map<string, ProductRecord>();
  activeCategories = new Set(['category']);
  nextId = 1;

  reset() {
    this.rows.clear();
    this.activeCategories = new Set(['category']);
    this.nextId = 1;
  }

  async create(storeId: string, input: CreateProductInput): Promise<ProductRecord> {
    const now = new Date();
    const row: ProductRecord = {
      id: `product-${this.nextId++}`, storeId, categoryId: input.categoryId,
      sku: input.sku ?? null, name: input.name, description: input.description ?? null,
      price: Number(input.price).toFixed(2), stock: input.stock, status: 'DRAFT',
      lastPriceUpdateAt: now, createdAt: now, updatedAt: now, images: [],
    };
    this.rows.set(row.id, row);
    return row;
  }

  async findByStore(storeId: string, productId: string) {
    const row = this.rows.get(productId);
    return row?.storeId === storeId ? row : null;
  }

  async listByStore(storeId: string, status?: ProductStatus) {
    return [...this.rows.values()].filter((row) => row.storeId === storeId && (!status || row.status === status));
  }

  async listPage(storeId: string, query: ProductListQuery): Promise<ProductPage> {
    const rows = (await this.listByStore(storeId, query.status)).filter((row) =>
      (!query.categoryId || row.categoryId === query.categoryId) &&
      (!query.q || `${row.name} ${row.sku ?? ''}`.toLowerCase().includes(query.q.toLowerCase())) &&
      (!query.stock || (query.stock === 'IN_STOCK' ? row.stock > 0 : row.stock === 0)),
    );
    return {
      items: rows.slice((query.page - 1) * query.limit, query.page * query.limit),
      total: rows.length, page: query.page, limit: query.limit,
    };
  }

  async categoryIsActive(categoryId: string) {
    return this.activeCategories.has(categoryId);
  }

  async update(storeId: string, productId: string, currentStatus: ProductStatus, input: UpdateProductInput, priceChanged: boolean) {
    const row = await this.findByStore(storeId, productId);
    if (!row || row.status !== currentStatus) return false;
    Object.assign(row, input);
    if (input.sku !== undefined) row.sku = input.sku?.trim().toUpperCase() || null;
    if (input.price !== undefined) row.price = Number(input.price).toFixed(2);
    if (priceChanged) row.lastPriceUpdateAt = new Date();
    return true;
  }

  async changeStatus(storeId: string, productId: string, currentStatus: ProductStatus, status: ProductStatus) {
    const row = await this.findByStore(storeId, productId);
    if (!row || row.status !== currentStatus) return false;
    row.status = status;
    return true;
  }

  async archive(storeId: string, productId: string) {
    const row = await this.findByStore(storeId, productId);
    if (!row) return false;
    row.status = 'ARCHIVED';
    return true;
  }

  async updatePrice(storeId: string, productId: string, price: string) {
    const row = await this.findByStore(storeId, productId);
    if (!row) return false;
    row.price = price;
    return true;
  }

  async updateInventory(storeId: string, _actorId: string, expected: ProductRecord, input: InventoryUpdateInput) {
    const row = await this.findByStore(storeId, expected.id);
    if (!row || row.status === 'ARCHIVED' || row.updatedAt !== expected.updatedAt) return null;
    if (input.price !== undefined && input.price !== row.price) {
      row.price = Number(input.price).toFixed(2);
      row.lastPriceUpdateAt = new Date();
    }
    if (input.stock !== undefined) row.stock = input.stock;
    row.updatedAt = new Date();
    return row;
  }
}

describe('Store products API', () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwt: JwtService;
  const products = new MemoryProducts();
  const valid = { categoryId: 'category', name: 'Cimento', price: '29.90', stock: 3 };

  before(async () => {
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'store-products-test' })],
      controllers: [ProductsController],
      providers: [
        JwtAuthGuard, RolesGuard, ProductUseCases, UpdateInventoryUseCase,
        { provide: ProductRepository, useValue: products },
        { provide: GetMyStoreUseCase, useValue: {
          execute: async (ownerId: string) => ({ id: `store-${ownerId}` }),
        } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
    jwt = module.get(JwtService);
  });

  beforeEach(() => products.reset());
  after(async () => app.close());

  const token = (ownerId: string, role: UserRole = UserRole.LOJISTA) => jwt.sign({
    id: ownerId, email: `${ownerId}@example.test`, role,
  } satisfies AuthenticatedUser);

  const request = (ownerId: string | null, path = '', method = 'GET', body?: unknown) => fetch(
    `${baseUrl}/api/store-products${path}`,
    { method, headers: {
      ...(ownerId ? { authorization: `Bearer ${token(ownerId)}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    }, body: body === undefined ? undefined : JSON.stringify(body) },
  );

  it('requires JWT and LOJISTA role', async () => {
    assert.equal((await request(null)).status, 401);
    const response = await fetch(`${baseUrl}/api/store-products`, {
      headers: { authorization: `Bearer ${token('client', UserRole.CLIENTE)}` },
    });
    assert.equal(response.status, 403);
  });

  it('validates DTOs and rejects storeId from body', async () => {
    for (const body of [
      { ...valid, storeId: 'store-other' },
      { ...valid, price: '0' },
      { ...valid, price: '1.001' },
      { ...valid, stock: -1 },
      { ...valid, stock: 1.5 },
      { ...valid, name: ' ' },
      { ...valid, description: 'x'.repeat(2001) },
      { ...valid, categoryId: 'inactive' },
      { name: 'missing values' },
    ]) {
      assert.equal((await request('a', '', 'POST', body)).status, 400, JSON.stringify(body).slice(0, 80));
    }
    assert.equal(products.rows.size, 0);
    const created = await (await request('a', '', 'POST', valid)).json() as ProductRecord;
    assert.equal((await request('a', `/${created.id}`, 'PATCH', { stock: null })).status, 400);
    assert.equal((await request('a', `/${created.id}`, 'PATCH', { storeId: 'store-other' })).status, 400);
    assert.equal((await request('a', `/${created.id}`, 'PATCH', {})).status, 400);
    assert.equal((await request('a', `/${created.id}/status`, 'PATCH', { status: 'ARCHIVED' })).status, 409);
  });

  it('creates, reads, filters, paginates, edits, and archives only the owner store', async () => {
    const firstResponse = await request('a', '', 'POST', valid);
    assert.equal(firstResponse.status, 201);
    const first = await firstResponse.json() as ProductRecord;
    const second = await (await request('a', '', 'POST', { ...valid, name: 'Areia', stock: 0 })).json() as ProductRecord;
    await request('b', '', 'POST', { ...valid, name: 'Loja B' });
    assert.equal(first.storeId, 'store-a');
    assert.equal((await request('b', `/${first.id}`)).status, 404);
    assert.equal((await request('b', `/${first.id}`, 'PATCH', { name: 'Ataque' })).status, 404);
    assert.equal((await request('b', `/${first.id}`, 'DELETE')).status, 404);
    const pageResponse = await request('a', '?q=cimento&categoryId=category&status=DRAFT&stock=IN_STOCK&page=1&limit=1');
    const page = await pageResponse.json() as ProductPage;
    assert.equal(pageResponse.status, 200);
    assert.deepEqual({ total: page.total, page: page.page, limit: page.limit }, { total: 1, page: 1, limit: 1 });
    assert.deepEqual(page.items.map((item) => item.id), [first.id]);
    const zeroStock = await (await request('a', '?stock=OUT_OF_STOCK')).json() as ProductPage;
    assert.deepEqual(zeroStock.items.map((item) => item.id), [second.id]);
    assert.equal((await request('a', '?page=0')).status, 400);
    assert.equal((await request('a', '?limit=101')).status, 400);
    assert.equal((await request('a', '?stock=INVALID')).status, 400);
    const oldPriceDate = new Date('2020-01-01T00:00:00.000Z');
    products.rows.get(first.id)!.lastPriceUpdateAt = oldPriceDate;
    await request('a', `/${first.id}`, 'PATCH', { price: '29.90' });
    assert.deepEqual(products.rows.get(first.id)!.lastPriceUpdateAt, oldPriceDate);
    const edited = await (await request('a', `/${first.id}`, 'PATCH', { name: ' Cimento CP II ', price: '30.00', stock: 0 })).json() as ProductRecord;
    assert.equal(edited.name, 'Cimento CP II');
    assert.equal(edited.price, '30.00');
    assert.equal(edited.stock, 0);
    assert(products.rows.get(first.id)!.lastPriceUpdateAt > oldPriceDate);
    const archived = await (await request('a', `/${first.id}`, 'DELETE')).json() as ProductRecord;
    assert.equal(archived.status, 'ARCHIVED');
    assert.equal((await request('a', `/${first.id}`, 'PATCH', { name: 'Outro' })).status, 409);
    assert.equal((await request('a', `/${first.id}`, 'DELETE')).status, 409);
    assert.equal((await request('a', `/${first.id}`)).status, 200);
    assert.equal((await (await request('a', '?status=ARCHIVED')).json() as ProductPage).total, 1);
  });

  it('requires cover and active category to activate, then permits deactivation', async () => {
    const created = await (await request('a', '', 'POST', valid)).json() as ProductRecord;
    const path = `/${created.id}/status`;
    const activate = () => request('a', path, 'PATCH', { status: 'ACTIVE' });
    const incomplete = await activate();
    assert.equal(incomplete.status, 400);
    assert((await incomplete.json() as { pending: string[] }).pending.includes('COVER_IMAGE_REQUIRED'));
    products.rows.get(created.id)!.images.push({
      id: 'cover', url: '/cover.jpg', objectKey: null, altText: null, position: 0, isCover: true,
    });
    products.activeCategories.delete('category');
    assert.equal((await activate()).status, 400);
    products.activeCategories.add('category');
    assert.equal((await activate()).status, 200);
    assert.equal(products.rows.get(created.id)!.status, 'ACTIVE');
    assert.equal((await request('b', path, 'PATCH', { status: 'INACTIVE' })).status, 404);
    assert.equal((await request('a', path, 'PATCH', { status: 'INACTIVE' })).status, 200);
    assert.equal((await request('a', path, 'PATCH', { status: 'DRAFT' })).status, 409);
    assert.equal((await activate()).status, 200);
    await request('a', `/${created.id}`, 'DELETE');
    assert.equal((await activate()).status, 409);
  });

  it('validates quick price and stock changes without mutating rejected input', async () => {
    const created = await (await request('a', '', 'POST', valid)).json() as ProductRecord;
    const path = `/${created.id}/inventory`;
    for (const body of [
      {}, { price: null }, { price: 10 }, { price: '0' }, { price: '-1' },
      { price: 'abc' }, { price: '1.234' }, { stock: null }, { stock: -1 },
      { stock: 1.5 }, { stock: 2_147_483_648 }, { stock: '2' }, { storeId: 'store-b', price: '10.00' },
    ]) {
      const response = await request('a', path, 'PATCH', body);
      assert.equal(response.status, 400, JSON.stringify(body));
    }
    assert.equal(products.rows.get(created.id)!.price, '29.90');
    assert.equal(products.rows.get(created.id)!.stock, 3);
    assert.equal((await request('b', path, 'PATCH', { stock: 0 })).status, 404);
    assert.equal((await request(null, path, 'PATCH', { stock: 0 })).status, 401);
  });

  it('saves quick updates immediately and derives catalog availability', async () => {
    const created = await (await request('a', '', 'POST', valid)).json() as ProductRecord;
    const path = `/${created.id}/inventory`;
    const oldDate = new Date('2020-01-01T00:00:00.000Z');
    const row = products.rows.get(created.id)!;
    row.status = 'ACTIVE';
    row.lastPriceUpdateAt = oldDate;
    const emptiedResponse = await request('a', path, 'PATCH', { stock: 0 });
    const emptied = await emptiedResponse.json() as ProductRecord & { available: boolean };
    assert.equal(emptiedResponse.status, 200);
    assert.equal(emptied.stock, 0);
    assert.equal(emptied.available, false);
    assert.deepEqual(row.lastPriceUpdateAt, oldDate);
    const restocked = await (await request('a', path, 'PATCH', { stock: 5 })).json() as ProductRecord & { available: boolean };
    assert.equal(restocked.available, true);
    assert.deepEqual(row.lastPriceUpdateAt, oldDate);
    const repriced = await (await request('a', path, 'PATCH', { price: '30.25' })).json() as ProductRecord & { available: boolean };
    assert.equal(repriced.price, '30.25');
    assert.equal(repriced.available, true);
    assert(row.lastPriceUpdateAt > oldDate);
    const listed = await (await request('a')).json() as ProductPage;
    assert.equal(listed.items[0].price, '30.25');
    await request('a', `/${created.id}`, 'DELETE');
    assert.equal((await request('a', path, 'PATCH', { stock: 1 })).status, 409);
  });
});
