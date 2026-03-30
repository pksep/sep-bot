import { DynamicModule, Type } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DevtoolsModule } from '@nestjs/devtools-integration';
import configFactory, { ConfigConstains } from './env.config';
import { S3Module } from 'src/modules/s3/s3.module';
import { redisStore } from 'cache-manager-redis-yet';
import { AuthModule } from 'src/modules/auth/auth.module';
import { UsersModule } from 'src/modules/users/users.module';
import { ChatsModule } from 'src/modules/chats/chats.module';
import { ChatMembersModule } from 'src/modules/chat-members/chat-members.module';
import { MessagesModule } from 'src/modules/messages/messages.module';
import { FilesModule } from 'src/modules/files/files.module';
import { BotsModule } from 'src/modules/bots/bots.module';
import { UpdatesModule } from 'src/modules/updates/updates.module';
import { CallbackQueriesModule } from 'src/modules/callback-queries/callback-queries.module';
import { BotApiModule } from 'src/modules/bot-api/bot-api.module';
import { WebhooksModule } from 'src/modules/webhooks/webhooks.module';
import { GatewayModule } from 'src/modules/gateway/gateway.module';

export const getCoreModules = (): (
  | DynamicModule
  | Promise<DynamicModule>
)[] => [
  DevtoolsModule.register({
    http: process.env.NODE_ENV !== 'production'
  }),

  ConfigModule.forRoot({
    envFilePath: `env/.${process.env.NODE_ENV}.env`,
    isGlobal: true,
    cache: true,
    load: [configFactory]
  }),

  ServeStaticModule.forRoot({
    rootPath: join(__dirname, '..', '..', 'static')
  }),

  CacheModule.registerAsync({
    isGlobal: true,
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: async (configService: ConfigService) => {
      const url = configService.get<string>(ConfigConstains.redisUrl);

      const store = await redisStore({
        url,
        ttl: 70 * 1000
      });

      const client = store.client;

      client.on('error', err => {
        console.error('Redis Client Error', err);
      });
      client.on('connect', () => console.log('Redis client is connect'));
      client.on('reconnecting', () =>
        console.log('Redis client is reconnecting')
      );
      client.on('ready', () => console.log('Redis client is ready'));

      return {
        store
      };
    }
  }),

  BullModule.forRootAsync({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (configService: ConfigService) => {
      const url = configService.get<string>(ConfigConstains.redisUrl);

      return {
        connection: {
          url
        }
      };
    }
  }),

  BullBoardModule.forRoot({
    route: '/queues',
    adapter: ExpressAdapter
  }),

  EventEmitterModule.forRoot(),
  S3Module.forRootAsync()
];

export const getAppModule = (): Type<any>[] => [
  AuthModule,
  UsersModule,
  ChatsModule,
  ChatMembersModule,
  MessagesModule,
  FilesModule,
  BotsModule,
  UpdatesModule,
  CallbackQueriesModule,
  BotApiModule,
  WebhooksModule,
  GatewayModule
];
