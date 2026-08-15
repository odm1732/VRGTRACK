import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => {
      const v = row[h];
      const str = v == null ? "" : String(v);
      return str.includes(",") || str.includes('"') || str.includes("\n")
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(","));
  }
  return lines.join("\n");
}

function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportDataPage() {
  const now = new Date();
  const [fromDate, setFromDate] = useState(`${now.getFullYear()}-01-01`);
  const [toDate, setToDate] = useState(now.toISOString().split("T")[0]);

  const { data: weeklyData, refetch: refetchWeekly } = trpc.dashboard.weeklyReport.useQuery(
    { fromDate: new Date(fromDate), toDate: new Date(toDate) },
    { enabled: false }
  );
  const { data: members, refetch: refetchMembers } = trpc.members.listAll.useQuery(undefined, { enabled: false });

  const handleExportSubmissions = async () => {
    const result = await refetchWeekly();
    if (!result.data) { toast.error("No data to export."); return; }
    const rows = result.data.map((s) => ({
      member: s.member?.name ?? "",
      meetingDate: new Date(s.meetingDate).toLocaleDateString(),
      attended: s.attended ? "Yes" : "No",
      absenceReason: s.absenceReason ?? "",
      referrals: s.referralsParsed.reduce((sum, r) => sum + Number(r.count || 0), 0),
      oneToOnes: s.oneToOnesParsed.length,
      moneyReceived: s.moneyReceivedParsed.reduce((sum, m) => sum + Number(m.amount || 0), 0),
      visitors: s.visitorsCount,
    }));
    downloadCSV(`submissions_${fromDate}_${toDate}.csv`, toCSV(rows));
    toast.success("Submissions exported.");
  };

  const handleExportMembers = async () => {
    const result = await refetchMembers();
    if (!result.data) { toast.error("No data to export."); return; }
    const rows = result.data.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email ?? "",
      active: m.active ? "Yes" : "No",
      createdAt: new Date(m.createdAt).toLocaleDateString(),
    }));
    downloadCSV("members.csv", toCSV(rows));
    toast.success("Members exported.");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Export Data</h1>
        <p className="text-muted-foreground text-sm">Download group data as CSV files.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Date Range</CardTitle>
          <CardDescription>Select the date range for submission exports.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1.5">
            <Label>From</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submissions</CardTitle>
            <CardDescription>Export all weekly report submissions for the selected date range.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExportSubmissions} className="w-full">
              <Download className="h-4 w-4 mr-2" />Export Submissions CSV
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Members</CardTitle>
            <CardDescription>Export the full member list with contact details and status.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExportMembers} variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />Export Members CSV
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
