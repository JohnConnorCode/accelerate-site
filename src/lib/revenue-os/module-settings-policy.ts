/** Public configuration metadata must not request credentials. Bounded model
 * token counts are quantities, distinct from authentication tokens. */
export function isCredentialSetting(field: {
  key: string;
  label?: string;
  type: string;
  min?: number;
  max?: number;
}) {
  const names = `${field.key} ${field.label ?? ""}`;
  if (/secret|password|api[_-]?key|credential/i.test(names)) return true;
  if (!/token/i.test(names)) return false;
  const modelQuantity = ["maxInputTokensPerCall", "maxOutputTokensPerCall"].includes(field.key);
  return !(
    modelQuantity &&
    field.type === "number" &&
    typeof field.min === "number" &&
    field.min >= 0 &&
    typeof field.max === "number" &&
    field.max >= field.min &&
    field.max <= 1000000
  );
}
