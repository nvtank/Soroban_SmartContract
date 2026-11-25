import type { Metadata } from "next";
import { OverviewDashboard } from "@/components/admin/overview/OverviewDashboard";

export const metadata: Metadata = {
  title: "Tổng quan quản trị · RentFlow",
  description: "Chỉ số vận hành và biểu đồ 30 ngày của hệ thống RentFlow.",
};

export default function AdminOverviewPage() {
  return <OverviewDashboard />;
}
