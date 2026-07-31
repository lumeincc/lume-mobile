// SPDX-License-Identifier: LicenseRef-LUME-Source-Available
// Copyright (C) 2026 LUME Inc

/**
 * App state: the open session, contacts, messages, and the live connection.
 *
 * Deliberately a small React context rather than another state library. The
 * engine already owns everything hard — keys, the ratchet, persistence — so this
 * layer only mirrors it for rendering and routes user actions back into it.
 *
 * Plaintext messages live here in memory and are written to the encrypted vault;
 * nothing readable is kept anywhere else.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { devicePlatform } from '../platform/reactNativeFull'
import { openSession, closeSession, flushSessions } from '../session'
import { registerNewAccount, restoreAccountFromMnemonic, rebindIdentity } from '../registration'
import { hasAccount, loadMessages, saveMessages, saveContacts, loadContacts } from '../vault'
import { sendMessage as engineSend, receiveMessage as engineReceive } from '../messaging'
import { RealtimeClient, type ConnectionStatus } from '../realtime'
import { authApi } from '../lib/api'
import { vaultGetMasterKey } from '../crypto/keyVault'
import type { AccountProfile, Contact, StoredMessage } from '../vault'
import type { IdentityKeys } from '../crypto/keys'

interface SessionState {
  ready: boolean
  accountExists: boolean
  unlocked: boolean
  profile: AccountProfile | null
  contacts: Contact[]
  messages: StoredMessage[]
  connection: ConnectionStatus
  /** Why the socket dropped, when it did — a bare "offline" hides real faults. */
  connectionDetail: string | null
  error: string | null
}

interface SessionActions {
  /** Returns the recovery phrase, which exists only at this moment. */
  register(username: string, pin: string): Promise<{ ok: true; mnemonic: string } | { ok: false; error: string }>
  restore(mnemonic: string, username: string, pin: string): Promise<string | null>
  unlock(pin: string): Promise<string | null>
  lock(): Promise<void>
  addContact(username: string): Promise<string | null>
  send(contactId: string, text: string): Promise<string | null>
  messagesWith(contactId: string): StoredMessage[]
}

const Ctx = createContext<(SessionState & SessionActions) | null>(null)

