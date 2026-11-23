import { NextResponse } from "next/server";
import { z } from "zod";
import { InvalidTransitionError } from "@/domain/states";
import { vi, type ApiErrorCode } from "@/i18n/vi";

const HTTP_STATUS: Record<ApiErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  INVALID_TRANSITION: 409,
  DISPUTE_LOCKED: 409,
  PAYMENT_NOT_CONFIRMED: 409,
  RATE_LIMITED: 429,
  ONCHAIN_FAILED: 502,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly details?: unknown,
    message?: string,
  ) {
    super(message ?? vi.errors[code]);
    this.name = "ApiError";
  }
}

export type ApiSuccess<T> = { data: T };
export type ApiFailure = { error: { code: ApiErrorCode; message: string; details?: unknown } };

export function ok<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ data }, { status });
}

export function toErrorResponse(error: unknown): NextResponse<ApiFailure> {
  const apiError =
    error instanceof ApiError
      ? error
      : error instanceof InvalidTransitionError
        ? new ApiError("INVALID_TRANSITION")
        : new ApiError("INTERNAL_ERROR");

  // Chỉ log tên lỗi: message của thư viện có thể chứa secret hoặc dữ liệu cá nhân.
  if (apiError.code === "INTERNAL_ERROR") {
    console.error("[api] unhandled error:", error instanceof Error ? error.name : typeof error);
  }

  return NextResponse.json(
    { error: { code: apiError.code, message: apiError.message, details: apiError.details } },
    { status: HTTP_STATUS[apiError.code] },
  );
}

export function withApi<Context>(handler: (request: Request, context: Context) => Promise<Response>) {
  return async (request: Request, context: Context): Promise<Response> => {
    try {
      return await handler(request, context);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export async function parseJson<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
): Promise<z.output<Schema>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError("VALIDATION_ERROR");
  }
  const result = schema.safeParse(body);
  if (!result.success) throw new ApiError("VALIDATION_ERROR", z.flattenError(result.error));
  return result.data;
}
