"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, Logo, type IconName } from "./Icons";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { roleLabel } from "@/lib/format";
import type { Perm } from "@/lib/permissions";
import { Sheet } from "./ui";
import GlobalSearch from "./GlobalSearch";

export interface NavItem { href: string; label: string; icon: IconName; perm: Perm }

export const NAV: NavItem[] = [
  { href: "/", label: "الرئيسية", icon: "home", perm: "dashboard.view" },
  { href: "/apartments", label: "الشقق", icon: "grid", perm: "units.view" },
  { href: "/tenants", label: "المستأجرون", icon: "users", perm: "tenants.view" },
  { href: "/finances", label: "المالية", icon: "wallet", perm: "finance.view" },
  { href: "/print", label: "الطباعة", icon: "print", perm: "reports.view" },
  { href: "/flags", label: "التنبيهات", icon: "alert", perm: "flags.view" },
  { href: "/documents", label: "المستندات", icon: "folder", perm: "docs.view" },
  { href: "/buildings", label: "العمارات", icon: "building", perm: "buildings.view" },
  { href: "/users", label: "المستخدمون", icon: "shield", perm: "users.manage" },
  { href: "/settings", label: "الإعدادات", icon: "cog", perm: "dashboard.view" },
];

function useNav() {
  const { allow } = useAuth();
  return useMemo(() => NAV.filter((n) => allow(n.perm)), [allow]);
}

const isActive = (path: string, href: string) =>
  href === "/" ? path === "/" : path === href || path.startsWith(href + "/");

/* ---------------------------- Building switcher ---------------------------- */

function BuildingSwitcher() {
  const { data, activeBuilding, setActiveBuilding } = useStore();
  const [open, setOpen] = useState(false);
  const current = data.buildings.find((b) => b.id === activeBuilding);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex max-w-[46vw] items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[13px] font-extrabold shadow-[var(--sh-1)] sm:max-w-none"
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: current?.color ?? "var(--ink)" }} />
        <span className="truncate">{current?.name ?? "كل العمارات"}</span>
        <Icon name="chevronDown" size={14} className="shrink-0 text-[var(--muted)]" />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="اختر العمارة">
        <div className="space-y-2">
          <button
            onClick={() => { setActiveBuilding("all"); setOpen(false); }}
            className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-right transition ${
              activeBuilding === "all" ? "border-[var(--primary)] bg-[var(--primary-050)]" : "border-[var(--line)] bg-[var(--surface)]"
            }`}
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--bg-soft)] text-[var(--ink-2)]">
              <Icon name="layers" size={19} />
            </span>
            <div className="flex-1">
              <p className="font-extrabold">كل العمارات</p>
              <p className="text-[12px] text-[var(--muted)]">
                {data.buildings.length} عمارة · {data.units.length} وحدة
              </p>
            </div>
            {activeBuilding === "all" && <Icon name="check" size={18} className="text-[var(--primary)]" />}
          </button>

          {data.buildings.map((b) => {
            const units = data.units.filter((u) => u.buildingId === b.id);
            const on = activeBuilding === b.id;
            return (
              <button
                key={b.id}
                onClick={() => { setActiveBuilding(b.id); setOpen(false); }}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-right transition ${
                  on ? "border-[var(--primary)] bg-[var(--primary-050)]" : "border-[var(--line)] bg-[var(--surface)]"
                }`}
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: b.color }}>
                  <Icon name="building" size={19} />
                </span>
                <div className="flex-1">
                  <p className="font-extrabold">{b.name}</p>
                  <p className="text-[12px] text-[var(--muted)]">
                    {b.area} · {units.length} وحدة
                  </p>
                </div>
                {on && <Icon name="check" size={18} className="text-[var(--primary)]" />}
              </button>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}

