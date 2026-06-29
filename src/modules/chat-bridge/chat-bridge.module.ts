import { Module, Global } from '@nestjs/common';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatBridgeService } from './chat-bridge.service';
import {
  CHAT_EVENTS_EXCHANGE,
  BOT_COMMANDS_EXCHANGE
} from './rabbitmq.constants';

@Global()
@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri:
          configService.get<string>('rabbitmqUrl') || 'amqp://localhost:5672',
        exchanges: [
          {
            name: CHAT_EVENTS_EXCHANGE,
            type: 'topic',
            options: { durable: true }
          },
          {
            name: BOT_COMMANDS_EXCHANGE,
            type: 'topic',
            options: { durable: true }
          }
        ],
        connectionInitOptions: { wait: false },
        enableControllerDiscovery: true
      })
    })
  ],
  providers: [ChatBridgeService],
  exports: [ChatBridgeService, RabbitMQModule]
})
export class ChatBridgeModule {}
