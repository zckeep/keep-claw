// src/pages/chatbot/data.d.ts
export interface ConversationItem {
  key: string;
  label: string;
  group?: string;
  isDraft?: boolean;
}

export type ChatMessageStatus = 'updating' | 'done' | 'error';

export interface ChatMessage {
  id: string;
  requestId?: string;
  role: 'user' | 'assistant';
  content: string;
  thinkContent?: string;
  rawThinkContent?: string;
  isThinking?: boolean;
  status: ChatMessageStatus;
}
