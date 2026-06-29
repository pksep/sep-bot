var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/@pksep/bot-api/dist/types.js
var require_types = __commonJS({
  "node_modules/@pksep/bot-api/dist/types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PollingError = exports.ApiError = exports.SepBotError = void 0;
    var SepBotError3 = class extends Error {
      constructor(message, code, response) {
        super(message);
        this.code = code;
        this.response = response;
        this.name = "SepBotError";
      }
    };
    exports.SepBotError = SepBotError3;
    var ApiError3 = class extends SepBotError3 {
      constructor(method, statusCode, description, response) {
        super(`API error on ${method}: [${statusCode}] ${description}`, statusCode, response);
        this.method = method;
        this.statusCode = statusCode;
        this.name = "ApiError";
      }
    };
    exports.ApiError = ApiError3;
    var PollingError3 = class extends SepBotError3 {
      constructor(message, cause) {
        super(message);
        this.cause = cause;
        this.name = "PollingError";
      }
    };
    exports.PollingError = PollingError3;
  }
});

// node_modules/@pksep/bot-api/dist/api.js
var require_api = __commonJS({
  "node_modules/@pksep/bot-api/dist/api.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ApiClient = void 0;
    var types_1 = require_types();
    var DEFAULT_TIMEOUT = 3e4;
    var ApiClient3 = class {
      constructor(token, baseUrl, timeout = DEFAULT_TIMEOUT) {
        this.token = token;
        this.baseUrl = baseUrl.replace(/\/+$/, "");
        this.timeout = timeout;
      }
      /**
       * Call a Bot API method.
       *
       * @param method — API method name (e.g. 'sendMessage')
       * @param params — request body
       * @returns parsed result from API response
       * @throws {ApiError} on non-ok response
       * @throws {SepBotError} on network/timeout errors
       */
      async call(method, params = {}) {
        const url = `${this.baseUrl}/bot${this.token}/${method}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params),
            signal: controller.signal
          });
          const data = await response.json();
          if (!data.ok) {
            throw new types_1.ApiError(method, data.error_code || response.status, data.description || "Unknown API error", data);
          }
          return data.result;
        } catch (err) {
          if (err instanceof types_1.ApiError)
            throw err;
          if (err instanceof Error) {
            if (err.name === "AbortError") {
              throw new types_1.SepBotError(`Request to ${method} timed out after ${this.timeout}ms`);
            }
            throw new types_1.SepBotError(`Network error on ${method}: ${err.message}`);
          }
          throw new types_1.SepBotError(`Unknown error on ${method}: ${String(err)}`);
        } finally {
          clearTimeout(timer);
        }
      }
      /**
       * Call with extended timeout (for long polling).
       */
      async callWithTimeout(method, params, timeoutMs) {
        const url = `${this.baseUrl}/bot${this.token}/${method}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params),
            signal: controller.signal
          });
          const data = await response.json();
          if (!data.ok) {
            throw new types_1.ApiError(method, data.error_code || response.status, data.description || "Unknown API error", data);
          }
          return data.result;
        } catch (err) {
          if (err instanceof types_1.ApiError)
            throw err;
          if (err instanceof Error && err.name === "AbortError") {
            throw new types_1.SepBotError(`Long polling timed out after ${timeoutMs}ms`);
          }
          throw new types_1.SepBotError(`Network error on ${method}: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          clearTimeout(timer);
        }
      }
    };
    exports.ApiClient = ApiClient3;
  }
});

// node_modules/@pksep/bot-api/dist/polling.js
var require_polling = __commonJS({
  "node_modules/@pksep/bot-api/dist/polling.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PollingManager = void 0;
    var types_1 = require_types();
    var DEFAULTS = {
      interval: 300,
      timeout: 30,
      limit: 100
    };
    var PollingManager = class {
      constructor(api, onUpdates, onError, options = {}) {
        this.api = api;
        this.onUpdates = onUpdates;
        this.onError = onError;
        this.running = false;
        this.timer = null;
        this.interval = options.interval ?? DEFAULTS.interval;
        this.timeout = options.timeout ?? DEFAULTS.timeout;
        this.limit = options.limit ?? DEFAULTS.limit;
        this.offset = options.offset ?? 0;
      }
      /** Start polling loop */
      start() {
        if (this.running)
          return;
        this.running = true;
        this.poll();
      }
      /** Stop polling loop gracefully */
      stop() {
        this.running = false;
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
        }
      }
      /** Whether polling is currently active */
      get isRunning() {
        return this.running;
      }
      async poll() {
        if (!this.running)
          return;
        try {
          const httpTimeout = (this.timeout + 5) * 1e3;
          const updates = await this.api.callWithTimeout("getUpdates", {
            offset: this.offset,
            limit: this.limit,
            timeout: this.timeout
          }, httpTimeout);
          if (updates && updates.length > 0) {
            const maxId = Math.max(...updates.map((u) => u.update_id));
            this.offset = maxId + 1;
            this.onUpdates(updates);
          }
        } catch (err) {
          const pollingError = new types_1.PollingError(err instanceof Error ? err.message : String(err), err instanceof Error ? err : void 0);
          this.onError(pollingError);
        }
        if (this.running) {
          this.timer = setTimeout(() => this.poll(), this.interval);
        }
      }
    };
    exports.PollingManager = PollingManager;
  }
});

// node_modules/@pksep/bot-api/dist/bot.js
var require_bot = __commonJS({
  "node_modules/@pksep/bot-api/dist/bot.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SepBot = void 0;
    var api_1 = require_api();
    var polling_1 = require_polling();
    var types_1 = require_types();
    var SepBot3 = class {
      /**
       * @param token — Bot API token (format: `{botId}:{secret}`)
       * @param serverUrl — Bot API server URL (e.g. `https://bot-api.example.com/api`)
       * @param options — optional configuration
       */
      constructor(token, serverUrl, options = {}) {
        this.polling = null;
        this.listeners = /* @__PURE__ */ new Map();
        const timeout = options.requestTimeout || 3e4;
        this.api = new api_1.ApiClient(token, serverUrl, timeout);
        if (options.polling) {
          const pollingOpts = typeof options.polling === "object" ? options.polling : {};
          if (pollingOpts.autoStart !== false) {
            this.startPolling(pollingOpts);
          }
        }
      }
      // ═══════════════════════════════════════════════════════════
      //  Event System
      // ═══════════════════════════════════════════════════════════
      /**
       * Register an event handler.
       *
       * @example
       * ```typescript
       * bot.on('message', (msg) => console.log(msg.text));
       * bot.on('edited_message', (msg) => console.log('Edited:', msg.text));
       * bot.on('deleted_message', (msg) => console.log('Deleted:', msg.message_id));
       * bot.on('polling_error', (err) => console.error(err));
       * ```
       */
      on(event, handler) {
        if (!this.listeners.has(event)) {
          this.listeners.set(event, /* @__PURE__ */ new Set());
        }
        this.listeners.get(event).add(handler);
        return this;
      }
      /** Remove an event handler */
      off(event, handler) {
        this.listeners.get(event)?.delete(handler);
        return this;
      }
      /** Remove all handlers for an event (or all events) */
      removeAllListeners(event) {
        if (event) {
          this.listeners.delete(event);
        } else {
          this.listeners.clear();
        }
        return this;
      }
      emit(event, ...args) {
        const handlers = this.listeners.get(event);
        if (!handlers)
          return;
        for (const handler of handlers) {
          try {
            const result = handler(...args);
            if (result instanceof Promise) {
              result.catch((err) => {
                this.emit("error", new types_1.SepBotError(`Async handler error: ${err instanceof Error ? err.message : String(err)}`));
              });
            }
          } catch (err) {
            this.emit("error", new types_1.SepBotError(`Handler error: ${err instanceof Error ? err.message : String(err)}`));
          }
        }
      }
      // ═══════════════════════════════════════════════════════════
      //  Polling
      // ═══════════════════════════════════════════════════════════
      /**
       * Start automatic long polling.
       *
       * @example
       * ```typescript
       * bot.startPolling({ timeout: 30, interval: 500 });
       * ```
       */
      startPolling(options = {}) {
        if (this.polling?.isRunning) {
          this.polling.stop();
        }
        this.polling = new polling_1.PollingManager(this.api, (updates) => this.processUpdates(updates), (error) => this.emit("polling_error", error), options);
        this.polling.start();
      }
      /** Stop polling */
      stopPolling() {
        this.polling?.stop();
        this.polling = null;
      }
      /** Whether polling is active */
      get isPolling() {
        return this.polling?.isRunning ?? false;
      }
      /**
       * Process a batch of updates.
       * Called automatically by polling, or can be called manually for webhooks.
       */
      processUpdates(updates) {
        for (const update of updates) {
          if (update.message) {
            this.emit("message", update.message);
          }
          if (update.edited_message) {
            this.emit("edited_message", update.edited_message);
          }
          if (update.deleted_message) {
            this.emit("deleted_message", update.deleted_message);
          }
        }
      }
      // ═══════════════════════════════════════════════════════════
      //  Bot Info
      // ═══════════════════════════════════════════════════════════
      /**
       * Get info about the bot.
       *
       * @returns Bot user object
       *
       * @example
       * ```typescript
       * const me = await bot.getMe();
       * console.log(`I am ${me.first_name} (@${me.username})`);
       * ```
       */
      async getMe() {
        return this.api.call("getMe");
      }
      // ═══════════════════════════════════════════════════════════
      //  Messages
      // ═══════════════════════════════════════════════════════════
      /**
       * Send a text message.
       *
       * @param chatId — target chat / topic ID
       * @param text — message text
       * @param options — optional parameters
       * @returns sent message
       *
       * @example
       * ```typescript
       * const msg = await bot.sendMessage('topic-uuid', 'Hello!');
       * console.log(`Sent message ${msg.message_id}`);
       *
       * // With reply
       * await bot.sendMessage('topic-uuid', 'Reply!', {
       *   reply_to_message_id: msg.message_id
       * });
       * ```
       */
      async sendMessage(chatId, text, options) {
        return this.api.call("sendMessage", {
          chat_id: chatId,
          text,
          ...options
        });
      }
      /**
       * Edit a message text.
       *
       * @param chatId — chat / topic ID
       * @param messageId — message to edit
       * @param text — new text
       * @param options — optional parameters
       * @returns edited message
       *
       * @example
       * ```typescript
       * await bot.editMessageText('topic-uuid', msg.message_id, 'Updated text');
       * ```
       */
      async editMessageText(chatId, messageId, text, options) {
        return this.api.call("editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text,
          ...options
        });
      }
      /**
       * Delete a message.
       *
       * @param chatId — chat / topic ID
       * @param messageId — message to delete
       * @returns true on success
       *
       * @example
       * ```typescript
       * await bot.deleteMessage('topic-uuid', msg.message_id);
       * ```
       */
      async deleteMessage(chatId, messageId) {
        return this.api.call("deleteMessage", {
          chat_id: chatId,
          message_id: messageId
        });
      }
      // ═══════════════════════════════════════════════════════════
      //  Files
      // ═══════════════════════════════════════════════════════════
      /**
       * Get a presigned URL for direct upload to object storage.
       * Usually not needed directly — use {@link sendDocument} / {@link sendPhoto}.
       */
      async getUploadUrl(fileName, mimeType) {
        return this.api.call("getUploadUrl", {
          file_name: fileName,
          mime_type: mimeType
        });
      }
      /**
       * Send a file as a document. The file is streamed DIRECTLY to object
       * storage (presigned PUT), bypassing the gateway and the message bus —
       * so it scales to large files.
       *
       * @example
       * ```typescript
       * import { readFileSync } from 'fs';
       * await bot.sendDocument('topic-uuid', {
       *   data: readFileSync('report.pdf'),
       *   filename: 'report.pdf',
       *   contentType: 'application/pdf'
       * }, { caption: 'Отчёт за месяц' });
       * ```
       */
      async sendDocument(chatId, file, options) {
        return this.uploadAndSend("sendDocument", chatId, file, options);
      }
      /** Send an image. Same flow as {@link sendDocument} but typed as IMAGE. */
      async sendPhoto(chatId, file, options) {
        return this.uploadAndSend("sendPhoto", chatId, file, options);
      }
      async uploadAndSend(method, chatId, file, options) {
        const { file_id, upload_url } = await this.getUploadUrl(file.filename, file.contentType);
        const body = file.data instanceof ArrayBuffer ? new Uint8Array(file.data) : file.data;
        const res = await fetch(upload_url, {
          method: "PUT",
          headers: file.contentType ? { "Content-Type": file.contentType } : void 0,
          body
        });
        if (!res.ok) {
          throw new types_1.SepBotError(`File upload failed: HTTP ${res.status}`);
        }
        return this.api.call(method, {
          chat_id: chatId,
          file_id,
          file_name: file.filename,
          file_size: this.byteLength(file.data),
          mime_type: file.contentType,
          caption: options?.caption,
          reply_to_message_id: options?.reply_to_message_id
        });
      }
      byteLength(data) {
        if (data instanceof Uint8Array)
          return data.byteLength;
        if (data instanceof ArrayBuffer)
          return data.byteLength;
        return data.size;
      }
      // ═══════════════════════════════════════════════════════════
      //  Updates
      // ═══════════════════════════════════════════════════════════
      /**
       * Get updates manually (for custom polling or one-off checks).
       *
       * @param options — offset, limit, timeout
       * @returns array of updates
       *
       * @example
       * ```typescript
       * const updates = await bot.getUpdates({ timeout: 10, limit: 5 });
       * for (const upd of updates) {
       *   console.log(upd.message?.text);
       * }
       * ```
       */
      async getUpdates(options) {
        const timeout = options?.timeout ?? 30;
        const httpTimeout = (timeout + 5) * 1e3;
        return this.api.callWithTimeout("getUpdates", {
          offset: options?.offset,
          limit: options?.limit,
          timeout
        }, httpTimeout);
      }
      // ═══════════════════════════════════════════════════════════
      //  Webhooks
      // ═══════════════════════════════════════════════════════════
      /**
       * Set a webhook URL.
       * Bot API will POST updates to this URL.
       *
       * @param url — HTTPS URL for receiving updates
       * @param options — optional config
       * @returns true on success
       *
       * @example
       * ```typescript
       * await bot.setWebhook('https://my-server.com/webhook/bot1');
       * ```
       */
      async setWebhook(url, options) {
        return this.api.call("setWebhook", { url, ...options });
      }
      /**
       * Delete the webhook.
       * After deletion, use getUpdates / polling to receive updates.
       */
      async deleteWebhook() {
        return this.api.call("deleteWebhook");
      }
      /**
       * Get current webhook status.
       */
      async getWebhookInfo() {
        return this.api.call("getWebhookInfo");
      }
      // ═══════════════════════════════════════════════════════════
      //  Chats
      // ═══════════════════════════════════════════════════════════
      /**
       * Get information about a chat.
       *
       * @param chatId — chat / topic ID
       * @returns chat object
       */
      async getChat(chatId) {
        return this.api.call("getChat", { chat_id: chatId });
      }
      /**
       * Get number of members in a chat.
       *
       * @param chatId — chat / topic ID
       * @returns member count
       */
      async getChatMembersCount(chatId) {
        return this.api.call("getChatMembersCount", { chat_id: chatId });
      }
      // ═══════════════════════════════════════════════════════════
      //  Lifecycle
      // ═══════════════════════════════════════════════════════════
      /**
       * Stop the bot gracefully (stop polling, clear handlers).
       */
      stop() {
        this.stopPolling();
        this.removeAllListeners();
      }
    };
    exports.SepBot = SepBot3;
  }
});

