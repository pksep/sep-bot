import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Chat } from './model/chats.model';
import { ChatsService } from './chats.service';
import { ChatsController } from './chats.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  controllers: [ChatsController],
  providers: [ChatsService],
  imports: [SequelizeModule.forFeature([Chat]), AuthModule],
  exports: [ChatsService]
})
export class ChatsModule {}
