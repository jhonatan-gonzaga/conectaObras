import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { after, before, beforeEach, describe, it } from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { StoreStatus, UserRole } from '@prisma/client';
import { STORE_REPOSITORY, StoreImageKind, StoreRecord, StoreRepository } from '../src/modules/stores/application/store.repository';
import { ChangeStoreStatusUseCase } from '../src/modules/stores/application/use-cases/change-store-status.use-case';
import { GetMyStoreUseCase } from '../src/modules/stores/application/use-cases/get-my-store.use-case';
import { SaveStoreProfileUseCase } from '../src/modules/stores/application/use-cases/save-store-profile.use-case';
import { SetStoreImageUseCase } from '../src/modules/stores/application/use-cases/set-store-image.use-case';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalUploadProvider } from '../src/modules/uploads/providers/local-upload.provider';
import { UPLOAD_PROVIDER } from '../src/modules/uploads/providers/upload-provider.interface';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { AuthenticatedUser } from '../src/common/types/authenticated-user';
import { StoreDashboardService } from '../src/modules/stores/store-dashboard.service';

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
    backgroundUrl: null,
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

  async updateImage(ownerId: string, kind: StoreImageKind, url: string) {
    const current = this.stores.get(ownerId)!;
    const next = { ...current, [kind === 'background' ? 'backgroundUrl' : 'logoUrl']: url, updatedAt: new Date() };
    this.stores.set(ownerId, next);
    return next;
  }
}

