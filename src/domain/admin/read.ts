import { z } from "zod";
import { ApiError } from "@/lib/api/http";
import type { Page } from "./dto";

type Result<T> = { data: T | null; error: unknown; count?: number | null };

export function read<T>(result: Result<unknown>): T {
  if (result.error) throw new ApiError("INTERNAL_ERROR");
  return result.data as T;
}

export async function readAll<T>(query: (from: number, to: number) => PromiseLike<Result<unknown>>) {
  const size = 500;
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const chunk = read<T[]>(await query(from, from + size - 1));
    rows.push(...chunk);
    if (chunk.length < size) return rows;
  }
}

const listSchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  status: z.string().max(50).optional(),
  role: z.string().max(50).optional(),
  sort: z.string().max(50).optional(),
  action: z.string().max(80).optional(),
});

export type AdminQuery = z.output<typeof listSchema>;

export function parseList(request: Request): AdminQuery {
  const parsed = listSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) throw new ApiError("VALIDATION_ERROR");
  return parsed.data;
}

export function bounds({ page, pageSize }: AdminQuery): [number, number] {
  const from = (page - 1) * pageSize;
  return [from, from + pageSize - 1];
}

export function pageOf<T>(items: T[], result: Result<unknown>, { page, pageSize }: AdminQuery): Page<T> {
  return { items, total: result.count ?? 0, page, pageSize };
}

export function like(query: string): string {
  return `%${query.replace(/[\\%_*]/g, "\\$&")}%`;
}

export function ilikeAny(columns: string[], query: string): string {
  return columns.map((column) => `${column}.ilike.${JSON.stringify(like(query))}`).join(",");
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isId(value: unknown): value is string {
  return typeof value === "string" && uuid.test(value);
}

export function requireId(value: string): string {
  if (!isId(value)) throw new ApiError("NOT_FOUND");
  return value;
}

export function maskPhone(phone: string | null): string {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return digits.length >= 9 ? `${digits.slice(0, 3)}***${digits.slice(-4)}` : "***";
}

export function displayText(value: string | null): string | null {
  if (!value) return null;
  return (
    value
      .replace(/\b(?:secret|encrypted|session)\S*|\bS[A-Z2-7]{55}\b/gi, "***")
      .replace(/\+?\d(?:[ .()-]*\d){8,}/g, "***")
      .trim()
      .slice(0, 120) || null
  );
}

export function shortName(value: string | null): string | null {
  const name = displayText(value)?.replace(/\s+\([^()]*\)$/, "");
  if (!name) return null;
  const words = name.split(/\s+/);
  return words
    .map((word, index) => (index === 0 || index === words.length - 1 ? word : `${word[0]}.`))
    .join(" ");
}
