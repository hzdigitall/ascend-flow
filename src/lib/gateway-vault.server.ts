/**
 * Cofre de credenciais de gateways de pagamento.
 *
 * O API Secret NUNCA é armazenado em texto puro. Ele é cifrado com AES-256-GCM
 * usando a chave mestra GATEWAY_ENCRYPTION_KEY (secret do backend) e só é
 * decifrado dentro de código server-only.
 */
const ALGO = "AES-GCM";

function masterKeyMaterial(): Uint8Array {
  const raw = process.env["GATEWAY_ENCRYPTION_KEY"];
  if (!raw) {
    throw new Error("GATEWAY_ENCRYPTION_KEY não configurada no servidor.");
  }
  // Deriva 32 bytes determinísticos da chave mestra textual.
  const bytes = new TextEncoder().encode(raw);
  const key = new Uint8Array(32);
  for (let i = 0; i < bytes.length; i += 1) {
    key[i % 32] = (key[i % 32]! + bytes[i]!) % 256;
  }
  return key;
}

async function importKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", masterKeyMaterial() as unknown as ArrayBuffer, ALGO, false, [
    "encrypt",
    "decrypt",
  ]);
}

function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += String.fromCharCode(b);
  return btoa(out);
}

function fromBase64(value: string): Uint8Array {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encryptSecret(plain: string): Promise<{ ciphertext: string; iv: string }> {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    new TextEncoder().encode(plain),
  );
  return { ciphertext: toBase64(new Uint8Array(encrypted)), iv: toBase64(iv) };
}

export async function decryptSecret(ciphertext: string, iv: string): Promise<string> {
  const key = await importKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGO, iv: fromBase64(iv) as unknown as ArrayBuffer },
    key,
    fromBase64(ciphertext) as unknown as ArrayBuffer,
  );
  return new TextDecoder().decode(decrypted);
}

export function maskSecret(lastFour: string): string {
  return `••••••••••••${lastFour}`;
}
