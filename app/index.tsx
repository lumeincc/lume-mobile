// SPDX-License-Identifier: LicenseRef-LUME-Source-Available
// Copyright (C) 2026 LUME Inc

// Polyfills before anything crypto-adjacent. Route modules are not guaranteed to
// evaluate after _layout, and the import is idempotent, so it is repeated here.
import '../src/polyfills'

import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSession } from '../src/store/session'
import {
  AuthHero,
  AuthHint,
  AuthTitle,
  ErrorText,
  Field,
  OrDivider,
  Pill,
  Screen,
  usePalette,
} from '../src/ui/components'
import { metrics, radius, space } from '../src/ui/theme'

/**
 * The auth screen, laid out like the web client's: a narrow centred column,
 * a large centred title, then pill buttons.
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

  // Navigation is deliberately explicit per action rather than an effect on
  // `unlocked`. Registration opens the session before the phrase reaches state,
  // so an effect would route away first and the user would never see the only
  // copy of their recovery phrase.

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
        <AuthHint>Открываем хранилище…</AuthHint>
      </Screen>
    )
  }

  if (recovery) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.shell}>
          <AuthHero>
            <AuthTitle>Сохраните фразу</AuthTitle>
            <AuthHint>
              Единственный способ восстановить доступ. Запишите на бумаге — фраза не хранится на сервере.
            </AuthHint>
            <View
              style={{
                backgroundColor: p.surfaceStrong,
                borderColor: p.border,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: space.lg,
                marginTop: space.xs,
              }}
            >
              <Text style={{ color: p.textPrimary, fontSize: 16, lineHeight: 27, letterSpacing: 0.2 }}>
                {recovery}
              </Text>
            </View>
            <Pill
              title="Я записал фразу"
              onPress={() => {
                setRecovery(null)
                router.replace('/chats')
              }}
            />
          </AuthHero>
        </ScrollView>
      </Screen>
    )
  }

  const title = mode === 'unlock' ? 'С возвращением' : mode === 'create' ? 'Добро пожаловать' : 'Восстановление'
  const hint =
    mode === 'unlock'
      ? 'Введите PIN, чтобы открыть хранилище на этом устройстве.'
      : mode === 'create'
        ? 'Публикуется только открытый ключ. Всё остальное остаётся здесь.'
        : 'Введите фразу из 12 слов и задайте новый PIN.'

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.shell} keyboardShouldPersistTaps="handled">
          <AuthHero>
            <Text
              style={{
                textAlign: 'center',
                fontSize: 13,
                letterSpacing: 3,
                color: p.textMuted,
                marginBottom: space.sm,
              }}
            >
              LUME
            </Text>
            <AuthTitle>{title}</AuthTitle>
            <AuthHint>{hint}</AuthHint>

            <View style={{ gap: space.md, marginTop: space.lg }}>
              {mode !== 'unlock' && (
                <Field
                  label="Имя пользователя"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="alice"
                />
              )}

              {mode === 'restore' && (
                <Field
                  label="Фраза восстановления"
                  value={mnemonic}
                  onChangeText={setMnemonic}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  placeholder="двенадцать слов через пробел"
                  style={{ minHeight: 96, textAlignVertical: 'top' }}
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

              {error ? <ErrorText>{error}</ErrorText> : null}

              {mode === 'unlock' && (
                <Pill
                  title="Открыть"
                  busy={busy}
                  onPress={() =>
                    run(async () => {
                      const failure = await session.unlock(pin)
                      if (failure) return failure
                      router.replace('/chats')
                      return null
                    })
                  }
                />
              )}

              {mode === 'create' && (
                <Pill
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
                <Pill
                  title="Восстановить"
                  busy={busy}
                  onPress={() =>
                    run(async () => {
                      const failure = await session.restore(mnemonic, username, pin)
                      if (failure) return failure
                      router.replace('/chats')
                      return null
                    })
                  }
                />
              )}

              <OrDivider label="или" />

              {mode === 'unlock' ? (
                <Pill variant="secondary" title="Восстановить по фразе" onPress={() => setMode('restore')} />
              ) : mode === 'create' ? (
                <Pill variant="secondary" title="У меня уже есть фраза" onPress={() => setMode('restore')} />
              ) : (
                <Pill
                  variant="secondary"
                  title={session.accountExists ? 'Назад ко входу' : 'Создать новый аккаунт'}
                  onPress={() => setMode(session.accountExists ? 'unlock' : 'create')}
                />
              )}
            </View>

            <Text style={{ fontSize: 13, color: p.textMuted, textAlign: 'center', marginTop: space.lg }}>
              Сервер видит только зашифрованные данные
            </Text>
          </AuthHero>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = {
  shell: {
    flexGrow: 1,
    justifyContent: 'center' as const,
    paddingHorizontal: space.lg,
    paddingVertical: space.xl,
  },
}
