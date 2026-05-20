import { describe, expect, it } from "vitest";
import { diffAlerts, type CurrentAlert, type OpenAlert } from "@/lib/sla/diffAlerts";

const baseSnap: CurrentAlert = {
  type: "stage_sla",
  clienteId: "c1",
  stageId: "s1",
  taskId: null,
  status: "overdue",
  enteredAt: "2026-05-10T12:00:00-03:00",
  deadline: "2026-05-11T12:00:00-03:00",
};

const baseOpen: OpenAlert = {
  id: "alert-1",
  type: "stage_sla",
  cliente_id: "c1",
  stage_id: "s1",
  task_id: null,
  status: "overdue",
};

describe("diffAlerts", () => {
  it("inserts new alerts when no open alert exists", () => {
    const res = diffAlerts([baseSnap], []);
    expect(res.toInsert).toHaveLength(1);
    expect(res.toInsert[0].cliente_id).toBe("c1");
    expect(res.toInsert[0].stage_id).toBe("s1");
    expect(res.toInsert[0].type).toBe("stage_sla");
    expect(res.toInsert[0].status).toBe("overdue");
  });

  it("updates status when warning escalates to overdue", () => {
    const res = diffAlerts([baseSnap], [{ ...baseOpen, status: "warning" }]);
    expect(res.toUpdate).toEqual([{ id: "alert-1", status: "overdue" }]);
  });

  it("resolves open alerts no longer in snapshot", () => {
    const res = diffAlerts([], [baseOpen]);
    expect(res.toResolve).toEqual(["alert-1"]);
  });

  it("only touches when status unchanged", () => {
    const res = diffAlerts([baseSnap], [baseOpen]);
    expect(res.toTouch).toEqual(["alert-1"]);
  });

  it("treats alerts with same cliente+stage but different type as distinct", () => {
    const stageAlert = baseSnap;
    const followupAlert: CurrentAlert = {
      ...baseSnap,
      type: "followup",
      status: "warning",
    };
    const openStage = baseOpen;
    const res = diffAlerts([stageAlert, followupAlert], [openStage]);
    expect(res.toTouch).toEqual(["alert-1"]); // stage_sla matches
    expect(res.toInsert).toHaveLength(1);
    expect(res.toInsert[0].type).toBe("followup");
    expect(res.toResolve).toEqual([]);
  });

  it("keys task_overdue by taskId", () => {
    const t1: CurrentAlert = {
      type: "task_overdue",
      clienteId: "c1",
      stageId: null,
      taskId: "task-A",
      status: "overdue",
      enteredAt: "2026-01-01T00:00:00Z",
      deadline: "2026-01-02T00:00:00Z",
    };
    const t2: CurrentAlert = { ...t1, taskId: "task-B" };
    const open: OpenAlert = {
      id: "alert-T",
      type: "task_overdue",
      cliente_id: "c1",
      stage_id: null,
      task_id: "task-A",
      status: "overdue",
    };
    const res = diffAlerts([t1, t2], [open]);
    expect(res.toTouch).toEqual(["alert-T"]);
    expect(res.toInsert).toHaveLength(1);
    expect(res.toInsert[0].task_id).toBe("task-B");
  });

  it("handles mixed ops in a single run", () => {
    const snap: CurrentAlert[] = [
      baseSnap,
      { ...baseSnap, clienteId: "c2", stageId: "s2" },
      { ...baseSnap, clienteId: "c3", stageId: "s3" },
    ];
    const open: OpenAlert[] = [
      baseOpen,
      {
        id: "alert-3",
        type: "stage_sla",
        cliente_id: "c3",
        stage_id: "s3",
        task_id: null,
        status: "warning",
      },
      {
        id: "alert-4",
        type: "stage_sla",
        cliente_id: "c4",
        stage_id: "s4",
        task_id: null,
        status: "warning",
      },
    ];
    const res = diffAlerts(snap, open);
    expect(res.toInsert.map((i) => i.cliente_id)).toEqual(["c2"]);
    expect(res.toUpdate).toEqual([{ id: "alert-3", status: "overdue" }]);
    expect(res.toResolve).toEqual(["alert-4"]);
    expect(res.toTouch).toEqual(["alert-1"]);
  });
});