describe('API de administração da loja (integracao HTTP)', () => {
  let app: NestExpressApplication;
  let baseUrl: string;
  let jwtService: JwtService;
  let repository: InMemoryStoreRepository;

  const originalCwd = process.cwd();
  let uploadDirectory: string;

  before(async () => {
    uploadDirectory = await mkdtemp(join(tmpdir(), 'store-images-test-'));
    process.chdir(uploadDirectory);
    const { StoresController } = await import('../src/modules/stores/stores.controller');
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
        SetStoreImageUseCase,
        { provide: StoreDashboardService, useValue: { summary: async () => ({ hasStore: false }), list: async () => [] } },
        { provide: STORE_REPOSITORY, useValue: repository },
        {
          provide: UPLOAD_PROVIDER,
          useClass: LocalUploadProvider,
        },
      ],
    }).compile();

    app = module.createNestApplication<NestExpressApplication>();
    app.useStaticAssets(join(uploadDirectory, 'uploads'), { prefix: '/uploads/' });
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
  after(async () => {
    await app?.close();
    process.chdir(originalCwd);
    if (uploadDirectory) await rm(uploadDirectory, { recursive: true, force: true });
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

  it('exige autenticacao e papel LOJISTA', async () => {
    assert.equal((await request('/me')).status, 401);
    assert.equal((await request('/me', tokenFor('client-a', UserRole.CLIENTE))).status, 403);
  });

  it('mostra somente a identidade da loja do usuario em qualquer perfil selecionavel', async () => {
    repository.stores.set('owner-a', { ...emptyStore('owner-a'), name: 'Loja Central', status: StoreStatus.ACTIVE, cnpj: '11222333000181' });
    repository.stores.set('owner-b', { ...emptyStore('owner-b'), name: 'Outra loja' });
    assert.equal((await request('/me/identity')).status, 401);
    assert.equal((await request('/me/identity', tokenFor('owner-b', UserRole.SUPORTE))).status, 403);

    for (const role of [UserRole.CLIENTE, UserRole.PROFISSIONAL, UserRole.LOJISTA]) {
      const response = await request('/me/identity?ownerId=owner-b', tokenFor('owner-a', role));
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { name: 'Loja Central', status: StoreStatus.ACTIVE });
    }
    assert.equal((await request('/me/identity', tokenFor('missing', UserRole.CLIENTE))).status, 404);
  });

  it('consulta prontidao sem mutacao, autenticada e limitada ao dono', async () => {
    assert.equal((await request('/me/activation-readiness')).status, 401);
    assert.equal((await request('/me/activation-readiness', tokenFor('client', UserRole.CLIENTE))).status, 403);
    assert.equal((await request('/me/activation-readiness', tokenFor('missing', UserRole.LOJISTA))).status, 404);
    repository.stores.set('owner-a', emptyStore('owner-a'));
    repository.stores.set('owner-b', { ...emptyStore('owner-b'), name: 'Outra loja' });
    const response = await request('/me/activation-readiness?ownerId=owner-b', tokenFor('owner-a', UserRole.LOJISTA));
    const readiness = await response.json() as { allowed: boolean; pending: string[] };
    assert.equal(response.status, 200);
    assert.equal(readiness.allowed, false);
    assert.ok(readiness.pending.includes('STORE_NAME_REQUIRED'));
    assert.equal(repository.stores.get('owner-a')?.status, StoreStatus.DRAFT);
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
    assert.ok(incomplete.pending.includes('ADDRESS_REQUIRED'));
    assert.ok(incomplete.pending.includes('BUSINESS_OPEN_DAY_REQUIRED'));
    assert.equal((await request('/me', token)).status, 200);

    await request('/me', token, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Loja A', cnpj: '11.222.333/0001-81', phone: '92999999999',
        address: {
          street: 'Rua A', number: '10', neighborhood: 'Centro',
          city: 'Manaus', state: 'AM', zipCode: '69000000',
        },
        openingHours: [{ dayOfWeek: 'MONDAY', openingTime: '08:00', closingTime: '18:00', closed: false }],
      }),
    });
    const readinessResponse = await request('/me/activation-readiness', token);
    assert.deepEqual(await readinessResponse.json(), { allowed: true, pending: [] });
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

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aEl8AAAAASUVORK5CYII=', 'base64');
  const imageBody = () => {
    const data = new FormData();
    data.append('file', new Blob([png], { type: 'image/png' }), 'image.png');
    data.append('ownerId', 'owner-b');
    data.append('storeId', 'store-owner-b');
    return data;
  };

  for (const route of ['cover', 'background', 'logo']) {
    it(`protege upload ${route} com JWT e papel LOJISTA`, async () => {
      assert.equal((await request(`/me/${route}`, undefined, { method: 'POST', body: imageBody() })).status, 401);
      assert.equal((await request(`/me/${route}`, tokenFor('client', UserRole.CLIENTE), { method: 'POST', body: imageBody() })).status, 403);
    });
  }

  it('salva capa e fundo independentemente, ignorando dono arbitrario', async () => {
    repository.stores.set('owner-a', emptyStore('owner-a'));
    repository.stores.set('owner-b', emptyStore('owner-b'));
    const token = tokenFor('owner-a', UserRole.LOJISTA);
    const coverResponse = await request('/me/cover', token, { method: 'POST', body: imageBody() });
    assert.equal(coverResponse.status, 201);
    const cover = await coverResponse.json() as StoreRecord;
    assert.match(cover.logoUrl!, /\/uploads\/images\/.+\.png$/);
    assert.equal(cover.backgroundUrl, null);
    const coverFile = await fetch(cover.logoUrl!);
    assert.equal(coverFile.status, 200);
    assert.equal(coverFile.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await coverFile.arrayBuffer()), png);
    const backgroundResponse = await request('/me/background', token, { method: 'POST', body: imageBody() });
    assert.equal(backgroundResponse.status, 201);
    const background = await backgroundResponse.json() as StoreRecord;
    assert.equal(background.logoUrl, cover.logoUrl);
    assert.notEqual(background.backgroundUrl, cover.logoUrl);
    const backgroundFile = await fetch(background.backgroundUrl!);
    assert.equal(backgroundFile.status, 200);
    assert.deepEqual(Buffer.from(await backgroundFile.arrayBuffer()), png);
    assert.equal(background.ownerId, 'owner-a');
    const reloaded = await (await request('/me', token)).json() as StoreRecord;
    assert.equal(reloaded.backgroundUrl, background.backgroundUrl);
    assert.equal(repository.stores.get('owner-b')?.logoUrl, null);
    assert.equal(repository.stores.get('owner-b')?.backgroundUrl, null);
    const legacyResponse = await request('/me/logo', token, { method: 'POST', body: imageBody() });
    assert.equal(legacyResponse.status, 201);
    assert.equal((await legacyResponse.json() as StoreRecord).backgroundUrl, background.backgroundUrl);
  });

  it('rejeita upload sem arquivo, formato invalido, tamanho excessivo ou loja inexistente', async () => {
    const token = tokenFor('owner-a', UserRole.LOJISTA);
    assert.equal((await request('/me/background', token, { method: 'POST' })).status, 400);
    const invalid = new FormData();
    invalid.append('file', new Blob(['invalid'], { type: 'text/plain' }), 'image.txt');
    assert.equal((await request('/me/cover', token, { method: 'POST', body: invalid })).status, 400);
    const oversized = new FormData();
    oversized.append('file', new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/png' }), 'large.png');
    assert.equal((await request('/me/background', token, { method: 'POST', body: oversized })).status, 413);
    assert.equal((await request('/me/cover', token, { method: 'POST', body: imageBody() })).status, 404);
  });

});
