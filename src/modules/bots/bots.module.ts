import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Bot } from './model/bots.model';
import { BotsService } from './bots.service';
import { BotsController } from './bots.controller';

@Module({
  controllers: [BotsController],
  providers: [BotsService],
  imports: [SequelizeModule.forFeature([Bot])],
  exports: [BotsService]
})
export class BotsModule {}
