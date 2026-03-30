import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { FileRecord } from './model/files.model';
import { FilesService } from './files.service';

@Module({
  providers: [FilesService],
  imports: [SequelizeModule.forFeature([FileRecord])],
  exports: [FilesService]
})
export class FilesModule {}
