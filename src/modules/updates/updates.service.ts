import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Update } from './model/updates.model';
import { UpdateType } from 'src/core/enums/entity.enum';
import { Op } from 'sequelize';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class UpdatesService {
  constructor(
    @InjectModel(Update) private updateRepository: typeof Update,
    private logger: LoggerService
  ) {}

  async createUpdate(botId: number, type: UpdateType, payload: object): Promise<Update> {
    return this.updateRepository.create({ botId, type, payload } as any);
  }

  /**
   * Long polling — получить обновления для бота.
   * offset — вернуть обновления с id > offset
   * limit — максимальное количество обновлений
   * timeout — секунды ожидания (long polling)
   */
  async getUpdates(botId: number, offset?: number, limit = 100, timeout = 30): Promise<Update[]> {
    const where: any = { botId };
    if (offset) {
      where.id = { [Op.gt]: offset };
    }

    // Первая попытка — сразу вернуть если есть
    let updates = await this.updateRepository.findAll({
      where,
      order: [['id', 'ASC']],
      limit: Math.min(limit, 100)
    });

    if (updates.length > 0) {
      return updates;
    }

    // Long polling: ждём timeout секунд с интервалом проверки 1с
    const startTime = Date.now();
    const timeoutMs = timeout * 1000;

    while (Date.now() - startTime < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      updates = await this.updateRepository.findAll({
        where,
        order: [['id', 'ASC']],
        limit: Math.min(limit, 100)
      });

      if (updates.length > 0) {
        return updates;
      }
    }

    return [];
  }

  async markAsDelivered(updateIds: number[]): Promise<void> {
    await this.updateRepository.update(
      { isDelivered: true },
      { where: { id: { [Op.in]: updateIds } } }
    );
  }

  async getPendingCount(botId: number): Promise<number> {
    return this.updateRepository.count({
      where: { botId, isDelivered: false }
    });
  }
}
