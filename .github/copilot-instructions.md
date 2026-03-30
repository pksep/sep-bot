# Bot API Gateway — Правила для LLM-агентов

## Документация

После любых изменений в коде **обязательно** актуализируй документацию:

1. **`doc/decisions/0001-bot-api-gateway-rabbitmq.md`** — при изменении:
   - Архитектуры, модулей, потоков данных
   - RabbitMQ topology (exchanges, routing keys, queues)
   - Модели данных (таблицы, поля)
   - Аутентификации, шифрования
   - Карты модулей (Приложение A)

2. **`doc/decisions/0002-testing-guide.md`** — при изменении:
   - API-эндпоинтов (добавление/удаление/изменение параметров)
   - Переменных окружения
   - Инфраструктурных зависимостей

3. **`rabbitmq.constants.ts`** — контракт дублируется в двух проектах:
   - `chat_server/src/modules/rabbitmq/rabbitmq.constants.ts`
   - `chat-bot/src/modules/chat-bridge/rabbitmq.constants.ts`
   - При изменении routing key / exchange / queue — **менять в обоих файлах**

## Стиль кода

- Типизируй `catch(err: unknown)`, не используй `catch(e)` с `e.message`
- Не используй `as any` — создавай `CreationAttributes` интерфейсы для Sequelize моделей
- Выноси inline DTO-типы в именованные интерфейсы
- Добавляй `readonly` к инжектированным зависимостям в конструкторах
- Удаляй неиспользуемые импорты

## Архитектура

- `chat-bot` НЕ хранит данные чата (сообщения, пользователи, топики) — всё в `chat_server`
- Коммуникация между сервисами — **только через RabbitMQ** (не HTTP, не WS)
- `ChatBridgeModule` — `@Global()`, не импортировать повторно в других модулях
