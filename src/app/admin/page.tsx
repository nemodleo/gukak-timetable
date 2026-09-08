import { getRole } from "@/lib/auth";
import { getMonthData, getPairingsForRange, getSettings } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminGate } from "@/components/admin/AdminGate";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [role, settings] = await Promise.all([getRole(), getSettings()]);
  const configured = Boolean(
    process.env.ADMIN_PASSWORD || process.env.INSTRUCTOR_PASSWORD,
  );

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`${settings.school_name} · 관리자`} title="관리자" />
      {role === "admin" ? (
        <Tabs />
      ) : (
        <AdminGate isAdmin={false} configured={configured}>
          <span />
        </AdminGate>
      )}
    </div>
  );
}

async function Tabs() {
  const base = await getSettings();
  const data = await getMonthData(base.year, base.month);
  // schedule editor spans weeks that spill into neighbouring months
  const editorPairings = await getPairingsForRange(data.from, data.to);
  return (
    <AdminTabs
      settings={data.settings}
      pairings={editorPairings}
      cells={data.cells}
      memos={data.memos}
      dayConfigs={data.dayConfigs}
      year={base.year}
      month={base.month}
      role="admin"
      configured
    />
  );
}
