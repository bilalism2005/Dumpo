import React from 'react';
import { MessageBubble } from './MessageBubble';
import { ChatMessage } from '../../store/chatStore';

interface AgentBubbleProps {
  message: ChatMessage;
  onTapTag?: (bucketKey: string, itemIdx: number) => void;
}

export function AgentBubble({ message, onTapTag }: AgentBubbleProps) {
  return <MessageBubble message={message} onTapTag={onTapTag} />;
}
