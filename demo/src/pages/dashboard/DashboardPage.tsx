import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { BarChart3, DollarSign, Target, Users } from "lucide-react";

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
  const { data: month } = trpc.goals.monthSummary.useQuery();
  const year = new Date().getFullYear();

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
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{month.monthName} (This Month)</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
