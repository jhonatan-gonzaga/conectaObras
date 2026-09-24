import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../src/common/types/authenticated-user';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { UpsertMyStoreDto } from '../src/modules/stores/dto/upsert-my-store.dto';
import { StoresController } from '../src/modules/stores/stores.controller';
import { StoresService } from '../src/modules/stores/stores.service';

const JWT_SECRET = 'lojista-rbac-integration-test';

type StoreFixture = {
  id: string;
  name: string;
  status: 'DRAFT';
};

class InMemoryStoresService {
  private stores = new Map<string, StoreFixture>();

  reset() {
    this.stores = new Map([
      ['lojista-a', { id: 'store-a', name: 'Loja A', status: 'DRAFT' }],
      ['lojista-b', { id: 'store-b', name: 'Loja B', status: 'DRAFT' }],
    ]);
  }

  findMine(userId: string) {
    const store = this.stores.get(userId);

    if (!store) {
      throw new NotFoundException('Loja nao encontrada.');
    }

    return store;
  }

  upsertMine(userId: string, dto: UpsertMyStoreDto) {
    const current = this.stores.get(userId) ?? {
      id: `store-${userId}`,
      name: '',
      status: 'DRAFT' as const,
    };
    const store = {
      ...current,
      name: dto.name ?? current.name,
    };

    this.stores.set(userId, store);
    return store;
  }
}

describe('RBAC e isolamento dos endpoints reais de loja (integracao HTTP)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwtService: JwtService;
  let storesService: InMemoryStoresService;

  before(async () => {
    storesService = new InMemoryStoresService();

    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      controllers: [StoresController],
      providers: [
        JwtAuthGuard,
        RolesGuard,
        { provide: StoresService, useValue: storesService },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    await app.listen(0, '127.0.0.1');

    baseUrl = await app.getUrl();
    jwtService = module.get(JwtService);
  });

  beforeEach(() => storesService.reset());

  after(async () => {
    await app.close();
  });

  const tokenFor = (id: string, role: UserRole) => jwtService.sign({
    id,
    email: `${id}@example.com`,
    role,
  } satisfies AuthenticatedUser);

  const request = (path: string, token?: string, init: RequestInit = {}) => fetch(
    `${baseUrl}/api/stores${path}`,
    {
      ...init,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    },
  );

  it('retorna 401 sem token', async () => {
    const response = await request('/me');

    assert.equal(response.status, 401);
  });

  it('retorna 403 para papel diferente de LOJISTA', async () => {
    const response = await request('/me', tokenFor('cliente-a', UserRole.CLIENTE));

    assert.equal(response.status, 403);
  });

  it('permite LOJISTA e ignora tentativa de escolher outra loja pela query', async () => {
    const response = await request(
      '/me?ownerId=lojista-b&storeId=store-b',
      tokenFor('lojista-a', UserRole.LOJISTA),
    );
    const body = await response.json() as StoreFixture;

    assert.equal(response.status, 200);
    assert.equal(body.id, 'store-a');
    assert.equal(body.name, 'Loja A');
  });

  it('rejeita ownerId, storeId e role enviados no corpo', async () => {
    const response = await request('/me', tokenFor('lojista-a', UserRole.LOJISTA), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Tentativa de reatribuicao',
        ownerId: 'lojista-b',
        storeId: 'store-b',
        role: UserRole.SUPORTE,
      }),
    });
    const ownerResponse = await request(
      '/me',
      tokenFor('lojista-b', UserRole.LOJISTA),
    );
    const ownerBody = await ownerResponse.json() as StoreFixture;

    assert.equal(response.status, 400);
    assert.equal(ownerResponse.status, 200);
    assert.equal(ownerBody.id, 'store-b');
    assert.equal(ownerBody.name, 'Loja B');
  });

  it('altera somente a loja resolvida pelo id do JWT', async () => {
    const updateResponse = await request(
      '/me',
      tokenFor('lojista-a', UserRole.LOJISTA),
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Loja A atualizada' }),
      },
    );
    const storeA = await updateResponse.json() as StoreFixture;
    const storeBResponse = await request(
      '/me',
      tokenFor('lojista-b', UserRole.LOJISTA),
    );
    const storeB = await storeBResponse.json() as StoreFixture;

    assert.equal(updateResponse.status, 200);
    assert.equal(storeA.id, 'store-a');
    assert.equal(storeA.name, 'Loja A atualizada');
    assert.equal(storeBResponse.status, 200);
    assert.equal(storeB.id, 'store-b');
    assert.equal(storeB.name, 'Loja B');
  });
});
