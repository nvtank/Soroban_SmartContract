import type { Metadata } from "next";
import { LiveDashboard } from "@/components/admin/live/LiveDashboard";

export const metadata: Metadata = {
  title: "Theo dõi trực tiếp · RentFlow Admin",
  description: "Theo dõi người dùng đang hoạt động và dòng sự kiện trực tiếp trên RentFlow.",
};

export default function AdminLivePage() {
  return <LiveDashboard />;
}
