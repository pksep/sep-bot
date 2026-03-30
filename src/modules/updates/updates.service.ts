import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Update } from './model/updates.model';
import { OnEvent } from '@nestjs/event-emitter';
import { Op } from 'sequelize';
import { LoggerService } from '../logger/logger.service';
import { WebhooksService } from '../webhooks/webhooks.service';

@Injectable()
export class UpdatesService {
  constructor(
    @InjectModel(Update) private updateRepository: typeof Update,
    private logger: LoggerService,
    private webhooksService: WebhooksService
  ) {}

  /**
   * Слушает события от ChatBridgeService
   * Создаёт Update в БД + ставит в очередь webhook если настроен
   */
  @OnEvent('bot.update')
  async handleBotUpdate(data: { botId: number; type: string; payload: object }) {
    const update = await this.createUpdate(data.botId, data.type, data.payload);

    // Если у бота есть webhook — ставим в очередь доставку
    await this.webhooksService.enqueueDelivery(data.botId, update.id, {
      update_id: update.id,
      ...data.payload
    });
  }

  async createUpdate(botId: number, type: string, payload: object): Promise<Update> {
    return this.updateRepository.create({ botId, type, payload } as any);
  }

  /**
   * Long polling — получить обновления для бота.
   * offset — вернуть обновления с id > offset
   * limit — максимальное количество
   * timeout — секунды ожидания
   */
  async getUpdates(botId: number, offset?: number, limit = 100, timeout = 30): Promise<Update[]> {
    const where: any = { botId };
    if (offset) {
      where.id = { [Op.gt]: offset };
    }

    // Первая попытка
    let updates = await this.updateRepository.findAll({
      where,
      order: [['id', 'ASC']],
      limit: Math.min(limit, 100)
    });

    if (updates.length > 0) return updates;

    // Long polling
    const startTime = Date.now();
    const timeoutMs = Math.min(timeout, 60) * 1000;

    while (Date.now() - startTime < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      updates = await this.updateRepository.findAll({
        where,
        order: [['id', 'ASC']],
        limit: Math.min(limit, 100)
      });

      if (updates.length > 0) return updates;
    }

    return [];
  }
}
