import { describe, expect, it } from "vitest";
import {
  advanceStepIndex,
  canUseNextButton,
  clearTourProgress,
  extractRoomTourKey,
  hasFinishedTour,
  loadTourProgress,
  mapUserRoleToTourRole,
  markTourFinished,
  previousStepIndex,
  saveTourProgress,
  shouldAutoStartTour,
  TOUR_DISABLED_KEY,
  tourCompletedKey,
} from "@/components/app/tour/state";
import { getTourSteps, LANDLORD_TOUR_STEPS, TENANT_TOUR_STEPS } from "@/components/app/tour/tours";
import type { StorageLike } from "@/components/app/tour/types";

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => (map.has(key) ? map.get(key)! : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

describe("tour state machine & persistence", () => {
  it("maps application user roles to tour roles", () => {
    expect(mapUserRoleToTourRole("TENANT")).toBe("tenant");
    expect(mapUserRoleToTourRole("LANDLORD")).toBe("landlord");
    expect(mapUserRoleToTourRole("ADMIN_DEMO")).toBeNull();
    expect(mapUserRoleToTourRole(null)).toBeNull();
  });

  it("advances, rewinds, and finishes step indices properly", () => {
    expect(advanceStepIndex(0, 5)).toEqual({ stepIndex: 1, finished: false });
    expect(advanceStepIndex(3, 5)).toEqual({ stepIndex: 4, finished: false });
    expect(advanceStepIndex(4, 5)).toEqual({ stepIndex: 4, finished: true });

    expect(previousStepIndex(3)).toBe(2);
    expect(previousStepIndex(1)).toBe(0);
    expect(previousStepIndex(0)).toBe(0);
  });

  it("saves, restores, and clears cross-page progress in sessionStorage", () => {
    const session = createMemoryStorage();
    expect(loadTourProgress(session)).toBeNull();

    saveTourProgress(session, "tenant", 4);
    expect(loadTourProgress(session)).toEqual({ role: "tenant", stepIndex: 4 });

    clearTourProgress(session);
    expect(loadTourProgress(session)).toBeNull();
  });

  it("ignores malformed progress data in sessionStorage", () => {
    const session = createMemoryStorage();
    session.setItem("rentflow.tour.progress.v1", "{bad-json");
    expect(loadTourProgress(session)).toBeNull();

    session.setItem("rentflow.tour.progress.v1", JSON.stringify({ role: "admin", stepIndex: 0 }));
    expect(loadTourProgress(session)).toBeNull();

    session.setItem("rentflow.tour.progress.v1", JSON.stringify({ role: "tenant", stepIndex: -2 }));
    expect(loadTourProgress(session)).toBeNull();
  });

  it("does not auto-start when disabled, already finished, or already in progress", () => {
    const local = createMemoryStorage();
    const session = createMemoryStorage();

    // Fresh tenant user -> auto-start
    expect(shouldAutoStartTour("tenant", local, session)).toBe(true);

    // Disabled flag for legacy E2E -> do not auto-start
    local.setItem(TOUR_DISABLED_KEY, "1");
    expect(shouldAutoStartTour("tenant", local, session)).toBe(false);
    local.removeItem(TOUR_DISABLED_KEY);

    // Finished or skipped -> writes rentflow.tour.<role>.v1 and blocks auto-start for that role only
    markTourFinished(local, session, "tenant", "skipped");
    expect(local.getItem(tourCompletedKey("tenant"))).toBe("skipped");
    expect(hasFinishedTour(local, "tenant")).toBe(true);
    expect(shouldAutoStartTour("tenant", local, session)).toBe(false);
    expect(shouldAutoStartTour("landlord", local, session)).toBe(true);

    // Active session progress -> handled by restore rather than fresh auto-start
    saveTourProgress(session, "landlord", 2);
    expect(shouldAutoStartTour("landlord", local, session)).toBe(false);
  });

  it("enforces manual click on real side-effect steps (canUseNextButton)", () => {
    const submitStep = TENANT_TOUR_STEPS.find((s) => s.id === "tenant-stepup-submit");
    expect(submitStep).toBeDefined();
    expect(submitStep!.mode).toBe("click");
    expect(submitStep!.safeAutoClick).toBe(false);
    expect(canUseNextButton(submitStep!)).toBe(false);

    const openStep = TENANT_TOUR_STEPS.find((s) => s.id === "tenant-open-301");
    expect(openStep).toBeDefined();
    expect(canUseNextButton(openStep!)).toBe(true);

    const infoStep = LANDLORD_TOUR_STEPS[0];
    expect(canUseNextButton(infoStep)).toBe(true);
  });

  it("extracts room key accurately for data-tour-key matching", () => {
    expect(extractRoomTourKey("Phòng 301 - Tòa Sunrise")).toBe("301");
    expect(extractRoomTourKey("Phòng 402 - Căn hộ Moonlight")).toBe("402");
    expect(extractRoomTourKey("Phòng 102 - Nhà phố Green")).toBe("102");
    expect(extractRoomTourKey("Căn hộ 501 - Chung cư The Manor")).toBe("501");
  });

  it("keeps both tours free of banned Web3 jargon and strictly using data-tour selectors", () => {
    const jargonRegex = /\bxlm\b|\bgas\b|seed\s*phrase/i;
    for (const role of ["tenant", "landlord"] as const) {
      const steps = getTourSteps(role);
      expect(steps.length).toBeGreaterThanOrEqual(8);
      for (const step of steps) {
        expect(step.target).toContain("[data-tour=");
        expect(`${step.title} ${step.body}`).not.toMatch(jargonRegex);
      }
    }
  });
});
