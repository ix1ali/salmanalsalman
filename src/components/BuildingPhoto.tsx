"use client";

import { useEffect, useState } from "react";
import { blobUrl } from "@/lib/files";

/**
 * صورة واجهة العقار. الرابط مؤقّت ويُطلب عند العرض،
 * فتظهر الصورة لصاحب العقار المفتوح وحده.
 */
export function useBuildingPhoto(photo?: string) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!photo) { setUrl(null); return; }
    blobUrl(photo)
      .then((u) => { if (alive) setUrl(u); })
      .catch(() => { if (alive) setUrl(null); });
    return () => { alive = false; };
  }, [photo]);

  return url;
}
