import { useEffect } from 'react';
import { useChatStore } from '../store/chatStore';

export function useChat() {
  const { messages, isLoading, error, sendMessage, fetchMessages, clearChat, reclassifyMessageItem } = useChatStore();

  useEffect(() => {
    fetchMessages();
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,
    reclassifyMessageItem
  };
}
