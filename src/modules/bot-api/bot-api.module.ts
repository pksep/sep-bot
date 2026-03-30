import { Module } from '@nestjs/common';
import { BotApiController } from './bot-api.controller';
import { BotApiService } from './bot-api.service';
import { BotsModule } from '../bots/bots.module';
import { MessagesModule } from '../messages/messages.module';
import { ChatsModule } from '../chats/chats.module';
import { ChatMembersModule } from '../chat-members/chat-members.module';
import { UpdatesModule } from '../updates/updates.module';
import { CallbackQueriesModule } from '../callback-queries/callback-queries.module';
import { FilesModule } from '../files/files.module';

@Module({
  controllers: [BotApiController],
  providers: [BotApiService],
  imports: [
    BotsModule,
    MessagesModule,
    ChatsModule,
    ChatMembersModule,
    UpdatesModule,
    CallbackQueriesModule,
    FilesModule
  ]
})
export class BotApiModule {}
