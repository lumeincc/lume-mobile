// SPDX-License-Identifier: LicenseRef-LUME-Source-Available
// Copyright (C) 2026 LUME Inc

import '../../src/polyfills'

import { useRef, useState } from 'react'
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSession } from '../../src/store/session'
import { Avatar, ErrorText, OnlineDot, Screen, usePalette } from '../../src/ui/components'
import { radius, space, text } from '../../src/ui/theme'
import type { StoredMessage } from '../../src/vault'

/** One conversation. Every bubble here was decrypted on this device. */
export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const session = useSession()
  const p = usePalette()
  const listRef = useRef<FlatList<StoredMessage>>(null)

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const contact = session.contacts.find(c => c.id === id)
  const messages = session.messagesWith(id ?? '')

  async function send() {
    const body = draft.trim()
    if (!body || !id) return
    setSending(true)
    setError(null)
    const failure = await session.send(id, body).catch(e => String(e))
    setSending(false)
    if (failure) {
      setError(failure)
      return
    }
    setDraft('')
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))
  }

  return (
    <Screen>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          paddingHorizontal: space.lg,
          paddingTop: space.lg,
          paddingBottom: space.md,
          borderBottomWidth: 1,
          borderBottomColor: p.border,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ fontSize: 24, color: p.textPrimary, lineHeight: 26 }}>‹</Text>
        </Pressable>
        <Avatar name={contact?.username ?? '?'} size={34} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: p.textPrimary }}>
            {contact?.username ?? 'Неизвестный'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 1 }}>
            <OnlineDot online={session.connection === 'connected'} />
            <Text style={{ fontSize: text.micro, color: p.textMuted }}>сквозное шифрование</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: space.lg, gap: space.sm, flexGrow: 1 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl }}>
              <Text style={{ fontSize: text.body, color: p.textMuted, textAlign: 'center' }}>
                Сообщений пока нет. Первое отправленное сообщение установит защищённую сессию.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View
              style={{
                alignSelf: item.outgoing ? 'flex-end' : 'flex-start',
                maxWidth: '82%',
                backgroundColor: item.outgoing ? p.bubbleOut : p.bubbleIn,
                borderColor: item.outgoing ? 'transparent' : p.border,
                borderWidth: item.outgoing ? 0 : 1,
                borderRadius: radius.md,
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
                gap: 2,
              }}
            >
              <Text
                style={{
                  color: item.outgoing ? p.bubbleOutText : p.bubbleInText,
                  fontSize: 15,
                  lineHeight: 20,
                }}
              >
                {item.text}
              </Text>
              <Text
                style={{
                  fontSize: text.micro,
                  color: item.outgoing ? p.bubbleOutText : p.textMuted,
                  opacity: item.outgoing ? 0.6 : 1,
                  alignSelf: 'flex-end',
                }}
              >
                {clock(item.timestamp)}
              </Text>
            </View>
          )}
        />

        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.sm }}>
          <ErrorText>{error}</ErrorText>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Сообщение"
              placeholderTextColor={p.textMuted}
              multiline
              style={{
                flex: 1,
                maxHeight: 120,
                borderWidth: 1,
                borderColor: p.border,
                borderRadius: radius.md,
                paddingHorizontal: space.md,
                paddingVertical: space.sm + 2,
                color: p.textPrimary,
                backgroundColor: p.surface,
                fontSize: 15,
              }}
            />
            <Pressable
              onPress={send}
              disabled={sending || !draft.trim()}
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: draft.trim() && !sending ? p.accent : p.accentDisabled,
              }}
            >
              <Text style={{ color: p.accentContrast, fontSize: 18, fontWeight: '700' }}>↑</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

function clock(ts: number) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
