import { Module } from '@nestjs/common';
import { BotApiController } from './bot-api.controller';
import { BotApiService } from './bot-api.service';
import { BotsModule } from '../bots/bots.module';
import { UpdatesModule } from '../updates/updates.module';

@Module({
  controllers: [BotApiController],
  providers: [BotApiService],
  imports: [BotsModule, UpdatesModule]
})
export class BotApiModule {}
