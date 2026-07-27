// SPDX-License-Identifier: LicenseRef-LUME-Source-Available
// Copyright (C) 2026 LUME Inc

import { describe, it, expect } from 'vitest'
import { createIdentity, recoverIdentity } from '@/onboarding'
import { nodePlatform } from '@/platform/node'

describe('onboarding — create & recover identity', () => {
  it('creates a mnemonic + Ed25519/X25519 public keys + a derived master key', async () => {
    const res = await createIdentity(nodePlatform, '123456')
    expect(res.mnemonic.split(' ').length).toBe(12)
    expect(typeof res.identity.signing.publicKey).toBe('string')
    expect(res.identity.signing.publicKey.length).toBeGreaterThan(0)
    expect(typeof res.identity.exchange.publicKey).toBe('string')
    expect(res.salt.length).toBe(16)
    expect(res.masterKeyLength).toBe(32)
  })

  it('recovering from the produced mnemonic yields the same identity (deterministic)', async () => {
    const created = await createIdentity(nodePlatform, '123456')
    const recovered = await recoverIdentity(created.mnemonic)
    expect(recovered.signing.publicKey).toBe(created.identity.signing.publicKey)
    expect(recovered.exchange.publicKey).toBe(created.identity.exchange.publicKey)
  })

  it('two fresh identities differ', async () => {
    const a = await createIdentity(nodePlatform, '123456')
    const b = await createIdentity(nodePlatform, '123456')
    expect(a.mnemonic).not.toBe(b.mnemonic)
    expect(a.identity.signing.publicKey).not.toBe(b.identity.signing.publicKey)
  })
})
