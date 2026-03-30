import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AppInitService } from 'src/scripts/app-init.service';
import { getSequelizeConfig } from 'src/configs/postgres.config';
import { getAppModule, getCoreModules } from './configs/modules';
import { OriginMiddleware } from 'src/middleware/origin.middleware';
import { LoggerModule } from './modules/logger/logger.module';

@Module({
  controllers: [],
  providers: [AppInitService],
  imports: [
    LoggerModule,
    SequelizeModule.forRootAsync(getSequelizeConfig({})),
    ...getCoreModules(),
    ...getAppModule()
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(OriginMiddleware).forRoutes('*');
  }
}
