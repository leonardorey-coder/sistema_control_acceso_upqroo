import type { ErrorHandler } from "hono";
import { ZodError } from "zod";
import { HttpError } from "../../shared/http-error";

function isPostgresError(error: unknown): error is { code: string; constraint?: string; detail?: string } {
  return Boolean(error && typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string");
}

export const errorHandler: ErrorHandler = (error, c) => {
  if (error instanceof HttpError) {
    return c.json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    }, error.status);
  }

  if (error instanceof ZodError) {
    return c.json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request payload.",
        details: error.flatten()
      }
    }, 400);
  }

  if (isPostgresError(error)) {
    if (error.code === "23505") {
      return c.json({
        error: {
          code: "CONFLICT",
          message: "The requested operation conflicts with an existing record.",
          details: {
            constraint: error.constraint,
            detail: error.detail
          }
        }
      }, 409);
    }

    if (error.code === "23503") {
      return c.json({
        error: {
          code: "FOREIGN_KEY_VIOLATION",
          message: "The requested operation references a record that does not exist.",
          details: {
            constraint: error.constraint,
            detail: error.detail
          }
        }
      }, 400);
    }
  }

  console.error(error);

  return c.json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Unexpected server error."
    }
  }, 500);
};
