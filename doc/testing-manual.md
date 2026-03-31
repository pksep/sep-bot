# Chat-Bot API — Полное руководство по тестированию

## Предусловия

```bash
# Запустить инфраструктуру
cd chat-bot
docker-compose up -d

# Убедиться что всё работает
docker ps --format "table {{.Names}}\t{{.Status}}"
# postgres-local   Up
# rabbitmq-local   Up
# redis-local      Up
# minio-local      Up

# Запустить сервис
bun run start:dev
# → Server running on port: 3001
```

---

## Архитектура

```
┌─────────────┐         ┌───────────────┐         ┌──────────────┐
│  Владелец   │  JWT/   │  chat-bot     │  AMQP   │  chat_server │
│  (frontend) │  HTTP   │  (gateway)    │  RPC    │  (core)      │
└──────┬──────┘         └───────┬───────┘         └──────────────┘
       │                        │
       │ POST /api/bots         │
       │ (создать бота)         │
       │                        │
       ▼                        │
┌─────────────┐                 │
│  Бот-клиент │  HTTP           │
│  (SDK)      │ ────────────────┘
└─────────────┘
  POST /api/bot{TOKEN}/sendMessage
```

**Два уровня API:**
1. **Management API** (`/api/bots/*`) — создание/управление ботами. Требует JWT (в dev-режиме пропускает localhost).
2. **Bot API** (`/api/bot{TOKEN}/*`) — Telegram-style API для бота. Авторизация через токен в URL.

---

## Шаг 1: Создание бота

> В dev-режиме JWT guard пропускает localhost, поэтому `Authorization` заголовок не нужен.
> Но `@UserId()` вернёт `undefined` — бот создастся с `ownerUserId = null`.

```bash
curl -s -X POST http://localhost:3001/api/bots \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_bot",
    "displayName": "Test Bot",
    "description": "Мой тестовый бот"
  }' | jq .
```

**Ожидаемый ответ:**
```json
{
  "ok": true,
  "result": {
    "id": 1,
    "username": "test_bot",
    "display_name": "Test Bot",
    "description": "Мой тестовый бот",
    "token": "1:a3f8b2c1d4e5f6..."
  }
}
```

> ⚠️ **ВАЖНО:** Токен показывается ОДИН РАЗ. Сохрани его!

```bash
# Сохранить токен в переменную для дальнейших шагов
export BOT_TOKEN="1:скопируй-токен-из-ответа"
```

> ⚠️ **ПРИМЕЧАНИЕ:** Создание бота делает RPC-вызов в `chat_server` для создания пользователя-бота.
> Если chat_server не запущен — создание упадёт с ошибкой.
> Для тестирования без chat_server см. "Тестирование в изоляции" ниже.

---

## Шаг 2: Проверка getMe

```bash
curl -s -X POST http://localhost:3001/api/bot${BOT_TOKEN}/getMe | jq .
```

**Ожидаемый ответ:**
```json
{
  "ok": true,
  "result": {
    "id": 1,
    "is_bot": true,
    "first_name": "Test Bot",
    "username": "test_bot"
  }
}
```

---

## Шаг 3: Получить список ботов

```bash
curl -s -X GET http://localhost:3001/api/bots | jq .
```

**Ответ:**
```json
{
  "ok": true,
  "result": [
    {
      "id": 1,
      "username": "test_bot",
      "display_name": "Test Bot",
      "description": "Мой тестовый бот",
      "is_active": true,
      "webhook": null
    }
  ]
}
```

---

## Шаг 4: Отправка сообщения

```bash
curl -s -X POST http://localhost:3001/api/bot${BOT_TOKEN}/sendMessage \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "uuid-вашего-топика",
    "text": "Привет от бота! 🤖"
  }' | jq .
```

> Для реального теста нужен `chat_id` (topicId) из chat_server,
> в который бот добавлен как участник.

---

## Шаг 5: Long Polling (getUpdates)

```bash
# timeout=5 — ждать до 5 секунд, потом вернуть пустой массив
curl -s -X POST http://localhost:3001/api/bot${BOT_TOKEN}/getUpdates \
  -H "Content-Type: application/json" \
  -d '{
    "timeout": 5,
    "limit": 10
  }' | jq .
```

**Ответ (нет обновлений):**
```json
{
  "ok": true,
  "result": []
}
```

**Ответ (есть обновления):**
```json
{
  "ok": true,
  "result": [
    {
      "update_id": 1,
      "message": {
        "message_id": "uuid-msg",
        "from": { "id": "uuid-user", "first_name": "Иванов" },
        "chat": { "id": "uuid-topic", "type": "group" },
        "date": 1711900000,
        "text": "Привет, бот!"
      }
    }
  ]
}
```

---

## Шаг 6: Webhook

### Установить

```bash
curl -s -X POST http://localhost:3001/api/bot${BOT_TOKEN}/setWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://my-server.com/webhook/bot1"
  }' | jq .
```

### Проверить

```bash
curl -s -X POST http://localhost:3001/api/bot${BOT_TOKEN}/getWebhookInfo | jq .
```

### Удалить

```bash
curl -s -X POST http://localhost:3001/api/bot${BOT_TOKEN}/deleteWebhook | jq .
```

---

## Шаг 7: Редактирование и удаление сообщений

### Редактировать

