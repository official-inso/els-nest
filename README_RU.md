# @inso_web/els-nest

[![npm version](https://img.shields.io/npm/v/@inso_web/els-nest.svg)](https://www.npmjs.com/package/@inso_web/els-nest)
[![npm downloads](https://img.shields.io/npm/dm/@inso_web/els-nest.svg)](https://www.npmjs.com/package/@inso_web/els-nest)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![license MIT](https://img.shields.io/npm/l/@inso_web/els-nest.svg)](./LICENSE)

NestJS module и `LoggerService` для **Inso Error Logs Service (ELS)** — управляемого SaaS централизованного сбора ошибок и событий с AI-диагностикой. Drop-in замена встроенного `Logger`, `nestjs-pino` и `@sentry/nestjs`. Поддерживает `app.useLogger()`, DI-инжект и request-scoped логирование через `ClsModule`.

> 🇬🇧 [English version → README.md](README.md) &nbsp;•&nbsp; 📚 [Обзор всех SDK → ../README_RU.md](../README_RU.md)

---

## Содержание

- [Что вы получаете](#что-вы-получаете)
- [Установка](#установка)
- [Быстрый старт](#быстрый-старт)
- [Когда что использовать](#когда-что-использовать)
- [Ключевые концепции](#ключевые-концепции)
- [Конфигурация](#конфигурация)
- [Миграция](#миграция)
  - [С built-in Nest Logger](#с-built-in-nest-logger)
  - [С nestjs-pino](#с-nestjs-pino)
  - [С @sentry/nestjs](#с-sentrynestjs)
- [Версионирование](#версионирование)
- [Quick reference](#quick-reference)
- [Почему ELS](#почему-els)
- [API](#api)
- [FAQ](#faq)
- [Другие ELS SDK](#другие-els-sdk)
- [Тарифы](#тарифы)
- [Лицензия](#лицензия)

---

## Что вы получаете

Встроенная панель с полнотекстовым поиском, фасетной фильтрацией, AI-диагностикой и виджетом регрессий по версиям.

![Превью панели ELS](https://raw.githubusercontent.com/official-inso/els-go/main/docs/screenshots/01-error-logs-list.png)

→ **[Полный обзор UI с 4 скриншотами](../README_RU.md#что-вы-получаете)**

---

## Установка

```bash
npm install @inso_web/els-client @inso_web/els-nest
```

`@inso_web/els-client` — peer-зависимость.

**Требования:** NestJS 9+, Node.js 18+.

---

## Быстрый старт

### 1. Подключите module

`app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ELSModule } from '@inso_web/els-nest';

@Module({
  imports: [
    ELSModule.forRoot({
      endpoint: process.env.ELS_URL!,
      apiKey: process.env.ELS_API_KEY!,
      appSlug: 'my-nest-app',
      serviceName: 'api',
      deploymentEnv: process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEV',
      appVersion: process.env.BUILD_VERSION,
      minLevel: 'info',
    }),
  ],
})
export class AppModule {}
```

Ещё нет API-ключа? **[Зарегистрируйтесь на lk.insoweb.ru](https://lk.insoweb.ru)** — займёт минуту.

### 2. Используйте как `app.useLogger()`

`main.ts`:

```ts
import { NestFactory } from '@nestjs/core';
import { ELSLoggerService } from '@inso_web/els-nest';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(ELSLoggerService));
  await app.listen(3000);
}
bootstrap();
```

Теперь все `Logger.log()` / `error()` / `warn()` встроенного Nest идут в ELS.

### 3. Через DI

```ts
import { Injectable } from '@nestjs/common';
import { ELSLoggerService } from '@inso_web/els-nest';

@Injectable()
export class UserService {
  constructor(private readonly logger: ELSLoggerService) {}

  async findById(id: string) {
    this.logger.log(`Fetching user ${id}`);
    // ...
  }
}
```

### 4. Request-scoped через CLS

Установите `nestjs-cls`, чтобы `requestId` подставлялся автоматически:

```ts
import { ClsModule } from 'nestjs-cls';

@Module({
  imports: [
    ClsModule.forRoot({ middleware: { mount: true, generateId: true } }),
    ELSModule.forRoot({ /* ... */ }),
  ],
})
export class AppModule {}
```

### 5. Async-конфиг (для `ConfigService`)

```ts
ELSModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    endpoint: config.getOrThrow('ELS_URL'),
    apiKey: config.getOrThrow('ELS_API_KEY'),
    appSlug: 'my-nest-app',
    deploymentEnv: config.get('NODE_ENV') === 'production' ? 'PRODUCTION' : 'DEV',
  }),
});
```

---

## Когда что использовать

| Сценарий | Что брать |
|---|---|
| Глобально заменить Nest-логгер | `app.useLogger(app.get(ELSLoggerService))` |
| Логирование в сервисах / контроллерах | `constructor(private readonly logger: ELSLoggerService)` |
| Статический конфиг на старте | `ELSModule.forRoot({ ... })` |
| Нужен `ConfigService` / async зависимости | `ELSModule.forRootAsync({ ... })` |
| HTTP middleware-style request-тэги | `ClsModule` + `ELSModule` вместе |
| Захват исключений в filter / interceptor | Инжект `ELSLoggerService`, вызов `.error(err.stack, context)` |

---

## Ключевые концепции

### Форма `LoggerService`

`ELSLoggerService` реализует Nest-`LoggerService` — кладётся в `app.useLogger()` без обёрток. Маппинг:

| Метод Nest | Уровень ELS |
|---|---|
| `log` | `info` |
| `error` | `error` |
| `warn` | `warning` |
| `debug` | `debug` |
| `verbose` | `debug` |
| `fatal` (Nest 10+) | `critical` |

### Контекст

`setContext('UsersController')` приклеит string-метку ко всем последующим вызовам — в панели видна как `meta.context`. Бонус: контроллеры автоматически получают имя класса как context, когда Nest создаёт логгер.

### Async-транспорт

Вызовы fire-and-forget. HTTP-транспорт батчит в фоне. `app.close()` запускает flush.

---

## Конфигурация

`ELSConfig` совпадает с базовым клиентом — см. [@inso_web/els-client](../js/README_RU.md). Ключевые поля:

| Опция | Описание |
|---|---|
| `endpoint` | URL ELS (обязательно) |
| `apiKey` | API-ключ (обязательно) |
| `appSlug` | Slug приложения (обязательно) |
| `serviceName` | Имя сервиса / модуля |
| `deploymentEnv` | `DEV` / `STAGING` / `PRODUCTION` |
| `appVersion` | Версия (≤128 символов) |
| `minLevel` | Минимальный уровень для отправки |

---

## Миграция

### С built-in Nest Logger

Стандартный `Logger` пишет в stdout. ELS пишет в фильтруемую панель. API совместим — переход в одну строчку в `main.ts`.

**Было:**

```ts
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // стандартный Logger пишет в консоль
  await app.listen(3000);
}
```

```ts
// some.service.ts
import { Logger } from '@nestjs/common';
@Injectable()
export class SomeService {
  private readonly logger = new Logger(SomeService.name);
  doWork() {
    this.logger.log('working');
    this.logger.error('boom', err.stack);
  }
}
```

**Стало:**

```ts
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(ELSLoggerService));
  await app.listen(3000);
}
```

```ts
// some.service.ts — изменения не нужны
import { Logger } from '@nestjs/common';
@Injectable()
export class SomeService {
  private readonly logger = new Logger(SomeService.name);
  // тот же API, теперь шлётся в ELS
}
```

| Nest built-in | ELS | Заметки |
|---|---|---|
| `new Logger(context)` | `ELSLoggerService` через DI | Или оставить `new Logger()` — `useLogger` его перенаправит |
| `logger.log()` | `logger.log()` | → `info` |
| `logger.error(msg, trace)` | `logger.error(msg, trace)` | Stack уходит в `meta.stack` |
| Цветной stdout | Plain stdout + удалённые события | Для локального dev оставьте `Console`-транспорт |

**Подводные камни:**

- Вызовы до bootstrap (до `app.useLogger(...)`) буферизуются при `bufferLogs: true`. Без буфера они уйдут только в stdout и не попадут в ELS.
- `Logger.overrideLogger(false)` отключает дефолтный — полезно в тестах.

---

### С nestjs-pino

**Было:**

```ts
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        autoLogging: true,
        genReqId: () => crypto.randomUUID(),
      },
    }),
  ],
})
export class AppModule {}
```

```ts
import { PinoLogger } from 'nestjs-pino';
@Injectable()
export class SomeService {
  constructor(private readonly logger: PinoLogger) {}
  doWork() { this.logger.info({ userId: 42 }, 'fetched'); }
}
```

**Стало:**

```ts
@Module({
  imports: [
    ELSModule.forRoot({
      endpoint: process.env.ELS_URL!,
      apiKey: process.env.ELS_API_KEY!,
      appSlug: 'my-nest-app',
      minLevel: 'info',
    }),
  ],
})
export class AppModule {}
```

```ts
import { ELSLoggerService } from '@inso_web/els-nest';
@Injectable()
export class SomeService {
  constructor(private readonly logger: ELSLoggerService) {}
  doWork() { this.logger.log('fetched', 'SomeService'); }
}
```

| nestjs-pino | ELS | Заметки |
|---|---|---|
| `LoggerModule.forRoot({ pinoHttp })` | `ELSModule.forRoot({ ... })` | Та же роль |
| `PinoLogger` (DI) | `ELSLoggerService` (DI) | Форма отличается — см. маппинг ниже |
| `logger.info(obj, msg)` | `logger.log(msg, context)` | Структурированную meta — через `child` |
| `pinoHttp.autoLogging` | Добавить middleware с `ClsModule` + `ELSLoggerService` | Из коробки auto-row на запрос не пишет |
| Bindings (`logger.setBindings`) | `child({ ...bindings })` на базовом клиенте | |

**Подводные камни:**

- Nest-`LoggerService` использует `(message, context?)` — `(obj, message)` pino не совпадает. Поменяйте порядок аргументов в вызовах.
- HTTP auto-logging опциональный — добавьте маленький middleware через `ClsModule`, если нужны per-request строки.

---

### С @sentry/nestjs

**Было:**

```ts
import { SentryModule } from '@sentry/nestjs';

@Module({
  imports: [
    SentryModule.forRoot({
      dsn: 'https://public@sentry.example.com/1',
      environment: 'production',
      release: process.env.BUILD_VERSION,
    }),
  ],
})
export class AppModule {}
```

```ts
import { SentryService } from '@sentry/nestjs';
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly sentry: SentryService) {}
  catch(exception: unknown, host: ArgumentsHost) {
    this.sentry.instance().captureException(exception);
  }
}
```

**Стало:**

```ts
@Module({
  imports: [
    ELSModule.forRoot({
      endpoint: process.env.ELS_URL!,
      apiKey: process.env.ELS_API_KEY!,
      appSlug: 'my-nest-app',
      deploymentEnv: 'PRODUCTION',
      appVersion: process.env.BUILD_VERSION,
    }),
  ],
})
export class AppModule {}
```

```ts
import { ELSLoggerService } from '@inso_web/els-nest';
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: ELSLoggerService) {}
  catch(exception: unknown, host: ArgumentsHost) {
    const err = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(err.message, err.stack, 'AllExceptionsFilter');
  }
}
```

| Sentry | ELS | Заметки |
|---|---|---|
| `SentryModule.forRoot({ dsn })` | `ELSModule.forRoot({ endpoint, apiKey, appSlug })` | Три явных поля вместо DSN |
| `sentry.captureException(err)` | `logger.error(err.message, err.stack)` | Stack уходит в `meta.stack` |
| `release` | `appVersion` | Любая строка ≤128 |
| `environment` | `deploymentEnv` | Фиксированный enum |
| Performance / tracing | не предоставляется | Sentry оставляйте рядом, если нужно |
| Source maps upload | не предоставляется | Парьте с другим инструментом, если критично |

**Подводные камни:**

- ELS не трассирует транзакции / спаны. Sentry Performance остаётся отдельно — конфликтов нет.
- Auto scope-теги Sentry повторите через `ClsModule` или `child`-bindings.

---

## Версионирование

Передавайте `BUILD_VERSION` через Dockerfile / CI. ELS принимает любой формат ≤128 символов: semver, CalVer, date-compact, git SHA, opaque.

```Dockerfile
ARG BUILD_VERSION=dev
ENV BUILD_VERSION=$BUILD_VERSION
```

```ts
ELSModule.forRoot({ ..., appVersion: process.env.BUILD_VERSION });
```

В панели появится виджет «Регрессии»: «эта ошибка впервые в v20260507120000, в v20260506180000 её не было».

---

## Quick reference

| Нужно | Делайте |
|---|---|
| Глобальный Nest-логгер | `app.useLogger(app.get(ELSLoggerService))` |
| Логгер через DI | `constructor(private readonly logger: ELSLoggerService)` |
| Async-конфиг из `ConfigService` | `ELSModule.forRootAsync({ ... })` |
| Request-scoped ID | `ClsModule.forRoot(...)` + `ELSModule.forRoot(...)` |
| Захват в filter | Инжект `ELSLoggerService`, `.error(msg, stack, ctx)` |
| Per-controller context | По умолчанию — Nest сам подставит имя класса |
| Подавить шумные уровни | `minLevel: 'warn'` |
| Буфер логов до bootstrap | `NestFactory.create(AppModule, { bufferLogs: true })` |

---

## Почему ELS

ELS для Node.js — сфокусированный SaaS для логирования, а не observability-комбайн. Оптимизирован под скорость захвата, AI-диагностику и дешевизну интеграции.

- **Меньше веса.** Нет peer-зависимости от `pino`, нет transport-пакетов.
- **Ноль внешних API.** Только `POST /errors[/batch]` и `GET /health`.
- **AI-диагностика** на каждом stack trace.
- **5 минут интеграции.** Зарегистрировать модуль, отдать в `useLogger`, готово.
- **Прозрачные тарифы.** Цены в личном кабинете.

| Возможность | ELS | Sentry | Datadog | Loki | LogRocket |
|---|---|---|---|---|---|
| AI на stack-trace | Встроено | Платный аддон | Платный аддон | Нет | Нет |
| Zero-dep SDK | Да | Нет | Нет | Нет | Нет |
| Free-tier retention | 24ч | 30д (лимит) | Только триал | Self-cost | 3–30д |
| Время setup | ~5 мин | 10–20 мин | 30–60 мин | Часы | 10–20 мин |

ELS **не предоставляет**: full APM / tracing, source-map upload, session replay, frontend RUM, метрики инфраструктуры. Парьте ELS с Grafana / Datadog или оставайтесь на Sentry, если нужно.

→ **Регистрация на [lk.insoweb.ru](https://lk.insoweb.ru)** для API-ключа.

---

## API

```ts
class ELSModule {
  static forRoot(config: ELSConfig): DynamicModule;
  static forRootAsync(opts: ELSAsyncOptions): DynamicModule;
}

class ELSLoggerService implements LoggerService {
  log(message: any, context?: string): void;
  error(message: any, trace?: string, context?: string): void;
  warn(message: any, context?: string): void;
  debug(message: any, context?: string): void;
  verbose(message: any, context?: string): void;
  setContext(context: string): void;
}
```

`ELSConfig` совпадает с базовым клиентом — см. [@inso_web/els-client](../js/README_RU.md).

---

## FAQ

**Работает с GraphQL / Microservices?** Да. `ELSLoggerService` — Nest-`LoggerService`, подключается к любому application context.

**Откуда приходят request ID?** В паре с `nestjs-cls` и `cls.getId()`; либо вручную задавайте `context` в каждом вызове.

**Можно несколько ELS-приложений в одном процессе?** Да — зарегистрируйте две `ELSModule` с разными `appSlug` и инжектьте разные `ELSLoggerService`.

---

## Другие ELS SDK

Тот же wire-формат, та же панель — выбирайте по стеку.

**Node.js**
- [`@inso_web/els-client`](../js/README_RU.md) — базовый TS / Node / browser клиент
- [`@inso_web/els-express`](../express/README_RU.md) — Express middleware
- [`@inso_web/els-next`](../next/README_RU.md) — хелперы для Next.js (App + Pages router)
- [`@inso_web/els-nest`](../nest/README_RU.md) — NestJS module (этот пакет)
- [`@inso_web/els-react`](../react/README_RU.md) — React Provider, hooks, ErrorBoundary
- [`@inso_web/els-vue`](../vue/README_RU.md) — Vue 3 plugin

**Другие стеки**
- [`Inso.Els`](../csharp/README_RU.md) — .NET (Core + ASP.NET Core + ILogger)
- [`io.github.official-inso:els-core`](../java/README_RU.md) — Java + Spring Boot starter + SLF4J
- [`github.com/official-inso/els-go`](../els-go/README_RU.md) — Go

→ **Обзор и сравнение:** [../README_RU.md](../README_RU.md) · [github.com/official-inso/els-go/blob/main/sdks/README_RU.md](https://github.com/official-inso/els-go/blob/main/sdks/README_RU.md)

---

## Тарифы

Free-тариф — **хранение логов 24 часа**. Полный прайс на **[lk.insoweb.ru](https://lk.insoweb.ru)**.

---

## Лицензия

[MIT](./LICENSE) © INSOWEB
