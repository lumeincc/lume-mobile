// SPDX-License-Identifier: LicenseRef-LUME-Source-Available
// Copyright (C) 2026 LUME Inc

/**
 * The platform seam. Everything the crypto core needs from the OS that differs
 * between web, Node (tests) and React Native goes through this interface, so the
 * vendored core itself stays byte-identical across platforms.
 *
 * Implementations:
 *   - Node  (src/platform/node.ts)  — node:crypto, used by the tests.
 *   - RN    (added with the app)    — react-native-quick-crypto for pbkdf2 +
 *                                      react-native-get-random-values for randomness.
 */
export interface PlatformCrypto {
  /**
   * PBKDF2-SHA256 → raw derived key bytes. On a phone this MUST run on native
   * crypto (600k iterations in JS would jank the UI).
   */
  pbkdf2(password: Uint8Array, salt: Uint8Array, iterations: number, keyLenBytes: number): Promise<Uint8Array>

  /** Cryptographically-secure random bytes from the OS CSPRNG. */
  randomBytes(length: number): Uint8Array
}
