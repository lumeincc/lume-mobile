// SPDX-License-Identifier: LicenseRef-LUME-Source-Available
// Copyright (C) 2026 LUME Inc

import { useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native'
import { createIdentity } from '../src/onboarding'
import { reactNativePlatform } from '../src/platform/reactNative'

/**
 * Walking skeleton: proves the vendored crypto core runs on device wired to the
 * native adapter — generate a BIP39 identity and derive the master key via native
 * PBKDF2. No persistence/registration yet; this is the on-device crypto smoke.
 */
export default function Index() {
  const [pin, setPin] = useState('123456')
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const id = await createIdentity(reactNativePlatform, pin)
      setResult(
        `mnemonic (show once):\n${id.mnemonic}\n\n` +
          `signing pub (Ed25519):\n${id.identity.signing.publicKey}\n\n` +
          `exchange pub (X25519):\n${id.identity.exchange.publicKey}\n\n` +
          `master key: ${id.masterKeyLength} bytes derived via native PBKDF2 (600k)`
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Crypto on device</Text>
      <Text style={styles.sub}>Generates an identity and derives the at-rest master key using the shared core + native crypto.</Text>

      <Text style={styles.label}>PIN</Text>
      <TextInput
        style={styles.input}
        value={pin}
        onChangeText={setPin}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={12}
      />

      <Pressable style={[styles.button, busy && styles.buttonDisabled]} onPress={run} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? 'Working…' : 'Create identity on device'}</Text>
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
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#c00' },
  resultBox: { backgroundColor: '#f3f3f3', borderRadius: 8, padding: 12, marginTop: 8 },
  mono: { fontFamily: 'monospace', fontSize: 12 },
})
