"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  formatLeadValue,
  leadClosedValue,
  leadHasServiceProduct,
  leadProposalValue,
  normalizeLeadStatus,
  type CrmLead,
} from "@/lib/crm-data";
import { funnelPipelinePath } from "@/lib/crm-funnels";
import { crmLeadStatusLabel } from "@/lib/crm-i18n";
import type { AppLanguage } from "@/lib/locale-types";
import { cn } from "@/lib/utils";
import { CrmDashboardCard, CrmDashboardSectionTitle, CrmDashboardSkeleton } from "./crm-dashboard-card";

type Props = {
  leads: CrmLead[];
  serviceProductMap: Record<string, number>;
  serviceProductLabels: readonly string[];
  serviceProductTotal: number;
  loading: boolean;
  language: AppLanguage;
  lt: (key: string) => string;
};

function leadPipelineHref(lead: CrmLead): string {
  return `${funnelPipelinePath(lead.funnel)}?lead=${encodeURIComponent(lead.id)}`;
}

function leadDealKind(lead: CrmLead): "sold" | "quoted" | "other" {
  if (normalizeLeadStatus(lead.status) === "Won" || leadClosedValue(lead) > 0) return "sold";
  if (leadProposalValue(lead) > 0) return "quoted";
  return "other";
}

function sortProductLeads(a: CrmLead, b: CrmLead): number {
  const rank = (lead: CrmLead) => {
    const kind = leadDealKind(lead);
    if (kind === "sold") return 0;
    if (kind === "quoted") return 1;
    return 2;
  };
  const byKind = rank(a) - rank(b);
  if (byKind !== 0) return byKind;
  return leadProposalValue(b) + leadClosedValue(b) - (leadProposalValue(a) + leadClosedValue(a));
}

export function CrmDashboardServiceProducts({
  leads,
  serviceProductMap,
  serviceProductLabels,
  serviceProductTotal,
  loading,
  language,
  lt,
}: Props) {
  const router = useRouter();
  const [openLabel, setOpenLabel] = useState<string | null>(null);

  const leadsByProduct = useMemo(() => {
    const map: Record<string, CrmLead[]> = {};
    for (const label of serviceProductLabels) {
      map[label] = leads.filter((lead) => leadHasServiceProduct(lead, label)).sort(sortProductLeads);
    }
    return map;
  }, [leads, serviceProductLabels]);

  const openProduct = (label: string) => {
    const matches = leadsByProduct[label] ?? [];
    if (matches.length === 1) {
      router.push(leadPipelineHref(matches[0]));
      return;
    }
    setOpenLabel((prev) => (prev === label ? null : label));
  };

  return (
    <CrmDashboardCard>
      <CrmDashboardSectionTitle>{lt("SERVICE / PRODUCT TYPES")}</CrmDashboardSectionTitle>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <CrmDashboardSkeleton key={i} className="h-10" />
            ))}
          </div>
        ) : serviceProductLabels.length === 0 ? (
          <p className="text-sm text-[rgba(255,255,255,0.45)]">{lt("No service or product types yet.")}</p>
        ) : (
          <ul className="space-y-4">
            {serviceProductLabels.map((label) => {
              const count = serviceProductMap[label] ?? 0;
              const pct = Math.round((count / serviceProductTotal) * 1000) / 10;
              const matches = leadsByProduct[label] ?? [];
              const expanded = openLabel === label && matches.length > 1;
              return (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() => openProduct(label)}
                    aria-expanded={expanded}
                    title={lt("View who was quoted or sold this product")}
                    className="w-full rounded-lg text-left transition hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center justify-between px-1 text-sm">
                      <span className="min-w-0 truncate text-white underline-offset-2 hover:underline">{label}</span>
                      <span className="mono-num shrink-0 text-[rgba(255,255,255,0.45)]">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
                      <div
                        className="h-full rounded-full bg-[var(--primary)]"
                        style={{
                          width: `${Math.min(100, serviceProductTotal ? (count / serviceProductTotal) * 100 : 0)}%`,
                        }}
                      />
                    </div>
                  </button>
                  {expanded ? (
                    <ul className="mt-2 space-y-1 border-l border-white/[0.08] pl-3">
                      {matches.map((lead) => {
                        const kind = leadDealKind(lead);
                        const dealLabel =
                          kind === "sold" ? lt("Sold") : kind === "quoted" ? lt("Quoted") : crmLeadStatusLabel(lead.status, language);
                        const amount = kind === "sold" ? leadClosedValue(lead) : leadProposalValue(lead);
                        return (
                          <li key={lead.id}>
                            <button
                              type="button"
                              onClick={() => router.push(leadPipelineHref(lead))}
                              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition hover:bg-white/[0.04]"
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs text-white">{lead.name}</span>
                                <span className="block truncate text-[0.65rem] text-[rgba(255,255,255,0.4)]">
                                  {lead.company?.trim() || lead.owner || "—"}
                                </span>
                              </span>
                              <span
                                className={cn(
                                  "shrink-0 text-[0.65rem] uppercase tracking-wide",
                                  kind === "sold" ? "text-emerald-400" : "text-[rgba(255,255,255,0.45)]",
                                )}
                              >
                                {dealLabel}
                              </span>
                              {amount > 0 ? (
                                <span className="mono-num shrink-0 text-[0.65rem] text-[rgba(255,255,255,0.55)]">
                                  {formatLeadValue(amount)}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </CrmDashboardCard>
  );
}