```bash
curl -s -X POST http://localhost:3001/api/bot${BOT_TOKEN}/editMessageText \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "uuid-топика",
    "message_id": "uuid-сообщения",
    "text": "Исправленный текст ✏️"
  }' | jq .
```

### Удалить

```bash
curl -s -X POST http://localhost:3001/api/bot${BOT_TOKEN}/deleteMessage \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "uuid-топика",
    "message_id": "uuid-сообщения"
  }' | jq .
```

---

## Шаг 8: Управление ботом

### Перегенерировать токен

```bash
curl -s -X POST http://localhost:3001/api/bots/1/regenerate-token | jq .
# → { "ok": true, "result": { "token": "1:новый-токен..." } }
```

### Деактивировать

```bash
curl -s -X POST http://localhost:3001/api/bots/1/deactivate | jq .
# → { "ok": true, "result": true }
# Теперь Bot API вернёт 401 для старого токена
```

### Активировать

```bash
curl -s -X POST http://localhost:3001/api/bots/1/activate | jq .
```

---

## Шаг 9: Тестирование с SDK (@pksep/bot-api)

```bash
mkdir test-bot && cd test-bot
bun init -y
bun add @pksep/bot-api
```

`index.ts`:
```typescript
import { SepBot } from '@pksep/bot-api';

const bot = new SepBot(
  process.env.BOT_TOKEN!,
  'http://localhost:3001/api',
  { polling: true }
);

bot.on('message', async (msg) => {
  console.log(`[${msg.chat.id}] ${msg.from?.first_name}: ${msg.text}`);

  if (msg.text === '/ping') {
    await bot.sendMessage(msg.chat.id, '🏓 Pong!');
  }

  if (msg.text === '/me') {
    const me = await bot.getMe();
    await bot.sendMessage(msg.chat.id, `Я — ${me.first_name} (@${me.username})`);
  }
});

bot.on('error', (err) => console.error('Error:', err));
bot.on('polling_error', (err) => console.error('Polling error:', err));

console.log('Bot started, listening for updates...');
```

```bash
BOT_TOKEN="1:твой-токен" bun run index.ts
```

---

## Тестирование ошибок

### Невалидный токен
```bash
curl -s -X POST http://localhost:3001/api/bot999:fake-token/getMe | jq .
# → { "ok": false, "error_code": 401, "description": "Unauthorized: invalid bot token" }
```

### Деактивированный бот
```bash
# Сначала деактивировать
curl -s -X POST http://localhost:3001/api/bots/1/deactivate

# Потом попробовать API
curl -s -X POST http://localhost:3001/api/bot${BOT_TOKEN}/getMe | jq .
# → 401 Unauthorized
```

### Дублирование username
```bash
curl -s -X POST http://localhost:3001/api/bots \
  -H "Content-Type: application/json" \
  -d '{"username": "test_bot", "displayName": "Dup Bot"}' | jq .
# → 409 Conflict: "Бот с таким username уже существует"
```

---

## Проверка RabbitMQ

Открой http://localhost:15672 (guest/guest) и проверь:

1. **Exchanges** → должны быть `chat.events`, `bot.commands`
2. **Queues** → `bot-gateway.chat-events.message_new`, ...
3. **Bindings** → exchange `chat.events` → queue с routing key `message.new`

---

## Полный сценарий одной командой

```bash
#!/bin/bash
set -e
API="http://localhost:3001/api"

echo "=== 1. Создание бота ==="
RESULT=$(curl -s -X POST $API/bots \
  -H "Content-Type: application/json" \
  -d '{"username":"smoke_bot","displayName":"Smoke Test"}')
echo "$RESULT" | jq .
TOKEN=$(echo "$RESULT" | jq -r '.result.token')
BOT_ID=$(echo "$RESULT" | jq -r '.result.id')

echo -e "\n=== 2. getMe ==="
curl -s -X POST "$API/bot${TOKEN}/getMe" | jq .

echo -e "\n=== 3. getUpdates (5s) ==="
curl -s -X POST "$API/bot${TOKEN}/getUpdates" \
  -H "Content-Type: application/json" \
  -d '{"timeout":2}' | jq .

echo -e "\n=== 4. setWebhook ==="
curl -s -X POST "$API/bot${TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/hook"}' | jq .

echo -e "\n=== 5. getWebhookInfo ==="
curl -s -X POST "$API/bot${TOKEN}/getWebhookInfo" | jq .

echo -e "\n=== 6. deleteWebhook ==="
curl -s -X POST "$API/bot${TOKEN}/deleteWebhook" | jq .

echo -e "\n=== 7. Невалидный токен ==="
curl -s -X POST "$API/bot999:fake/getMe" | jq .

echo -e "\n=== 8. Деактивация ==="
curl -s -X POST "$API/bots/${BOT_ID}/deactivate" | jq .

echo -e "\n=== 9. API после деактивации ==="
curl -s -X POST "$API/bot${TOKEN}/getMe" | jq .

echo -e "\n=== 10. Реактивация ==="
curl -s -X POST "$API/bots/${BOT_ID}/activate" | jq .

echo -e "\n=== 11. API после реактивации ==="
curl -s -X POST "$API/bot${TOKEN}/getMe" | jq .

echo -e "\n✅ Smoke test завершён"
```

---

## Нагрузочное тестирование (k6)

```bash
bun run test:k6
```

Или вручную:
```bash
k6 run --vus 10 --duration 30s src/tests/k6/k6.test.ts
```
