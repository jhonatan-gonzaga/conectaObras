import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  Body,
  Controller,
  Get,
  INestApplication,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { IsString, MinLength } from 'class-validator';
import { CurrentUser } from '../src/common/decorators/current-user.decorator';
import { Roles } from '../src/common/decorators/roles.decorator';
import { AuthenticatedUser } from '../src/common/types/authenticated-user';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';

const JWT_SECRET = 'lojista-rbac-integration-test';

class UpdateAdministrativeResourceDto {
  @IsString()
  @MinLength(2)
  name: string;
}

type StoreFixture = {
  id: string;
  ownerUserId: string;
};

type AdministrativeResourceFixture = {
  id: string;
  storeId: string;
  name: string;
};

@Injectable()
class StorePanelFixtureService {
  private stores: StoreFixture[] = [];
  private resources: AdministrativeResourceFixture[] = [];

  reset() {
    this.stores = [
      { id: 'store-a', ownerUserId: 'lojista-a' },
      { id: 'store-b', ownerUserId: 'lojista-b' },
    ];
    this.resources = [
      { id: 'resource-a', storeId: 'store-a', name: 'Recurso A' },
      { id: 'resource-b', storeId: 'store-b', name: 'Recurso B' },
    ];
  }

  findMyStore(userId: string) {
    const store = this.stores.find((candidate) => candidate.ownerUserId === userId);

    if (!store) {
      throw new NotFoundException('Loja nao encontrada.');
    }

    return store;
  }

  findMyResource(userId: string, resourceId: string) {
    const store = this.findMyStore(userId);
    const resource = this.resources.find(
      (candidate) => candidate.id === resourceId && candidate.storeId === store.id,
    );

    if (!resource) {
      throw new NotFoundException('Recurso nao encontrado.');
    }

    return resource;
  }

  updateMyResource(userId: string, resourceId: string, dto: UpdateAdministrativeResourceDto) {
    const resource = this.findMyResource(userId, resourceId);
    resource.name = dto.name;
    return resource;
  }
}

@Controller('store-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.LOJISTA)
class StorePanelFixtureController {
  constructor(private readonly storePanel: StorePanelFixtureService) {}

  @Get('me')
  findMyStore(@CurrentUser() user: AuthenticatedUser) {
    return this.storePanel.findMyStore(user.id);
  }

  @Get('resources/:resourceId')
  findMyResource(
    @CurrentUser() user: AuthenticatedUser,
    @Param('resourceId') resourceId: string,
  ) {
    return this.storePanel.findMyResource(user.id, resourceId);
  }

  @Patch('resources/:resourceId')
  updateMyResource(
    @CurrentUser() user: AuthenticatedUser,
    @Param('resourceId') resourceId: string,
    @Body() dto: UpdateAdministrativeResourceDto,
  ) {
    return this.storePanel.updateMyResource(user.id, resourceId, dto);
  }
}

describe('RBAC e isolamento do painel lojista (integracao HTTP)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwtService: JwtService;
  let storePanel: StorePanelFixtureService;

  before(async () => {
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      controllers: [StorePanelFixtureController],
      providers: [StorePanelFixtureService, JwtAuthGuard, RolesGuard],
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
    storePanel = module.get(StorePanelFixtureService);
  });

  beforeEach(() => storePanel.reset());

  after(async () => {
    await app.close();
  });

  const tokenFor = (id: string, role: UserRole) => jwtService.sign({
    id,
    email: `${id}@example.com`,
    role,
  } satisfies AuthenticatedUser);

  const request = (path: string, token?: string, init: RequestInit = {}) => fetch(
    `${baseUrl}/api/store-admin${path}`,
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

  it('permite o papel LOJISTA e resolve a loja pelo id do JWT', async () => {
    const response = await request('/me?storeId=store-b', tokenFor('lojista-a', UserRole.LOJISTA));
    const body = await response.json() as StoreFixture;

    assert.equal(response.status, 200);
    assert.equal(body.id, 'store-a');
    assert.equal(body.ownerUserId, 'lojista-a');
  });

  it('oculta e preserva recursos administrativos de outra loja', async () => {
    const token = tokenFor('lojista-a', UserRole.LOJISTA);
    const readResponse = await request('/resources/resource-b', token);
    const updateResponse = await request('/resources/resource-b', token, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Alterado pela loja A' }),
    });
    const ownerResponse = await request(
      '/resources/resource-b',
      tokenFor('lojista-b', UserRole.LOJISTA),
    );
    const ownerBody = await ownerResponse.json() as AdministrativeResourceFixture;

    assert.equal(readResponse.status, 404);
    assert.equal(updateResponse.status, 404);
    assert.equal(ownerResponse.status, 200);
    assert.equal(ownerBody.name, 'Recurso B');
  });

  it('rejeita ownerId e storeId enviados no corpo', async () => {
    const token = tokenFor('lojista-a', UserRole.LOJISTA);
    const response = await request('/resources/resource-a', token, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Tentativa de reatribuicao',
        ownerId: 'lojista-b',
        storeId: 'store-b',
      }),
    });
    const ownResourceResponse = await request('/resources/resource-a', token);
    const ownResource = await ownResourceResponse.json() as AdministrativeResourceFixture;

    assert.equal(response.status, 400);
    assert.equal(ownResourceResponse.status, 200);
    assert.equal(ownResource.name, 'Recurso A');
    assert.equal(ownResource.storeId, 'store-a');
  });
});
