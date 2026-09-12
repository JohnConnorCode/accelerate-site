import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callSocialRpc, tenantIdForDatabase } from "@/lib/supabase/server";
import { socialConfiguration } from "./social-marketing";
export async function uploadWorkspaceMedia(db: SupabaseClient, file: File, actorEmail: string) {
  const cfg = await socialConfiguration(db);
  if (!file.size || file.size > 3000000 || !["image/png", "image/jpeg"].includes(file.type))
    throw new Error("Choose a PNG or JPEG image up to 3 MB");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const valid =
    file.type === "image/png"
      ? bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!valid) throw new Error("The image does not match its declared type");
  const hash = createHash("sha256").update(bytes).digest("hex");
  const id = randomUUID();
  const storagePath = `${cfg.tenantId}/${id}/${hash}.${file.type === "image/png" ? "png" : "jpg"}`;
  const uploaded = await db.storage
    .from("workspace-media")
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (uploaded.error) throw new Error("Private image upload failed");
  const result = await callSocialRpc(db, "execute_social_command", {
    p_operation_key: id,
    p_change: {
      operation: "register_media",
      id,
      storagePath,
      hash,
      mime: file.type,
      size: bytes.length,
    },
    p_config_updated_at: cfg.updatedAt,
    p_actor_email: actorEmail,
  });
  if (result.error)
    throw new Error(
      "Image was uploaded but registration failed; upload again. The unregistered image cannot be published.",
    );
  return { id, contentHash: hash, mimeType: file.type, sizeBytes: bytes.length };
}
export async function readWorkspaceMedia(db: SupabaseClient, id: string) {
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Workspace context required");
  const result = await db
    .from("media_assets")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .single();
  if (result.error || !result.data || !result.data.storage_path.startsWith(`${tenantId}/`))
    throw new Error("Image unavailable in this workspace");
  const file = await db.storage.from("workspace-media").download(result.data.storage_path);
  if (file.error || !file.data || file.data.size > 3000000)
    throw new Error("Private image unavailable");
  const bytes = new Uint8Array(await file.data.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== result.data.content_hash)
    throw new Error("Image changed; upload and approve again");
  return { bytes, mime: result.data.mime_type as "image/png" | "image/jpeg" };
}
