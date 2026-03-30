import { Module, Global } from '@nestjs/common';
import { ChatBridgeService } from './chat-bridge.service';

@Global()
@Module({
  providers: [ChatBridgeService],
  exports: [ChatBridgeService]
})
export class ChatBridgeModule {}
