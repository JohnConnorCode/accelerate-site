"use client";

import { useState } from "react";
import { CATEGORY_META, capabilities, type CapabilityCategory } from "@/content/command-center";
import styles from "./product.module.css";

export function CapabilityCatalog() {
  const [active, setActive] = useState<CapabilityCategory | "all">("all");
  const [query, setQuery] = useState("");
  const filtered = capabilities.filter((item) =>
    (active === "all" || item.category === active) &&
    `${item.title} ${item.promise} ${item.detail}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <div className={styles.catalog}>
      <label htmlFor="capability-search" className="text-sm font-medium">Find a capability</label>
      <input id="capability-search" type="search" className={styles.search} placeholder="Try customer, invoice, meeting…" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className={styles.filters} role="group" aria-label="Capability categories">
        <button type="button" aria-pressed={active === "all"} onClick={() => setActive("all")}>All capabilities</button>
        {CATEGORY_META.map((category) => <button key={category.id} type="button" aria-pressed={active === category.id} onClick={() => setActive(category.id)}>{category.label}</button>)}
      </div>
      <p role="status" className={styles.note}>{filtered.length} of {capabilities.length} capabilities</p>
      {filtered.length === 0 ? <div className={styles.card}><p>No capabilities match this search. Try another word or clear the filters.</p><button type="button" className={styles.textLink} onClick={() => { setQuery(""); setActive("all"); }}>Clear filters</button></div> :
        <div className={styles.grid}>{filtered.map((item) => <details key={item.id}>
          <summary><strong>{item.title}</strong><span>{item.promise}</span></summary>
          <div><p>{item.detail}</p>{item.gated && <p className={styles.note}>Uses the shared approval process.</p>}</div>
        </details>)}</div>}
    </div>
  );
}
