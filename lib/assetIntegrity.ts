export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifySha256(name: string, data: ArrayBuffer, expectedHash: string): Promise<void> {
  const actualHash = await sha256Hex(data);
  if (actualHash !== expectedHash) {
    throw new Error(`${name} failed its integrity check`);
  }
}
