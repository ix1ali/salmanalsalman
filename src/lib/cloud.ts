"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * إعداد الاتصال بـ Supabase.
 *
 * إن لم تُضبط المفاتيح يعمل النظام محليًا على هذا الجهاز فقط (وضع التجربة).
 * وعند ضبطها تصير البيانات مشتركة بين كل المستخدمين لحظيًا.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** هل النظام موصول بالسحابة؟ */
export const CLOUD = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/**
 * الدخول باسم المستخدم فقط، وSupabase يتطلّب بريدًا،
 * فيُشتقّ البريد من اسم المستخدم بحروف صغيرة دائمًا — فلا فرق بين
 * Ali و ali و ALI.
 */
export const AUTH_EMAIL_DOMAIN =
  process.env.NEXT_PUBLIC_AUTH_EMAIL_DOMAIN || "users.salmanalsalman.app";

export const normalizeUsername = (u: string) => u.trim().toLowerCase();
export const emailOf = (u: string) => `${normalizeUsername(u)}@${AUTH_EMAIL_DOMAIN}`;

let client: SupabaseClient | null = null;

/** العميل الوحيد المشترك — يحفظ الجلسة ويجدّدها تلقائيًا. */
export function sb(): SupabaseClient {
  if (!CLOUD) throw new Error("لم يتم ربط النظام بالسحابة بعد.");
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: "aqar-auth",
      },
      realtime: { params: { eventsPerSecond: 5 } },
    });
  }
  return client;
}

/** رسائل Supabase بالعربية. */
export function cloudError(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e ?? "");
  if (/Invalid login credentials/i.test(m)) return "اسم المستخدم أو كلمة المرور غير صحيحة.";
  if (/Email not confirmed/i.test(m)) return "الحساب غير مُفعّل. راجع المدير.";
  if (/rate limit|too many/i.test(m)) return "محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.";
  if (/Failed to fetch|NetworkError|fetch failed/i.test(m)) return "تعذّر الاتصال بالخادم. تحقّق من الإنترنت.";
  if (/not-allowed/i.test(m)) return "هذه العملية للمدير فقط.";
  if (/duplicate key|already registered|unique/i.test(m)) return "اسم المستخدم محجوز.";
  if (/row-level security|permission denied/i.test(m)) return "لا تملك صلاحية لهذه العملية.";
  return m || "حدث خطأ غير متوقع.";
}
