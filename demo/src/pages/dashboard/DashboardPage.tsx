import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { BarChart3, ChevronLeft, ChevronRight, ClipboardList, DollarSign, Target, Users } from "lucide-react";
import { useState } from "react";

/** Step a YYYY-MM key by whole months, staying in UTC so no timezone can shift it. */
function shiftMonth(key: string, delta: number) {
  const d = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  goal,
  unit,
  color = "text-primary",
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  goal?: number | null;
  unit?: string;
  color?: string;
}) {
  const pct = goal && goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : null;
  const display = unit === "$" ? `$${value.toLocaleString()}` : value.toLocaleString();
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{display}</div>
        {goal != null && (
          <p className="text-xs text-muted-foreground mt-1">
            Goal: {unit === "$" ? `$${goal.toLocaleString()}` : goal.toLocaleString()}
          </p>
        )}
        {pct !== null && (
          <div className="mt-2 space-y-1">
            <Progress value={pct} className="h-1.5" />
            <p className="text-xs text-muted-foreground">{pct}% of annual goal</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: ytd, isLoading: ytdLoading } = trpc.goals.ytdSummary.useQuery();
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>(undefined);
  const { data: month } = trpc.goals.monthSummary.useQuery({ month: selectedMonth });
  const year = new Date().getFullYear();

  const isCurrentMonth = !month || month.monthKey >= month.currentMonth;
  const canGoBack = !!month && month.monthKey > month.earliestMonth;

  const isLoading = statsLoading || ytdLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Overview of group performance for {year}.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="h-28 animate-pulse bg-muted rounded mt-4" /></Card>
          ))}
        </div>
      ) : (
        <>
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Year-to-Date</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Users} label="Referrals" value={ytd?.ytd.referrals ?? 0} goal={ytd?.goals?.referrals} color="text-blue-500" />
              <StatCard icon={Target} label="One-to-Ones" value={ytd?.ytd.oneToOnes ?? 0} goal={ytd?.goals?.oneToOnes} color="text-purple-500" />
              <StatCard icon={DollarSign} label="Money Received" value={ytd?.ytd.money ?? 0} goal={ytd?.goals?.money} unit="$" color="text-green-500" />
              <StatCard icon={BarChart3} label="Visitors" value={ytd?.ytd.visitors ?? 0} goal={ytd?.goals?.visitors} color="text-orange-500" />
            </div>
          </div>

          {month && (
            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {month.monthName} {month.monthKey.slice(0, 4)}
                  {isCurrentMonth ? " (This Month)" : ""}
                </h2>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Previous month"
                    disabled={!canGoBack}
                    onClick={() => setSelectedMonth(shiftMonth(month.monthKey, -1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Next month"
                    disabled={isCurrentMonth}
                    onClick={() => setSelectedMonth(shiftMonth(month.monthKey, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  {!isCurrentMonth && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setSelectedMonth(undefined)}
                    >
                      This month
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatCard icon={ClipboardList} label="Submissions" value={month.month.submissions} color="text-slate-500" />
                <StatCard icon={Users} label="Referrals" value={month.month.referrals} color="text-blue-500" />
                <StatCard icon={Target} label="One-to-Ones" value={month.month.oneToOnes} color="text-purple-500" />
                <StatCard icon={DollarSign} label="Money Received" value={month.month.money} unit="$" color="text-green-500" />
                <StatCard icon={BarChart3} label="Visitors" value={month.month.visitors} color="text-orange-500" />
              </div>
            </div>
          )}

          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Group Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-2 gap-4 max-w-sm">
              <StatCard icon={Users} label="Active Members" value={stats?.totalMembers ?? 0} color="text-primary" />
              <StatCard icon={BarChart3} label="Total Submissions" value={stats?.totalSubmissions ?? 0} color="text-primary" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
