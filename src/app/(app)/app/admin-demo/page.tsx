import { redirect } from "next/navigation";

export const instant = false;

export default function AdminDemoPage() {
  redirect("/admin/khoi-phuc");
}
