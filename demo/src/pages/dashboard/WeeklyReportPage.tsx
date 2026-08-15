import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

function getWeekBounds(offset: number = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { from: monday, to: sunday };
}

export default function WeeklyReportPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [search, setSearch] = useState("");

  const { from, to } = useMemo(() => getWeekBounds(weekOffset), [weekOffset]);

  const { data: submissions, isLoading } = trpc.dashboard.weeklyReport.useQuery({ fromDate: from, toDate: to });

  const filtered = useMemo(() => {
    if (!submissions) return [];
    if (!search) return submissions;
    const q = search.toLowerCase();
    return submissions.filter((s) => s.member?.name?.toLowerCase().includes(q));
  }, [submissions, search]);

  const weekLabel = `${from.toLocaleDateString()} – ${to.toLocaleDateString()}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Weekly Report</h1>
          <p className="text-muted-foreground text-sm">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((v) => v - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>
            This Week
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((v) => v + 1)} disabled={weekOffset >= 0}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Input placeholder="Search by member name…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submissions ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">No submissions for this week.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Attended</TableHead>
                  <TableHead>Referrals</TableHead>
                  <TableHead>1-to-1s</TableHead>
                  <TableHead>Money</TableHead>
                  <TableHead>Visitors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const totalRefs = s.referralsParsed.reduce((sum, r) => sum + Number(r.count || 0), 0);
                  const totalMoney = s.moneyReceivedParsed.reduce((sum, m) => sum + Number(m.amount || 0), 0);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.member?.name ?? "Unknown"}</TableCell>
                      <TableCell>
                        {s.attended ? (
                          <Badge variant="default" className="bg-green-500/10 text-green-700 border-green-200">Present</Badge>
                        ) : (
                          <Badge variant="destructive" className="bg-red-500/10 text-red-700 border-red-200">Absent</Badge>
                        )}
                      </TableCell>
                      <TableCell>{totalRefs}</TableCell>
                      <TableCell>{s.oneToOnesParsed.length}</TableCell>
                      <TableCell>{totalMoney > 0 ? `$${totalMoney.toLocaleString()}` : "-"}</TableCell>
                      <TableCell>{s.visitorsCount}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
