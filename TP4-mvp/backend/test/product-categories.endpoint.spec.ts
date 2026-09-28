import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { after, before, describe, it } from 'node:test';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProductCategoriesModule } from '../src/modules/product-categories/product-categories.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('GET /product-categories', () => {
  let app: INestApplication;
  let baseUrl: string;
  const rows = [
    { id: 'cement', name: 'Cimento e argamassa', slug: 'cimento-e-argamassa', description: null, imageUrl: null, active: true },
    { id: 'hidden', name: 'Oculta', slug: 'oculta', description: null, imageUrl: null, active: false },
    { id: 'sand', name: 'Areia e brita', slug: 'areia-e-brita', description: null, imageUrl: null, active: true },
  ];
  const queries: any[] = [];

  before(async () => {
    const prisma = {
      productCategory: {
        findMany: async (query: any) => {
          queries.push(query);
          return rows
            .filter((row) => row.active === query.where.active)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((row) => Object.fromEntries(Object.keys(query.select).map((key) => [key, row[key as keyof typeof row]])));
        },
      },
    };
    const module = await Test.createTestingModule({ imports: [ProductCategoriesModule] })
      .overrideProvider(PrismaService).useValue(prisma).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  after(async () => app?.close());

  it('retorna publicamente apenas categorias ativas, em ordem e sem campos internos', async () => {
    const response = await fetch(`${baseUrl}/api/product-categories`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), [
      { id: 'sand', name: 'Areia e brita', slug: 'areia-e-brita', description: null, imageUrl: null },
      { id: 'cement', name: 'Cimento e argamassa', slug: 'cimento-e-argamassa', description: null, imageUrl: null },
    ]);
    assert.deepEqual(queries[0].where, { active: true });
    assert.deepEqual(queries[0].orderBy, [{ name: 'asc' }, { slug: 'asc' }]);
    assert.deepEqual(Object.keys(queries[0].select), ['id', 'name', 'slug', 'description', 'imageUrl']);
  });

  it('não oferece criação nem edição de categorias de produto', async () => {
    for (const [method, path] of [
      ['POST', '/api/product-categories'],
      ['PATCH', '/api/product-categories/cement'],
      ['PUT', '/api/product-categories/cement'],
      ['DELETE', '/api/product-categories/cement'],
    ]) {
      const response = await fetch(`${baseUrl}${path}`, { method });
      assert.equal(response.status, 404, `${method} ${path}`);
    }
  });
});
