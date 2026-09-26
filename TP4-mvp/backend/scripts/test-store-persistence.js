// Run only against disposable MySQL databases. Never reads DATABASE_URL.
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { PrismaClient } = require('@prisma/client');

const root = resolve(__dirname, '..');
// Node >= 20.12; variables already exported by the caller take precedence.
if (require('node:fs').existsSync(resolve(root, '.env'))) {
  process.loadEnvFile(resolve(root, '.env'));
}
const migration = '20260924100000_store_persistence_constraints';
const forward = readFileSync(resolve(root, 'prisma/migrations', migration, 'migration.sql'), 'utf8');
const reverse = readFileSync(resolve(root, 'prisma/operations/revert-store-persistence-constraints.sql'), 'utf8');
const rollback = new Error('Rollback test fixtures');

function testUrl(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Configure ${name} with a disposable database URL.`);
  const url = new URL(value);
  if (url.protocol !== 'mysql:' || !/^\/loja_test_[a-zA-Z0-9_]+$/.test(url.pathname)) {
    throw new Error(`${name}: database name must start with loja_test_.`);
  }
  return value;
}

function prismaCli(url, ...args) {
  execFileSync(process.execPath, [require.resolve('prisma'), ...args], {
    cwd: root, env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe',
  });
}

async function sql(client, script) {
  for (const statement of script.replace(/^--.*$/gm, '').split(';').filter((part) => part.trim())) {
    await client.$executeRawUnsafe(statement);
  }
}

async function snapshot(client) {
  const tables = await client.$queryRaw`SELECT TABLE_NAME AS name FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`;
  const result = {};
  for (const { name } of tables) {
    if (name === '_prisma_migrations') continue;
    const rows = await client.$queryRawUnsafe(`SELECT * FROM \`${name.replace(/`/g, '``')}\``);
    const serialized = rows.map((row) => JSON.stringify(row,
      (_, value) => typeof value === 'bigint' ? value.toString() : value)).sort();
    result[name] = createHash('sha256').update(JSON.stringify(serialized)).digest('hex');
  }
  return result;
}

