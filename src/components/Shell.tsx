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

/** الأقسام مرتّبة كما يستخدمها المكتب: العمل اليومي، ثم المستندات، ثم الإدارة. */
export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "العمل اليومي",
    items: [
      { href: "/", label: "الرئيسية", icon: "home", perm: "dashboard.view" },
      { href: "/apartments", label: "الشقق", icon: "grid", perm: "units.view" },
      { href: "/tenants", label: "المستأجرون", icon: "users", perm: "tenants.view" },
      { href: "/finances", label: "المالية", icon: "wallet", perm: "finance.view" },
    ],
  },
  {
    label: "المتابعة",
    items: [
      { href: "/flags", label: "التنبيهات", icon: "alert", perm: "flags.view" },
      { href: "/memos", label: "المراسلات", icon: "message", perm: "memos.view" },
      { href: "/documents", label: "الملفات", icon: "folder", perm: "docs.view" },
    ],
  },
  {
    label: "الإدارة",
    items: [
      { href: "/buildings", label: "العمارات", icon: "building", perm: "buildings.view" },
      { href: "/users", label: "المستخدمون", icon: "shield", perm: "users.manage" },
      { href: "/settings", label: "الإعدادات", icon: "cog", perm: "dashboard.view" },
    ],
  },
];

export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

const isActive = (path: string, href: string) =>
  href === "/" ? path === "/" : path === href || path.startsWith(href + "/");

/* --------------------------- مبدّل العقار --------------------------- */

