import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CallbackQuery } from './model/callback-queries.model';
import { CallbackQueriesService } from './callback-queries.service';
import { UpdatesModule } from '../updates/updates.module';

@Module({
  providers: [CallbackQueriesService],
  imports: [SequelizeModule.forFeature([CallbackQuery]), UpdatesModule],
  exports: [CallbackQueriesService]
})
export class CallbackQueriesModule {}
