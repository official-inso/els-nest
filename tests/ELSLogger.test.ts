import { describe, it, expect, vi, beforeEach } from "vitest";
import { ELSLoggerService } from "../src/ELSLogger.service";

function createMockClient() {
  const calls: Array<{ method: string; bindings: Record<string, unknown>; args: any[] }> = [];
  const mkChild = (bindings: Record<string, unknown>): any => ({
    info: (...args: any[]) => calls.push({ method: "info", bindings, args }),
    warn: (...args: any[]) => calls.push({ method: "warn", bindings, args }),
    error: (...args: any[]) => calls.push({ method: "error", bindings, args }),
    debug: (...args: any[]) => calls.push({ method: "debug", bindings, args }),
    trace: (...args: any[]) => calls.push({ method: "trace", bindings, args }),
    fatal: (...args: any[]) => calls.push({ method: "fatal", bindings, args }),
    child: (more: Record<string, unknown>) => mkChild({ ...bindings, ...more }),
    flush: async () => {},
  });
  return {
    child: (bindings: Record<string, unknown>) => mkChild(bindings),
    calls,
  } as any;
}

describe("ELSLoggerService", () => {
  let mockClient: any;
  let service: ELSLoggerService;

  beforeEach(() => {
    mockClient = createMockClient();
    service = new ELSLoggerService(mockClient);
  });

  it("log() calls client.child().info()", () => {
    service.log("hello");
    expect(mockClient.calls).toHaveLength(1);
    expect(mockClient.calls[0].method).toBe("info");
    expect(mockClient.calls[0].args[0]).toBe("hello");
  });

  it("log(msg, context) extracts context binding", () => {
    service.log("user created", "UserService");
    expect(mockClient.calls[0].bindings).toEqual({ context: "UserService" });
  });

  it("error(Error) passes Error directly", () => {
    const err = new Error("boom");
    service.error(err);
    expect(mockClient.calls[0].method).toBe("error");
    expect(mockClient.calls[0].args[0]).toBe(err);
  });

  it("error(message, trace, context) wraps as stack object", () => {
    service.error("DB failed", "stack trace here", "DbModule");
    const call = mockClient.calls[0];
    expect(call.method).toBe("error");
    expect(call.bindings).toEqual({ context: "DbModule" });
    expect(call.args[0]).toEqual({ stack: "stack trace here" });
    expect(call.args[1]).toBe("DB failed");
  });

  it("warn maps to warn", () => {
    service.warn("careful", "MyService");
    expect(mockClient.calls[0].method).toBe("warn");
    expect(mockClient.calls[0].bindings).toEqual({ context: "MyService" });
  });

  it("verbose maps to trace", () => {
    service.verbose?.("verbose message");
    expect(mockClient.calls[0].method).toBe("trace");
  });

  it("fatal calls fatal", () => {
    service.fatal?.("die", "FatalContext");
    expect(mockClient.calls[0].method).toBe("fatal");
    expect(mockClient.calls[0].bindings).toEqual({ context: "FatalContext" });
  });
});