async function constraints(client) {
  await client.$transaction(async (tx) => {
    const prefix = randomUUID();
    const owner = await tx.user.create({ data: {
      name: 'Persistence test', email: `${prefix}@example.test`, passwordHash: 'test-only', role: 'LOJISTA',
    } });
    const other = await tx.user.create({ data: {
      name: 'Second test', email: `${prefix}-2@example.test`, passwordHash: 'test-only', role: 'LOJISTA',
    } });
    const store = await tx.storeProfile.create({ data: { ownerId: owner.id } });
    const duplicate = (operation) => assert.rejects(operation, (error) => error.code === 'P2002');
    const foreignKey = (operation) => assert.rejects(operation, (error) => error.code === 'P2003');
    await duplicate(tx.storeProfile.create({ data: { ownerId: owner.id } }));
    await foreignKey(tx.storeProfile.create({ data: { ownerId: `missing-${prefix}` } }));
    // Reserve a random CNPJ so a restored copy cannot collide with a fixed fixture.
    let cnpj;
    do {
      cnpj = String(BigInt(`0x${randomUUID().replace(/-/g, '').slice(0, 12)}`) % 100000000000000n).padStart(14, '0');
    } while (await tx.storeProfile.findUnique({ where: { cnpj } }));
    await tx.storeProfile.update({ where: { id: store.id }, data: { cnpj } });
    await duplicate(tx.storeProfile.create({ data: { ownerId: other.id, cnpj } }));
    const secondStore = await tx.storeProfile.create({ data: { ownerId: other.id } });
    assert.equal(secondStore.cnpj, null);
    const address = await tx.storeAddress.create({ data: { storeId: store.id, zipCode: '69000000' } });
    await duplicate(tx.storeAddress.create({ data: { storeId: store.id } }));
    await foreignKey(tx.storeAddress.create({ data: { storeId: `missing-${prefix}` } }));
    await tx.storeOpeningHour.create({ data: { storeId: store.id, dayOfWeek: 'SUNDAY', closed: true } });
    await duplicate(tx.storeOpeningHour.create({ data: { storeId: store.id, dayOfWeek: 'SUNDAY', closed: true } }));
    await foreignKey(tx.storeOpeningHour.create({ data: { storeId: `missing-${prefix}`, dayOfWeek: 'SUNDAY', closed: true } }));
    await tx.storeOpeningHour.create({ data: {
      storeId: store.id, dayOfWeek: 'MONDAY', openingTime: '08:00', closingTime: '18:00',
    } });
    // Raw SQL exercises CHECK constraints independently of DTOs and services.
    const check = (query, ...values) => assert.rejects(tx.$executeRawUnsafe(query, ...values),
      (error) => error.code === 'P2010' && String(error.meta?.code) === '3819');
    for (const status of ['ACTIVE', 'INACTIVE']) {
      await check('UPDATE store_profiles SET status = ? WHERE id = ?', status, store.id);
    }
    await check('UPDATE store_profiles SET cnpj = ? WHERE id = ?', '11.222.333/0001-81', store.id);
    await check('UPDATE store_addresses SET zipCode = ? WHERE id = ?', '69000-000', address.id);
    await check('UPDATE store_opening_hours SET closed = false WHERE storeId = ? AND dayOfWeek = ?', store.id, 'SUNDAY');
    for (const [opening, closing] of [[null, '18:00'], ['08:00', null], ['24:00', '25:00'], ['18:00', '08:00']]) {
      await check('UPDATE store_opening_hours SET openingTime = ?, closingTime = ? WHERE storeId = ? AND dayOfWeek = ?',
        opening, closing, store.id, 'MONDAY');
    }
    await tx.user.delete({ where: { id: owner.id } });
    assert.equal(await tx.storeProfile.count({ where: { id: store.id } }), 0);
    assert.equal(await tx.storeAddress.count({ where: { storeId: store.id } }), 0);
    assert.equal(await tx.storeOpeningHour.count({ where: { storeId: store.id } }), 0);
    throw rollback;
  }, { timeout: 60000 }).catch((error) => { if (error !== rollback) throw error; });
}

async function run(url, label) {
  const client = new PrismaClient({ datasources: { db: { url } } });
  try {
    const [{ version }] = await client.$queryRaw`SELECT VERSION() AS version`;
    const [major, minor, patch] = version.split('.').map(Number);
    assert(!version.includes('MariaDB') && (major > 8 || (major === 8 && (minor > 0 || patch >= 16))),
      'Requires MySQL >= 8.0.16 with enforced CHECK constraints');
    const before = await snapshot(client);
    if (label === 'empty') assert.equal(Object.keys(before).length, 0, 'Empty target must have no application tables');
    else assert('users' in before, 'Copy must contain the current application schema');
    prismaCli(url, 'migrate', 'deploy');
    const after = await snapshot(client);
    for (const table of Object.keys(before)) assert.equal(after[table], before[table], `${table}: existing data changed`);
    await constraints(client);
    await sql(client, reverse);
    assert.deepEqual(await snapshot(client), after, 'Rollback must preserve all data');
    await sql(client, forward);
    await constraints(client);
    assert.deepEqual(await snapshot(client), after, 'Reapplication must preserve all data');
    prismaCli(url, 'migrate', 'status');
    console.log(`${label}: deploy, unique/FK/CHECK/cascade, rollback and reapply passed`);
  } finally {
    await client.$disconnect();
  }
}

async function main() {
  const empty = testUrl('STORE_TEST_EMPTY_DATABASE_URL');
  const copy = testUrl('STORE_TEST_COPY_DATABASE_URL');
  assert.notEqual(empty, copy, 'Use two distinct disposable databases');
  await run(empty, 'empty');
  await run(copy, 'copy');
}

main().catch((error) => {
  // Avoid logging connection strings or restored row contents.
  console.error('Store persistence tests failed:', error.code || error.message.replace(/mysql:\/\/\S+/g, '[redacted]'));
  process.exitCode = 1;
});
