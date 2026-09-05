"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Shell, { NAV } from "@/components/Shell";
import { Empty } from "@/components/ui";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, allow } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--line)] border-t-[var(--primary)]" />
      </div>
    );
  }

  // حماية على مستوى المسار — لا يكفي إخفاء الرابط من القائمة
  const route = NAV.filter((n) => n.href !== "/").find((n) => path === n.href || path.startsWith(n.href + "/"));
  const denied = route && !allow(route.perm);

  return (
    <Shell>
      {denied ? (
        <Empty
          icon="lock"
          title="غير مصرح لك بهذا القسم"
          body="حسابك لا يملك صلاحية الاطلاع على هذه الصفحة. راجع مدير النظام."
        />
      ) : (
        children
      )}
    </Shell>
  );
}
