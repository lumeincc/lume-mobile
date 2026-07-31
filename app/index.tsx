// SPDX-License-Identifier: LicenseRef-LUME-Source-Available
// Copyright (C) 2026 LUME Inc

// Polyfills before anything crypto-adjacent. Route modules are not guaranteed to
// evaluate after _layout, and the import is idempotent, so it is repeated here.
import '../src/polyfills'

import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSession } from '../src/store/session'
import { Body, Button, ErrorText, Field, Screen, Title, layout, usePalette } from '../src/ui/components'
import { radius, space, text } from '../src/ui/theme'

/**
 * The gate: create an account, restore one, or unlock the one on this device.
 * Everything below happens locally — only public keys ever reach the relay.
 */
export default function Index() {
  const session = useSession()
  const p = usePalette()

  const [mode, setMode] = useState<'unlock' | 'create' | 'restore'>('unlock')
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [mnemonic, setMnemonic] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recovery, setRecovery] = useState<string | null>(null)

  useEffect(() => {
    if (session.ready) setMode(session.accountExists ? 'unlock' : 'create')
  }, [session.ready, session.accountExists])

  useEffect(() => {
    // Nothing to show here once the vault is open.
    if (session.unlocked && !recovery) router.replace('/chats')
  }, [session.unlocked, recovery])

  async function run(action: () => Promise<string | null>) {
    setBusy(true)
    setError(null)
    const failure = await action().catch(e => (e instanceof Error ? e.message : String(e)))
    setBusy(false)
    if (failure) setError(failure)
  }

  if (!session.ready) {
    return (
      <Screen style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Body muted>Открываем хранилище…</Body>
      </Screen>
    )
  }

  // Shown once, right after the account is created.
  if (recovery) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={layout.padded}>
          <Title>Сохраните фразу</Title>
          <Body>
            Это единственный способ восстановить доступ на другом устройстве. Запишите её на бумаге —
            фраза не хранится на сервере и не может быть выдана повторно.
          </Body>
          <View
            style={{
              backgroundColor: p.surface,
              borderColor: p.border,
              borderWidth: 1,
              borderRadius: radius.md,
              padding: space.lg,
            }}
          >
            <Text style={{ color: p.textPrimary, fontSize: 16, lineHeight: 26, letterSpacing: 0.3 }}>
              {recovery}
            </Text>
          </View>
          <Button
            title="Я записал фразу"
            onPress={() => {
              setRecovery(null)
              router.replace('/chats')
            }}
          />
        </ScrollView>
      </Screen>
    )
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[layout.padded, { flexGrow: 1, justifyContent: 'center' }]}>
          <View style={{ gap: space.xs, marginBottom: space.sm }}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: p.textPrimary, letterSpacing: 1 }}>
              LUME
            </Text>
            <Body muted>
              {mode === 'unlock'
                ? 'Введите PIN, чтобы открыть зашифрованное хранилище.'
                : mode === 'create'
                  ? 'Публикуется только открытый ключ. Всё остальное остаётся на устройстве.'
                  : 'Восстановление по фразе из 12 слов.'}
            </Body>
          </View>

          {mode !== 'unlock' && (
            <Field
              label="ИМЯ ПОЛЬЗОВАТЕЛЯ"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="alice"
            />
          )}

          {mode === 'restore' && (
            <Field
              label="ФРАЗА ВОССТАНОВЛЕНИЯ"
              value={mnemonic}
              onChangeText={setMnemonic}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              placeholder="двенадцать слов через пробел"
              style={{ minHeight: 90, textAlignVertical: 'top' }}
            />
          )}

          <Field
            label="PIN"
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={12}
            placeholder="••••••"
          />

          <ErrorText>{error}</ErrorText>

          {mode === 'unlock' && (
            <Button title="Открыть" busy={busy} onPress={() => run(() => session.unlock(pin))} />
          )}

          {mode === 'create' && (
            <Button
              title="Создать аккаунт"
              busy={busy}
              onPress={() =>
                run(async () => {
                  const res = await session.register(username, pin)
                  if (!res.ok) return res.error
                  // The phrase exists only at creation time — show it before routing on.
                  setRecovery(res.mnemonic)
                  return null
                })
              }
            />
          )}

          {mode === 'restore' && (
            <Button
              title="Восстановить"
              busy={busy}
              onPress={() => run(() => session.restore(mnemonic, username, pin))}
            />
          )}

          <View style={{ height: space.xs }} />

          {mode === 'unlock' ? (
            <Button variant="ghost" title="Восстановить по фразе" onPress={() => setMode('restore')} />
          ) : mode === 'create' ? (
            <Button variant="ghost" title="У меня уже есть фраза" onPress={() => setMode('restore')} />
          ) : (
            <Button
              variant="ghost"
              title={session.accountExists ? 'Назад ко входу' : 'Создать новый аккаунт'}
              onPress={() => setMode(session.accountExists ? 'unlock' : 'create')}
            />
          )}

          <Text style={{ fontSize: text.micro, color: p.textMuted, textAlign: 'center', marginTop: space.md }}>
            Сервер видит только зашифрованные данные
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}
