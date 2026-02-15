import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { palette, radius } from "@/constants/palette";
import { spacing } from "@/constants/spacing";
import { typography } from "@/constants/typography";
import { useChat } from "@/hooks/useChat";
import { hasLatex, InlineLatex } from "@/components/InlineLatex";
import type { ChatMessage } from '@/lib/api';

type ChatPanelProps = {
  visible: boolean;
  onClose: () => void;
  assignmentId: string | null;
  problemNum: number | null;
  token?: string | null;
};

const QUICK_ACTIONS = [
  'Explain this mistake',
  'Give me a hint',
  'What should I try next?',
];

const OPENER_MESSAGE = (num: number) =>
  `I see you're working on problem ${num}. What's giving you trouble?`;

function ChatHeader({ problemNum, onClose }: { problemNum: number | null; onClose: () => void }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>
        {problemNum != null ? `Ask about Problem ${problemNum}` : 'Chat'}
      </Text>
      <Pressable
        onPress={onClose}
        hitSlop={12}
        style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel="Close chat"
      >
        <Text style={styles.closeBtnText}>X</Text>
      </Pressable>
    </View>
  );
}

function QuickActions({ onAction, disabled }: { onAction: (a: string) => void; disabled: boolean }) {
  return (
    <View style={styles.quickActions}>
      {QUICK_ACTIONS.map((action) => (
        <Pressable
          key={action}
          style={({ pressed }) => [styles.quickActionBtn, pressed && { opacity: 0.7 }]}
          onPress={() => onAction(action)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={action}
        >
          <Text style={styles.quickActionText}>{action}</Text>
        </Pressable>
      ))}
    </View>
  );
}

type MessageListProps = {
  messages: ChatMessage[];
  loading: boolean;
  problemNum: number | null;
};

function MessageList({ messages, loading, problemNum }: MessageListProps) {
  const scrollRef = useRef<ScrollView>(null);
  const showOpener = messages.length === 0 && problemNum != null;

  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages.length]);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.messageList}
      contentContainerStyle={styles.messageListContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {showOpener && (
        <View style={[styles.messageBubble, styles.assistantBubble]}>
          <Text style={styles.assistantText}>{OPENER_MESSAGE(problemNum)}</Text>
        </View>
      )}
      {messages.map((msg) => {
        const isStudent = msg.role === 'student';
        const showLatex = !isStudent && hasLatex(msg.content);
        return (
          <View
            key={msg.id}
            style={[
              styles.messageBubble,
              isStudent ? styles.studentBubble : styles.assistantBubble,
            ]}
          >
            {showLatex ? (
              <InlineLatex content={msg.content} color={palette.textPrimary} />
            ) : (
              <Text style={isStudent ? styles.studentText : styles.assistantText}>
                {msg.content}
              </Text>
            )}
          </View>
        );
      })}
      {loading && (
        <View style={[styles.messageBubble, styles.assistantBubble]}>
          <ActivityIndicator size="small" color={palette.textMuted} />
        </View>
      )}
    </ScrollView>
  );
}

type ChatInputBarProps = {
  inputText: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  loading: boolean;
};

function ChatInputBar({ inputText, onChangeText, onSend, loading }: ChatInputBarProps) {
  const canSend = !!inputText.trim() && !loading;
  const inputRef = useRef<TextInput>(null);
  const onSendRef = useRef(onSend);
  onSendRef.current = onSend;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = inputRef.current as any;
    const el = node && (node as HTMLElement);
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        onSendRef.current();
      }
    };
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, []);

  return (
    <View style={styles.inputBar}>
      <View style={{ flex: 1 }}>
        <TextInput
          ref={inputRef}
          style={styles.textInput}
          value={inputText}
          onChangeText={onChangeText}
          placeholder="Type a message..."
          placeholderTextColor={palette.textDisabled}
          multiline
          maxLength={2000}
          editable={!loading}
          blurOnSubmit={false}
          accessibilityLabel="Message"
        />
        {Platform.OS === 'web' && (
          <Text style={styles.sendHint}>Cmd+Enter to send</Text>
        )}
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.sendBtn,
          !canSend && styles.sendBtnDisabled,
          pressed && { opacity: 0.7 },
        ]}
        onPress={onSend}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Send message"
      >
        <Text style={styles.sendBtnText}>Send</Text>
      </Pressable>
    </View>
  );
}

export function ChatPanel({ visible, onClose, assignmentId, problemNum, token }: ChatPanelProps) {
  const { messages, sendMessage, loading, error } = useChat(
    visible ? assignmentId : null,
    visible ? problemNum : null,
    token,
  );
  const [inputText, setInputText] = useState('');

  const handleSend = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed || loading) return;
    setInputText('');
    sendMessage(trimmed);
  }, [inputText, loading, sendMessage]);

  const handleQuickAction = useCallback(
    (action: string) => {
      if (loading) return;
      sendMessage(action);
    },
    [loading, sendMessage],
  );

  if (!visible) return null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ChatHeader problemNum={problemNum} onClose={onClose} />
      <QuickActions onAction={handleQuickAction} disabled={loading} />
      <MessageList messages={messages} loading={loading} problemNum={problemNum} />
      {error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <ChatInputBar
        inputText={inputText}
        onChangeText={setInputText}
        onSend={handleSend}
        loading={loading}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "60%",
    backgroundColor: palette.card,
    borderTopLeftRadius: radius.modal,
    borderTopRightRadius: radius.modal,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  headerTitle: {
    ...typography.button,
    color: palette.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    ...typography.bodySmall,
    fontWeight: "700",
    color: palette.textSecondary,
  },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  quickActionBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: palette.surface,
  },
  quickActionText: {
    ...typography.caption,
    color: palette.textSecondary,
    fontWeight: "500",
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: spacing.md,
    gap: 10,
  },
  messageBubble: {
    maxWidth: "80%",
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    borderRadius: radius.card,
  },
  studentBubble: {
    alignSelf: "flex-end",
    backgroundColor: palette.primary,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: palette.surface,
  },
  studentText: {
    color: palette.white,
    fontSize: 14,
    lineHeight: 20,
  },
  assistantText: {
    color: palette.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  errorBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: palette.errorBg,
  },
  errorText: {
    ...typography.caption,
    color: palette.error,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    gap: 8,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: palette.surface,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    ...typography.bodySmall,
    color: palette.textPrimary,
  },
  sendBtn: {
    backgroundColor: palette.primary,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 40,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnText: {
    ...typography.bodySmall,
    color: palette.textOnPrimary,
    fontWeight: "700",
  },
  sendHint: {
    ...typography.caption,
    color: palette.textDisabled,
    marginTop: spacing.xxs,
    marginLeft: spacing.xs,
  },
});
