// SPDX-License-Identifier: LicenseRef-LUME-Source-Available
// Copyright (C) 2026 LUME Inc

import '../src/polyfills'

import { useMemo, useState } from 'react'
import { FlatList, Modal, Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSession } from '../src/store/session'
import {
  Avatar,
  Body,
  Button,
  ErrorText,
  Field,
  OnlineDot,
  Screen,
  layout,
  usePalette,
} from '../src/ui/components'
import { radius, space, text } from '../src/ui/theme'

/** Conversation list, newest first, with a live connection indicator. */
export default function Chats() {
  const session = useSession()
  const p = usePalette()
  const [adding, setAdding] = useState(false)
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rows = useMemo(() => {
    return session.contacts
      .map(contact => {
        const thread = session.messages.filter(m => m.contactId === contact.id)
        const last = thread.length ? thread[thread.length - 1] : null
        return { contact, last }
      })
      .sort((a, b) => (b.last?.timestamp ?? 0) - (a.last?.timestamp ?? 0))
  }, [session.contacts, session.messages])

  async function add() {
    setBusy(true)
    setError(null)
    const failure = await session.addContact(username).catch(e => String(e))
    setBusy(false)
    if (failure) {
      setError(failure)
      return
    }
    setUsername('')
    setAdding(false)
  }

  return (
    <Screen>
      <View
        style={{
          paddingHorizontal: space.lg,
          paddingTop: space.lg,
          paddingBottom: space.md,
          borderBottomWidth: 1,
          borderBottomColor: p.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View>
          <Text style={{ fontSize: 22, fontWeight: '700', color: p.textPrimary, letterSpacing: 0.5 }}>
            LUME
          </Text>
          <View style={[layout.row, { gap: space.sm, marginTop: 2 }]}>
            <OnlineDot online={session.connection === 'connected'} />
            <Text style={{ fontSize: text.caption, color: p.textMuted }}>
              {session.profile ? `@${session.profile.username}` : ''}
              {session.connection === 'connected' ? '' : ' · нет связи'}
            </Text>
          </View>
        </View>
        <Pressable onPress={() => setAdding(true)} hitSlop={12}>
          <Text style={{ fontSize: 28, color: p.textPrimary, lineHeight: 30 }}>+</Text>
        </Pressable>
      </View>

      <FlatList
        data={rows}
        keyExtractor={r => r.contact.id}
        contentContainerStyle={rows.length ? undefined : { flexGrow: 1, justifyContent: 'center' }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl }}>
            <Body muted>Пока никого нет</Body>
            <Text style={{ fontSize: text.body, color: p.textMuted, textAlign: 'center' }}>
              Добавьте собеседника по имени пользователя, чтобы начать переписку.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/chat/${item.contact.id}`)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
              paddingHorizontal: space.lg,
              paddingVertical: space.md,
              backgroundColor: pressed ? p.surfaceAlt : 'transparent',
            })}
          >
            <Avatar name={item.contact.username} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: p.textPrimary }}>
                {item.contact.username}
              </Text>
              <Text numberOfLines={1} style={{ fontSize: text.body, color: p.textMuted }}>
                {item.last ? (item.last.outgoing ? `Вы: ${item.last.text}` : item.last.text) : 'Нет сообщений'}
              </Text>
            </View>
            {item.last ? (
              <Text style={{ fontSize: text.caption, color: p.textMuted }}>{time(item.last.timestamp)}</Text>
            ) : null}
          </Pressable>
        )}
      />

      <Modal visible={adding} transparent animationType="fade" onRequestClose={() => setAdding(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: p.background,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              padding: space.lg,
              gap: space.md,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: '600', color: p.textPrimary }}>Новый чат</Text>
            <Field
              label="ИМЯ ПОЛЬЗОВАТЕЛЯ"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="alice"
              autoFocus
            />
            <ErrorText>{error}</ErrorText>
            <Button title="Добавить" busy={busy} onPress={add} />
            <Button variant="ghost" title="Отмена" onPress={() => setAdding(false)} />
          </View>
        </View>
      </Modal>
    </Screen>
  )
}

function time(ts: number) {
  const d = new Date(ts)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay
    ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`
}
