import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { SlaEstouradoListCard } from "@/components/dashboard/sla-estourado-list-card";
import type { SlaEstouradoClienteItem } from "@/lib/dashboard/sla-estourado";

const clientes: SlaEstouradoClienteItem[] = [
  {
    id: "cliente-a",
    nome: "Acme Brasil",
    segmentoNome: "Alimentos",
    responsavelNome: "Ana Producao",
    diasNaEtapa: 5,
    slaHoursRemaining: -18,
    stageSlug: "briefing",
    stageName: "Briefing",
    stageColor: "#2563eb",
  },
  {
    id: "cliente-b",
    nome: "Beta Conteudo",
    segmentoNome: "Moda",
    responsavelNome: null,
    diasNaEtapa: 9,
    slaHoursRemaining: -52,
    stageSlug: "producao",
    stageName: "Producao",
    stageColor: "#dc2626",
  },
];

describe("SlaEstouradoListCard", () => {
  beforeAll(() => {
    vi.stubGlobal("React", React);
  });

  it("mostra a lista filtravel de clientes com SLA estourado", () => {
    render(<SlaEstouradoListCard clientes={clientes} />);

    expect(screen.getByRole("heading", { name: /Clientes com SLA estourado/i })).toBeInTheDocument();
    expect(screen.getByText("2 clientes")).toBeInTheDocument();
    expect(screen.getByText("Acme Brasil")).toBeInTheDocument();
    expect(screen.getByText("Beta Conteudo")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: /Filtrar clientes com SLA estourado/i }), {
      target: { value: "ana" },
    });

    expect(screen.getByText("Acme Brasil")).toBeInTheDocument();
    expect(screen.queryByText("Beta Conteudo")).not.toBeInTheDocument();
  });
});
