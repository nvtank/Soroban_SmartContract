"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { SessionUser, UserRole } from "@/domain/dto";
import { DEMO_USERS } from "./mock/mock-data";
import {
  getServerSessionUser,
  logoutServerAction,
  switchDemoUserAction,
} from "./session-actions";

const UI_MOCK = process.env.NEXT_PUBLIC_UI_MOCK === "true";

interface SessionContextType {
  user: SessionUser | null;
  role: UserRole;
  isLoggedIn: boolean;
  isLoading: boolean;
  loginAs: (userKey: "landlord" | "tenant1" | "tenant2" | "admin") => Promise<void>;
  refreshSession: () => Promise<SessionUser | null>;
  setRole: (role: UserRole) => void;
  setUser: (user: SessionUser | null) => void;
  logout: () => Promise<void>;
  isMock: boolean;
}

const SessionContext = createContext<SessionContextType | null>(null);

export function SessionProvider({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  initialUser?: SessionUser | null;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<SessionUser | null>(() => {
    if (UI_MOCK) {
      if (typeof window !== "undefined") {
        try {
          const savedUser = localStorage.getItem("rentflow_active_user");
          if (savedUser) return JSON.parse(savedUser);
        } catch {
          // ignore
        }
      }
      return DEMO_USERS.landlord;
    }
    return initialUser;
  });
  const [isLoading, setIsLoading] = useState<boolean>(!initialUser && !UI_MOCK);

  // Load / refresh session
  const refreshSession = useCallback(async (): Promise<SessionUser | null> => {
    if (UI_MOCK) {
      return user;
    }
    setIsLoading(true);
    try {
      const serverUser = await getServerSessionUser();
      setUser(serverUser);
      return serverUser;
    } catch {
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Initial client check if no initial user
  useEffect(() => {
    if (UI_MOCK || initialUser) return;
    let ignore = false;
    getServerSessionUser()
      .then((serverUser) => {
        if (!ignore) {
          setUser(serverUser);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          setUser(null);
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [initialUser]);

  // Route protection for /app routes when unauthenticated
  useEffect(() => {
    if (UI_MOCK || isLoading) return;

    if (!user && pathname && pathname.startsWith("/app")) {
      const nextUrl = encodeURIComponent(pathname);
      router.replace(`/dang-nhap?next=${nextUrl}`);
    }
  }, [user, isLoading, pathname, router]);

  const loginAs = async (userKey: "landlord" | "tenant1" | "tenant2" | "admin") => {
    if (UI_MOCK) {
      const selected = DEMO_USERS[userKey];
      setUser(selected);
      localStorage.setItem("rentflow_active_user", JSON.stringify(selected));
      return;
    }

    setIsLoading(true);
    try {
      const updated = await switchDemoUserAction(userKey);
      setUser(updated);
    } finally {
      setIsLoading(false);
    }
  };

  const setRole = (newRole: UserRole) => {
    if (!user) return;
    const updated = { ...user, role: newRole };
    setUser(updated);
    if (UI_MOCK && typeof window !== "undefined") {
      localStorage.setItem("rentflow_active_user", JSON.stringify(updated));
    }
  };

  const logout = async () => {
    if (UI_MOCK) {
      setUser(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("rentflow_active_user");
      }
      return;
    }

    setIsLoading(true);
    try {
      await logoutServerAction();
      setUser(null);
    } finally {
      setIsLoading(false);
      router.push("/dang-nhap");
    }
  };

  return (
    <SessionContext.Provider
      value={{
        user,
        role: user?.role || "LANDLORD",
        isLoggedIn: !!user,
        isLoading,
        loginAs,
        refreshSession,
        setRole,
        setUser,
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
