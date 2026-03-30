import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { BotsService } from '../../bots/bots.service';

@Injectable()
export class BotApiAuthGuard implements CanActivate {
  constructor(private botsService: BotsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    // Извлекаем токен из URL: /bot{token}/method
    const url = req.originalUrl;
    const botMatch = url.match(/\/bot([^/]+)\//);

    if (!botMatch) {
      throw new UnauthorizedException({
        ok: false,
        error_code: 401,
        description: 'Unauthorized: bot token required'
      });
    }

    const token = botMatch[1];
    const bot = await this.botsService.verifyToken(token);

    if (!bot) {
      throw new UnauthorizedException({
        ok: false,
        error_code: 401,
        description: 'Unauthorized: invalid bot token'
      });
    }

    req.bot = bot;
    return true;
  }
}
