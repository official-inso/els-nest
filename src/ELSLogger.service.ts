import { Injectable, Inject, type LoggerService } from "@nestjs/common";
import type { ELSClient } from "@inso_web/els-client";
import { ELS_CLIENT } from "./ELS.constants.js";

/**
 * Имплементация NestJS LoggerService поверх ELSClient.
 *
 * Подключается через `app.useLogger(app.get(ELSLoggerService))`.
 * После этого вся встроенная Nest Logger подсистема (`new Logger(ContextName).log()`,
 * `console.log` от NestJS, ошибки бутстрапа) автоматически летит в ELS.
 */
@Injectable()
export class ELSLoggerService implements LoggerService {
  constructor(@Inject(ELS_CLIENT) private readonly client: ELSClient) {}

  log(message: any, ...optionalParams: any[]): void {
    const ctx = this.extractContext(optionalParams);
    this.client.child(ctx).info(this.toLogArg(message));
  }

  error(message: any, ...optionalParams: any[]): void {
    const ctx = this.extractContext(optionalParams);
    if (message instanceof Error) {
      this.client.child(ctx).error(message);
      return;
    }
    // Nest signature: error(message, trace?, context?)
    const trace = optionalParams[0];
    const ctxLogger = this.client.child(ctx);
    const msgStr = this.toMessageString(message);
    if (typeof trace === "string") {
      ctxLogger.error({ stack: trace }, msgStr);
    } else {
      ctxLogger.error(msgStr);
    }
  }

  warn(message: any, ...optionalParams: any[]): void {
    this.client.child(this.extractContext(optionalParams)).warn(this.toLogArg(message));
  }

  debug?(message: any, ...optionalParams: any[]): void {
    this.client.child(this.extractContext(optionalParams)).debug(this.toLogArg(message));
  }

  verbose?(message: any, ...optionalParams: any[]): void {
    this.client.child(this.extractContext(optionalParams)).trace(this.toLogArg(message));
  }

  fatal?(message: any, ...optionalParams: any[]): void {
    this.client.child(this.extractContext(optionalParams)).fatal(this.toLogArg(message));
  }

  /**
   * Nest передаёт context (имя класса/модуля) последним строковым аргументом
   * либо через `setContext`. Извлекаем его если это последний строковый параметр.
   */
  private extractContext(params: any[]): Record<string, unknown> {
    const last = params[params.length - 1];
    if (typeof last === "string" && params.length > 0) {
      return { context: last };
    }
    return {};
  }

  /** Для info/warn/debug/trace/fatal — принимают object | string */
  private toLogArg(message: any): object | string {
    if (typeof message === "string") return message;
    if (message && typeof message === "object") return message;
    return String(message);
  }

  /** Для error() — приводим к string чтобы попасть во второй параметр Logger.error */
  private toMessageString(message: any): string {
    if (typeof message === "string") return message;
    if (message instanceof Error) return message.message;
    if (message && typeof message === "object") {
      try {
        return JSON.stringify(message);
      } catch {
        return String(message);
      }
    }
    return String(message);
  }
}
