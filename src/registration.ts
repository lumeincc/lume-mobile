// SPDX-License-Identifier: LicenseRef-LUME-Source-Available
// Copyright (C) 2026 LUME Inc

/**
 * Account setup against the relay.
 *
 * The order mirrors the web client deliberately: the server call happens BEFORE
 * anything is written locally, so a rejected username (or an unreachable relay)
 * leaves no half-made account on the device. Only the public halves of the key
 * material are ever sent; the secrets go straight into the sealed vault.
 */

import { createAccountWithMnemonic, recoverIdentityFromMnemonic } from './crypto/mnemonic'
import { generatePreKeyBundle } from './crypto/keys'
import { authApi } from './lib/api'
import {
  deriveMasterKey,
  saveIdentityKeys,
  savePinToken,
  savePreKeyMaterial,
  saveProfile,
} from './vault'
import type { IdentityKeys } from './crypto/keys'
import type { Platform } from './platform/adapter'

/** How many one-time prekeys to publish at setup — the web client uses 20. */
const ONE_TIME_PREKEY_COUNT = 20

export interface RegisteredAccount {
  /** Show once, have the user write it down, then drop it. */
  mnemonic: string
  identity: IdentityKeys
  userId: string
  username: string
}

export type RegistrationResult =
  | { ok: true; account: RegisteredAccount }
  | { ok: false; error: string }

async function persist(
  platform: Platform,
  pin: string,
  identity: IdentityKeys,
  bundle: ReturnType<typeof generatePreKeyBundle>,
  profile: { userId: string; username: string }
): Promise<void> {
  const masterKey = await deriveMasterKey(platform, pin)
  try {
    await saveIdentityKeys(platform, identity, masterKey)
    await savePinToken(platform, masterKey)
    await savePreKeyMaterial(
      platform,
      {
        signedPreKey: bundle.signedPreKey,
        oneTimePreKeys: bundle.oneTimePreKeys,
        updatedAt: Date.now(),
      },
      masterKey
    )
    await saveProfile(platform, profile, masterKey)
  } finally {
    masterKey.fill(0)
  }
}

/**
 * Create an identity, publish its public keys, then seal everything locally.
 */
export async function registerNewAccount(
  platform: Platform,
  username: string,
  pin: string
): Promise<RegistrationResult> {
  const { mnemonic, identity } = await createAccountWithMnemonic()
  const bundle = generatePreKeyBundle(identity.exchange, identity.signing, ONE_TIME_PREKEY_COUNT)

  const { data, error } = await authApi.register({
    username,
    identityKey: identity.signing.publicKey,
    exchangeIdentityKey: identity.exchange.publicKey,
    signedPrekey: bundle.signedPreKey.publicKey,
    signedPrekeySignature: bundle.signature,
    oneTimePrekeys: bundle.oneTimePreKeys.map((key, i) => ({
      id: `${username}-prekey-${i}`,
      publicKey: key.publicKey,
    })),
  })

  if (error || !data) return { ok: false, error: error ?? 'Registration failed' }

  await persist(platform, pin, identity, bundle, { userId: data.id, username })
  return { ok: true, account: { mnemonic, identity, userId: data.id, username } }
}

/**
 * Re-bind an existing identity (recovered from its mnemonic) to the relay. The
 * server row is a cache of a client-authoritative identity, so re-registering the
 * same keys is how a new device — or a reset server — picks the account back up
 * without changing the identity or the safety numbers.
 */
export async function restoreAccountFromMnemonic(
  platform: Platform,
  mnemonic: string,
  username: string,
  pin: string
): Promise<RegistrationResult> {
  const identity = await recoverIdentityFromMnemonic(mnemonic)
  const bundle = generatePreKeyBundle(identity.exchange, identity.signing, ONE_TIME_PREKEY_COUNT)

  const { data, error } = await authApi.register({
    username,
    identityKey: identity.signing.publicKey,
    exchangeIdentityKey: identity.exchange.publicKey,
    signedPrekey: bundle.signedPreKey.publicKey,
    signedPrekeySignature: bundle.signature,
    oneTimePrekeys: bundle.oneTimePreKeys.map((key, i) => ({
      id: `${username}-prekey-${i}`,
      publicKey: key.publicKey,
    })),
  })

  if (error || !data) return { ok: false, error: error ?? 'Restore failed' }

  await persist(platform, pin, identity, bundle, { userId: data.id, username })
  return { ok: true, account: { mnemonic, identity, userId: data.id, username } }
}
