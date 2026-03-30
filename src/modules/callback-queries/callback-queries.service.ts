import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CallbackQuery } from './model/callback-queries.model';
import { UpdatesService } from '../updates/updates.service';
import { UpdateType } from 'src/core/enums/entity.enum';

@Injectable()
export class CallbackQueriesService {
  constructor(
    @InjectModel(CallbackQuery) private callbackQueryRepository: typeof CallbackQuery,
    private updatesService: UpdatesService
  ) {}

  async create(params: {
    fromUserId: number;
    messageId: number;
    botId: number;
    data: string;
  }): Promise<CallbackQuery> {
    const cbQuery = await this.callbackQueryRepository.create(params as any);

    // Создаём Update для бота
    await this.updatesService.createUpdate(params.botId, UpdateType.CALLBACK_QUERY, {
      callback_query: {
        id: cbQuery.callbackId,
        from: { id: params.fromUserId },
        message: { message_id: params.messageId },
        data: params.data
      }
    });

    return cbQuery;
  }

  async answerCallbackQuery(callbackQueryId: string, params?: {
    text?: string;
    showAlert?: boolean;
  }): Promise<boolean> {
    const cbQuery = await this.callbackQueryRepository.findOne({
      where: { callbackId: callbackQueryId }
    });
    if (!cbQuery) throw new HttpException('Callback query не найден', HttpStatus.NOT_FOUND);

    await cbQuery.update({ isAnswered: true });
    return true;
  }
}
