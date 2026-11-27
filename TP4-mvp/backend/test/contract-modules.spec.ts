import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { it } from 'node:test';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ApplicationsModule } from '../src/modules/applications/applications.module';
import { ApplicationsService } from '../src/modules/applications/applications.service';
import { ContractCreationService } from '../src/modules/contracts/contract-creation.service';
import { ContractsModule } from '../src/modules/contracts/contracts.module';
import { ContractsService } from '../src/modules/contracts/contracts.service';
import { DirectRequestsModule } from '../src/modules/direct-requests/direct-requests.module';
import { DirectRequestsService } from '../src/modules/direct-requests/direct-requests.service';
import { PrismaService } from '../src/prisma/prisma.service';

it('resolve os modulos de contratacao sem banco ou dependencias circulares', async () => {
  const module = await Test.createTestingModule({
    imports: [
      JwtModule.register({ global: true, secret: 'test-only' }),
      ApplicationsModule,
      DirectRequestsModule,
      ContractsModule,
    ],
  }).overrideProvider(PrismaService).useValue({}).compile();

  try {
    assert.ok(module.get(ApplicationsService));
    assert.ok(module.get(DirectRequestsService));
    assert.ok(module.get(ContractsService));
    assert.ok(module.get(ContractCreationService));
  } finally {
    await module.close();
  }
});
