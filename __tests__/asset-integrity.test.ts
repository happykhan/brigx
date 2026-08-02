import { describe, expect, it } from 'vitest';
import { sha256Hex, verifySha256 } from '@/lib/assetIntegrity';

describe('asset integrity', () => {
  it('calculates a stable SHA-256 digest', async () => {
    const data = new TextEncoder().encode('BRIGX').buffer;
    await expect(sha256Hex(data)).resolves.toBe('fced86e3a861c43b21a2677536c139f2508f1d37c454023d12eead1df4e94ff4');
  });

  it('rejects a changed asset', async () => {
    const data = new TextEncoder().encode('changed').buffer;
    await expect(verifySha256('blastall.wasm', data, 'not-the-real-hash'))
      .rejects.toThrow('blastall.wasm failed its integrity check');
  });
});
