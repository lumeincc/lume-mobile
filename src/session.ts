// SPDX-License-Identifier: LicenseRef-LUME-Source-Available
// Copyright (C) 2026 LUME Inc

/**
 * Opening and closing a session.
 *
 * Unlocking the vault is only half the job: the identity and master key must also
 * reach the in-memory key vault, because every authenticated request is signed
 * from there. Without this step registration succeeds and then the very next call
 * fails with "no identity keys — cannot sign request".
 *
 * Kept separate from vault.ts so the storage layer stays free of the in-memory
 * key holder, and from registration.ts because this is the returning-user path.
 */

import { unlock, loadProfile, type UnlockResult, type AccountProfile } from './vault'
import { vaultSetAuth, vaultClear } from './crypto/keyVault'
import type { Platform } from './platform/adapter'
import type { IdentityKeys } from './crypto/keys'

export type SessionResult =
  | { ok: true; identity: IdentityKeys; profile: AccountProfile | null }
  | { ok: false; reason: 'no-account' | 'wrong-pin' | 'corrupt' }

/**
 * Open the vault and load the keys for signing.
 *
 * The master key is handed to the key vault, which holds the reference and zeroes
 * it on `closeSession`; it is deliberately not zeroed here.
 */
export async function openSession(platform: Platform, pin: string): Promise<SessionResult> {
  const res: UnlockResult = await unlock(platform, pin)
  if (!res.ok) return { ok: false, reason: res.reason }

  const profile = await loadProfile(platform, res.masterKey)
  vaultSetAuth(res.identity, res.masterKey)
  return { ok: true, identity: res.identity, profile }
}

/** Drop every live key from memory. */
export function closeSession(): void {
  vaultClear()
}
