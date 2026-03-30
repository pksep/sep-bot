import { User } from 'src/modules/users/model/users.model';
import { Chat } from 'src/modules/chats/model/chats.model';
import { ChatMember } from 'src/modules/chat-members/model/chat-members.model';
import { Message } from 'src/modules/messages/model/messages.model';
import { Bot } from 'src/modules/bots/model/bots.model';
import { Update } from 'src/modules/updates/model/updates.model';
import { CallbackQuery } from 'src/modules/callback-queries/model/callback-queries.model';
import { FileRecord } from 'src/modules/files/model/files.model';

const models = [
  User,
  Chat,
  ChatMember,
  Message,
  Bot,
  Update,
  CallbackQuery,
  FileRecord
];

export default models;
