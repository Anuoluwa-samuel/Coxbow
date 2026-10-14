import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth";
import { db } from "@/server/db/client";
import { listAudit } from "@/server/admin-queries";
import { Card, PageTitle, tableCls, tdCls, thCls } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Audit log", robots: { index: false } };

export default async function AuditPage() {
  await requirePagePermission("audit.read");
  const rows = await listAudit(db);
  return (
    <>
      <PageTitle title="Audit log" sub="Append-only record of sensitive actions. Latest 200 entries." />
      <Card>
        <div className="overflow-x-auto"><table className={tableCls}>
          <thead><tr>{["When (Lagos)", "Who", "Action", "Entity", "Details"].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">{rows.map(({ a, actor }) => (
            <tr key={a.id}><td className={tdCls}>{a.createdAt.toLocaleString("en-NG", { dateStyle: "short", timeStyle: "medium", timeZone: "Africa/Lagos" })}</td><td className={tdCls}>{actor ?? "System / customer"}</td><td className={`${tdCls} font-mono text-xs`}>{a.action}</td><td className={tdCls}>{a.entity}</td><td className={`${tdCls} max-w-xs truncate font-mono text-xs`}>{a.metadata ? JSON.stringify(a.metadata) : ""}</td></tr>))}</tbody></table></div>
      </Card>
    </>
  );
}
