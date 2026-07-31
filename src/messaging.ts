// SPDX-License-Identifier: LicenseRef-LUME-Source-Available
// Copyright (C) 2026 LUME Inc

/**
 * Sending and receiving encrypted messages.
 *
 * The web client keeps this flow inside the chat screen component; here it is a
 * plain module so it can be unit-tested and driven from Node against the real
 * relay. Every security-relevant step is carried over deliberately — dropping any
 * one of them silently downgrades the guarantee:
 *
 *   - the signed prekey's signature is verified before any DH;
 *   - the fetched bundle is pinned to the identity already trusted for that
 *     contact, so a malicious relay cannot substitute its own (SEC-20260621-002);
 *   - an inbound X3DH header is pinned the same way;
 *   - the responder answers with the signed prekey the sender actually addressed,
 *     accepting the previous one only inside its grace window (SEC-20260621-022);
 *   - a one-time prekey is consumed on use, because X3DH's forward secrecy
 *     depends on it being used at most once;
 *   - a fresh X3DH session is NOT persisted when the send fails, so a retry
 *     re-sends the handshake instead of leaving the recipient unable to decrypt.
 *
 * Note the two layers: the ratchet wraps a payload that is itself sealed with
 * nacl-box between the two exchange identity keys.
 */

import { decodeBase64 } from 'tweetnacl-util'
import { verify } from './crypto/keys'
import {
  x3dhInitiate,
  x3dhRespond,
  initSenderSession,
  initReceiverSession,
  ratchetEncrypt,
  ratchetDecrypt,
  serializeSession,
  deserializeSession,
  type DoubleRatchetSession,
  type EncryptedMessage,
} from './crypto/ratchet'
import {
  vaultGetExchangeKeyPair,
  vaultGetPublicKeys,
  vaultGetSession,
  vaultUpsertSession,
  vaultGetMasterKey,
} from './crypto/keyVault'
import { findOneTimePreKey, deleteOneTimePreKey, loadPreKeyMaterial } from './crypto/storage'
import { selectRespondSpk } from './crypto/spkRotation'
import { encodeRatchetEnvelope, parseRatchetEnvelope } from './lib/ratchetPayload'
import { encodeMessagePayload, decodeMessagePayload } from './lib/messagePayload'
import {
  bundleMatchesTrustedIdentity,
  inboundSenderMatchesTrustedIdentity,
  type TrustedIdentity,
} from './lib/identityPinning'
import { authApi, messagesApi } from './lib/api'

export interface SendTarget {
  /** Server id of the recipient. */
  id: string
  username: string
  /** What we already trust for this contact, if anything. Drives MITM pinning. */
  trusted?: TrustedIdentity | null
  /** Recipient's X25519 exchange identity key, when already known. */
  exchangeKey?: string
}

export type SendResult = { ok: true; messageId: string } | { ok: false; error: string }

export async function sendMessage(
  senderId: string,
  target: SendTarget,
  text: string
): Promise<SendResult> {
  const timestamp = Date.now()

  const existing = vaultGetSession(target.id)
  let session: DoubleRatchetSession | null = existing ? deserializeSession(existing) : null
  let recipientExchangeKey = target.exchangeKey ?? null
  let x3dhInit:
    | {
        senderIdentityKey: string
        senderEphemeralKey: string
        recipientOneTimePreKey?: string | null
        recipientSignedPreKey?: string
      }
    | undefined

  if (!session || !recipientExchangeKey) {
    const { data: bundle, error: bundleError } = await authApi.getBundle(target.username)
    if (bundleError || !bundle) return { ok: false, error: bundleError ?? 'Failed to fetch bundle' }

    // The signature proves the bundle is internally consistent...
    const signatureOk = verify(
      decodeBase64(bundle.signedPrekey),
      decodeBase64(bundle.signedPrekeySignature),
      bundle.identityKey
    )
    if (!signatureOk) return { ok: false, error: 'Invalid signed prekey signature' }

    const recipientIk = bundle.exchangeIdentityKey || bundle.exchangeKey
    if (!recipientIk) return { ok: false, error: 'Recipient bundle missing exchange identity key' }

    // ...but only pinning proves it is the identity we already trust, which is
    // what a malicious relay cannot forge.
    if (!bundleMatchesTrustedIdentity(bundle.identityKey, recipientIk, target.trusted)) {
      return {
        ok: false,
        error: 'Recipient identity does not match the trusted contact (possible MITM)',
      }
    }
    recipientExchangeKey = recipientIk

    if (!session) {
      const { sharedSecret, ephemeralPublicKey } = x3dhInitiate(vaultGetExchangeKeyPair(), {
        identityKey: recipientIk,
        signingKey: bundle.identityKey,
        signedPreKey: bundle.signedPrekey,
        signature: bundle.signedPrekeySignature,
        oneTimePreKey: bundle.oneTimePrekey,
      })

      session = initSenderSession(sharedSecret, bundle.signedPrekey)
      x3dhInit = {
        senderIdentityKey: vaultGetPublicKeys()!.exchangePublicKey,
        senderEphemeralKey: ephemeralPublicKey,
        recipientOneTimePreKey: bundle.oneTimePrekey ?? null,
        // Tell the recipient which signed prekey we used, so they can answer with
        // the matching one during its grace window (SEC-20260621-022).
        recipientSignedPreKey: bundle.signedPrekey,
      }
    }
  }

  const ownKeys = vaultGetExchangeKeyPair()
  const plaintext = encodeMessagePayload(
    text,
    timestamp,
    null,
    ownKeys.publicKey,
    ownKeys.secretKey,
    recipientExchangeKey
  )

  const encrypted = ratchetEncrypt(session, new TextEncoder().encode(plaintext))
  const encryptedPayload = encodeRatchetEnvelope({
    encrypted,
    timestamp,
    ...(x3dhInit ? { x3dh: x3dhInit } : {}),
  })

  const { data, error } = await messagesApi.send({
    senderId,
    recipientId: target.id,
    encryptedPayload,
  })

  if (error || !data) {
    // Never persist a brand-new X3DH session on a failed first send: the retry
    // must repeat the handshake, or the recipient could never derive the key. An
    // already-established session keeps its advance, so an ambiguous transport
    // failure cannot lead to reusing a message key.
    if (existing) vaultUpsertSession(target.id, serializeSession(session))
    return { ok: false, error: error ?? 'Send failed' }
  }

  vaultUpsertSession(target.id, serializeSession(session))
  return { ok: true, messageId: data.messageId }
}