/* ----------------------------- User menu ---------------------------------- */

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  if (!user) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--primary)] text-white shadow-[var(--sh-1)]"
        aria-label="حسابي"
      >
        <Icon name="user" size={17} />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="حسابي">
        <div className="flex items-center gap-3 rounded-2xl bg-[var(--surface-2)] p-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--primary)] text-white">
            <Icon name="user" size={22} />
          </span>
          <div>
            <p className="font-extrabold">{user.displayName}</p>
            <p className="text-[12px] text-[var(--muted)]">
              @{user.username} · {roleLabel[user.role]}
            </p>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-xl border border-[var(--line)] p-3 text-sm font-bold"
          >
            <Icon name="cog" size={18} className="text-[var(--muted)]" /> الإعدادات وكلمة المرور
          </Link>
          <button
            onClick={() => { setOpen(false); logout(); router.push("/login"); }}
            className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--danger)]/25 bg-[var(--danger-050)] p-3 text-sm font-bold text-[#b3303b]"
          >
            <Icon name="logout" size={18} /> تسجيل الخروج
          </button>
        </div>
      </Sheet>
    </>
  );
}

/* -------------------------------- Shell ----------------------------------- */

export default function Shell({ children }: { children: React.ReactNode }) {
  const nav = useNav();
  const path = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const { data } = useStore();

  useEffect(() => setMoreOpen(false), [path]);

  const primary = nav.filter((n) => ["/", "/apartments", "/tenants", "/finances", "/flags"].includes(n.href)).slice(0, 4);
  const rest = nav.filter((n) => !primary.some((p) => p.href === n.href));

  return (
    <div className="min-h-dvh">
      {/* ===== Sidebar (شاشات كبيرة) ===== */}
      <aside className="fixed inset-y-0 right-0 z-40 hidden w-[248px] flex-col border-l border-[var(--line)] bg-[var(--surface)] lg:flex no-print">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <Logo size={38} />
          <div>
            <p className="text-[15px] font-extrabold leading-tight">{data.settings.orgName}</p>
            <p className="text-[11px] text-[var(--muted)]">إدارة العمارات</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {nav.map((n) => {
            const on = isActive(path, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-bold transition ${
                  on ? "bg-[var(--primary-050)] text-[var(--primary-700)]" : "text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
                }`}
              >
                <Icon name={n.icon} size={19} />
                {n.label}
                {on && <span className="mr-auto h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* ===== Topbar ===== */}
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--bg)]/85 backdrop-blur-xl lg:pr-[248px] no-print">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-2.5 sm:px-4">
          <div className="lg:hidden">
            <Logo size={32} />
          </div>
          <BuildingSwitcher />
          <div className="mr-auto flex items-center gap-1.5">
            <GlobalSearch />
            <Link href="/flags" className="btn btn-icon btn-ghost relative" aria-label="التنبيهات">
              <Icon name="bell" size={18} />
              {data.units.some((u) => u.flagged) && (
                <span className="absolute left-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--danger)]" />
              )}
            </Link>
            <Link href="/settings" className="btn btn-icon btn-ghost" aria-label="الإعدادات">
              <Icon name="cog" size={18} />
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* ===== Content ===== */}
      <main className="mx-auto max-w-5xl px-3 pb-28 pt-4 sm:px-4 lg:pr-[264px] lg:pb-10">{children}</main>

      {/* ===== Bottom nav (جوال) ===== */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur-xl lg:hidden no-print">
        <div className="mx-auto grid max-w-lg grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)]">
          {primary.map((n) => {
            const on = isActive(path, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className="flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-bold transition"
                style={{ color: on ? "var(--primary-700)" : "var(--muted)" }}
              >
                <span
                  className="grid h-8 w-12 place-items-center rounded-full transition"
                  style={{ background: on ? "var(--primary-050)" : "transparent" }}
                >
                  <Icon name={n.icon} size={19} strokeWidth={on ? 2.2 : 1.8} />
                </span>
                {n.label}
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-bold text-[var(--muted)]"
          >
            <span className="grid h-8 w-12 place-items-center rounded-full">
              <Icon name="menu" size={19} />
            </span>
            المزيد
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="كل الأقسام">
        <div className="grid grid-cols-3 gap-2.5">
          {rest.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5 text-center text-[12px] font-bold"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-050)] text-[var(--primary-700)]">
                <Icon name={n.icon} size={19} />
              </span>
              {n.label}
            </Link>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
