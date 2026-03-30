import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Update } from './model/updates.model';
import { OnEvent } from '@nestjs/event-emitter';
import { Op, WhereOptions } from 'sequelize';
import { WebhooksService } from '../webhooks/webhooks.service';

interface BotUpdateEvent {
  botId: number;
  type: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class UpdatesService {
  constructor(
    @InjectModel(Update) private readonly updateRepository: typeof Update,
    private readonly webhooksService: WebhooksService
  ) {}

  /**
   * Слушает события от ChatBridgeService.
   * Создаёт Update в БД + ставит в очередь webhook если настроен.
   */
  @OnEvent('bot.update')
  async handleBotUpdate(data: BotUpdateEvent): Promise<void> {
    const update = await this.createUpdate(
      data.botId,
      data.type,
      data.payload
    );

    await this.webhooksService.enqueueDelivery(data.botId, update.id, {
      update_id: update.id,
      ...data.payload
    });
  }

  async createUpdate(
    botId: number,
    type: string,
    payload: Record<string, unknown>
  ): Promise<Update> {
    return this.updateRepository.create({ botId, type, payload });
  }

  /**
   * Long polling — получить обновления для бота.
   * @param botId — ID бота
   * @param offset — вернуть обновления с id > offset
   * @param limit — максимальное количество (макс. 100)
   * @param timeout — секунды ожидания (макс. 60)
   */
  async getUpdates(
    botId: number,
    offset?: number,
    limit = 100,
    timeout = 30
  ): Promise<Update[]> {
    const where: WhereOptions<Update> = { botId };
    if (offset) {
      (where as Record<string, unknown>).id = { [Op.gt]: offset };
    }

    const queryOptions = {
      where,
      order: [['id', 'ASC']] as [string, string][],
      limit: Math.min(limit, 100)
    };

    // Первая попытка
    let updates = await this.updateRepository.findAll(queryOptions);
    if (updates.length > 0) return updates;

    // Long polling — переспрашиваем каждую секунду
    const startTime = Date.now();
    const timeoutMs = Math.min(timeout, 60) * 1000;

    while (Date.now() - startTime < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      updates = await this.updateRepository.findAll(queryOptions);
      if (updates.length > 0) return updates;
    }

    return [];
  }
}
