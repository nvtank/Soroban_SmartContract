import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTRACT_STATUSES, DEPOSIT_STATUSES, DISPUTE_STATUSES, RENT_STATUSES } from "@/domain/states";

const rust = readFileSync(resolve(process.cwd(), "contracts/rentflow/src/types.rs"), "utf8");

function rustVariants(name: string): string[] {
  const body = rust.match(new RegExp(`pub enum ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1];
  if (!body) throw new Error(`Missing Rust enum ${name}`);
  return [...body.matchAll(/(\w+) = (\d+),/g)]
    .sort((a, b) => Number(a[2]) - Number(b[2]))
    .map((m) => m[1].replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase());
}

describe("TypeScript and Soroban enums", () => {
  it.each([
    ["ContractStatus", CONTRACT_STATUSES],
    ["DepositStatus", DEPOSIT_STATUSES],
    ["RentStatus", RENT_STATUSES],
    ["DisputeStatus", DISPUTE_STATUSES],
  ])("%s matches by name and code", (name, statuses) => {
    expect(rustVariants(name)).toEqual([...statuses]);
  });
});
