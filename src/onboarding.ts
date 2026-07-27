// SPDX-License-Identifier: LicenseRef-LUME-Source-Available
// Copyright (C) 2026 LUME Inc

import { createAccountWithMnemonic, recoverIdentityFromMnemonic } from './crypto/mnemonic'
import { deriveMasterKey } from './identity'
import type { IdentityKeys } from './crypto/keys'
import type { PlatformCrypto } from './platform/adapter'

export interface NewIdentity {
  /** Show once during setup, then wipe from memory. Never leaves the device. */
  mnemonic: string
  /** Ed25519 (signing) + X25519 (exchange). Only the public halves are published. */
  identity: IdentityKeys
  /** Stored next to the encrypted vault so the master key can be re-derived from the PIN. */
  salt: Uint8Array
  /** Length of the derived master key — proof the KDF ran, without exposing the key. */
  masterKeyLength: number
}

/**
 * Create a fresh LUME identity on device: a BIP39 mnemonic → Ed25519/X25519
 * identity (deterministic — the same construction as the web client), plus a
 * PIN-derived master key that will seal the key material at rest.
 *
 * This is the crypto spine of onboarding. Persistence (writing the encrypted
 * vault) and registration (publishing the public keys) are layered on top by the
 * storage adapter and the API client — both reused from the web client.
 */
export async function createIdentity(platform: PlatformCrypto, pin: string): Promise<NewIdentity> {
  const { mnemonic, identity } = await createAccountWithMnemonic()
  const salt = platform.randomBytes(16)
  const masterKey = await deriveMasterKey(platform, pin, salt)
  const masterKeyLength = masterKey.length
  // The vault layer owns the master key's real lifecycle; do not keep it here.
  masterKey.fill(0)
  return { mnemonic, identity, salt, masterKeyLength }
}

/** Recover an existing identity from its mnemonic (deterministic). */
export async function recoverIdentity(mnemonic: string): Promise<IdentityKeys> {
  return recoverIdentityFromMnemonic(mnemonic)
}
