"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { SessionUser, UserRole } from "@/domain/dto";
import { DEMO_USERS } from "./mock/mock-data";

// Mock chỉ bật bằng biến môi trường lúc build, người dùng không tự bật được từ trình duyệt.
const UI_MOCK = process.env.NEXT_PUBLIC_UI_MOCK === "true";

interface SessionContextType {
  user: SessionUser | null;
  role: UserRole;
  isLoggedIn: boolean;
  loginAs: (userKey: "landlord" | "tenant1" | "tenant2" | "admin") => void;
  setRole: (role: UserRole) => void;
  logout: () => void;
  isMock: boolean;
}

const SessionContext = createContext<SessionContextType | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(UI_MOCK ? DEMO_USERS.landlord : null);

  useEffect(() => {
    if (!UI_MOCK) return;
    let saved: SessionUser | null = null;
    try {
      const savedUser = localStorage.getItem("rentflow_active_user");
      if (savedUser) saved = JSON.parse(savedUser);
    } catch {
      // ignore
    }
    const timer = setTimeout(() => {
      if (saved) setUser(saved);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const loginAs = (userKey: "landlord" | "tenant1" | "tenant2" | "admin") => {
    if (!UI_MOCK) return;
    const selected = DEMO_USERS[userKey];
    setUser(selected);
    localStorage.setItem("rentflow_active_user", JSON.stringify(selected));
  };

  const setRole = (newRole: UserRole) => {
    if (!UI_MOCK || !user) return;
    const updated = { ...user, role: newRole };
    setUser(updated);
    localStorage.setItem("rentflow_active_user", JSON.stringify(updated));
  };

  const logout = () => {
    setUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("rentflow_active_user");
    }
  };

  return (
    <SessionContext.Provider
      value={{
        user,
        role: user?.role || "LANDLORD",
        isLoggedIn: !!user,
        loginAs,
        setRole,
        logout,
        isMock: UI_MOCK,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
