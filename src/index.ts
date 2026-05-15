export { ELSLoggerService } from "./ELSLogger.service.js";
export { ELSModule } from "./ELS.module.js";
export type { ELSModuleAsyncOptions } from "./ELS.module.js";
export { ELS_CLIENT } from "./ELS.constants.js";

// Re-export ELSClient и типы — чтобы можно было ставить только @inso_web/els-nest
export { ELSClient } from "@inso_web/els-client";
export type {
  ELSConfig,
  ErrorEntry,
  Logger,
  LogLevel,
} from "@inso_web/els-client";
