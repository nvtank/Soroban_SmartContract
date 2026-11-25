"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { AdminSidebarBrand, AdminSidebarNav, adminSectionTitle } from "./AdminSidebar";
import { AdminTopBar } from "./AdminTopBar";

gsap.registerPlugin(useGSAP);

function AdminWorkspace({ children, segment }: { children: ReactNode; segment: string | null }) {
  const [compact, setCompact] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const { contextSafe } = useGSAP({ scope: dialogRef });

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 64rem)");
    function closeOnDesktop() {
      if (desktop.matches) dialogRef.current?.close();
    }
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  function openDrawer() {
    const dialog = dialogRef.current;
    const drawer = drawerRef.current;
    if (!dialog || !drawer || dialog.open) return;

    dialog.showModal();
    if (window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
      contextSafe(() => {
        gsap.fromTo(
          drawer,
          { xPercent: -100 },
          { xPercent: 0, duration: 0.26, ease: "power2.out", overwrite: true, clearProps: "transform" },
        );
      })();
    }
  }

  function closeDrawer() {
    const dialog = dialogRef.current;
    const drawer = drawerRef.current;
    if (!dialog?.open || !drawer) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      dialog.close();
    } else {
      contextSafe(() => {
        gsap.to(drawer, {
          xPercent: -100,
          duration: 0.19,
          ease: "power2.in",
          overwrite: true,
          clearProps: "transform",
          onComplete: () => dialog.close(),
        });
      })();
    }
  }

  return (
    <div
      className={`grid flex-1 min-w-0 bg-paper ${compact ? "lg:grid-cols-[4.75rem_minmax(0,1fr)]" : "lg:grid-cols-[15rem_minmax(0,1fr)]"}`}
    >
      <a
        href="#admin-content"
        className="sr-only z-[70] rounded-lg bg-white px-4 py-2 text-sm font-semibold focus:not-sr-only focus:fixed focus:top-10 focus:left-4"
      >
        Bỏ qua điều hướng
      </a>
      <aside className="sticky top-0 hidden h-dvh flex-col self-start border-r border-line bg-white lg:flex">
        <div className="px-4 py-5">
          <AdminSidebarBrand compact={compact} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-2" data-lenis-prevent>
          <AdminSidebarNav segment={segment} compact={compact} />
        </div>
        <div className="border-t border-line p-3">
          <button
            type="button"
            aria-label={compact ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
            title={compact ? "Mở rộng thanh bên" : undefined}
            onClick={() => setCompact(!compact)}
            className={`flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-lg text-sm font-semibold text-ink/70 hover:bg-surface ${compact ? "justify-center" : "px-3"}`}
          >
            {compact ? (
              <PanelLeftOpen size={18} aria-hidden="true" />
            ) : (
              <>
                <PanelLeftClose size={18} aria-hidden="true" /> Thu gọn
              </>
            )}
          </button>
        </div>
      </aside>
      <div className="min-w-0">
        <AdminTopBar title={adminSectionTitle(segment)} onOpenNav={openDrawer} />
        <main
          id="admin-content"
          tabIndex={-1}
          className="mx-auto w-full min-w-0 max-w-[100rem] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8"
        >
          {children}
        </main>
      </div>
      <dialog
        ref={dialogRef}
        id="admin-nav-drawer"
        aria-label="Điều hướng quản trị"
        onCancel={(event) => {
          event.preventDefault();
          closeDrawer();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDrawer();
        }}
        className="fixed inset-0 top-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden bg-ink/40 backdrop:bg-transparent lg:hidden"
      >
        <div
          ref={drawerRef}
          className="flex h-full w-72 max-w-[85%] flex-col border-r border-line bg-white text-ink"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-4">
            <AdminSidebarBrand />
            <button
              type="button"
              onClick={closeDrawer}
              aria-label="Đóng điều hướng"
              className="grid size-10 cursor-pointer place-items-center rounded-lg hover:bg-surface"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4" data-lenis-prevent>
            <AdminSidebarNav segment={segment} onNavigate={closeDrawer} />
          </div>
        </div>
      </dialog>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const segment = useSelectedLayoutSegment();

  if (segment === "dang-nhap") return children;

  return <AdminWorkspace segment={segment}>{children}</AdminWorkspace>;
}
