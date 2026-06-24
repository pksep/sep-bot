# [ADR-0001] Архитектура Bot API Gateway — межсервисное взаимодействие через RabbitMQ

* **Status:** Accepted
* **Date:** 2026-03-30
* **Members:** @trixter
* **Tags:** #architecture #rabbitmq #bot-api #inter-service

## Контекст

Необходимо реализовать сервис Bot API Gateway (`chat-bot`), который предоставляет разработчикам ботов Telegram-совместимый HTTP API для взаимодействия с существующим чат-сервером (`chat_server`).

**Требования:**
- Боты должны отправлять и получать сообщения через кастомный чат
- Бот — системный пользователь в `chat_server` с флагом `isBot: true`
- Минимум изменений в `chat_server`
- Два способа получения обновлений: long polling (`getUpdates`) и webhook
- API-токены ботов управляются в `chat-bot`, `chat_server` о них не знает

**Ключевая проблема:** какой механизм коммуникации использовать между `chat-bot` и `chat_server`?

## Варианты решения

### Вариант 1: HTTP (REST) между сервисами

`chat-bot` вызывает internal REST API `chat_server` напрямую по HTTP. Для получения событий — подключается как Socket.IO клиент.

```
Bot Developer → HTTP → chat-bot → HTTP → chat_server
                                    ↑ WS (Socket.IO client)
```

* **Плюсы:**
  - Простая реализация, понятная отладка
  - Не требует дополнительной инфраструктуры

* **Минусы:**
  - Синхронная зависимость: если `chat_server` лежит — бот не работает
  - WS-клиент может отвалиться, нужен reconnect и системный JWT
  - Два HTTP-хопа на каждое сообщение + задержка
  - Три env-переменных для конфигурации (URL, API key, JWT)

### Вариант 2: Kafka

Общение через Kafka-топики. `chat_server` уже использует Kafka для user-change events.

```
chat-bot → Kafka topic → chat_server (consume)
chat_server → Kafka topic → chat-bot (consume)
```

* **Плюсы:**
  - Асинхронность, буферизация
  - Уже есть Kafka-инфраструктура в проекте

* **Минусы:**
  - Kafka не поддерживает RPC (запрос-ответ) нативно — нужно реализовывать correlation через два топика
  - Избыточна для текущего масштаба
  - Высокие операционные расходы (ZooKeeper / KRaft, партиции)

### Вариант 3: RabbitMQ

Два exchange: `chat.events` (Pub/Sub) и `bot.commands` (RPC через reply queue). Библиотека `@golevelup/nestjs-rabbitmq` нативно поддерживает оба паттерна.

```
chat-bot ──RPC──→ RabbitMQ ──→ chat_server (обрабатывает, возвращает результат)
chat_server ──Pub/Sub──→ RabbitMQ ──→ chat-bot (получает события)
```

* **Плюсы:**
  - Слабая связанность — сервисы не знают адресов друг друга
  - Нативный RPC-паттерн через reply queue
  - Отказоустойчивость: durable очереди, автоматический retry
  - Одна env-переменная (`RABBITMQ_URL`)
  - Легковесен, прост в администрировании

* **Минусы:**
  - Дополнительный инфраструктурный компонент (RabbitMQ сервер)
  - Незначительная задержка на сериализацию/десериализацию

### Вариант 4: Встроить Bot API в chat_server

Добавить bot-api эндпоинты прямо в `chat_server`. `chat-bot` отвечает только за управление ботами и updates.

* **Плюсы:**
  - Один хоп: разработчик → chat_server → БД
  - Минимум точек отказа

* **Минусы:**
  - Загрязнение `chat_server` бот-логикой
  - Нарушение принципа единственной ответственности
  - Усложнение деплоя — бот-фичи привязаны к релизному циклу чата

## Решение

Выбранный вариант: **Вариант 3 — RabbitMQ**

