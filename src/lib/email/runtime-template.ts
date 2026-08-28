import { createServiceRoleClient } from "@/lib/supabase/server";
import { getEmailTemplateDefinition, renderDefinition, replaceEmailVariables } from "./registry";
import { blocksFromPlainText, parseStoredEmailBlocks, renderEmailBlocks } from "./blocks";

export interface ResolvedEmailTemplate {
  templateKey: string;
  versionId: string | null;
  source: "published" | "built_in";
  subject: string;
  text: string;
  html: string;
}

export async function resolveEmailTemplate(templateKey: string, variables: Record<string, string>): Promise<ResolvedEmailTemplate> {
  const definition = getEmailTemplateDefinition(templateKey);
  if (!definition) throw new Error(`Unknown email template: ${templateKey}`);

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("email_templates")
      .select("current_published_version, email_template_versions!email_templates_current_published_version_fkey(id, subject_template, body_template)")
      .eq("template_key", templateKey)
      .maybeSingle();
    if (!error && data?.current_published_version) {
      const version = Array.isArray(data.email_template_versions) ? data.email_template_versions[0] : data.email_template_versions;
      if (version) {
        const subject = replaceEmailVariables(version.subject_template, variables);
        const blocks = parseStoredEmailBlocks(version.body_template) || blocksFromPlainText(version.body_template);
        const { text, html } = await renderEmailBlocks(blocks, variables);
        return { templateKey, versionId: version.id, source: "published", subject, text, html };
      }
    }
  } catch {
    // Built-in templates deliberately remain available during migration or a
    // temporary database failure so transactional mail is never blank.
  }

  const rendered = renderDefinition(definition, variables);
  return { templateKey, versionId: null, source: "built_in", ...rendered };
}
