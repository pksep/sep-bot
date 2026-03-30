import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { getSequelizeConfig } from 'src/configs/postgres.config';
import { getAppModule, getCoreModules } from 'src/configs/modules';
import { Bot } from 'src/modules/bots/model/bots.model';

@Module({
  providers: [],
  imports: [
    SequelizeModule.forRootAsync(
      getSequelizeConfig({
        logging: false
      })
    ),
    SequelizeModule.forFeature([Bot]),
    ...getCoreModules(),
    ...getAppModule()
  ]
})
export class CliModule {}
