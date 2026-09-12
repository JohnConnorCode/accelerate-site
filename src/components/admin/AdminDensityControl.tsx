"use client";
import { useId } from "react";
import { setAdminDensity, useAdminDensity } from "@/lib/admin/density";
export function AdminDensityControl() {
  const density = useAdminDensity();
  const groupId = useId();
  return (
    <fieldset className="admin-density-control">
      <legend>Density</legend>
      <div className="admin-density-options">
        {(["comfortable", "compact"] as const).map((value) => (
          <label key={value}>
            <input
              type="radio"
              name={groupId}
              value={value}
              checked={density === value}
              onChange={() => setAdminDensity(value)}
            />
            <span>{value === "comfortable" ? "Comfortable" : "Compact"}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
