# Bot API Gateway — Архитектура

## 1. Что это

**Bot API Gateway** (`chat-bot`) — микросервис-посредник между разработчиками ботов и существующим чат-сервером (`chat_server`).

Он предоставляет Telegram-совместимый HTTP API, через который бот может:
- отправлять / редактировать / удалять сообщения
- получать обновления (long polling или webhook)
- управлять участием в чатах

При этом сам чат-сервер **не знает** о существовании ботов как концепции — для него бот = обычный системный пользователь с флагом `isBot: true`.

---

## 2. Принципы

| Принцип | Реализация |
|---------|------------|
| **Слабая связанность** | Сервисы общаются только через RabbitMQ. Нет HTTP-вызовов между ними. |
| **Единственная ответственность** | `chat_server` = чат + WS + хранение. `chat-bot` = бот-API + токены + обновления. |
| **Идемпотентность команд** | Каждая RPC-команда — атомарная операция с однозначным результатом. |
| **Отказоустойчивость** | Если один сервис лежит, сообщения копятся в RabbitMQ и обработаются при восстановлении. |
| **Совместимость с Telegram** | API-контракт повторяет Telegram Bot API (getUpdates, sendMessage, setWebhook и т.д.). |

---

## 3. Обзор архитектуры

```
┌─────────────────────┐         ┌──────────────┐         ┌──────────────────────┐
│   Bot Developer     │  HTTP   │   chat-bot   │  AMQP   │    chat_server       │
│   (SDK / curl)      │────────▶│  (Gateway)   │◀───────▶│    (Core Chat)       │
│                     │         │              │         │                      │
│  POST /bot{token}/  │         │  • BotApi    │  RPC →  │  • BotCommandsHandler│
│    sendMessage      │         │  • Bots      │         │    (обрабатывает     │
│    getUpdates       │         │  • Bridge    │  ← Sub  │     команды бота)    │
│    setWebhook       │         │  • Updates   │         │                      │
│                     │         │  • Webhooks  │         │  • ChatEventsPublish │
└─────────────────────┘         └──────┬───────┘         │    (публикует        │
                                       │                 │     события чата)    │
                                       │                 └──────────────────────┘
                                       │
                                ┌──────┴───────┐
                                │  RabbitMQ    │
                                │              │
                                │ chat.events  │  (topic exchange)
                                │ bot.commands │  (topic exchange)
                                └──────────────┘
```

---

## 4. Модель данных

### chat_server (существующая БД + расширение)

| Сущность | Изменение |
|----------|-----------|
| `User` | + `is_bot: boolean` — отличает ботов от людей |
| `Topic` | Без изменений — бот участвует как обычный пользователь |
| `TopicSetting` | Без изменений — бот "состоит" в чате через эту таблицу |
| `Message` | Без изменений — сообщения бота = обычные сообщения |

### chat-bot (собственная БД)

| Таблица | Назначение | Ключевые поля |
|---------|------------|---------------|
| `bots` | Реестр ботов | `id` (int PK), `chat_user_id` (UUID → User в chat_server), `owner_user_id`, `username`, `api_token` (AES-256-GCM), `api_token_hash` (SHA-256), `webhook_config` (JSONB) |
| `updates` | Очередь обновлений для long polling | `id` (bigint PK), `bot_id` → bots, `type`, `payload` (JSONB) |

> **Важно:** `chat-bot` **не хранит** сообщения, пользователей или топики. Все данные чата живут в `chat_server`. Gateway хранит только свои сущности: ботов и обновления.

---

## 5. Коммуникация через RabbitMQ

Два сервиса общаются через **два exchange** в RabbitMQ:

### 5.1. `chat.events` — события чата (Pub/Sub)

**Направление:** `chat_server` → `chat-bot`

```
chat_server публикует событие при каждом создании/редактировании/удалении сообщения.
chat-bot подписан на эти события и создаёт Update для каждого бота, который состоит в затронутом топике.
```

| Routing Key | Когда публикуется | Payload |
|-------------|-------------------|---------|
| `message.new` | Новое сообщение | `{ type, topicId, message, senderUserId }` |
| `message.edit` | Редактирование | `{ type, topicId, message, senderUserId }` |
| `message.delete` | Удаление | `{ type, topicId, message: { id, topicId } }` |

### 5.2. `bot.commands` — команды бота (RPC)

**Направление:** `chat-bot` → `chat_server` (запрос-ответ)

```
chat-bot отправляет RPC-запрос через RabbitMQ.
chat_server обрабатывает команду и возвращает результат (через reply queue).
```

