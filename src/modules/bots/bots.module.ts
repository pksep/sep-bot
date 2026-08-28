import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Bot } from './model/bots.model';
import { BotsService } from './bots.service';
import { BotsController } from './bots.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  controllers: [BotsController],
  providers: [BotsService],
  imports: [SequelizeModule.forFeature([Bot]), AuthModule],
  exports: [BotsService]
})
export class BotsModule {}
