import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const secret = process.env.AI_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("AI_ENCRYPTION_KEY must be set in environment variables");
  }
  return createHash("sha256").update(secret).digest();
}

export function encrypt(text: string): string {
  if (!text) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decrypt(payload: string): string {
  if (!payload) return "";
  const buffer = Buffer.from(payload, "base64");
  if (buffer.length < 28) {
    throw new Error("Invalid encrypted payload length");
  }
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const ciphertext = buffer.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return (
    decipher.update(ciphertext, undefined, "utf8") + decipher.final("utf8")
  );
}
