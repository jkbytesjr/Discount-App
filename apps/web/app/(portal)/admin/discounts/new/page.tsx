"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { useT } from "@/components/i18n";
import { DiscountForm } from "@/components/discount-form";

function Inner() {
  const { t } = useT();
  const router = useRouter();
  const businessId = useSearchParams().get("businessId") ?? "";
  const [list, setList] = useState<{ id: string; tradingName: string }[]>([]);
  useEffect(() => { api<{ items: { id: string; tradingName: string }[] }>("/admin/businesses?status=APPROVED&limit=100").then((r) => setList(r.items)).catch(() => {}); }, []);
  return (
    <>
      <div className="field" style={{ maxWidth: 420 }}>
        <label htmlFor="biz-pick">{t("nav.businesses")}</label>
        <select id="biz-pick" value={businessId} onChange={(e) => router.replace(`/admin/discounts/new?businessId=${e.target.value}`)}>
          <option value="" disabled>{t("common.select")}</option>
          {list.map((b) => <option key={b.id} value={b.id}>{b.tradingName}</option>)}
        </select>
      </div>
      {businessId ? <DiscountForm key={businessId} admin={{ businessId }} /> : null}
    </>
  );
}

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}
