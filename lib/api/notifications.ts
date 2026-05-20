import { createClient } from "@/lib/supabase/server";

export async function getNewAssignmentsTodayCount(userId: string): Promise<number> {
  if (!userId) return 0;

  const supabase = await createClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("client_stage_history")
    .select("id", { count: "exact", head: true })
    .eq("to_assigned_to", userId)
    .eq("action_type", "bulk_reassignment")
    .gte("created_at", startOfDay.toISOString());

  if (error) return 0;
  return count ?? 0;
}
