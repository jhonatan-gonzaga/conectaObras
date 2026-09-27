// Explicit opt-in: never uses DATABASE_URL as a test target.
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');

if (!process.env.PRODUCT_TEST_DATABASE_URL) {
  console.error('Configure PRODUCT_TEST_DATABASE_URL with a fresh empty MySQL database named catalog_test_*.');
  process.exitCode = 1;
} else {
  try {
    execFileSync(process.execPath, ['--test', 'dist-test/test/product-persistence.integration.spec.js'], {
      cwd: resolve(__dirname, '..'), stdio: 'inherit',
    });
  } catch {
    process.exitCode = 1;
  }
}
