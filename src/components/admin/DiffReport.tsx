"use client";

import type { ImportDiff, DiffItem } from "@/lib/import/diff";

interface DiffReportProps {
  diff: ImportDiff;
}

function DiffTable({ items, title }: { items: DiffItem[]; title: string }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-bold uppercase text-f1-muted">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-f1-border text-xs font-bold uppercase text-f1-muted">
              <th className="py-2 pr-4 text-left">Name</th>
              <th className="py-2 pr-4 text-right">Workbook</th>
              <th className="py-2 pr-4 text-right">App</th>
              <th className="py-2 text-center">Match</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.name}
                className={`border-b border-f1-border ${item.match ? "" : "bg-red-950/20"}`}
              >
                <td className="py-2 pr-4 text-f1-white">{item.name}</td>
                <td className="py-2 pr-4 text-right font-mono text-f1-white">
                  {item.workbookPoints >= 0 ? item.workbookPoints : "—"}
                </td>
                <td className="py-2 pr-4 text-right font-mono text-f1-white">
                  {item.appPoints >= 0 ? item.appPoints : "—"}
                </td>
                <td className="py-2 text-center">
                  {item.match ? (
                    <span className="text-xs font-bold text-team-sauber">✓</span>
                  ) : (
                    <span className="text-xs font-bold text-f1-red">✗</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function DiffReport({ diff }: DiffReportProps) {
  const totalItems = diff.drivers.length + diff.constructors.length;
  const mismatches = [...diff.drivers, ...diff.constructors].filter((d) => !d.match).length;

  return (
    <div className="space-y-6 border border-f1-border bg-f1-dark p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase text-f1-white">Diff Report</h2>
        <span
          className={`border px-2 py-0.5 text-xs font-bold uppercase ${
            diff.clean
              ? "border-team-sauber text-team-sauber"
              : "border-f1-red text-f1-red"
          }`}
        >
          {diff.clean ? "Clean" : `${mismatches} mismatch${mismatches !== 1 ? "es" : ""} / ${totalItems}`}
        </span>
      </div>
      <DiffTable items={diff.drivers} title="Driver Standings" />
      {diff.constructors.length > 0 && (
        <DiffTable items={diff.constructors} title="Constructor Standings" />
      )}
    </div>
  );
}