| Routing Key | Действие | Payload → | ← Response |
|-------------|----------|-----------|------------|
| `bot.send_message` | Отправить сообщение | `{ senderUserId, topicId, text, ... }` | `{ ok, result: Message }` |
| `bot.edit_message` | Редактировать | `{ senderUserId, messageId, text }` | `{ ok, result: Message }` |
| `bot.delete_message` | Удалить | `{ senderUserId, messageId, topicId }` | `{ ok, result: true }` |
| `bot.create_user` | Создать пользователя-бота | `{ nickname, displayName }` | `{ ok, result: User }` |
| `bot.get_topic_info` | Информация о топике | `{ topicId }` | `{ ok, result: Topic }` |
| `bot.get_topic_members` | Участники топика | `{ topicId }` | `{ ok, result: string[] }` |
| `bot.get_user_topics` | Топики пользователя | `{ userId }` | `{ ok, result: string[] }` |
| `bot.add_to_topic` | Добавить бота в чат | `{ topicId, botUserId, actorId }` | `{ ok, result: true }` |
| `bot.remove_from_topic` | Удалить бота из чата | `{ topicId, botUserId, actorId }` | `{ ok, result: true }` |

### Почему RPC, а не fire-and-forget?

Для команд типа `sendMessage` бот ожидает синхронный ответ (message_id, дата, и т.д.) — поэтому используется RPC-паттерн (request → reply queue). Для событий (`message.new`) — обычный Pub/Sub, ответ не нужен.

---

## 6. Потоки данных

### 6.1. Бот отправляет сообщение

```
1. Developer → POST /api/bot{token}/sendMessage { chat_id, text }
2. BotApiAuthGuard: SHA-256(token) → находит бота в таблице bots
3. BotApiService.sendMessage(bot, params)
4. ChatBridgeService.sendMessage(botId, topicId, text)
5. amqp.request('bot.commands', 'bot.send_message', payload)
         │
         ▼  RabbitMQ
6. chat_server: BotCommandsHandler.handleSendMessage()
7. MessagesService.create(senderUserId, dto)
8. MessagesGateway.broadcastMessageChange(NEW, topicId, message)
   ├── WS → все клиенты в комнате видят сообщение
   └── ChatEventsPublisher.publishMessageNew() → RabbitMQ
         │
         ▼  RPC response
9. ← ChatBridgeService получает { ok: true, result: message }
10. ← 200 OK: { message_id, chat, date, text }
```

### 6.2. Пользователь пишет сообщение → бот получает update

```
1. User отправляет сообщение через WS → MessagesGateway.handleSendMessage
2. MessagesService.create() → broadcastMessageChange(NEW)
3. ChatEventsPublisher.publishMessageNew(topicId, message)
         │
         ▼  RabbitMQ (chat.events / message.new)
4. chat-bot: ChatBridgeService.handleMessageNew()
5. Проверки:
   - Системное сообщение? → пропустить
   - Отправитель = бот? → пропустить (анти-петля)
   - Есть ли боты в этом topicId? → если нет, пропустить
6. Для каждого botId в topicBotRegistry[topicId]:
   EventEmitter.emit('bot.update', { botId, type: 'message', payload })
         │
         ▼
7. UpdatesService.handleBotUpdate() → создаёт Update в БД
8. WebhooksService.enqueueDelivery() → BullMQ (если есть webhook)
         │
         ├──→ Если webhook: WebhookProcessor → HTTP POST → Developer
         └──→ Если polling: Developer → POST /getUpdates → long polling → ← updates
```

---

## 7. Безопасность

### API-токены ботов

```
Формат:    {botId}:{64 hex chars}
Хранение:  AES-256-GCM (зашифрованный токен в поле api_token)
Поиск:     SHA-256 hash (индексируемое поле api_token_hash)
Показ:     Токен показывается ОДИН РАЗ при создании бота
```

**Почему не хранить открытый токен?** — если база утечёт, злоумышленник не сможет использовать токены. SHA-256 hash необратим, AES-256-GCM расшифровывается только с ключом сервера.

### Аутентификация

| Кто | Механизм | Где проверяется |
|-----|----------|-----------------|
| Владелец бота | JWT (cookie / Bearer) | `JwtAuthGuard` в `BotsController` |
| Бот (API) | Token в URL `/bot{token}/method` | `BotApiAuthGuard` |
| Сервис ↔ Сервис | RabbitMQ (доверенная внутренняя сеть) | AMQP credentials |

---

## 8. Структура модулей (chat-bot)

