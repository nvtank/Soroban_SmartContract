"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { SessionUser, UserRole } from "@/domain/dto";
import { DEMO_USERS } from "./mock/mock-data";

interface SessionContextType {
  user: SessionUser | null;
  role: UserRole;
  isLoggedIn: boolean;
  loginAs: (userKey: "landlord" | "tenant1" | "tenant2" | "admin") => void;
  setRole: (role: UserRole) => void;
  logout: () => void;
  isMock: boolean;
  toggleMock: () => void;
}

const SessionContext = createContext<SessionContextType | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(DEMO_USERS.landlord);
  const [isMock, setIsMock] = useState<boolean>(true);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    let saved: SessionUser | null = null;
    let mockVal = true;
    try {
      const savedUser = localStorage.getItem("rentflow_active_user");
      if (savedUser) saved = JSON.parse(savedUser);
      const mockFlag = localStorage.getItem("rentflow_ui_mock");
      if (mockFlag !== null) mockVal = mockFlag === "true";
    } catch {
      // ignore
    }
    const timer = setTimeout(() => {
      if (saved) setUser(saved);
      setIsMock(mockVal);
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const loginAs = (userKey: "landlord" | "tenant1" | "tenant2" | "admin") => {
    const selected = DEMO_USERS[userKey];
    setUser(selected);
    if (typeof window !== "undefined") {
      localStorage.setItem("rentflow_active_user", JSON.stringify(selected));
    }
  };

  const setRole = (newRole: UserRole) => {
    if (!user) return;
    const updated = { ...user, role: newRole };
    setUser(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("rentflow_active_user", JSON.stringify(updated));
    }
  };

  const logout = () => {
    setUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("rentflow_active_user");
    }
  };

  const toggleMock = () => {
    const nextVal = !isMock;
    setIsMock(nextVal);
    if (typeof window !== "undefined") {
      localStorage.setItem("rentflow_ui_mock", nextVal ? "true" : "false");
    }
  };

  const currentRole = user?.role || "LANDLORD";

  if (!mounted) {
    return (
      <SessionContext.Provider
        value={{
          user: DEMO_USERS.landlord,
          role: "LANDLORD",
          isLoggedIn: true,
          loginAs,
          setRole,
          logout,
          isMock: true,
          toggleMock,
        }}
      >
        {children}
      </SessionContext.Provider>
    );
  }

  return (
    <SessionContext.Provider
      value={{
        user,
        role: currentRole,
        isLoggedIn: !!user,
        loginAs,
        setRole,
        logout,
        isMock,
        toggleMock,
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
