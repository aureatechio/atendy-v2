"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  SemResponsavelDrawer,
  type SemResponsavelClienteItem,
} from "@/components/dashboard/sem-responsavel-drawer";
import type { ResponsavelOption } from "@/components/dashboard/atribuir-responsavel-drawer";

interface Props {
  title: string;
  value: string;
  subtitle?: string;
  clientes: SemResponsavelClienteItem[];
  responsaveis: ResponsavelOption[];
}

export function SemResponsavelKpiCard({
  title,
  value,
  subtitle,
  clientes,
  responsaveis,
}: Props) {
  const [open, setOpen] = useState(false);
  const disabled = clientes.length === 0;

  return (
    <>
      <Card className="ds-kpi-card sem-responsavel-kpi-card">
        <CardContent className="ds-kpi-content">
          <button
            type="button"
            className="sem-responsavel-kpi-trigger"
            onClick={() => setOpen(true)}
            disabled={disabled}
            aria-label={`Abrir lista de ${value} ${title.toLowerCase()}`}
          >
            <span className="sem-responsavel-kpi-textwrap">
              <span className="ds-kpi-label">{title}</span>
              <span className="ds-kpi-value">{value}</span>
              {subtitle ? <span className="ds-kpi-foot">{subtitle}</span> : null}
            </span>
            {!disabled ? (
              <span className="sem-responsavel-kpi-cta" aria-hidden>
                Ver lista
                <ChevronRight size={14} />
              </span>
            ) : null}
          </button>
        </CardContent>
      </Card>

      <SemResponsavelDrawer
        open={open}
        clientes={clientes}
        responsaveis={responsaveis}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
