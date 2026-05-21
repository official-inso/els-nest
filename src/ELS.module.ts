import { Module, type DynamicModule, type Provider } from "@nestjs/common";
import { ELSClient, type ELSConfig } from "@inso_web/els-client";
import { ELSLoggerService } from "./ELSLogger.service.js";
import { ELS_CLIENT } from "./ELS.constants.js";

export interface ELSModuleAsyncOptions {
  inject?: any[];
  imports?: any[];
  useFactory: (...args: any[]) => ELSConfig | Promise<ELSConfig>;
}

/**
 * Global NestJS module for `@inso_web/els-client`.
 *
 * Registers an {@link ELSClient} as a DI provider under the `ELS_CLIENT` token
 * plus {@link ELSLoggerService} for use with `app.useLogger()`.
 *
 * @example
 * ELSModule.forRoot({ apiKey: process.env.ELS_API_KEY!, appSlug: "my-app" })
 */
@Module({})
export class ELSModule {
  static forRoot(config: ELSConfig): DynamicModule {
    const clientProvider: Provider = {
      provide: ELS_CLIENT,
      useValue: new ELSClient(config),
    };
    return {
      module: ELSModule,
      providers: [clientProvider, ELSLoggerService],
      exports: [clientProvider, ELSLoggerService],
      global: true,
    };
  }

  static forRootAsync(opts: ELSModuleAsyncOptions): DynamicModule {
    const clientProvider: Provider = {
      provide: ELS_CLIENT,
      inject: opts.inject || [],
      useFactory: async (...args: any[]) => {
        const config = await opts.useFactory(...args);
        return new ELSClient(config);
      },
    };
    return {
      module: ELSModule,
      imports: opts.imports || [],
      providers: [clientProvider, ELSLoggerService],
      exports: [clientProvider, ELSLoggerService],
      global: true,
    };
  }
}
