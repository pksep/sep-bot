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
