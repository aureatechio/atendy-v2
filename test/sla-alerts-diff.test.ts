import { describe, expect, it } from "vitest";
import { diffAlerts, type CurrentAlert, type OpenAlert } from "@/lib/sla/diffAlerts";

const baseSnap: CurrentAlert = {
  clienteId: "c1",
  stageId: "s1",
  status: "overdue",
  enteredAt: "2026-05-10T12:00:00-03:00",
  deadline: "2026-05-11T12:00:00-03:00",
};

const baseOpen: OpenAlert = {
  id: "alert-1",
  cliente_id: "c1",
  stage_id: "s1",
  status: "overdue",
};

describe("diffAlerts", () => {
  it("inserts new alerts when no open alert exists", () => {
    const res = diffAlerts([baseSnap], []);
    expect(res.toInsert).toHaveLength(1);
    expect(res.toInsert[0].cliente_id).toBe("c1");
    expect(res.toInsert[0].stage_id).toBe("s1");
    expect(res.toInsert[0].status).toBe("overdue");
    expect(res.toUpdate).toEqual([]);
    expect(res.toResolve).toEqual([]);
    expect(res.toTouch).toEqual([]);
  });

  it("updates status when warning escalates to overdue", () => {
    const res = diffAlerts([baseSnap], [{ ...baseOpen, status: "warning" }]);
    expect(res.toInsert).toEqual([]);
    expect(res.toUpdate).toEqual([{ id: "alert-1", status: "overdue" }]);
    expect(res.toResolve).toEqual([]);
    expect(res.toTouch).toEqual([]);
  });

  it("resolves open alerts no longer in snapshot", () => {
    const res = diffAlerts([], [baseOpen]);
    expect(res.toResolve).toEqual(["alert-1"]);
    expect(res.toInsert).toEqual([]);
    expect(res.toUpdate).toEqual([]);
    expect(res.toTouch).toEqual([]);
  });

  it("only touches when status unchanged", () => {
    const res = diffAlerts([baseSnap], [baseOpen]);
    expect(res.toInsert).toEqual([]);
    expect(res.toUpdate).toEqual([]);
    expect(res.toResolve).toEqual([]);
    expect(res.toTouch).toEqual(["alert-1"]);
  });

  it("handles mixed ops in a single run", () => {
    const snap: CurrentAlert[] = [
      baseSnap, // unchanged
      { ...baseSnap, clienteId: "c2", stageId: "s2", status: "overdue" }, // new
      { ...baseSnap, clienteId: "c3", stageId: "s3", status: "overdue" }, // escalation
    ];
    const open: OpenAlert[] = [
      baseOpen,
      { id: "alert-3", cliente_id: "c3", stage_id: "s3", status: "warning" },
      { id: "alert-4", cliente_id: "c4", stage_id: "s4", status: "warning" }, // gone
    ];
    const res = diffAlerts(snap, open);
    expect(res.toInsert.map((i) => i.cliente_id)).toEqual(["c2"]);
    expect(res.toUpdate).toEqual([{ id: "alert-3", status: "overdue" }]);
    expect(res.toResolve).toEqual(["alert-4"]);
    expect(res.toTouch).toEqual(["alert-1"]);
  });
});
