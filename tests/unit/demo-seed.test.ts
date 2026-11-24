import "@/../tests/setup";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as seedPost } from "@/app/api/demo/seed/route";
import { POST as resetPost } from "@/app/api/demo/reset/route";
import { seedDemoData, DEMO_USERS, DEMO_CONTRACTS } from "@/lib/supabase/seed";
import { createAdminSupabase } from "@/lib/supabase/admin";

describe("/api/demo/seed & reset idempotent and DEMO_MODE enforcement", () => {
  const admin = createAdminSupabase();
  const originalDemoMode = process.env.DEMO_MODE;

  it("returns 404 when DEMO_MODE is not true", async () => {
    process.env.DEMO_MODE = "false";
    try {
      const resSeed = await seedPost({} as Request, {} as any);
      expect(resSeed.status).toBe(404);

      const resReset = await resetPost({} as Request, {} as any);
      expect(resReset.status).toBe(404);
    } finally {
      process.env.DEMO_MODE = originalDemoMode;
    }
  });

  describe("seedDemoData structure and idempotency", () => {
    beforeAll(async () => {
      process.env.DEMO_MODE = "true";
    });

    it("seeds 1 landlord, 2 tenants, and 3 contracts with exact required states", async () => {
      const result = await seedDemoData(admin);

      expect(result.users.LANDLORD.phone).toBe("0900000001");
      expect(result.users.TENANT_1.phone).toBe("0900000002");
      expect(result.users.TENANT_2.phone).toBe("0900000003");

      // Verify Contract 1: PENDING_CONFIRMATION, deposit UNPAID
      const { data: c1 } = await admin
        .from("rental_contracts")
        .select("id, status")
        .eq("id", DEMO_CONTRACTS.CONTRACT_1)
        .single();
      expect(c1?.status).toBe("PENDING_CONFIRMATION");

      const { data: dep1 } = await admin
        .from("deposits")
        .select("status")
        .eq("contract_id", DEMO_CONTRACTS.CONTRACT_1)
        .single();
      expect(dep1?.status).toBe("UNPAID");

      // Verify Contract 2: ACTIVE, with overdue rent period
      const { data: c2 } = await admin
        .from("rental_contracts")
        .select("id, status")
        .eq("id", DEMO_CONTRACTS.CONTRACT_2)
        .single();
      expect(c2?.status).toBe("ACTIVE");

      const { data: p2 } = await admin
        .from("rent_periods")
        .select("status, late_days, late_fee")
        .eq("contract_id", DEMO_CONTRACTS.CONTRACT_2)
        .eq("period_no", 1)
        .single();
      expect(p2?.status).toBe("OVERDUE");
      expect(p2?.late_days).toBeGreaterThan(0);
      expect(p2?.late_fee).toBeGreaterThan(0);

      // Verify Contract 3: ACTIVE, deposit PENDING_DISPUTE, dispute IN_PROGRESS
      const { data: c3 } = await admin
        .from("rental_contracts")
        .select("id, status")
        .eq("id", DEMO_CONTRACTS.CONTRACT_3)
        .single();
      expect(c3?.status).toBe("ACTIVE");

      const { data: dep3 } = await admin
        .from("deposits")
        .select("status")
        .eq("contract_id", DEMO_CONTRACTS.CONTRACT_3)
        .single();
      expect(dep3?.status).toBe("PENDING_DISPUTE");

      const { data: disp3 } = await admin
        .from("disputes")
        .select("status")
        .eq("contract_id", DEMO_CONTRACTS.CONTRACT_3)
        .single();
      expect(disp3?.status).toBe("IN_PROGRESS");
    });

    it("is IDEMPOTENT: running seed a second time succeeds without errors or duplicates", async () => {
      // Run second time
      const result2 = await seedDemoData(admin);
      expect(result2).toBeDefined();

      const { count: contractCount } = await admin
        .from("rental_contracts")
        .select("id", { count: "exact", head: true })
        .in("id", Object.values(DEMO_CONTRACTS));

      expect(contractCount).toBe(3);

      const { count: periodCount } = await admin
        .from("rent_periods")
        .select("id", { count: "exact", head: true })
        .eq("contract_id", DEMO_CONTRACTS.CONTRACT_2);

      expect(periodCount).toBe(1);
    });

    afterAll(async () => {
      process.env.DEMO_MODE = originalDemoMode;
    });
  });
});