* **Причины выбора:**
  - Нативная поддержка RPC (бот ожидает `message_id` в ответ на `sendMessage`) и Pub/Sub (поток событий чата)
  - Слабая связанность: оба сервиса зависят только от RabbitMQ, а не друг от друга
  - Отказоустойчивость: если `chat_server` перезапускается, команды ботов буферизируются в очереди
  - Единая точка конфигурации — одна переменная `RABBITMQ_URL` вместо URL + API key + JWT
  - `@golevelup/nestjs-rabbitmq` интегрируется с NestJS декораторами (`@RabbitRPC`, `@RabbitSubscribe`)

* **Последствия:**
  - В `chat_server` добавлен модуль `rabbitmq/` — обработчик команд (`BotCommandsHandler`) и публикатор событий (`ChatEventsPublisher`)
  - `broadcastMessageChange` в `MessagesGateway` теперь публикует события и в WS, и в RabbitMQ
  - В `chat-bot` модуль `ChatBridgeService` использует `AmqpConnection` вместо axios/socket.io-client
  - Требуется RabbitMQ-сервер в инфраструктуре (docker-compose)
  - Internal REST API контроллеры в `chat_server` сохранены как fallback

## Детали реализации

### RabbitMQ Topology

| Exchange | Тип | Направление | Паттерн |
|----------|-----|-------------|---------|
| `chat.events` | topic | chat_server → chat-bot | Pub/Sub |
| `bot.commands` | topic | chat-bot → chat_server | RPC (request/reply) |

### Routing Keys — события чата

| Key | Когда | Payload |
|-----|-------|---------|
| `message.new` | Новое сообщение | `{ type, topicId, message, senderUserId }` |
| `message.edit` | Редактирование | `{ type, topicId, message, senderUserId }` |
| `message.delete` | Удаление | `{ type, topicId, message: { id } }` |

### Routing Keys — команды ботов (RPC)

| Key | Действие | Request | Response |
|-----|----------|---------|----------|
| `bot.send_message` | Отправить сообщение | `{ senderUserId, topicId, text }` | `{ ok, result: Message }` |
| `bot.edit_message` | Редактировать | `{ senderUserId, messageId, text }` | `{ ok, result: Message }` |
| `bot.delete_message` | Удалить | `{ senderUserId, messageId, topicId }` | `{ ok, result: true }` |
| `bot.create_user` | Создать пользователя-бота | `{ nickname, displayName }` | `{ ok, result: User }` |
| `bot.get_topic_info` | Информация о топике | `{ topicId }` | `{ ok, result: Topic }` |
| `bot.get_topic_members` | Участники | `{ topicId }` | `{ ok, result: string[] }` |
| `bot.get_user_topics` | Топики пользователя | `{ userId }` | `{ ok, result: string[] }` |
| `bot.add_to_topic` | Добавить бота | `{ topicId, botUserId, actorId }` | `{ ok }` |
| `bot.remove_from_topic` | Удалить бота | `{ topicId, botUserId, actorId }` | `{ ok }` |

### Модель данных

**chat_server** — добавлено поле `is_bot: boolean` в таблицу `users`.

**chat-bot** — собственная БД с двумя таблицами:

| Таблица | Назначение | Ключевые поля |
|---------|------------|---------------|
| `bots` | Реестр ботов | `chat_user_id` (UUID → User), `api_token` (AES-256-GCM), `api_token_hash` (SHA-256), `webhook_config` |
| `updates` | Очередь обновлений | `bot_id`, `type`, `payload` (JSONB) |

### API-токены

| Свойство | Значение |
|----------|----------|
| Формат | `{botId}:{64 hex символа}` |
| Хранение | AES-256-GCM (шифрованный) |
| Индекс | SHA-256 хеш для быстрого поиска |
| Показ | Один раз при создании |

### Аутентификация

| Актор | Механизм |
|-------|----------|
| Владелец бота | JWT (cookie / Bearer) → `JwtAuthGuard` |
| Бот (API-вызов) | Токен в URL `/bot{token}/method` → `BotApiAuthGuard` |
| Сервис ↔ Сервис | AMQP credentials (внутренняя сеть) |

