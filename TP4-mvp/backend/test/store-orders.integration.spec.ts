
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.STORE_ORDERS_TEST_DATABASE_URL;

const root = resolve(__dirname, '../..');

const prismaCli = (...args: string[]) =>
  execFileSync(
    process.execPath,
    [
      resolve(root, 'node_modules/prisma/build/index.js'),
      ...args,
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl!,
      },
      stdio: 'pipe',
    },
  );

test(
  'LOJA-018: integridade dos pedidos no MySQL',
  {
    skip:
      !databaseUrl &&
      'Configure STORE_ORDERS_TEST_DATABASE_URL com um banco de testes descartavel.',
    timeout: 180000,
  },
  async () => {
    // Valida a URL do banco de testes.
    const url = new URL(databaseUrl!);

    assert.equal(url.protocol, 'mysql:');

    assert.match(
      url.pathname,
      /^\/store_orders_test_[a-zA-Z0-9_]+$/,
    );

    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl!,
        },
      },
    });

    try {
      // Conecta ao banco de testes.
      await prisma.$connect();

      // Confirma que o banco está vazio.
      const tables = await prisma.$queryRaw<
        Array<{ TABLE_NAME: string }>
      >`
        SELECT TABLE_NAME
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
      `;

      assert.equal(
        tables.length,
        0,
        'Use um banco MySQL de testes vazio e descartavel.',
      );

      // Aplica as migrações no banco de testes vazio.
      prismaCli('migrate', 'deploy');

      // Confirma que a migração da LOJA-018 foi aplicada.
      const migrations = await prisma.$queryRaw<
        Array<{ migration_name: string }>
      >`
        SELECT migration_name
        FROM _prisma_migrations
        WHERE migration_name =
          '20261018000000_model_store_orders_history_delivery'
          AND finished_at IS NOT NULL
      `;

      assert.equal(
        migrations.length,
        1,
        'A migracao da LOJA-018 deve ser aplicada com sucesso.',
      );

      // Verifica a restrição UNIQUE de entrega por pedido.
      const constraints = await prisma.$queryRaw<
        Array<{
          INDEX_NAME: string;
          NON_UNIQUE: bigint;
        }>
      >`
        SELECT INDEX_NAME, NON_UNIQUE
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'deliveries'
          AND COLUMN_NAME = 'orderId'
          AND INDEX_NAME = 'deliveries_orderId_key'
      `;

      assert.equal(
        constraints.length,
        1,
        'A entrega deve possuir um indice unico por pedido.',
      );

      assert.equal(
        Number(constraints[0].NON_UNIQUE),
        0,
        'O indice de orderId deve ser UNIQUE.',
      );
    } finally {
      // Encerra a conexão mesmo se algum teste falhar.
      await prisma.$disconnect();
    }
  },
);
