import { Suspense } from "react";
import { connection } from "next/server";
import { demoAdminPasswordConfig } from "@/lib/admin/server/password";
import { AdminLoginForm } from "./AdminLoginForm";

async function ConfiguredAdminLogin() {
  await connection();
  return <AdminLoginForm passwordEnabled={Boolean(demoAdminPasswordConfig())} />;
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <ConfiguredAdminLogin />
    </Suspense>
  );
}
