import { ChatBridgeService } from '../chat-bridge.service';
import {
  BOT_COMMANDS_EXCHANGE,
  RK_BOT_GET_TOPIC_INFO,
  RK_BOT_GET_TOPIC_MEMBERS
} from '../rabbitmq.constants';

describe('ChatBridgeService topic authorization', () => {
  const amqp = { request: jest.fn() };
  let service: ChatBridgeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ChatBridgeService(
      {} as any,
      {} as any,
      amqp as any,
      {} as any
    );
  });

  it('передаёт chat user бота при запросе данных топика', async () => {
    amqp.request.mockResolvedValue({
      ok: true,
      result: { id: 'topic-1', type: 'GROUP' }
    });

    await service.getTopicInfo('topic-1', 'bot-user-1');

    expect(amqp.request).toHaveBeenCalledWith({
      exchange: BOT_COMMANDS_EXCHANGE,
      routingKey: RK_BOT_GET_TOPIC_INFO,
      payload: {
        topicId: 'topic-1',
        requesterUserId: 'bot-user-1'
      },
      timeout: 10000
    });
  });

  it('передаёт chat user бота при запросе участников топика', async () => {
    amqp.request.mockResolvedValue({ ok: true, result: ['bot-user-1'] });

    await service.getTopicMembers('topic-1', 'bot-user-1');

    expect(amqp.request).toHaveBeenCalledWith({
      exchange: BOT_COMMANDS_EXCHANGE,
      routingKey: RK_BOT_GET_TOPIC_MEMBERS,
      payload: {
        topicId: 'topic-1',
        requesterUserId: 'bot-user-1'
      },
      timeout: 10000
    });
  });

  it('не скрывает отказ chat_server в доступе к топику', async () => {
    amqp.request.mockResolvedValue({
      ok: false,
      error: 'Нет доступа к топику'
    });

    await expect(
      service.getTopicInfo('topic-1', 'outsider-bot')
    ).rejects.toThrow('Нет доступа к топику');
  });
});