export function useSession() {
  const value = useContext(Ctx)
  if (!value) throw new Error('useSession must be used inside <SessionProvider>')
  return value
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({
    ready: false,
    accountExists: false,
    unlocked: false,
    profile: null,
    contacts: [],
    messages: [],
    connection: 'idle',
    connectionDetail: null,
    error: null,
  })

  const realtime = useRef<RealtimeClient | null>(null)
  const profileRef = useRef<AccountProfile | null>(null)
  const identityRef = useRef<IdentityKeys | null>(null)
  const messagesRef = useRef<StoredMessage[]>([])
  const contactsRef = useRef<Contact[]>([])

  useEffect(() => {
    void hasAccount(devicePlatform)
      .then(exists => setState(s => ({ ...s, ready: true, accountExists: exists })))
      .catch(e => setState(s => ({ ...s, ready: true, error: describe(e) })))
  }, [])

  const persistMessages = useCallback(async (next: StoredMessage[]) => {
    messagesRef.current = next
    setState(s => ({ ...s, messages: next }))
    await saveMessages(devicePlatform, next, vaultGetMasterKey())
  }, [])

  const persistContacts = useCallback(async (next: Contact[]) => {
    contactsRef.current = next
    setState(s => ({ ...s, contacts: next }))
    await saveContacts(devicePlatform, next, vaultGetMasterKey())
  }, [])

  /** Decrypt an inbound message and file it under the right contact. */
  const ingest = useCallback(
    async (incoming: { id: string; senderId: string; senderUsername?: string; encryptedPayload: string }) => {
      if (messagesRef.current.some(m => m.id === incoming.id)) return

      const known = contactsRef.current.find(c => c.id === incoming.senderId)
      const res = await engineReceive(
        { id: incoming.id, senderId: incoming.senderId, encryptedPayload: incoming.encryptedPayload },
        known ? { publicKey: known.publicKey, exchangeKey: known.exchangeKey } : null
      )
      if (!res.ok) {
        setState(s => ({ ...s, error: res.error }))
        return
      }

      // First contact: remember who they are, so later handshakes are pinned.
      if (!known && incoming.senderUsername) {
        const bundle = await authApi.getBundle(incoming.senderUsername)
        if (bundle.data) {
          await persistContacts([
            ...contactsRef.current,
            {
              id: incoming.senderId,
              username: incoming.senderUsername,
              publicKey: bundle.data.identityKey,
              exchangeKey: bundle.data.exchangeIdentityKey || bundle.data.exchangeKey || '',
              addedAt: Date.now(),
            },
          ])
        }
      }

      await persistMessages([
        ...messagesRef.current,
        {
          id: incoming.id,
          contactId: incoming.senderId,
          outgoing: false,
          text: res.text,
          timestamp: res.timestamp,
        },
      ])
    },
    [persistContacts, persistMessages]
  )

  /** Pull anything queued while the app was closed, then stay connected. */
  const startRealtime = useCallback(
    async (initialUserId: string) => {
      let userId = initialUserId
      // Anything that goes wrong here used to return silently, which showed up
      // as a permanently "idle" connection with no explanation. Report instead.
      try {
        const pending = await messagesApiGetPending(userId)
        for (const m of pending) await ingest(m)
      } catch (e) {
        setState(s => ({ ...s, error: `Не удалось забрать сообщения: ${describe(e)}` }))
      }

      let token = await authApi.getSession(userId)

      // "User not found" means the relay lost its row, not that anything is wrong
      // with this account — the identity here is authoritative. Republish it and
      // carry on; the identity and safety numbers are unchanged.
      if (token.error && /not found/i.test(token.error) && identityRef.current && profileRef.current) {
        const rebind = await rebindIdentity(
          devicePlatform,
          identityRef.current,
          profileRef.current.username,
          vaultGetMasterKey()
        )
        if (rebind.ok) {
          profileRef.current = { userId: rebind.userId, username: profileRef.current.username }
          setState(s => ({ ...s, profile: profileRef.current }))
          userId = rebind.userId
          token = await authApi.getSession(userId)
        }
      }

      if (token.error || !token.data) {
        setState(s => ({
          ...s,
          connection: 'auth_error',
          connectionDetail: token.error ?? 'сервер не выдал токен',
        }))
        return
      }

      realtime.current?.disconnect()
      realtime.current = new RealtimeClient({
        onStatus: (connection, detail) =>
          setState(s => ({
            ...s,
            connection,
            connectionDetail: detail?.code
              ? `${detail.code}${detail.reason ? `: ${detail.reason}` : ''}`
              : null,
          })),
        onMessage: m => void ingest(m),
        onTokenRefreshNeeded: async () => {
          const fresh = await authApi.getSession(userId)
          return fresh.data?.token ?? null
        },
      })
      realtime.current.connect(token.data.token)
    },
    [ingest]
  )

  const afterOpen = useCallback(
    async (profile: AccountProfile | null, contacts: Contact[], identity: IdentityKeys) => {
      profileRef.current = profile
      identityRef.current = identity
      contactsRef.current = contacts
      const stored = await loadMessages(devicePlatform, vaultGetMasterKey())
      messagesRef.current = stored
      setState(s => ({
        ...s,
        unlocked: true,
        accountExists: true,
        profile,
        contacts,
        messages: stored,
        error: null,
      }))
      if (profile) void startRealtime(profile.userId)
    },
    [startRealtime]
  )

  const register = useCallback(
    async (
      username: string,
      pin: string
    ): Promise<{ ok: true; mnemonic: string } | { ok: false; error: string }> => {
      const res = await registerNewAccount(devicePlatform, username.trim(), pin)
      if (!res.ok) return { ok: false, error: res.error }
      const opened = await openSession(devicePlatform, pin)
      if (!opened.ok) return { ok: false, error: opened.reason }
      await afterOpen(opened.profile, opened.contacts, opened.identity)
      return { ok: true, mnemonic: res.account.mnemonic }
    },
    [afterOpen]
  )

  const restore = useCallback(
    async (mnemonic: string, username: string, pin: string) => {
      const res = await restoreAccountFromMnemonic(devicePlatform, mnemonic.trim(), username.trim(), pin)
      if (!res.ok) return res.error
      const opened = await openSession(devicePlatform, pin)
      if (!opened.ok) return opened.reason
      await afterOpen(opened.profile, opened.contacts, opened.identity)
      return null
    },
    [afterOpen]
  )

  const unlock = useCallback(
    async (pin: string) => {
      const opened = await openSession(devicePlatform, pin)
      if (!opened.ok) {
        return opened.reason === 'wrong-pin' ? 'Неверный PIN' : opened.reason
      }
      await afterOpen(opened.profile, opened.contacts, opened.identity)
      return null
    },
    [afterOpen]
  )

  const lock = useCallback(async () => {
    realtime.current?.disconnect()
    realtime.current = null
    await flushSessions()
    await closeSession()
    messagesRef.current = []
    contactsRef.current = []
    setState(s => ({ ...s, unlocked: false, profile: null, contacts: [], messages: [], connection: 'idle' }))
  }, [])

  const addContact = useCallback(
    async (username: string) => {
      const name = username.trim()
      if (!name) return 'Введите имя пользователя'
      if (contactsRef.current.some(c => c.username === name)) return 'Контакт уже добавлен'

      const bundle = await authApi.getBundle(name)
      if (bundle.error || !bundle.data) return bundle.error ?? 'Пользователь не найден'

      await persistContacts([
        ...contactsRef.current,
        {
          id: bundle.data.id,
          username: bundle.data.username,
          publicKey: bundle.data.identityKey,
          exchangeKey: bundle.data.exchangeIdentityKey || bundle.data.exchangeKey || '',
          addedAt: Date.now(),
        },
      ])
      return null
    },
    [persistContacts]
  )

  const send = useCallback(
    async (contactId: string, text: string) => {
      const profile = profileRef.current
      const contact = contactsRef.current.find(c => c.id === contactId)
      if (!profile || !contact) return 'Контакт не найден'

      const res = await engineSend(
        profile.userId,
        {
          id: contact.id,
          username: contact.username,
          trusted: { publicKey: contact.publicKey, exchangeKey: contact.exchangeKey },
          exchangeKey: contact.exchangeKey || undefined,
        },
        text
      )
      if (!res.ok) return res.error

      await persistMessages([
        ...messagesRef.current,
        { id: res.messageId, contactId, outgoing: true, text, timestamp: Date.now() },
      ])
      return null
    },
    [persistMessages]
  )

  const messagesWith = useCallback(
    (contactId: string) =>
      state.messages.filter(m => m.contactId === contactId).sort((a, b) => a.timestamp - b.timestamp),
    [state.messages]
  )

  const value = useMemo(
    () => ({ ...state, register, restore, unlock, lock, addContact, send, messagesWith }),
    [state, register, restore, unlock, lock, addContact, send, messagesWith]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

function describe(e: unknown) {
  return e instanceof Error ? e.message : String(e)
}

/** Pending messages the relay held while this device was offline. */
async function messagesApiGetPending(userId: string) {
  const { messagesApi } = await import('../lib/api')
  const res = await messagesApi.getPending(userId)
  if (res.error || !res.data) return []
  return res.data.messages.map(m => ({
    id: m.id,
    senderId: m.senderId,
    senderUsername: m.senderUsername,
    encryptedPayload: m.encryptedPayload,
  }))
}
