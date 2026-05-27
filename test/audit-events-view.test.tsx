import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuditEventsView } from "@/components/audit/audit-events-view";

describe("AuditEventsView", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          events: [
            {
              action: "cliente.archived",
              actor: {
                email: "admin@example.com",
                id: "11111111-1111-1111-1111-111111111111",
                role: "admin",
                source: "user",
              },
              after: { is_archived: true },
              before: { is_archived: false },
              cliente: {
                code: "6275",
                company_cnpj: null,
                email: "rodrigo@caveon.com.br",
                id: "22222222-2222-2222-2222-222222222222",
                nome: null,
                nomecliente: "Cave on APP",
                whatsapp: "5511984633244",
              },
              cliente_id: "22222222-2222-2222-2222-222222222222",
              created_at: "2026-05-27T12:00:00.000Z",
              diff: { is_archived: { before: false, after: true } },
              entity_id: "22222222-2222-2222-2222-222222222222",
              entity_type: "cliente",
              error_message: null,
              id: "33333333-3333-3333-3333-333333333333",
              metadata: {},
              operation_id: "44444444-4444-4444-4444-444444444444",
              request_path: "/clientes/22222222-2222-2222-2222-222222222222",
              status: "success",
              user_agent: "Vitest",
            },
          ],
          page: 1,
          pageSize: 25,
          total: 1,
        }),
        ok: true,
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders audit rows and opens event details", async () => {
    render(<AuditEventsView />);

    expect(await screen.findByText("cliente.archived")).toBeInTheDocument();
    expect(screen.getByText("Cave on APP")).toBeInTheDocument();
    fireEvent.click(screen.getByText("cliente.archived"));

    await waitFor(() => {
      expect(screen.getByText("Diff")).toBeInTheDocument();
      expect(screen.getByText("Filtrar operação")).toBeInTheDocument();
    });
  });
});
