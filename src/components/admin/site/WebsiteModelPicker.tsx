"use client";
import { useEffect, useState, useId } from "react";
import {
  DEFAULT_SITE_MODEL,
  SITE_STUDIO_MODELS,
  SITE_MODELS_OBSERVED_AT,
  recommendedSiteModelIds,
  type SiteStudioModel,
} from "@/lib/site-studio/models";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { websiteFieldClass, websiteButtonClass } from "./WebsiteFields";

type Catalog = {
  models: SiteStudioModel[];
  observedAt: string;
  source: "live" | "cached" | "bundled";
};
const tierLabels = { free: "Free", low: "Low cost", standard: "Standard", premium: "Premium" };
export function WebsiteModelPicker({
  value,
  onChange,
  disabled,
}: {
  value: SiteStudioModel;
  onChange: (value: SiteStudioModel) => void;
  disabled?: boolean;
}) {
  const modelInputId = useId();
  const catalog = useAdminQuery<Catalog>(
    ["admin", "site-studio", "model-catalog"],
    "/api/admin/site/models?refresh=1",
    { staleTime: 300_000, retry: false, refetchOnWindowFocus: false },
  );
  const [browse, setBrowse] = useState(false);
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState("");
  const [cost, setCost] = useState("");
  const [sort, setSort] = useState("newest");
  const models = catalog.data?.models ?? SITE_STUDIO_MODELS;
  const recommendations = recommendedSiteModelIds(models);
  const selected = models.find((model) => model.id === value.id);
  // Keep the displayed price and submitted ceiling together. Never change IDs
  // automatically, including when a model disappears from the live catalogue.
  useEffect(() => {
    if (!disabled && selected && selected !== value) onChange(selected);
  }, [selected, value, onChange, disabled]);
  const query = search.trim().toLowerCase();
  const visible = models
    .filter(
      (model) =>
        (!provider || model.provider === provider) &&
        (!cost || model.tier === cost) &&
        (!query || `${model.label} ${model.id}`.toLowerCase().includes(query)) &&
        (browse || recommendations.includes(model.id)),
    )
    .sort((a, b) =>
      browse
        ? sort === "price"
          ? a.prompt + a.completion - (b.prompt + b.completion) || b.created - a.created
          : b.created - a.created
        : recommendations.indexOf(a.id) - recommendations.indexOf(b.id),
    );
  const option = (model: SiteStudioModel) => (
    <option key={model.id} value={model.id}>
      {model.label}
      {model.id === DEFAULT_SITE_MODEL ? " · Default" : ""} · {tierLabels[model.tier]}
    </option>
  );
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={modelInputId} className="text-sm">
          Model
        </label>
        <button
          type="button"
          className="min-h-10 text-xs underline underline-offset-4"
          aria-expanded={browse}
          onClick={() => {
            setBrowse(!browse);
            setSearch("");
            setProvider("");
            setCost("");
          }}
        >
          {browse ? "Recommended models" : "Browse all models"}
        </button>
      </div>
      {browse && (
        <div className="space-y-2 rounded-lg border border-[var(--admin-border)] p-3">
          <input
            aria-label="Search models"
            placeholder="Search names or model IDs"
            maxLength={100}
            className={websiteFieldClass}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="min-w-0 text-xs">
              Provider
              <select
                aria-label="Model provider"
                className={websiteFieldClass}
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
              >
                <option value="">All providers</option>
                {[...new Set(models.map((model) => model.provider))].sort().map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 text-xs">
              Cost
              <select
                aria-label="Model cost"
                className={websiteFieldClass}
                value={cost}
                onChange={(event) => setCost(event.target.value)}
              >
                <option value="">All prices</option>
                {Object.entries(tierLabels).map(([tier, label]) => (
                  <option key={tier} value={tier}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-[var(--admin-muted)]" role="status">
              {visible.length} matching models
            </span>
            <select
              aria-label="Sort models"
              className="min-h-10 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 text-xs"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="price">Lowest token price</option>
            </select>
          </div>
        </div>
      )}
      <select
        id={modelInputId}
        aria-label="Model"
        className={websiteFieldClass}
        value={value.id}
        onChange={(event) => {
          const choice = models.find((model) => model.id === event.target.value);
          if (choice) onChange(choice);
        }}
      >
        {!visible.some((model) => model.id === value.id) && (
          <optgroup label="Current selection">{option(value)}</optgroup>
        )}
        <optgroup label={browse ? "Matching models" : "Recommended"}>
          {visible.map(option)}
        </optgroup>
      </select>
      {!selected && (
        <p role="alert" className="text-xs text-[var(--admin-danger)]">
          This model is no longer in the current catalogue. Choose an available model before
          generating.
        </p>
      )}
      <p className="break-words text-xs text-[var(--admin-muted)]">
        {value.id}
        <br />
        Input ${value.prompt} / output ${value.completion} per million tokens. A price increase
        requires review; the model will not silently switch. Free models may have availability
        limits.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--admin-muted)]" role="status">
          {!catalog.isError && catalog.data?.source === "live"
            ? "Live catalogue"
            : "Saved catalogue"}{" "}
          · {(catalog.data?.observedAt ?? SITE_MODELS_OBSERVED_AT).slice(0, 10)}
          {catalog.isFetching ? " · Refreshing…" : ""}
        </p>
        <button
          type="button"
          disabled={disabled || catalog.isFetching}
          className={`${websiteButtonClass} text-xs`}
          onClick={() => void catalog.refetch()}
        >
          Refresh models
        </button>
      </div>
      {(catalog.isError ||
        catalog.data?.source === "cached" ||
        catalog.data?.source === "bundled") && (
        <p className="text-xs text-[var(--admin-muted)]">
          Using the saved catalogue. Refresh when connected; generation still checks compatibility
          and pricing.
        </p>
      )}
    </fieldset>
  );
}
