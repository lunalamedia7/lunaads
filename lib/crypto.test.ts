import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, decrypt } from "./crypto";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

describe("lib/crypto", () => {
  it("encrypt(decrypt(x)) === x", () => {
    const original = "tiktok-access-token-super-secreto";
    const ciphertext = encrypt(original);
    expect(ciphertext).not.toBe(original);
    expect(decrypt(ciphertext)).toBe(original);
  });

  it("usa IV aleatório: o mesmo texto gera ciphertexts diferentes", () => {
    const a = encrypt("mesmo-valor");
    const b = encrypt("mesmo-valor");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("mesmo-valor");
    expect(decrypt(b)).toBe("mesmo-valor");
  });

  it("rejeita ciphertext adulterado (autenticação do GCM)", () => {
    const ciphertext = encrypt("valor-original");
    const tampered = Buffer.from(ciphertext, "base64");
    tampered[tampered.length - 1] ^= 0xff;
    expect(() => decrypt(tampered.toString("base64"))).toThrow();
  });
});
