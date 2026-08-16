import { useEffect, useState } from 'react';
import { useChatStore } from '../store/chatStore';

export function useChat() {
  const [chatHydrated, setChatHydrated] = useState(
    useChatStore.persist.hasHydrated()
  );

  const { messages, isLoading, hasMore, error, sendMessage, fetchMessages, clearChat, reclassifyMessageItem } = useChatStore();

  useEffect(() => {
    if (chatHydrated) return;
    const unsub = useChatStore.persist.onFinishHydration(() => {
      setChatHydrated(true);
    });
    return () => unsub();
  }, [chatHydrated]);

  useEffect(() => {
    if (!chatHydrated) return;
    const hasCachedMessages = useChatStore.getState().messages.length > 0;
    fetchMessages(hasCachedMessages);
  }, [chatHydrated]);

  return {
    messages,
    isLoading: !chatHydrated || isLoading,
    hasMore,
    error,
    sendMessage,
    fetchMessages,
    clearChat,
    reclassifyMessageItem
  };
}
