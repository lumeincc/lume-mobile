// SPDX-License-Identifier: LicenseRef-LUME-Source-Available
// Copyright (C) 2026 LUME Inc

// Polyfills before anything crypto-adjacent. Route modules are not guaranteed to
// evaluate after _layout, and the import is idempotent, so it is repeated here.
import '../src/polyfills'

import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native'
import { registerNewAccount } from '../src/registration'
import { hasAccount, wipeVault } from '../src/vault'
import { openSession } from '../src/session'
import { devicePlatform } from '../src/platform/reactNativeFull'
import { verifyPbkdf2Parity, nativePbkdf2Available } from '../src/platform/nativeCrypto'
import { API_URL } from '../src/lib/config'
import { healthApi, authApi } from '../src/lib/api'

/**
 * Setup and unlock against the real relay: register publishes only public keys,
 * then the identity and prekey secrets are sealed in the local vault.
 */
export default function Index() {
  const [ready, setReady] = useState(false)
  const [existing, setExisting] = useState(false)
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('123456')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  async function refresh() {
    try {
      setExisting(await hasAccount(devicePlatform))
    } catch (e) {
      setError(describe(e))
    } finally {
      setReady(true)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  function describe(e: unknown) {
    return e instanceof Error ? `${e.name}: ${e.message}` : String(e)
  }

  async function run(fn: () => Promise<string>) {
    setBusy(true)
    setError(null)
    setResult(null)
    const started = Date.now()
    try {
      setResult(`${await fn()}\n\ntook ${Date.now() - started}ms`)
    } catch (e) {
      setError(describe(e))
    } finally {
      setBusy(false)
      void refresh()
    }
  }

  const onPing = () =>
    run(async () => {
      const { data, error: err } = await healthApi.check()
      if (err) return `RELAY UNREACHABLE\n${API_URL}\n\n${err}`
      return `RELAY OK\n${API_URL}\n\nstatus: ${data?.status ?? '?'}`
    })

  const onRegister = () =>
    run(async () => {
      const name = username.trim()
      if (name.length < 3) return 'Pick a username of at least 3 characters.'
      const res = await registerNewAccount(devicePlatform, name, pin)
      if (!res.ok) return `REGISTRATION FAILED\n\n${res.error}`
      return (
        `REGISTERED AS @${res.account.username}\n\n` +
        `server id: ${res.account.userId}\n\n` +
        `recovery phrase (write it down):\n${res.account.mnemonic}\n\n` +
        `Only public keys were sent. Identity and prekey secrets are sealed locally.`
      )
    })

  const onUnlock = () =>
    run(async () => {
      // openSession also loads the keys into the in-memory vault, without which
      // the very next authenticated request could not be signed.
      const res = await openSession(devicePlatform, pin)
      if (!res.ok) return `UNLOCK FAILED: ${res.reason}`

      const session = res.profile ? await authApi.getSession(res.profile.userId) : null
      return (
        `VAULT OPENED\n\n` +
        (res.profile ? `account: @${res.profile.username}\nserver id: ${res.profile.userId}\n\n` : '') +
        `signing pub:\n${res.identity.signing.publicKey}\n\n` +
        (session ? `signed request to relay: ${session.error ? `FAILED — ${session.error}` : 'OK'}` : '')
      )
    })

  const onParity = () =>
    run(async () => {
      const r = await verifyPbkdf2Parity()
      return (
        `KDF PARITY (2000 iterations)\n\n` +
        `native module: ${r.native ? 'present' : 'MISSING — falling back to JS'}\n` +
        `bytes match:   ${r.match ? 'YES' : 'NO'}\n` +
        `native: ${r.nativeMs}ms   pure JS: ${r.jsMs}ms`
      )
    })

  const onWipe = () =>
    run(async () => {
      await wipeVault(devicePlatform)
      return 'VAULT WIPED (database + keystore secret)'
    })

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{ready ? (existing ? 'Unlock vault' : 'Create account') : 'Checking vault…'}</Text>
      <Text style={styles.sub}>
        {existing
          ? 'An encrypted account is stored on this device. Enter the PIN to open it.'
          : 'Publishes your public keys to the relay, then seals the identity and prekey secrets in an encrypted vault on this device.'}
      </Text>

      {!existing && (
        <>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="alice"
          />
        </>
      )}

      <Text style={styles.label}>PIN</Text>
      <TextInput
        style={styles.input}
        value={pin}
        onChangeText={setPin}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={12}
      />

      {existing ? (
        <Pressable style={[styles.button, busy && styles.disabled]} onPress={onUnlock} disabled={busy}>
          <Text style={styles.buttonText}>{busy ? 'Working…' : 'Unlock'}</Text>
        </Pressable>
      ) : (
        <Pressable style={[styles.button, busy && styles.disabled]} onPress={onRegister} disabled={busy}>
          <Text style={styles.buttonText}>{busy ? 'Working…' : 'Register with relay'}</Text>
        </Pressable>
      )}

      <Pressable style={[styles.secondary, busy && styles.disabled]} onPress={onPing} disabled={busy}>
        <Text style={styles.secondaryText}>Ping relay</Text>
      </Pressable>

      <Pressable style={[styles.secondary, busy && styles.disabled]} onPress={onParity} disabled={busy}>
        <Text style={styles.secondaryText}>Check KDF ({nativePbkdf2Available ? 'native' : 'JS only'})</Text>
      </Pressable>

      <Pressable style={[styles.secondary, busy && styles.disabled]} onPress={onWipe} disabled={busy}>
        <Text style={styles.secondaryText}>Wipe vault</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {result ? (
        <View style={styles.resultBox}>
          <Text style={styles.mono}>{result}</Text>
        </View>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 10 },
  title: { fontSize: 22, fontWeight: '600' },
  sub: { fontSize: 13, opacity: 0.7 },
  label: { fontSize: 13, marginTop: 6, opacity: 0.7 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  button: { backgroundColor: '#111', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '600' },
  secondary: { borderRadius: 8, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#ccc' },
  secondaryText: { color: '#333' },
  error: { color: '#c00' },
  resultBox: { backgroundColor: '#f3f3f3', borderRadius: 8, padding: 12, marginTop: 8 },
  mono: { fontFamily: 'monospace', fontSize: 12 },
})
