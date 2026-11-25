/**
 * Hàm toán học thuần cho thư viện biểu đồ SVG admin.
 * Không phụ thuộc DOM hay trình duyệt để có thể unit test trực tiếp.
 */

export type Point2D = { x: number; y: number };

export type NiceScaleResult = {
  min: number;
  max: number;
  step: number;
  ticks: number[];
};

/**
 * Tính thang đo trục Y "đẹp" (bội số của 1, 2, 5 × 10^n).
 * Luôn neo min = 0 với dữ liệu không âm để tránh phóng đại sai lệch.
 */
export function niceScale(minValue: number, maxValue: number, maxTicks = 5): NiceScaleResult {
  const safeMin = Number.isFinite(minValue) ? minValue : 0;
  const safeMax = Number.isFinite(maxValue) ? maxValue : 0;
  const tickCount = Math.max(2, Math.floor(maxTicks));

  let lo = Math.min(safeMin, safeMax);
  let hi = Math.max(safeMin, safeMax);

  if (lo >= 0) lo = 0;

  if (lo === hi) {
    if (hi === 0) {
      return { min: 0, max: 4, step: 1, ticks: [0, 1, 2, 3, 4] };
    }
    hi = hi > 0 ? hi * 1.25 : 0;
  }

  const range = niceNumber(hi - lo, false);
  const step = niceNumber(range / (tickCount - 1), true);
  const niceMin = Math.floor(lo / step) * step;
  const niceMax = Math.ceil(hi / step) * step;

  const ticks: number[] = [];
  const count = Math.min(20, Math.round((niceMax - niceMin) / step));
  for (let i = 0; i <= count; i++) {
    // Khử sai số dấu phẩy động (vd: 0.30000000000000004)
    const val = Number((niceMin + i * step).toPrecision(12));
    ticks.push(Object.is(val, -0) ? 0 : val);
  }

  return { min: niceMin, max: niceMax, step, ticks };
}

function niceNumber(range: number, round: boolean): number {
  if (range <= 0 || !Number.isFinite(range)) return 1;
  const exponent = Math.floor(Math.log10(range));
  const fraction = range / Math.pow(10, exponent);
  let niceFraction: number;

  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else {
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
  }

  return niceFraction * Math.pow(10, exponent);
}

/** Ánh xạ tuyến tính từ miền [d0, d1] sang khoảng [r0, r1]. */
export function linearScale(
  value: number,
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number,
): number {
  if (domainMax === domainMin) return (rangeMin + rangeMax) / 2;
  const t = (value - domainMin) / (domainMax - domainMin);
  return rangeMin + t * (rangeMax - rangeMin);
}

/**
 * Tạo đường cong mượt bằng nội suy Hermite đơn điệu (Fritsch–Carlson).
 * Không bao giờ vọt lố qua cực trị cục bộ (vd: không bao giờ võng xuống âm khi dữ liệu >= 0).
 */
export function smoothPath(points: readonly Point2D[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    return `M ${fmt(points[0].x)} ${fmt(points[0].y)}`;
  }
  if (points.length === 2) {
    return `M ${fmt(points[0].x)} ${fmt(points[0].y)} L ${fmt(points[1].x)} ${fmt(points[1].y)}`;
  }

  const n = points.length;
  const dx: number[] = new Array(n - 1);
  const dy: number[] = new Array(n - 1);
  const slopes: number[] = new Array(n - 1);

  for (let i = 0; i < n - 1; i++) {
    dx[i] = points[i + 1].x - points[i].x;
    dy[i] = points[i + 1].y - points[i].y;
    slopes[i] = dx[i] === 0 ? 0 : dy[i] / dx[i];
  }

  const tangents: number[] = new Array(n);
  tangents[0] = slopes[0];
  tangents[n - 1] = slopes[n - 2];

  for (let i = 1; i < n - 1; i++) {
    const m0 = slopes[i - 1];
    const m1 = slopes[i];
    if (m0 * m1 <= 0) {
      tangents[i] = 0;
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      tangents[i] = (w1 + w2) / (w1 / m0 + w2 / m1);
    }
  }

  let d = `M ${fmt(points[0].x)} ${fmt(points[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const step = dx[i] / 3;
    const cp1x = points[i].x + step;
    const cp1y = points[i].y + tangents[i] * step;
    const cp2x = points[i + 1].x - step;
    const cp2y = points[i + 1].y - tangents[i + 1] * step;
    d += ` C ${fmt(cp1x)} ${fmt(cp1y)}, ${fmt(cp2x)} ${fmt(cp2y)}, ${fmt(points[i + 1].x)} ${fmt(points[i + 1].y)}`;
  }
  return d;
}

/** Đóng vùng bên dưới đường cong mượt xuống trục baselineY để tô gradient. */
export function areaPath(points: readonly Point2D[], baselineY: number): string {
  if (points.length === 0) return "";
  const line = smoothPath(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L ${fmt(last.x)} ${fmt(baselineY)} L ${fmt(first.x)} ${fmt(baselineY)} Z`;
}

