"use client";
import { use, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useErrorText, useT } from "@/components/i18n";
import { DiscountForm, type DiscountDto } from "@/components/discount-form";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useT();
  const errText = useErrorText();
  const [dto, setDto] = useState<DiscountDto | null>(null); const [error, setError] = useState("");
  useEffect(() => { api<DiscountDto>(`/discounts/${id}`).then(setDto).catch((e) => setError(errText(e))); }, [id]);
  if (error) return <div className="notice bad" role="alert">{error}</div>;
  if (!dto) return <span className="skeleton" style={{ width: 240 }} role="status" aria-label={t("common.loading")} />;
  return <DiscountForm initial={dto} />;
}
