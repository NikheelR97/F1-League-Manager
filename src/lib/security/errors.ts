import { MAX_ERROR_MESSAGE_LENGTH } from "@/lib/constants";

export interface SanitizedError {
  error: string;
}

export function sanitizeError(error: unknown, production = true): SanitizedError {
  if (production) {
    return { error: "Something went wrong" };
  }

  if (error instanceof Error) {
    return { error: error.message.slice(0, MAX_ERROR_MESSAGE_LENGTH) };
  }

  return { error: "Unknown error" };
}
