import { describe, expect, it } from "vitest";
import {
  areaPath,
  clampTooltipPosition,
  computeDonutSlices,
  describeArc,
  formatCompactVi,
  formatDateFullVi,
  formatDateShortVi,
  formatNumberVi,
  formatPercentVi,
  formatVndCompactVi,
  formatVndVi,
  linearScale,
  nearestIndex,
  niceScale,
  pickTickIndices,
  smoothPath,
  trendPercent,
} from "@/components/admin/charts";

describe("admin charts math", () => {
  it("niceScale produces clean non-negative domain and evenly spaced ticks", () => {
    const s = niceScale(0, 18_500_000, 4);
    expect(s.min).toBe(0);
    expect(s.max).toBeGreaterThanOrEqual(18_500_000);
    expect(s.ticks[0]).toBe(0);
    expect(s.ticks[s.ticks.length - 1]).toBe(s.max);
    for (let i = 1; i < s.ticks.length; i++) {
      expect(s.ticks[i] - s.ticks[i - 1]).toBeCloseTo(s.step, 6);
    }
  });

  it("niceScale handles all-zero and single-value inputs gracefully", () => {
    const zeros = niceScale(0, 0, 4);
    expect(zeros.min).toBe(0);
    expect(zeros.max).toBeGreaterThan(0);
    expect(zeros.ticks.length).toBeGreaterThanOrEqual(2);

    const flat = niceScale(5, 5, 4);
    expect(flat.min).toBe(0);
    expect(flat.max).toBeGreaterThanOrEqual(5);
  });

  it("linearScale maps domain to range and handles degenerate domain", () => {
    expect(linearScale(50, 0, 100, 200, 0)).toBe(100);
    expect(linearScale(0, 0, 100, 200, 0)).toBe(200);
    expect(linearScale(10, 10, 10, 0, 100)).toBe(50);
  });

  it("smoothPath builds valid SVG cubic curves and handles 0/1/2 points", () => {
    expect(smoothPath([])).toBe("");
    expect(smoothPath([{ x: 10, y: 20 }])).toBe("M 10.00 20.00");
    expect(
      smoothPath([
        { x: 0, y: 100 },
        { x: 50, y: 20 },
      ]),
    ).toBe("M 0.00 100.00 L 50.00 20.00");

    const d = smoothPath([
      { x: 0, y: 100 },
      { x: 50, y: 40 },
      { x: 100, y: 60 },
      { x: 150, y: 10 },
    ]);
    expect(d.startsWith("M 0.00 100.00 C ")).toBe(true);
    expect(d.includes("150.00 10.00")).toBe(true);
  });

  it("areaPath closes the curve down to baselineY", () => {
    const pts = [
      { x: 10, y: 50 },
      { x: 60, y: 20 },
      { x: 110, y: 30 },
    ];
    const d = areaPath(pts, 180);
    expect(d.endsWith("L 110.00 180.00 L 10.00 180.00 Z")).toBe(true);
  });

  it("computeDonutSlices sums ratios to 1 and ignores zero/negative entries", () => {
    const circ = 2 * Math.PI * 50;
    const slices = computeDonutSlices(
      [
        { id: "a", label: "A", value: 30, color: "#0f8b6d" },
        { id: "b", label: "B", value: 0, color: "#f2a541" },
        { id: "c", label: "C", value: 70, color: "#c8553d" },
      ],
      circ,
    );
    expect(slices).toHaveLength(2);
    expect(slices[0].ratio).toBeCloseTo(0.3, 6);
    expect(slices[1].ratio).toBeCloseTo(0.7, 6);
    expect(slices[0].dashLength + slices[1].dashLength).toBeCloseTo(circ, 6);
    expect(slices[1].dashOffset).toBeCloseTo(-slices[0].dashLength, 6);
  });

  it("describeArc returns empty string for non-positive sweep and valid arc otherwise", () => {
    expect(describeArc(100, 100, 50, 90, 90)).toBe("");
    const arc = describeArc(100, 100, 50, -110, 110);
    expect(arc.startsWith("M ")).toBe(true);
    expect(arc).toContain("A 50.00 50.00 0 1 1");
  });

  it("clampTooltipPosition keeps tooltip inside container bounds", () => {
    // Near right edge: flips left
    const right = clampTooltipPosition(490, 100, 180, 70, 500, 240);
    expect(right.left).toBeGreaterThanOrEqual(8);
    expect(right.left + 180).toBeLessThanOrEqual(492);
    expect(right.top).toBeGreaterThanOrEqual(8);
    expect(right.top + 70).toBeLessThanOrEqual(232);

    // Near top-left corner
    const topLeft = clampTooltipPosition(5, 5, 180, 70, 320, 200);
    expect(topLeft.left).toBeGreaterThanOrEqual(8);
    expect(topLeft.top).toBeGreaterThanOrEqual(8);
  });

  it("nearestIndex clamps pointer X to [0, count - 1]", () => {
    expect(nearestIndex(0, 30, 50, 400)).toBe(0);
    expect(nearestIndex(500, 30, 50, 400)).toBe(29);
    expect(nearestIndex(250, 11, 50, 400)).toBe(5);
  });

  it("pickTickIndices always includes first and last index", () => {
    const ticks = pickTickIndices(30, 6);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBe(29);
    expect(ticks.length).toBeLessThanOrEqual(6);
  });

  it("trendPercent computes percentage change between recent and previous window", () => {
    const up = [1, 1, 1, 1, 2, 2, 2, 2];
    expect(trendPercent(up, 4)).toBeCloseTo(100, 5);
    expect(trendPercent([0, 0, 0, 0], 2)).toBe(0);
    expect(trendPercent([0, 0, 5, 5], 2)).toBeNull();
  });
});

describe("admin charts Vietnamese formatters", () => {
  it("formats numbers, compact units, VND, dates, and percentages", () => {
    expect(formatNumberVi(1234567)).toBe("1.234.567");
    expect(formatVndVi(9_000_000)).toBe("9.000.000 đ");
    expect(formatCompactVi(1_500_000)).toBe("1,5 Tr");
    expect(formatCompactVi(450_000)).toBe("450 N");
    expect(formatVndCompactVi(186_000_000)).toBe("186 Tr đ");
    expect(formatDateShortVi("2026-11-25")).toBe("25/11");
    expect(formatDateFullVi("2026-11-25")).toBe("25/11/2026");
    expect(formatPercentVi(0.96, 1)).toBe("96,0%");
  });
});
