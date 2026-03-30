import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ChatMember } from './model/chat-members.model';
import { ChatMembersService } from './chat-members.service';

@Module({
  providers: [ChatMembersService],
  imports: [SequelizeModule.forFeature([ChatMember])],
  exports: [ChatMembersService]
})
export class ChatMembersModule {}
