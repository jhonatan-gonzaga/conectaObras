import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { after, before, beforeEach, describe, it } from 'node:test';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { StoreStatus, UserRole } from '@prisma/client';
import { STORE_REPOSITORY, StoreRecord, StoreRepository } from '../src/modules/stores/application/store.repository';
import { ChangeStoreStatusUseCase } from '../src/modules/stores/application/use-cases/change-store-status.use-case';
import { GetMyStoreUseCase } from '../src/modules/stores/application/use-cases/get-my-store.use-case';
import { SaveStoreProfileUseCase } from '../src/modules/stores/application/use-cases/save-store-profile.use-case';
import { SetStoreLogoUseCase } from '../src/modules/stores/application/use-cases/set-store-logo.use-case';
import { StoresController } from '../src/modules/stores/stores.controller';
import { UPLOAD_PROVIDER } from '../src/modules/uploads/providers/upload-provider.interface';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { AuthenticatedUser } from '../src/common/types/authenticated-user';

const JWT_SECRET = 'lojista-rbac-integration-test';
const now = new Date('2026-09-24T12:00:00.000Z');

function emptyStore(ownerId: string, id = `store-${ownerId}`): StoreRecord {
  return {
    id,
    ownerId,
    name: null,
    cnpj: null,
    description: null,
    phone: null,
    whatsapp: null,
    logoUrl: null,
    status: StoreStatus.DRAFT,
    address: null,
    openingHours: [],
    createdAt: now,
    updatedAt: now,
  };
}

class InMemoryStoreRepository implements StoreRepository {
  stores = new Map<string, StoreRecord>();

  reset() {
    this.stores = new Map();
  }

  async findByOwner(ownerId: string) {
    return this.stores.get(ownerId) ?? null;
  }

  async upsertProfile(ownerId: string, dto: any) {
    const current = this.stores.get(ownerId) ?? emptyStore(ownerId);
    const next: StoreRecord = {
      ...current,
      name: dto.name ?? current.name,
      cnpj: dto.cnpj?.replace(/\D/g, '') ?? current.cnpj,
      description: dto.description ?? current.description,
      phone: dto.phone ?? current.phone,
      whatsapp: dto.whatsapp ?? current.whatsapp,
      address: dto.address
        ? { ...current.address, ...dto.address, state: dto.address.state?.toUpperCase() ?? current.address?.state ?? null }
        : current.address,
      openingHours: dto.openingHours ?? current.openingHours,
      updatedAt: new Date(),
    };
    this.stores.set(ownerId, next);
    return next;
  }

  async changeStatus(ownerId: string, status: StoreStatus) {
    const current = this.stores.get(ownerId)!;
    const next = { ...current, status, updatedAt: new Date() };
    this.stores.set(ownerId, next);
    return next;
  }

  async updateLogo(ownerId: string, logoUrl: string) {
    const current = this.stores.get(ownerId)!;
    const next = { ...current, logoUrl, updatedAt: new Date() };
    this.stores.set(ownerId, next);
    return next;
  }
}

describe('API de administração da loja (integracao HTTP)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwtService: JwtService;
  let repository: InMemoryStoreRepository;

  before(async () => {
    repository = new InMemoryStoreRepository();
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      controllers: [StoresController],
      providers: [
        JwtAuthGuard,
        RolesGuard,
        GetMyStoreUseCase,
        SaveStoreProfileUseCase,
        ChangeStoreStatusUseCase,
        SetStoreLogoUseCase,
        { provide: STORE_REPOSITORY, useValue: repository },
        {
          provide: UPLOAD_PROVIDER,
          useValue: { buildResponse: () => ({ url: 'http://localhost/uploads/images/logo.png' }) },
        },
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

  beforeEach(() => repository.reset());
  after(async () => app.close());

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

  it('exige autenticacao e papel LOJISTA', async () => {
    assert.equal((await request('/me')).status, 401);
    assert.equal((await request('/me', tokenFor('client-a', UserRole.CLIENTE))).status, 403);
  });

  it('cria e edita a loja do dono identificado pelo JWT', async () => {
    const token = tokenFor('owner-a', UserRole.LOJISTA);
    const createdResponse = await request('/me', token, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Loja A',
        address: { city: 'Manaus', state: 'am' },
        openingHours: [{ dayOfWeek: 'MONDAY', openingTime: '08:00', closingTime: '18:00', closed: false }],
      }),
    });
    const created = await createdResponse.json() as StoreRecord;
    const editResponse = await request('/me', token, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Loja A Editada' }),
    });
    const edited = await editResponse.json() as StoreRecord;

    assert.equal(createdResponse.status, 200);
    assert.equal(created.ownerId, 'owner-a');
    assert.equal(created.address?.state, 'AM');
    assert.equal(edited.id, created.id);
    assert.equal(edited.name, 'Loja A Editada');
  });

  it('rejeita campos que tentam escolher proprietário, loja ou papel', async () => {
    const response = await request('/me', tokenFor('owner-a', UserRole.LOJISTA), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ataque', ownerId: 'owner-b', storeId: 'store-b', role: 'SUPORTE' }),
    });
    assert.equal(response.status, 400);
    assert.equal(repository.stores.has('owner-b'), false);
  });

  it('bloqueia ativacao incompleta com pendencias e ativa perfil completo', async () => {
    const token = tokenFor('owner-a', UserRole.LOJISTA);
    await request('/me', token, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{}' });
    const incompleteResponse = await request('/me/status', token, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: StoreStatus.ACTIVE }),
    });
    const incomplete = await incompleteResponse.json() as { pending: string[] };
    assert.equal(incompleteResponse.status, 400);
    assert.ok(incomplete.pending.includes('STORE_NAME_REQUIRED'));
    assert.equal((await request('/me', token)).status, 200);

    await request('/me', token, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Loja A', cnpj: '11.222.333/0001-81', phone: '92999999999',
        openingHours: [{ dayOfWeek: 'MONDAY', openingTime: '08:00', closingTime: '18:00', closed: false }],
      }),
    });
    const activeResponse = await request('/me/status', token, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: StoreStatus.ACTIVE }),
    });
    assert.equal(activeResponse.status, 200);
    assert.equal((await activeResponse.json() as StoreRecord).status, StoreStatus.ACTIVE);
  });

  it('mantem INACTIVE visivel ao dono e nao permite alterar loja alheia', async () => {
    repository.stores.set('owner-a', { ...emptyStore('owner-a'), status: StoreStatus.ACTIVE });
    repository.stores.set('owner-b', { ...emptyStore('owner-b'), status: StoreStatus.DRAFT });
    const inactiveResponse = await request('/me/status', tokenFor('owner-a', UserRole.LOJISTA), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: StoreStatus.INACTIVE }),
    });
    const mineResponse = await request('/me?ownerId=owner-b', tokenFor('owner-a', UserRole.LOJISTA));
    const mine = await mineResponse.json() as StoreRecord;

    assert.equal(inactiveResponse.status, 200);
    assert.equal(mineResponse.status, 200);
    assert.equal(mine.ownerId, 'owner-a');
    assert.equal(mine.status, StoreStatus.INACTIVE);
    assert.equal(repository.stores.get('owner-b')?.status, StoreStatus.DRAFT);
  });
});
