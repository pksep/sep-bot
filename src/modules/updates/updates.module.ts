import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Update } from './model/updates.model';
import { UpdatesService } from './updates.service';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  providers: [UpdatesService],
  imports: [SequelizeModule.forFeature([Update]), WebhooksModule],
  exports: [UpdatesService]
})
export class UpdatesModule {}
