import type { ReactNode } from "react";

export type SortDirection = "asc" | "desc";

export type SortState = {
  key: string;
  dir: SortDirection;
};

export type ColumnDef<T> = {
  key: string;
  header: string;
  /** Cho phép sắp xếp theo cột này. */
  sortable?: boolean;
  /** Khóa gửi lên API (?sort=key:asc). Mặc định dùng `key`. */
  sortKey?: string;
  align?: "left" | "right" | "center";
  cell: (row: T) => ReactNode;
  /** Nhãn hiển thị trên thẻ điện thoại. Mặc định dùng `header`. */
  mobileLabel?: string;
  /** Đánh dấu cột chính làm tiêu đề thẻ trên điện thoại. */
  isMobileTitle?: boolean;
  /** Ẩn cột khỏi thẻ điện thoại (ví dụ đã gộp vào tiêu đề). */
  hideOnMobile?: boolean;
  className?: string;
};

export type FilterOption = {
  value: string;
  label: string;
};
