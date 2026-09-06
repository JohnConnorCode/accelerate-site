import { MemorySupabase, type Row } from "./memory-supabase";
export class AuthorizedMemorySupabase extends MemorySupabase {
  constructor(seed: Record<string, Row[]> = {}) {
    super(seed);
    this.rpc("check_autonomy", ({ p_action_key }) => ({
      action_key: p_action_key,
      allowed: false,
      level: "always_ask",
      requires_approval: true,
      policy_id: null,
      hard_floor: false,
      reason: "No standing policy; explicit human approval required",
    }));
  }
}