function BuildingSwitcher() {
  const { data, activeBuilding, setActiveBuilding } = useStore();
  const [open, setOpen] = useState(false);
  const current = data.buildings.find((b) => b.id === activeBuilding);

  // بعقار واحد لا داعي لزر يفتح قائمة من خيار واحد
  if (data.buildings.length <= 1) {
    return (
      <span className="flex min-w-0 items-center gap-1.5 text-[13.5px] font-semibold text-[var(--ink)]">
        <Icon name="building" size={15} className="shrink-0 text-[var(--muted)]" />
        <span className="truncate">{data.buildings[0]?.name ?? "لا يوجد عقار"}</span>
      </span>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex min-w-0 max-w-[48vw] items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[13px] font-semibold transition hover:border-[var(--line-strong)] sm:max-w-none"
      >
        <Icon name="building" size={14} className="shrink-0 text-[var(--muted)]" />
        <span className="truncate">{current?.name ?? data.buildings[0]?.name ?? "—"}</span>
        <Icon name="chevronDown" size={13} className="shrink-0 text-[var(--faint)]" />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="اختر العقار">
        <div className="-mx-4 -my-3.5">
          {data.buildings.map((b) => (
            <button key={b.id} onClick={() => { setActiveBuilding(b.id); setOpen(false); }} className="row row-link">
              <Icon name="building" size={17} className="shrink-0 text-[var(--muted)]" />
              <span className="flex-1">
                <span className="block text-[13.5px] font-semibold">{b.name}</span>
                <span className="t-xs block text-[var(--muted)]">
                  {b.area} · {data.units.filter((u) => u.buildingId === b.id).length} وحدة
                </span>
              </span>
              {activeBuilding === b.id && <Icon name="check" size={16} className="text-[var(--primary)]" />}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

/* ----------------------------- حساب المستخدم ----------------------------- */

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  if (!user) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--primary)] text-white"
        aria-label="حسابي"
      >
        <Icon name="user" size={16} />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="حسابي">
        <div className="flex items-center gap-3 rounded-lg bg-[var(--surface-2)] p-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--primary)] text-white">
            <Icon name="user" size={19} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold">{user.displayName}</p>
            <p className="t-xs text-[var(--muted)]">@{user.username} · {roleLabel[user.role]}</p>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <Link href="/settings" onClick={() => setOpen(false)} className="btn btn-ghost w-full !justify-start">
            <Icon name="cog" size={16} /> الإعدادات وكلمة المرور
          </Link>
          <button
            onClick={() => { setOpen(false); logout(); router.push("/login"); }}
            className="btn btn-danger w-full !justify-start"
          >
            <Icon name="logout" size={16} /> تسجيل الخروج
          </button>
        </div>
      </Sheet>
    </>
  );
}

/* -------------------------------- الهيكل -------------------------------- */

const MOBILE_PRIMARY = ["/", "/apartments", "/tenants", "/finances"];

export default function Shell({ children }: { children: React.ReactNode }) {
  const { allow } = useAuth();
  const path = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const { data } = useStore();

  const groups = useMemo(
    () => NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((n) => allow(n.perm)) })).filter((g) => g.items.length),
    [allow]
  );
  const nav = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => setMoreOpen(false), [path]);

  const primary = nav.filter((n) => MOBILE_PRIMARY.includes(n.href));
  const rest = nav.filter((n) => !MOBILE_PRIMARY.includes(n.href));
  const flagged = data.units.filter((u) => u.flagged).length;

  return (
    <div className="min-h-dvh">
      {/* ============================ القائمة الجانبية ============================ */}
      <aside className="fixed inset-y-0 right-0 z-40 hidden w-[var(--sidebar-w)] flex-col border-l border-[var(--line)] bg-[var(--surface)] lg:flex no-print">
        <div className="flex items-center gap-2.5 border-b border-[var(--line)] px-4 py-3">
          <Logo size={30} />
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-bold leading-tight">{data.settings.orgName}</p>
            <p className="t-xs text-[var(--faint)]">إدارة العقارات</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-3">
          {groups.map((g, gi) => (
            <div key={g.label} className={gi ? "mt-4" : ""}>
              <p className="px-2 pb-1.5 text-[10.5px] font-bold tracking-wide text-[var(--faint)]">{g.label}</p>
              <div className="space-y-0.5">
                {g.items.map((n) => {
                  const on = isActive(path, n.href);
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition ${
                        on ? "bg-[var(--primary)] text-white" : "text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
                      }`}
                    >
                      <Icon name={n.icon} size={17} strokeWidth={on ? 2 : 1.7} />
                      {n.label}
                      {n.href === "/flags" && flagged > 0 && (
                        <span className={`num mr-auto rounded px-1.5 text-[11px] font-bold ${on ? "bg-white/20" : "bg-[var(--danger-050)] text-[var(--danger)]"}`}>
                          {flagged}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* ============================== الشريط العلوي ============================== */}
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--surface)]/92 backdrop-blur-lg lg:pr-[var(--sidebar-w)] no-print">
        <div className="mx-auto flex h-[var(--topbar-h)] max-w-[1100px] items-center gap-2 px-3 sm:px-5">
          <span className="lg:hidden"><Logo size={26} /></span>
          <BuildingSwitcher />
          <div className="mr-auto flex items-center gap-0.5">
            <GlobalSearch />
            <Link href="/flags" className="btn btn-icon btn-ghost relative !border-transparent !bg-transparent" aria-label="التنبيهات">
              <Icon name="bell" size={17} />
              {flagged > 0 && <span className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--danger)]" />}
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* ================================ المحتوى ================================ */}
      <main className="mx-auto max-w-[1100px] px-3 pb-24 pt-4 sm:px-5 lg:pb-10 lg:pr-[calc(var(--sidebar-w)+1.25rem)]">
        {children}
      </main>

      {/* ============================= شريط الجوال ============================= */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur-lg lg:hidden no-print">
        <div className="mx-auto grid max-w-lg grid-cols-5 pb-[env(safe-area-inset-bottom)]">
          {primary.map((n) => {
            const on = isActive(path, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className="flex flex-col items-center gap-1 py-2 text-[10.5px] font-semibold transition"
                style={{ color: on ? "var(--primary)" : "var(--muted)" }}
              >
                <Icon name={n.icon} size={20} strokeWidth={on ? 2.1 : 1.7} />
                {n.label}
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className="relative flex flex-col items-center gap-1 py-2 text-[10.5px] font-semibold"
            style={{ color: rest.some((n) => isActive(path, n.href)) ? "var(--primary)" : "var(--muted)" }}
          >
            <Icon name="menu" size={20} />
            المزيد
            {flagged > 0 && <span className="absolute right-[27%] top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--danger)]" />}
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="الأقسام">
        <div className="-mx-4 -my-3.5">
          {groups.map((g) => {
            const items = g.items.filter((n) => rest.some((r) => r.href === n.href));
            if (!items.length) return null;
            return (
              <div key={g.label}>
                <p className="bg-[var(--surface-2)] px-4 py-1.5 text-[10.5px] font-bold text-[var(--faint)]">{g.label}</p>
                {items.map((n) => (
                  <Link key={n.href} href={n.href} className="row row-link">
                    <Icon name={n.icon} size={18} className="shrink-0 text-[var(--muted)]" />
                    <span className="flex-1 text-[13.5px] font-semibold">{n.label}</span>
                    {n.href === "/flags" && flagged > 0 && (
                      <span className="num rounded bg-[var(--danger-050)] px-1.5 text-[11px] font-bold text-[var(--danger)]">{flagged}</span>
                    )}
                    <Icon name="chevronLeft" size={15} className="text-[var(--faint)]" />
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      </Sheet>
    </div>
  );
}
