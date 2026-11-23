/**
 * Số liệu lấy từ brief, CHƯA được xác minh. Chủ dự án tự kiểm tra nguồn trước ngày thi.
 * UI phải hiển thị dòng nguồn, và hiện "Chưa xác minh nguồn" khi verified = false.
 */
export type Fact = {
  id: string;
  value: number;
  unit: string;
  label: string;
  source: string | null;
  sourceUrl: string | null;
  verified: boolean;
};

export const FACTS: readonly Fact[] = [
  {
    id: "rooms",
    value: 9570,
    unit: "phòng trọ",
    label: "Số phòng trọ nêu trong brief",
    source: null,
    sourceUrl: null,
    verified: false,
  },
  {
    id: "affected-tenants",
    value: 15549,
    unit: "người thuê",
    label: "Số người thuê bị ảnh hưởng nêu trong brief",
    source: null,
    sourceUrl: null,
    verified: false,
  },
];
