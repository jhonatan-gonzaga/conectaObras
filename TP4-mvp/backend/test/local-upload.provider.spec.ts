import { strict as assert } from 'node:assert';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { LocalUploadProvider } from '../src/modules/uploads/providers/local-upload.provider';

describe('LocalUploadProvider', () => {
  it('grava bytes reais, gera chave controlada e remove somente no diretorio de uploads', async () => {
    const temp = await mkdtemp(join(tmpdir(), 'conecta-upload-'));
    const previous = process.cwd();
    let provider: LocalUploadProvider;
    try {
      process.chdir(temp);
      provider = new LocalUploadProvider();
    } finally {
      process.chdir(previous);
    }
    try {
      const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      const saved = await provider.save({
        originalname: '../../nome.png', mimetype: 'image/jpeg', buffer: bytes, size: bytes.length,
      }, 'image', 'https://api.example.com/');
      assert.match(saved.objectKey, /^images\/[0-9a-f-]+\.jpg$/);
      assert.equal(saved.url, `https://api.example.com/uploads/${saved.objectKey}`);
      assert.deepEqual(await readFile(join(temp, 'uploads', saved.objectKey)), bytes);
      await assert.rejects(provider.remove('../outside'), /Chave de upload invalida/);
      await provider.remove(saved.objectKey);
      await assert.rejects(readFile(join(temp, 'uploads', saved.objectKey)), { code: 'ENOENT' });
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });
});
