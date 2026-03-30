import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Update } from './model/updates.model';
import { UpdatesService } from './updates.service';

@Module({
  providers: [UpdatesService],
  imports: [SequelizeModule.forFeature([Update])],
  exports: [UpdatesService]
})
export class UpdatesModule {}
