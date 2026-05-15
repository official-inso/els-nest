# @inso_web/els-nest

[![npm version](https://img.shields.io/npm/v/@inso_web/els-nest.svg)](https://www.npmjs.com/package/@inso_web/els-nest)
[![npm downloads](https://img.shields.io/npm/dm/@inso_web/els-nest.svg)](https://www.npmjs.com/package/@inso_web/els-nest)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![license MIT](https://img.shields.io/npm/l/@inso_web/els-nest.svg)](./LICENSE)

NestJS module и `LoggerService` для **Error Logs Service (ELS)**. Drop-in замена встроенного `Logger`, `nestjs-pino`, `pino-nestjs`. Поддержка `app.useLogger()`, DI инжекта и request-scoped логирования через `ClsModule`.

## Что внутри

- `ELSModule.forRoot({...})` — глобальный module с конфигурацией клиента.
- `ELSLoggerService` — реализует Nest `LoggerService` для `app.useLogger()` и `@Inject(Logger)`.
- Опционально request-scoped: с `ClsModule` (от nestjs-cls) автоматически добавляет `requestId` к каждому событию.

---

## UI: что вы получаете

ELS из коробки даёт админ-панель — все события из вашего NestJS приложения попадают в неё.

### Список логов с фильтрами

![Список логов](https://raw.githubusercontent.com/official-inso/els-go/main/docs/screenshots/01-error-logs-list.png)

Виртуальная таблица всех событий: trace ID, приложение, источник, уровень, сообщение, страница, IP. Левый сайдбар — фасеты по приложению, окружению, **версии**, источнику, уровню, браузеру, языку, IP, категории ошибки.

### Детальная карточка с метаданными

![Детальная карточка](https://raw.githubusercontent.com/official-inso/els-go/main/docs/screenshots/02-event-detail-info.png)

Время сервера/клиента, IP с гео, окружение, **версия приложения**, fingerprint, session ID. Карточки повторений и корреляция событий справа.

### AI-диагностика ошибок

![AI диагностика](https://raw.githubusercontent.com/official-inso/els-go/main/docs/screenshots/03-error-detail-ai.png)

Stack trace с распарсенными фреймами + AI-анализ что именно сломалось и как чинить.

### Аналитика и регрессии по версиям

![Аналитика](https://raw.githubusercontent.com/official-inso/els-go/main/docs/screenshots/04-analytics-dashboard.png)

Total / critical+errors / warnings / error rate. AI-обзор слева, timeline в центре, donut'ы по приложению/источнику/уровню. **Виджет «Регрессии»**: какие fingerprint'ы появились впервые в свежей версии и какие пропали.

### Управление API-ключами

![API ключи](https://raw.githubusercontent.com/official-inso/els-go/main/docs/screenshots/05-api-keys.png)
![Действия с ключом](https://raw.githubusercontent.com/official-inso/els-go/main/docs/screenshots/06-api-key-actions.png)

Scoped-ключи (write/read/read-any), live/test environments, ротация без даунтайма.

### Избранные события

![Избранные](https://raw.githubusercontent.com/official-inso/els-go/main/docs/screenshots/07-favorites.png)

Закладки на конкретные trace ID — для расследований, не теряются между сессиями.

---

## Установка

```bash
npm install @inso_web/els-client @inso_web/els-nest
```

`@inso_web/els-client` — peer-зависимость.

---

## Quick Start

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

Теперь все встроенные `Logger.log()` / `error()` / `warn()` Nest идут в ELS.

### 3. Используйте через DI

```ts
import { Injectable, Logger } from '@nestjs/common';
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

### 4. Request-scoped с CLS

Установите `nestjs-cls`, чтобы `requestId` автоматически проставлялся к каждому логу:

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

---

## Версионирование

Прокидывайте `BUILD_VERSION` через Dockerfile / CI и передавайте в `appVersion`. ELS принимает любой формат до 128 символов: `semver`, `CalVer`, date-compact (`YYYYMMDDHHmmss`), git SHA, opaque.

```Dockerfile
ARG BUILD_VERSION=dev
ENV BUILD_VERSION=$BUILD_VERSION
```

```ts
ELSModule.forRoot({ ..., appVersion: process.env.BUILD_VERSION });
```

В аналитике появляется виджет регрессий: «эта ошибка впервые увидена в v20260507120000, в v20260506180000 её не было».

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

`ELSConfig` совпадает с базовым клиентом — см. [@inso_web/els-client](https://www.npmjs.com/package/@inso_web/els-client).

---

## FAQ

**Чем отличается от nestjs-pino?** API совместим, без runtime-зависимости от `pino` и без отдельного transport-пакета — события сразу уходят в ELS.

**Можно использовать с GraphQL/Microservices?** Да, `ELSLoggerService` — это `LoggerService`, его можно подключить к любому Nest-приложению.

---

## License

[MIT](./LICENSE) © INSOWEB
