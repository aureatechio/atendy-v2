import { describe, expect, it } from "vitest";
import {
  evaluateContractExpiry,
  type ContractExpiryClienteRow,
} from "@/lib/alerts/evaluateContractExpiry";

const NOW = new Date("2026-05-20T12:00:00Z");

function cliente(overrides: Partial<ContractExpiryClienteRow>): ContractExpiryClienteRow {
  return {
    id: "cliente-1",
    vigencia: null,
    inicio_vigencia: null,
    data_contrato_assinado: null,
    ...overrides,
  };
}

describe("evaluateContractExpiry", () => {
  it("ignores missing, blank, invalid, and out-of-window vigencias", () => {
    const res = evaluateContractExpiry({
      clientes: [
        cliente({ id: "missing", vigencia: null }),
        cliente({ id: "blank", vigencia: "   " }),
        cliente({ id: "invalid", vigencia: "31/02/2026" }),
        cliente({ id: "future", vigencia: "2026-06-05" }),
      ],
      now: NOW,
    });

    expect(res).toEqual([]);
  });

  it("emits warning when vigencia expires exactly in 15 days", () => {
    const res = evaluateContractExpiry({
      clientes: [cliente({ vigencia: "2026-06-04" })],
      now: NOW,
    });

    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({
      type: "contract_expiry",
      clienteId: "cliente-1",
      stageId: null,
      taskId: null,
      status: "warning",
      deadline: "2026-06-05T02:59:59.999Z",
    });
  });

  it("emits warning when vigencia expires today", () => {
    const res = evaluateContractExpiry({
      clientes: [cliente({ vigencia: "20/05/2026" })],
      now: NOW,
    });

    expect(res).toHaveLength(1);
    expect(res[0].status).toBe("warning");
    expect(res[0].deadline).toBe("2026-05-21T02:59:59.999Z");
  });

  it("emits overdue when vigencia expired yesterday", () => {
    const res = evaluateContractExpiry({
      clientes: [cliente({ vigencia: "2026-05-19" })],
      now: NOW,
    });

    expect(res).toHaveLength(1);
    expect(res[0].status).toBe("overdue");
  });

  it("accepts ISO datetimes and keeps the vigencia date as the contract deadline", () => {
    const res = evaluateContractExpiry({
      clientes: [cliente({ vigencia: "2026-05-30T15:45:00.000Z" })],
      now: NOW,
    });

    expect(res).toHaveLength(1);
    expect(res[0].status).toBe("warning");
    expect(res[0].deadline).toBe("2026-05-31T02:59:59.999Z");
  });

  it("uses inicio_vigencia as enteredAt, then data_contrato_assinado, then deadline", () => {
    const [withInicio, withContrato, fallback] = evaluateContractExpiry({
      clientes: [
        cliente({
          id: "inicio",
          vigencia: "2026-05-30",
          inicio_vigencia: "2026-01-10",
          data_contrato_assinado: "2026-01-01",
        }),
        cliente({
          id: "contrato",
          vigencia: "2026-05-30",
          data_contrato_assinado: "15/01/2026",
        }),
        cliente({
          id: "fallback",
          vigencia: "2026-05-30",
        }),
      ],
      now: NOW,
    });

    expect(withInicio.enteredAt).toBe("2026-01-10T03:00:00.000Z");
    expect(withContrato.enteredAt).toBe("2026-01-15T03:00:00.000Z");
    expect(fallback.enteredAt).toBe(fallback.deadline);
  });
});
