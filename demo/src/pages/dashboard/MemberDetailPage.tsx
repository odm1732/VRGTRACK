import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { ChevronLeft } from "lucide-react";
import { Link } from "wouter";

export default function MemberDetailPage({ memberId }: { memberId: number }) {
  const { data, isLoading } = trpc.dashboard.memberReport.useQuery({ memberId });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!data) return <div className="p-8 text-center text-muted-foreground">Member not found.</div>;

  const { member, submissions } = data;

  let totalRefs = 0, totalOto = 0, totalMoney = 0, totalVisitors = 0, absences = 0;
  for (const s of submissions) {
    totalRefs += s.referralsParsed.reduce((sum, r) => sum + Number(r.count || 0), 0);
    totalOto += s.oneToOnesParsed.length;
    totalMoney += s.moneyReceivedParsed.reduce((sum, m) => sum + Number(m.amount || 0), 0);
    totalVisitors += s.visitorsCount;
    if (!s.attended) absences++;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/members"><ChevronLeft className="h-4 w-4 mr-1" />Back</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{member.name}</h1>
          <p className="text-muted-foreground text-sm">{member.email ?? "No email"}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Referrals", value: totalRefs },
          { label: "One-to-Ones", value: totalOto },
          { label: "Money Received", value: `$${totalMoney.toLocaleString()}` },
          { label: "Absences", value: absences },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{s.label}</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{s.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Submission History ({submissions.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {submissions.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">No submissions yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Attended</TableHead>
                  <TableHead>Referrals</TableHead>
                  <TableHead>1-to-1s</TableHead>
                  <TableHead>Money</TableHead>
                  <TableHead>Visitors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((s) => {
                  const refs = s.referralsParsed.reduce((sum, r) => sum + Number(r.count || 0), 0);
                  const money = s.moneyReceivedParsed.reduce((sum, m) => sum + Number(m.amount || 0), 0);
                  return (
                    <TableRow key={s.id}>
                      <TableCell>{new Date(s.meetingDate).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {s.attended ? (
                          <Badge className="bg-green-500/10 text-green-700 border-green-200">Present</Badge>
                        ) : (
                          <Badge variant="destructive" className="bg-red-500/10 text-red-700 border-red-200">Absent</Badge>
                        )}
                      </TableCell>
                      <TableCell>{refs}</TableCell>
                      <TableCell>{s.oneToOnesParsed.length}</TableCell>
                      <TableCell>{money > 0 ? `$${money.toLocaleString()}` : "-"}</TableCell>
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
