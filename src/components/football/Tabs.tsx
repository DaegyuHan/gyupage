"use client";

import { useState } from "react";

export interface TabItem {
  key: string;
  label: string;
  content: React.ReactNode;
}

export default function Tabs({ items, initial }: { items: TabItem[]; initial?: string }) {
  const [active, setActive] = useState(initial ?? items[0]?.key);
  const current = items.find((t) => t.key === active) ?? items[0];

  return (
    <div>
      <div role="tablist" className="mb-6 flex justify-center gap-1 border-b border-line">
        {items.map((t) => {
          const on = t.key === current?.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={on}
              onClick={() => setActive(t.key)}
              className={`-mb-px border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
                on ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel">{current?.content}</div>
    </div>
  );
}
