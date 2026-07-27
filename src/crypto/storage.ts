// SPDX-License-Identifier: LicenseRef-LUME-Source-Available
// Copyright (C) 2026 LUME Inc

/**
 * Seam placeholder for the platform storage layer.
 *
 * On the web, crypto/storage.ts owns IndexedDB persistence and PBKDF2 via
 * SubtleCrypto. On mobile that responsibility moves behind a platform adapter
 * (see src/platform/) backed by SQLite/MMKV + the OS keystore. The vendored
 * `keyVault.ts` only depends on `clearCachedMasterKey`, so that is all this seam
 * exposes for now; the rest arrives with the on-device adapter.
 */

let cachedMasterKey: Uint8Array | null = null

export function setCachedMasterKey(key: Uint8Array | null): void {
  cachedMasterKey = key
}

export function getCachedMasterKey(): Uint8Array | null {
  return cachedMasterKey
}

export function clearCachedMasterKey(): void {
  if (cachedMasterKey) cachedMasterKey.fill(0)
  cachedMasterKey = null
}