```
src/modules/
├── auth/                  # JWT-аутентификация владельцев ботов
├── chat-bridge/           # ★ Ядро: RabbitMQ клиент
│   ├── chat-bridge.module.ts      # Global module, RabbitMQ config
│   ├── chat-bridge.service.ts     # RPC + Pub/Sub + bot registry
│   ├── rabbitmq.constants.ts      # Exchanges, routing keys, queues
│   └── interfaces/chat-types.ts   # Типы данных chat_server
├── bots/                  # CRUD ботов, токены, шифрование
│   ├── bots.controller.ts         # REST: создать/деактивировать/regenerate
│   ├── bots.service.ts            # Бизнес-логика + OnModuleInit (загрузка ботов)
│   ├── model/bots.model.ts        # Sequelize модель
│   └── dto/bots.dto.ts            # Валидация
├── bot-api/               # Telegram-style HTTP API
│   ├── bot-api.controller.ts      # POST /bot{token}/sendMessage и т.д.
│   ├── bot-api.service.ts         # Проксирование через ChatBridgeService
│   ├── guards/bot-api-auth.guard.ts  # Верификация токена
│   └── decorators/bot.decorator.ts   # @CurrentBot()
├── updates/               # Очередь обновлений
│   ├── updates.service.ts         # @OnEvent('bot.update') + long polling
│   └── model/updates.model.ts     # Sequelize модель (bigint PK)
├── webhooks/              # Доставка webhook'ов
│   ├── webhooks.service.ts        # Enqueue в BullMQ
│   └── webhooks.processor.ts      # Worker: HTTP POST + retry
├── logger/                # Логирование
└── s3/                    # Файловое хранилище
```

### Структура модулей (chat_server, новое)

```
src/modules/rabbitmq/
├── rabbitmq.module.ts             # Конфигурация RabbitMQ + DI
├── rabbitmq.constants.ts          # Exchanges, routing keys
├── bot-commands.handler.ts        # @RabbitRPC обработчики (10 команд)
└── chat-events.publisher.ts       # Публикация событий в broadcastMessageChange
```

---

## 9. Диаграмма зависимостей модулей

```
                    ┌──────────────┐
                    │  AppModule   │
                    └──────┬───────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────┴─────┐   ┌──────┴──────┐   ┌────┴─────┐
    │   Auth    │   │ ChatBridge  │   │   S3     │
    │ (JWT)     │   │ (Global)    │   │          │
    └───────────┘   └──────┬──────┘   └──────────┘
                           │ (injected everywhere)
              ┌────────────┼────────────┐
              │            │            │
        ┌─────┴─────┐ ┌───┴────┐ ┌─────┴──────┐
        │   Bots    │ │ BotApi │ │  Updates   │
        │           │ │        │ │            │
        └───────────┘ └────────┘ └─────┬──────┘
                                       │
                                 ┌─────┴──────┐
                                 │  Webhooks  │
                                 │ (BullMQ)   │
                                 └────────────┘
```

`ChatBridgeModule` — **@Global()**, доступен всем модулям без импорта.

---

## 10. Переменные окружения

| Переменная | Сервис | Описание |
|-----------|--------|----------|
| `RABBITMQ_URL` | оба | `amqp://user:pass@host:5672` |
| `BOT_TOKEN_ENCRYPTION_KEY` | chat-bot | 32 байта hex для AES-256-GCM |
| `DATABASE_URL` | chat-bot | PostgreSQL для bots + updates |
| `REDIS_URL` | chat-bot | Кеш + BullMQ очереди |
| `SERVICE_API_KEY` | chat_server | Для internal REST API (fallback) |
| `RABBITMQ_URL` | chat_server | Тот же RabbitMQ |

---

## 11. FAQ

**Q: Почему бот — это системный пользователь, а не отдельная сущность в chat_server?**
A: Минимум изменений в chat_server. Бот автоматически получает все возможности пользователя: участие в топиках, отправка сообщений, аватар. Единственное отличие — флаг `isBot: true`.

**Q: Почему RabbitMQ, а не HTTP между сервисами?**
A: HTTP создаёт синхронную зависимость — если один сервис лёг, второй тоже ломается. RabbitMQ буферизирует сообщения, обеспечивает retry, и оба сервиса работают независимо.

**Q: Почему не Kafka?**
A: Kafka избыточна для RPC-паттерна (запрос-ответ). RabbitMQ нативно поддерживает RPC через reply queues, имеет меньше операционных затрат и проще в настройке.

**Q: Как бот узнаёт о новых сообщениях?**
A: Два способа (как в Telegram):
1. **Long polling** — `POST /bot{token}/getUpdates` с параметром `timeout` (до 60 сек)
2. **Webhook** — `POST /bot{token}/setWebhook { url }` — сервис сам отправит HTTP POST на указанный URL

**Q: Что если RabbitMQ упадёт?**
A: `@golevelup/nestjs-rabbitmq` автоматически переподключается. Сообщения в durable очередях сохраняются на диске. Оба сервиса продолжают работать, но межсервисные команды будут ждать восстановления.