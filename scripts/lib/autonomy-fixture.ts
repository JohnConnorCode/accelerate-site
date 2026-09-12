import { MemorySupabase, type Row } from "./memory-supabase";
import { installPipelineActionFixture } from "./pipeline-action-fixture";
import { installLocalActionFixture } from "./local-action-fixture";
export class AuthorizedMemorySupabase extends MemorySupabase {
  constructor(seed: Record<string, Row[]> = {}) {
    super(seed);
    installLocalActionFixture(this);
    installPipelineActionFixture(this);
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
