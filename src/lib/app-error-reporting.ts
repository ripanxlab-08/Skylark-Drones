import { captureAppError } from "./error-capture";

export function reportAppRuntimeError(error: unknown, context: Record<string, unknown> = {}) {
  captureAppError(error, context);
}
