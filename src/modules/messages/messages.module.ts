import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Message } from './model/messages.model';
import { MessagesService } from './messages.service';

@Module({
  providers: [MessagesService],
  imports: [SequelizeModule.forFeature([Message])],
  exports: [MessagesService]
})
export class MessagesModule {}