export interface IncomingMessage {
  id: string
  senderId: string
  encryptedPayload: string
}

export type ReceiveResult =
  | { ok: true; text: string; timestamp: number }
  | { ok: false; error: string }

export async function receiveMessage(
  message: IncomingMessage,
  trusted?: TrustedIdentity | null
): Promise<ReceiveResult> {
  const envelope = parseRatchetEnvelope(message.encryptedPayload)
  if (!envelope) return { ok: false, error: 'Unreadable envelope' }

  const existing = vaultGetSession(message.senderId)
  let session: DoubleRatchetSession | null = existing ? deserializeSession(existing) : null
  let consumedOpkPublicKey: string | null = null

  if (!session) {
    const x3dh = envelope.x3dh
    if (!x3dh) return { ok: false, error: 'No session and no X3DH header' }

    // Pin the sender the same way as the outbound side: a relay that injects its
    // own handshake must not be able to become a "new contact" silently.
    if (!inboundSenderMatchesTrustedIdentity(x3dh.senderIdentityKey, trusted)) {
      return { ok: false, error: 'Sender identity does not match the trusted contact (possible MITM)' }
    }

    const masterKey = vaultGetMasterKey()
    const material = await loadPreKeyMaterial(masterKey)
    if (!material) return { ok: false, error: 'No local prekey material' }

    let opk = null
    if (x3dh.recipientOneTimePreKey) {
      opk = await findOneTimePreKey(x3dh.recipientOneTimePreKey, masterKey)
      if (!opk) return { ok: false, error: 'One-time prekey missing — ask your contact to retry' }
      consumedOpkPublicKey = x3dh.recipientOneTimePreKey
    }

    // Answer with the signed prekey the sender addressed: the current one, or the
    // previous one while still inside its grace window. Fail closed otherwise.
    const respondSpk = selectRespondSpk(material, x3dh.recipientSignedPreKey, Date.now())
    if (!respondSpk) return { ok: false, error: 'Addressed signed prekey is no longer available' }

    const sharedSecret = x3dhRespond(
      vaultGetExchangeKeyPair(),
      respondSpk,
      opk,
      x3dh.senderIdentityKey,
      x3dh.senderEphemeralKey
    )
    session = initReceiverSession(sharedSecret, respondSpk)
  }

  const encrypted: EncryptedMessage = {
    header: envelope.header,
    ciphertext: envelope.ciphertext,
    nonce: envelope.nonce,
  }

  const plaintextBytes = ratchetDecrypt(session, encrypted)
  if (!plaintextBytes) return { ok: false, error: 'Decryption failed' }

  const ownKeys = vaultGetExchangeKeyPair()
  const decoded = decodeMessagePayload(new TextDecoder().decode(plaintextBytes), ownKeys.secretKey)
  if (!decoded) return { ok: false, error: 'Unreadable message payload' }

  // Commit only after a fully successful decrypt, and only then burn the
  // one-time prekey — a failed handshake must leave it usable for a retry.
  vaultUpsertSession(message.senderId, serializeSession(session))
  if (consumedOpkPublicKey) {
    await deleteOneTimePreKey(consumedOpkPublicKey, vaultGetMasterKey())
  }

  return { ok: true, text: decoded.content, timestamp: decoded.timestamp ?? envelope.timestamp }
}
