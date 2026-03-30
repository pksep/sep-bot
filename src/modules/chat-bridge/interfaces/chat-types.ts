/**
 * Типы данных chat_server
 */

export interface ChatUser {
  id: string;       // UUID
  initials: string;
  nickname: string;
  avatarUrl?: string;
  lastOnline?: Date;
  isBot: boolean;
  ex?: any;
}

export interface ChatTopic {
  id: string;       // UUID
  type: 'GROUP' | 'DM';
  createdAt: Date;
}

export interface ChatMessage {
  id: string;       // UUID
  senderUserId: string;
  topicId: string;
  text?: string;
  ex?: any;
  isSystem: boolean;
  isEdit: boolean;
  isPin: boolean;
  status: string;
  replyMessageId?: string;
  forwardUserId?: string;
  taggedUserIds?: string[];
  createdAt: Date;
  updatedAt: Date;
  senderUser?: ChatUser;
  media?: any[];
}

export interface WsChangePayload<T = any> {
  type: 'NEW' | 'CHANGE' | 'DELETE' | 'PIN' | 'REACTION';
  topicId: string;
  data: T;
}

export interface ChatApiResponse<T = any> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
}
