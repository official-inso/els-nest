# @inso_web/els-nest

[![npm version](https://img.shields.io/npm/v/@inso_web/els-nest.svg)](https://www.npmjs.com/package/@inso_web/els-nest)
[![npm downloads](https://img.shields.io/npm/dm/@inso_web/els-nest.svg)](https://www.npmjs.com/package/@inso_web/els-nest)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![license MIT](https://img.shields.io/npm/l/@inso_web/els-nest.svg)](./LICENSE)

NestJS module and `LoggerService` for the **Inso Error Logs Service (ELS)** — a managed SaaS for centralised event logging (debug → fatal) with AI-assisted error triage. Drop-in replacement for the built-in `Logger`, `nestjs-pino`, and `@sentry/nestjs`. Supports `app.useLogger()`, DI injection, and request-scoped logging via `ClsModule`.

> 🇷🇺 [Русская версия → README_RU.md](README_RU.md)

---

## Table of contents

- [What you get](#what-you-get)
- [Install](#install)
- [Quick Start](#quick-start)
- [When to use what](#when-to-use-what)
- [Core concepts](#core-concepts)
- [Configuration](#configuration)
- [Migration](#migration)
  - [From built-in Nest Logger](#from-built-in-nest-logger)
  - [From nestjs-pino](#from-nestjs-pino)
  - [From @sentry/nestjs](#from-sentrynestjs)
- [Versioning](#versioning)
- [Quick reference](#quick-reference)
- [Why ELS](#why-els)
- [API](#api)
- [FAQ](#faq)
- [Other ELS SDKs](#other-els-sdks)
- [Pricing](#pricing)
- [License](#license)

---

## What you get

ELS ships with a built-in admin dashboard. Every event captured by this SDK lands there with full-text search, faceted filtering, AI-assisted diagnosis, and version-aware regression detection.

| | |
|---|---|
| ![Logs list](https://raw.githubusercontent.com/official-inso/els-go/main/docs/screenshots/01-error-logs-list.png) | ![Event detail](https://raw.githubusercontent.com/official-inso/els-go/main/docs/screenshots/02-event-detail-info.png) |
| Virtual table with facet sidebar (app, env, **version**, source, level, browser, IP, category). Live mode auto-refreshes every 5s. | Full event metadata: timestamps, geo, env, **app version**, fingerprint, session, repetition cards, in-session correlation. |
| ![AI diagnosis](https://raw.githubusercontent.com/official-inso/els-go/main/docs/screenshots/03-error-detail-ai.png) | ![Analytics](https://raw.githubusercontent.com/official-inso/els-go/main/docs/screenshots/04-analytics-dashboard.png) |
| Parsed stack trace + AI-assisted diagnosis: what broke, where, how to fix. | Timeline, donuts, top URLs/IPs, hourly heatmap, **version-regression widget**. |

---

## Install

```bash
npm install @inso_web/els-client @inso_web/els-nest
```

`@inso_web/els-client` is a peer dependency.

**Requirements:** NestJS 9+, Node.js 18+.

---

## Quick Start

### 1. Register the module

`app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ELSModule } from '@inso_web/els-nest';

@Module({
  imports: [
    ELSModule.forRoot({
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

Don't have an API key yet? **[Sign up at lk.insoweb.ru](https://lk.insoweb.ru)** — takes under a minute.

### 2. Hook it into `app.useLogger()`

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

Now every built-in `Logger.log()` / `error()` / `warn()` call in Nest goes to ELS.

### 3. Inject through DI

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

### 4. Request-scoped with CLS

Install `nestjs-cls` to propagate `requestId` automatically:

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

### 5. Async config (for `ConfigService`)

```ts
ELSModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    apiKey: config.getOrThrow('ELS_API_KEY'),
    appSlug: 'my-nest-app',
    deploymentEnv: config.get('NODE_ENV') === 'production' ? 'PRODUCTION' : 'DEV',
  }),
});
```

---

## When to use what

| Scenario | Use |
|---|---|
| Replace Nest's default logger globally | `app.useLogger(app.get(ELSLoggerService))` |
| Log inside services / controllers | `constructor(private readonly logger: ELSLoggerService)` |
| Static config at boot | `ELSModule.forRoot({ ... })` |
| Need `ConfigService` / async deps | `ELSModule.forRootAsync({ ... })` |
| HTTP middleware-style request tagging | `ClsModule` + `ELSModule` together |
| Capture exceptions from filters / interceptors | Inject `ELSLoggerService`, call `.error(err.stack, context)` |

---

## Core concepts

### `LoggerService` shape

`ELSLoggerService` implements Nest's `LoggerService` contract — drop it into `app.useLogger()` without wrappers. Mapping:

| Nest method | ELS level |
|---|---|
| `log` | `info` |
| `error` | `error` |
| `warn` | `warning` |
| `debug` | `debug` |
| `verbose` | `debug` |
| `fatal` (Nest 10+) | `critical` |

### Context tracking

`setContext('UsersController')` attaches a string label to subsequent calls — visible in the dashboard as a `meta.context` field. Bonus: child controllers automatically get their class name as the context when Nest creates the logger.

### Async transport

Calls are fire-and-forget. The HTTP transport batches in the background. `app.close()` triggers a flush.

---

## Configuration

`ELSConfig` matches the base client — see [@inso_web/els-client](https://github.com/official-inso/els-client). Key fields:

| Option | Description |
|---|---|
| `apiKey` | API key (required) |
| `appSlug` | App slug (required) |
| `serviceName` | Service / module name |
| `deploymentEnv` | `DEV` / `STAGING` / `PRODUCTION` |
| `appVersion` | Version (≤128 chars) |
| `minLevel` | Minimum level to send |

---

## Migration

### From built-in Nest Logger

The default `Logger` writes to stdout. ELS writes to a queryable dashboard. API is compatible — switching is a one-liner in `main.ts`.

**Before:**

```ts
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // default Logger prints to console
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

**After:**

```ts
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(ELSLoggerService));
  await app.listen(3000);
}
```

```ts
// some.service.ts — no changes required
import { Logger } from '@nestjs/common';
@Injectable()
export class SomeService {
  private readonly logger = new Logger(SomeService.name);
  // identical API, now ships to ELS
}
```

| Nest built-in | ELS | Notes |
|---|---|---|
| `new Logger(context)` | `ELSLoggerService` (via DI) | Or keep `new Logger()` — `useLogger` reroutes it |
| `logger.log()` | `logger.log()` | → `info` |
| `logger.error(msg, trace)` | `logger.error(msg, trace)` | Stack lands in `meta.stack` |
| Color-coded stdout | Plain stdout + remote events | Keep `Console` transport for local dev |

**Gotchas:**

- Pre-bootstrap calls (before `app.useLogger(...)`) buffer when `bufferLogs: true`. Without buffering they go to stdout-only and won't reach ELS.
- `Logger.overrideLogger(false)` disables the default — useful in tests.

---

### From nestjs-pino

**Before:**

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
// service
import { PinoLogger } from 'nestjs-pino';
@Injectable()
export class SomeService {
  constructor(private readonly logger: PinoLogger) {}
  doWork() { this.logger.info({ userId: 42 }, 'fetched'); }
}
```

**After:**

```ts
@Module({
  imports: [
    ELSModule.forRoot({
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

| nestjs-pino | ELS | Notes |
|---|---|---|
| `LoggerModule.forRoot({ pinoHttp })` | `ELSModule.forRoot({ ... })` | Same role |
| `PinoLogger` (DI) | `ELSLoggerService` (DI) | Different shape — see method map below |
| `logger.info(obj, msg)` | `logger.log(msg, context)` | Pass structured meta via `child` |
| `pinoHttp.autoLogging` | Add a request middleware with `ClsModule` + `ELSLoggerService` | No built-in request log row |
| Bindings (`logger.setBindings`) | `child({ ...bindings })` on the underlying client | |

**Gotchas:**

- Nest's `LoggerService` contract uses `(message, context?)` — pino's `(obj, message)` does not match. Re-order arguments at call sites.
- nestjs-pino's HTTP auto-logging is opt-in here — register a small middleware via `ClsModule` if you need per-request rows.

---

### From @sentry/nestjs

**Before:**

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
// in a filter
import { SentryService } from '@sentry/nestjs';
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly sentry: SentryService) {}
  catch(exception: unknown, host: ArgumentsHost) {
    this.sentry.instance().captureException(exception);
  }
}
```

**After:**

```ts
@Module({
  imports: [
    ELSModule.forRoot({
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

| Sentry | ELS | Notes |
|---|---|---|
| `SentryModule.forRoot({ dsn })` | `ELSModule.forRoot({ apiKey, appSlug })` | Three explicit fields instead of DSN |
| `sentry.captureException(err)` | `logger.error(err.message, err.stack)` | Stack lands in `meta.stack` |
| `release` | `appVersion` | Any string ≤128 chars |
| `environment` | `deploymentEnv` | Fixed enum |
| Performance / tracing | Not provided | Keep Sentry alongside if needed |
| Source maps upload | Not provided | Same — pair with another tool if critical |

**Gotchas:**

- ELS doesn't trace transactions or spans. Sentry Performance integrations stay — they don't conflict.
- Sentry's automatic scope tags need to be replicated via `ClsModule` or `child` bindings.

---

## Versioning

Pass `BUILD_VERSION` through Dockerfile / CI. ELS accepts any format ≤128 chars: semver, CalVer, date-compact, git SHA, opaque.

```Dockerfile
ARG BUILD_VERSION=dev
ENV BUILD_VERSION=$BUILD_VERSION
```

```ts
ELSModule.forRoot({ ..., appVersion: process.env.BUILD_VERSION });
```

In the dashboard you get a "Regressions" widget: "this error first seen in v20260507120000, not present in v20260506180000."

---

## Quick reference

| Need | Use |
|---|---|
| Global Nest logger | `app.useLogger(app.get(ELSLoggerService))` |
| Logger via DI | `constructor(private readonly logger: ELSLoggerService)` |
| Async config from `ConfigService` | `ELSModule.forRootAsync({ ... })` |
| Request-scoped IDs | `ClsModule.forRoot(...)` + `ELSModule.forRoot(...)` |
| Capture in a filter | Inject `ELSLoggerService`, call `.error(msg, stack, ctx)` |
| Per-controller context | Default — Nest passes the class name automatically |
| Suppress noisy levels | `minLevel: 'warn'` |
| Buffer logs before bootstrap | `NestFactory.create(AppModule, { bufferLogs: true })` |

---

## Why ELS

ELS for Node.js is a focused logging SaaS, not a full observability suite. It optimises for capture speed, AI-driven triage, and a low integration cost.

- **Lower weight.** No `pino` peer, no transport packages.
- **Zero external API calls.** Only `POST /errors[/batch]` and `GET /health`.
- **AI-assisted diagnosis** on every stack trace.
- **5-minute integration.** Register the module, hand it to `useLogger`, done.
- **Predictable price.** Tariffs in the dashboard.

### Detailed comparison

| Category | ELS | Sentry | Datadog / New Relic | Grafana Loki | LogRocket / Logtail / BetterStack |
|---|---|---|---|---|---|
| Hosting model | Managed SaaS | SaaS or self-hosted | SaaS only | Self-hosted / Grafana Cloud | SaaS |
| SDK runtime deps | Zero | Medium (sub-SDKs, integrations) | Heavy (agent + tracing) | Promtail / agent | Medium |
| Typical integration time | ~5 min | 10–20 min | 30–60 min | Hours to days | 10–20 min |
| AI-assisted triage | Built-in | Paid add-on | Paid add-on | None | None |
| Error grouping / fingerprint | Yes | Yes | Yes | Manual via LogQL | Partial |
| Source-map upload | No | Yes | Yes | n/a | Partial |
| Session replay (frontend) | No | Paid | Paid | n/a | Yes (core) |
| Distributed tracing / APM | No | Partial | Yes (core) | Yes with Tempo | No |
| Infrastructure metrics | No | No | Yes (core) | Yes with Mimir | No |
| Free tier log retention | 24 hours | 30 days (limited volume) | Trial only | Self-cost | 3–30 days |
| Russian-language support / docs | Native | Community | Limited | Community | None |

### When ELS is the wrong choice

- You need a single vendor for **APM + logs + metrics** under one bill — go Datadog or New Relic.
- Your frontend bug triage relies on **DOM session replay** — go LogRocket or Sentry Replay.
- You ship a **public mobile app** and need crash symbolication + ANR detection — Firebase Crashlytics or Sentry Mobile.

For everything else — backend errors, frontend JS errors, request logs, structured app events with version-aware analytics — ELS is built to be the cheapest path to a working dashboard.

→ **Sign up at [lk.insoweb.ru](https://lk.insoweb.ru)** to grab an API key.

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

`ELSConfig` matches the base client — see [@inso_web/els-client](https://github.com/official-inso/els-client).

---

## FAQ

**Works with GraphQL / Microservices?** Yes. `ELSLoggerService` is a Nest `LoggerService` — attach to any application context.

**Where do request IDs come from?** Pair with `nestjs-cls` and call `cls.getId()`; or set `context` on each call manually.

**Can I have multiple ELS apps in one process?** Yes — register two `ELSModule` instances with different `appSlug` and inject distinct `ELSLoggerService` providers.

---

## Other ELS SDKs

Same wire format, same dashboard — pick by stack.

**Node.js family**
- [`@inso_web/els-client`](https://github.com/official-inso/els-client) — base TS / Node / browser client
- [`@inso_web/els-express`](https://github.com/official-inso/els-express) — Express middleware
- [`@inso_web/els-next`](https://github.com/official-inso/els-next) — Next.js helpers (App + Pages router)
- [`@inso_web/els-nest`](https://github.com/official-inso/els-nest) — NestJS module (this repo)
- [`@inso_web/els-react`](https://github.com/official-inso/els-react) — React Provider, hooks, ErrorBoundary
- [`@inso_web/els-vue`](https://github.com/official-inso/els-vue) — Vue 3 plugin

**Other stacks**
- [`Inso.Els`](https://github.com/official-inso/els-csharp) — .NET (Core + ASP.NET Core + ILogger)
- [`io.github.official-inso:els-core`](https://github.com/official-inso/els-java) — Java + Spring Boot starter + SLF4J
- [`github.com/official-inso/els-go`](https://github.com/official-inso/els-go) — Go

---

## Pricing

Free tier — **24-hour log retention**. See **[lk.insoweb.ru](https://lk.insoweb.ru)** for the full tariff matrix.

---

## License

[MIT](./LICENSE) © INSOWEB
