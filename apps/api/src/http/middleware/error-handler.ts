import type { ErrorHandler } from "hono";
import { ZodError } from "zod";
import { HttpError } from "../../shared/http-error";

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

  console.error(error);

  return c.json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Unexpected server error."
    }
  }, 500);
};
