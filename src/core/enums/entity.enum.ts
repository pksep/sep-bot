export enum ChatType {
  PRIVATE = 'private',
  GROUP = 'group',
  SUPERGROUP = 'supergroup',
  CHANNEL = 'channel'
}

export enum MessageType {
  TEXT = 'text',
  PHOTO = 'photo',
  VIDEO = 'video',
  DOCUMENT = 'document',
  STICKER = 'sticker',
  AUDIO = 'audio',
  VOICE = 'voice',
  LOCATION = 'location',
  CONTACT = 'contact'
}

export enum ChatMemberRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member'
}

export enum UpdateType {
  MESSAGE = 'message',
  EDITED_MESSAGE = 'edited_message',
  CALLBACK_QUERY = 'callback_query',
  CHAT_MEMBER = 'chat_member'
}

export enum SenderType {
  USER = 'user',
  BOT = 'bot'
}