/** Chuyển tọa độ cực (độ, 0° ở 12 giờ, tăng theo chiều kim đồng hồ) sang tọa độ Descartes. */
export function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number): Point2D {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

/** Tạo SVG path cho cung tròn từ startAngle đến endAngle (độ, theo chiều kim đồng hồ). */
export function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const sweep = endAngle - startAngle;
  if (sweep <= 0) return "";
  const clampedEnd = sweep >= 359.99 ? startAngle + 359.99 : endAngle;
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, clampedEnd);
  const largeArc = clampedEnd - startAngle > 180 ? 1 : 0;
  return `M ${fmt(start.x)} ${fmt(start.y)} A ${fmt(radius)} ${fmt(radius)} 0 ${largeArc} 1 ${fmt(end.x)} ${fmt(end.y)}`;
}

export type DonutInput = {
  id: string;
  label: string;
  value: number;
  color: string;
};

export type DonutSlice = DonutInput & {
  ratio: number;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  dashLength: number;
  dashOffset: number;
};

/**
 * Tính các lát cắt cho DonutChart dùng strokeDasharray/strokeDashoffset trên vòng tròn chuẩn.
 */
export function computeDonutSlices(items: readonly DonutInput[], circumference: number): DonutSlice[] {
  const positive = items.filter((item) => item.value > 0);
  const total = positive.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return [];

  let accAngle = 0;
  let accLength = 0;

  return positive.map((item) => {
    const ratio = item.value / total;
    const angle = ratio * 360;
    const startAngle = accAngle;
    const endAngle = accAngle + angle;
    const midAngle = startAngle + angle / 2;
    const dashLength = ratio * circumference;
    const dashOffset = -accLength;

    accAngle = endAngle;
    accLength += dashLength;

    return {
      ...item,
      ratio,
      startAngle,
      endAngle,
      midAngle,
      dashLength,
      dashOffset,
    };
  });
}

/**
 * Đặt vị trí hộp tooltip sao cho không bao giờ tràn ra khỏi khung chứa.
 */
export function clampTooltipPosition(
  anchorX: number,
  anchorY: number,
  tooltipWidth: number,
  tooltipHeight: number,
  containerWidth: number,
  containerHeight: number,
  gap = 12,
): { left: number; top: number } {
  const pad = 8;
  // Ưu tiên đặt bên phải con trỏ; nếu tràn thì chuyển sang bên trái
  let left = anchorX + gap;
  if (left + tooltipWidth > containerWidth - pad) {
    left = anchorX - tooltipWidth - gap;
  }
  left = Math.max(pad, Math.min(left, Math.max(pad, containerWidth - tooltipWidth - pad)));

  // Ưu tiên đặt phía trên nhẹ; nếu tràn thì kẹp trong khung
  let top = anchorY - tooltipHeight / 2;
  top = Math.max(pad, Math.min(top, Math.max(pad, containerHeight - tooltipHeight - pad)));

  return { left: Math.round(left), top: Math.round(top) };
}

/** Tìm chỉ số điểm dữ liệu gần nhất với tọa độ X của con trỏ. */
export function nearestIndex(
  pointerX: number,
  count: number,
  plotLeft: number,
  plotWidth: number,
): number {
  if (count <= 1 || plotWidth <= 0) return 0;
  const clamped = Math.max(0, Math.min(plotWidth, pointerX - plotLeft));
  const idx = Math.round((clamped / plotWidth) * (count - 1));
  return Math.max(0, Math.min(count - 1, idx));
}

/** Chọn các chỉ số trục X cách đều để nhãn không đè lên nhau. */
export function pickTickIndices(count: number, maxTicks: number): number[] {
  if (count <= 0) return [];
  if (count <= maxTicks) return Array.from({ length: count }, (_, i) => i);
  const slots = Math.max(2, maxTicks);
  const step = (count - 1) / (slots - 1);
  const indices = new Set<number>();
  for (let i = 0; i < slots; i++) {
    indices.add(Math.round(i * step));
  }
  return Array.from(indices).sort((a, b) => a - b);
}

/**
 * Tính phần trăm thay đổi giữa nửa sau và nửa trước (hoặc 7 ngày cuối so với 7 ngày trước đó).
 * Trả null nếu không đủ dữ liệu hoặc mẫu số = 0.
 */
export function trendPercent(values: readonly number[], windowSize = 7): number | null {
  if (values.length < 2) return null;
  const w = Math.min(windowSize, Math.floor(values.length / 2));
  if (w < 1) return null;

  const recent = values.slice(values.length - w).reduce((a, b) => a + b, 0);
  const prev = values.slice(values.length - 2 * w, values.length - w).reduce((a, b) => a + b, 0);
  if (prev === 0) return recent === 0 ? 0 : null;
  return ((recent - prev) / prev) * 100;
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : "0";
}
