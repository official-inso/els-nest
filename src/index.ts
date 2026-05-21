export { ELSLoggerService } from "./ELSLogger.service.js";
export { ELSModule } from "./ELS.module.js";
export type { ELSModuleAsyncOptions } from "./ELS.module.js";
export { ELS_CLIENT } from "./ELS.constants.js";

// Re-export ELSClient and types so apps can depend on @inso_web/els-nest alone.
export { ELSClient } from "@inso_web/els-client";
export type {
  ELSConfig,
  ErrorEntry,
  Logger,
  LogLevel,
} from "@inso_web/els-client";
