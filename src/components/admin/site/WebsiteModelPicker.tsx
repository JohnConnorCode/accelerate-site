"use client";
import { DEFAULT_SITE_MODEL, SITE_STUDIO_MODELS, siteModel } from "@/lib/site-studio/models";
import { websiteFieldClass } from "./WebsiteFields";

export function WebsiteModelPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const selected = siteModel(value);
  return (
    <div className="space-y-2">
      <label className="block text-sm">
        Model
        <select
          aria-label="Model"
          className={websiteFieldClass}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        >
          {SITE_STUDIO_MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label}
              {model.id === DEFAULT_SITE_MODEL ? " · Default" : ""} ·{" "}
              {model.tier === "free"
                ? "Free"
                : model.tier === "low"
                  ? "Very low cost"
                  : model.tier === "premium"
                    ? "Premium"
                    : "Standard"}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-[var(--admin-muted)]">
        Input ${selected.prompt} / output ${selected.completion} per million tokens. These are price
        ceilings; the selected model will not silently switch. Free models may have tighter
        availability limits.
      </p>
    </div>
  );
}
