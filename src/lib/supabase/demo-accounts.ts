/**
 * Danh sách tài khoản demo cố định do seed tạo (không phụ thuộc DB/crypto để proxy có thể import nhẹ).
 * Đây cũng là allowlist duy nhất mà phiên demo (cookie ký HMAC) được phép đại diện.
 */
export const DEMO_USERS = {
  LANDLORD: {
    id: "00000000-0000-0000-0000-000000000001",
    email: "landlord.demo@rentflow.local",
    phone: "0900000001",
    fullName: "Nguyễn Văn An (Chủ nhà Demo)",
    role: "LANDLORD" as const,
  },
  TENANT_1: {
    id: "00000000-0000-0000-0000-000000000002",
    email: "tenant1.demo@rentflow.local",
    phone: "0900000002",
    fullName: "Trần Thị Bình (Người thuê Demo 1)",
    role: "TENANT" as const,
  },
  TENANT_2: {
    id: "00000000-0000-0000-0000-000000000003",
    email: "tenant2.demo@rentflow.local",
    phone: "0900000003",
    fullName: "Lê Văn Cường (Người thuê Demo 2)",
    role: "TENANT" as const,
  },
  ADMIN: {
    id: "00000000-0000-0000-0000-000000000004",
    email: "admin.demo@rentflow.local",
    phone: "0900000004",
    fullName: "Quản trị viên Demo",
    role: "ADMIN_DEMO" as const,
  },
};

export type DemoRole = (typeof DEMO_USERS)[keyof typeof DEMO_USERS]["role"];

export function findDemoUserById(id: string) {
  return Object.values(DEMO_USERS).find((u) => u.id === id) ?? null;
}

export function findDemoUserByPhone(phone: string) {
  return Object.values(DEMO_USERS).find((u) => u.phone === phone) ?? null;
}