## Дополнительные материалы

- [@golevelup/nestjs-rabbitmq](https://github.com/golevelup/nestjs/tree/master/packages/rabbitmq) — NestJS интеграция
- [RabbitMQ RPC Tutorial](https://www.rabbitmq.com/tutorials/tutorial-six-javascript) — паттерн запрос-ответ
- [Telegram Bot API](https://core.telegram.org/bots/api) — референсный API
- [Руководство по тестированию](./0002-testing-guide.md) — функциональное и нагрузочное тестирование

---

## Приложение A: Онбординг — как устроен сервис

> Этот раздел предназначен для нового разработчика, который берёт сервис на поддержку.

### A.1. Назначение

Сервис `chat-bot` — это **прокси-шлюз**. Он:
1. Принимает HTTP-запросы от разработчиков ботов (`POST /bot{token}/sendMessage`)
2. Конвертирует их в RabbitMQ RPC-команды и отправляет в `chat_server`
3. Слушает события из `chat_server` (новые сообщения) через RabbitMQ
4. Создаёт из них Updates и доставляет разработчику через long polling или webhook

**Сервис НЕ хранит** сообщения, пользователей или топики. Все данные чата живут в `chat_server`. Здесь хранятся только: боты (`bots`), обновления (`updates`).

### A.2. Карта модулей — что за что отвечает

```
src/modules/
│
├── chat-bridge/          ★ ЯДРО — коммуникация с chat_server
│   ├── chat-bridge.service.ts
│   │   ├── @RabbitSubscribe    → получает события (message.new/edit/delete)
│   │   ├── amqp.request()      → RPC-команды (sendMessage, createBotUser...)
│   │   ├── topicBotRegistry    → Map: topicId → Set<botId>
│   │   ├── botChatUserMap      → Map: botId → chatUserId (UUID)
│   │   └── dispatchToBot()     → фильтрует + EventEmitter.emit('bot.update')
│   ├── chat-bridge.module.ts   → @Global(), RabbitMQ config
│   └── rabbitmq.constants.ts   → КОНТРАКТ с chat_server (exchanges, routing keys)
│
├── bots/                 Управление реестром ботов
│   ├── bots.service.ts
│   │   ├── createBot()         → RPC: создаёт User(isBot) в chat_server → шифрует токен
│   │   ├── verifyToken()       → SHA-256 hash lookup → используется в BotApiAuthGuard
│   │   ├── onModuleInit()      → загружает всех ботов в bridge registry при старте
│   │   ├── encryptToken()      → AES-256-GCM шифрование
│   │   └── findOwnedBot()     → DRY проверка владельца
│   ├── model/bots.model.ts     → Sequelize модель + BotCreationAttributes
│   └── bots.controller.ts      → REST для владельцев ботов (JWT auth)
│
├── bot-api/              Telegram-style HTTP API для ботов
│   ├── bot-api.controller.ts   → POST /bot{token}/sendMessage, getUpdates, ...
│   ├── bot-api.service.ts      → проксирует через ChatBridgeService
│   ├── guards/bot-api-auth.guard.ts → извлекает token из URL → verifyToken
│   └── decorators/bot.decorator.ts  → @CurrentBot() параметр
│
├── updates/              Очередь обновлений
│   ├── updates.service.ts
│   │   ├── @OnEvent('bot.update') → создаёт Update в БД
│   │   └── getUpdates()         → long polling с таймаутом
│   └── model/updates.model.ts  → bigint PK, JSONB payload
│
└── webhooks/             Доставка webhook'ов (BullMQ)
    ├── webhooks.service.ts      → enqueueDelivery() → BullMQ queue
    └── webhooks.processor.ts    → Worker: HTTP POST + exponential retry
```

### A.3. Жизненный цикл запроса — пошагово

#### Бот отправляет сообщение:
```
1. HTTP POST /api/bot1:abc.../sendMessage { chat_id: "uuid", text: "hello" }
2. BotApiAuthGuard:
   - regex: достаёт "1:abc..." из URL
   - SHA-256("1:abc...") → ищет в bots.api_token_hash
   - если нашёл + isActive → req.bot = bot
3. BotApiController.sendMessage(@CurrentBot() bot, @Body() body)
4. BotApiService.sendMessage(bot, body)
5. ChatBridgeService.sendMessage(bot.id, topicId, text)
   - Берёт chatUserId из botChatUserMap
   - amqp.request('bot.commands', 'bot.send_message', { senderUserId, topicId, text })
                    │
                    ▼  RabbitMQ
6. chat_server: BotCommandsHandler.handleSendMessage()
   - MessagesService.create(senderUserId, dto) → INSERT в БД
   - MessagesGateway.broadcastMessageChange(NEW) → WS + RabbitMQ
   - return { ok: true, result: message }
                    │
                    ▼  RPC reply
7. ChatBridgeService получает ответ
8. BotApiService.formatMessage(result) → Telegram-style JSON
9. HTTP 200: { ok: true, result: { message_id, chat, date, text } }
```

#### Пользователь пишет → бот получает update:
```
1. User → WS → MessagesGateway → MessagesService.create()
2. broadcastMessageChange(NEW, topicId, message)
3. ChatEventsPublisher.publishMessageNew() → RabbitMQ 'chat.events' / 'message.new'
                    │
                    ▼  RabbitMQ
4. ChatBridgeService.handleMessageNew() (@RabbitSubscribe)
5. dispatchToBot(topicId, message, 'message'):
   - Пропускает системные? → да → return
   - Отправитель = бот? → да → return (анти-петля)
   - topicBotRegistry.get(topicId) → Set<botId>
   - Для каждого botId:
     EventEmitter.emit('bot.update', { botId, type: 'message', payload })
                    │
                    ▼  In-process EventEmitter
6. UpdatesService.handleBotUpdate() (@OnEvent)
   - INSERT Update в БД
   - WebhooksService.enqueueDelivery() → BullMQ (если webhook настроен)
7. Developer → POST /getUpdates → long polling → ← updates
```

### A.4. Важные нюансы при поддержке

**Контракт `rabbitmq.constants.ts`** — ДУБЛИРУЕТСЯ в двух проектах:
- `chat_server/src/modules/rabbitmq/rabbitmq.constants.ts`
- `chat-bot/src/modules/chat-bridge/rabbitmq.constants.ts`

> При изменении routing key, exchange name или queue — менять в ОБОИХ файлах.

**topicBotRegistry** — in-memory Map. Данные загружаются при старте (`onModuleInit`) через RPC `bot.get_user_topics`. Если бот добавлен в новый топик через UI чата, нужен механизм обновления (пока не реализован — топик появится после перезагрузки `chat-bot`).

**Шифрование токенов** — ключ `BOT_TOKEN_ENCRYPTION_KEY` должен быть одинаковым между деплоями. Если потерять ключ, все существующие токены невозможно расшифровать (но верификация по SHA-256 хешу продолжит работать).

**Long polling** — текущая реализация poll-каждую-секунду в цикле. При высокой нагрузке рассмотреть переход на Postgres LISTEN/NOTIFY или Redis pub/sub для real-time уведомлений.

### A.5. Частые сценарии поддержки

| Задача | Где смотреть |
|--------|-------------|
| Бот не получает сообщения | RabbitMQ UI → очереди, chat.events binding. `topicBotRegistry` — бот в нужном топике? |
| Бот не может отправить | RabbitMQ UI → bot.commands queue. chat_server логи. |
| Токен не работает | `SELECT * FROM bots WHERE api_token_hash = SHA256(token)` + проверить `is_active` |
| Добавить новый RPC-метод | 1) routing key в constants (оба проекта) 2) handler в chat_server 3) метод в ChatBridgeService |
| Webhook не доставляется | BullMQ dashboard (`/queues`), логи WebhookProcessor |