// node_modules/@pksep/bot-api/dist/webhook.js
var require_webhook = __commonJS({
  "node_modules/@pksep/bot-api/dist/webhook.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.parseWebhookUpdate = parseWebhookUpdate3;
    var types_1 = require_types();
    function parseWebhookUpdate3(body, options = {}) {
      if (options.secret !== void 0 && options.signature !== options.secret) {
        throw new types_1.SepBotError("Webhook signature mismatch");
      }
      if (typeof body !== "object" || body === null) {
        throw new types_1.SepBotError("Invalid webhook body: expected a JSON object");
      }
      const update = body;
      if (typeof update.update_id !== "number") {
        throw new types_1.SepBotError('Invalid webhook update: missing numeric "update_id"');
      }
      return update;
    }
  }
});

// node_modules/@pksep/bot-api/dist/index.js
var require_dist = __commonJS({
  "node_modules/@pksep/bot-api/dist/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PollingError = exports.ApiError = exports.SepBotError = exports.parseWebhookUpdate = exports.ApiClient = exports.SepBot = void 0;
    var bot_1 = require_bot();
    Object.defineProperty(exports, "SepBot", { enumerable: true, get: function() {
      return bot_1.SepBot;
    } });
    var api_1 = require_api();
    Object.defineProperty(exports, "ApiClient", { enumerable: true, get: function() {
      return api_1.ApiClient;
    } });
    var webhook_1 = require_webhook();
    Object.defineProperty(exports, "parseWebhookUpdate", { enumerable: true, get: function() {
      return webhook_1.parseWebhookUpdate;
    } });
    var types_1 = require_types();
    Object.defineProperty(exports, "SepBotError", { enumerable: true, get: function() {
      return types_1.SepBotError;
    } });
    Object.defineProperty(exports, "ApiError", { enumerable: true, get: function() {
      return types_1.ApiError;
    } });
    Object.defineProperty(exports, "PollingError", { enumerable: true, get: function() {
      return types_1.PollingError;
    } });
  }
});

// pksep-bot-api-browser-entry.js
var sdk = __toESM(require_dist());
var SepBot2 = sdk.SepBot;
var ApiClient2 = sdk.ApiClient;
var parseWebhookUpdate2 = sdk.parseWebhookUpdate;
var SepBotError2 = sdk.SepBotError;
var ApiError2 = sdk.ApiError;
var PollingError2 = sdk.PollingError;
var pksep_bot_api_browser_entry_default = sdk;
export {
  ApiClient2 as ApiClient,
  ApiError2 as ApiError,
  PollingError2 as PollingError,
  SepBot2 as SepBot,
  SepBotError2 as SepBotError,
  pksep_bot_api_browser_entry_default as default,
  parseWebhookUpdate2 as parseWebhookUpdate
};
