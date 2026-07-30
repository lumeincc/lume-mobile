// SPDX-License-Identifier: LicenseRef-LUME-Source-Available
// Copyright (C) 2026 LUME Inc

// Polyfills before anything crypto-adjacent. Route modules are not guaranteed to
// evaluate after _layout, and the import is idempotent, so it is repeated here.
import '../src/polyfills'

import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native'
import { createAccount } from '../src/onboarding'
import { hasAccount, unlock, wipeVault } from '../src/vault'
import { devicePlatform } from '../src/platform/reactNativeFull'
import { verifyPbkdf2Parity, nativePbkdf2Available } from '../src/platform/nativeCrypto'

/**
 * Vault walkthrough: setup on first launch, unlock on every launch after.
 * Proves the encrypted SQLite vault + keystore-backed device secret survive a
 * real app restart, which is what the storage layer exists to do.
 */
export default function Index() {
  const [ready, setReady] = useState(false)
  const [existing, setExisting] = useState(false)
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
      const text = fn ? await fn() : ''
      setResult(`${text}\n\ntook ${Date.now() - started}ms`)
    } catch (e) {
      setError(describe(e))
    } finally {
      setBusy(false)
      void refresh()
    }
  }

  const onCreate = () =>
    run(async () => {
      const { mnemonic, identity } = await createAccount(devicePlatform, pin)
      return (
        `ACCOUNT CREATED & SEALED IN SQLITE\n\n` +
        `recovery phrase (write it down):\n${mnemonic}\n\n` +
        `signing pub:\n${identity.signing.publicKey}\n\n` +
        `Now force-close the app and reopen it — it should ask to UNLOCK.`
      )
    })

  const onUnlock = () =>
    run(async () => {
      const res = await unlock(devicePlatform, pin)
      if (!res.ok) return `UNLOCK FAILED: ${res.reason}`
      const keyLen = res.masterKey.length
      res.masterKey.fill(0)
      return (
        `VAULT OPENED\n\n` +
        `signing pub:\n${res.identity.signing.publicKey}\n\n` +
        `exchange pub:\n${res.identity.exchange.publicKey}\n\n` +
        `master key: ${keyLen} bytes (PIN + keystore secret)`
      )
    })

  const onWipe = () =>
    run(async () => {
      await wipeVault(devicePlatform)
      return 'VAULT WIPED (database + keystore secret)'
    })

  const onParity = () =>
    run(async () => {
      const r = await verifyPbkdf2Parity()
      return (
        `KDF PARITY (2000 iterations)\n\n` +
        `native module: ${r.native ? 'present' : 'MISSING — falling back to JS'}\n` +
        `bytes match:   ${r.match ? 'YES ✓' : 'NO ✗'}\n` +
        `native: ${r.nativeMs}ms   pure JS: ${r.jsMs}ms\n` +
        `speedup: ${r.jsMs > 0 && r.nativeMs > 0 ? (r.jsMs / r.nativeMs).toFixed(1) : '?'}×\n\n` +
        `digest: ${r.digestPrefix}…`
      )
    })

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{ready ? (existing ? 'Unlock vault' : 'Create account') : 'Checking vault…'}</Text>
      <Text style={styles.sub}>
        {existing
          ? 'An encrypted account is stored on this device. Enter the PIN to open it.'
          : 'Creates an identity and seals it in an encrypted SQLite vault, keyed by your PIN plus a secret held in the Android keystore.'}
      </Text>

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
        <Pressable style={[styles.button, busy && styles.disabled]} onPress={onCreate} disabled={busy}>
          <Text style={styles.buttonText}>{busy ? 'Working…' : 'Create account'}</Text>
        </Pressable>
      )}

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
  container: { padding: 20, gap: 12 },
  title: { fontSize: 22, fontWeight: '600' },
  sub: { fontSize: 13, opacity: 0.7 },
  label: { fontSize: 13, marginTop: 8, opacity: 0.7 },
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
