import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { BarChart3, CalendarDays, DollarSign, NotebookPen, Target, Users } from "lucide-react";
import { Link } from "wouter";

function StatCard({
  icon: Icon,
  label,
  value,
  goal,
  unit,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  goal: number | null;
  unit?: string;
}) {
  const pct = goal && goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : null;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {unit === "$" ? `$${value.toLocaleString()}` : value.toLocaleString()}
        </div>
        {goal && (
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

export default function Home() {
  const { data: ytd, isLoading } = trpc.goals.ytdSummary.useQuery();
  const { data: month } = trpc.goals.monthSummary.useQuery();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="container flex h-16 items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <BarChart3 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg whitespace-nowrap">
              VRG<span className="hidden sm:inline"> Accountability</span>
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Button variant="outline" asChild>
              <Link href="/submit">Submit Report</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b bg-muted/30 py-16">
        <div className="container text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">
            Valley Referral Group
          </h1>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button size="lg" asChild>
              <Link href="/submit">Submit Weekly Report</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/dashboard">View Dashboard</Link>
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2">
            <Link
              href="/agenda"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <CalendarDays className="h-4 w-4" />
              Meeting agenda & speakers
            </Link>
            <Link
              href="/notes"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <NotebookPen className="h-4 w-4" />
              Meeting notes
            </Link>
          </div>
        </div>
      </section>

      {/* YTD Stats */}
      <section className="py-12">
        <div className="container space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Year-to-Date Progress</h2>
            <span className="text-sm text-muted-foreground">{new Date().getFullYear()}</span>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}><CardContent className="h-24 animate-pulse bg-muted rounded" /></Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Users} label="Referrals" value={ytd?.ytd.referrals ?? 0} goal={ytd?.goals?.referrals ?? null} />
              <StatCard icon={Target} label="One-to-Ones" value={ytd?.ytd.oneToOnes ?? 0} goal={ytd?.goals?.oneToOnes ?? null} />
              <StatCard icon={DollarSign} label="Money Received" value={ytd?.ytd.money ?? 0} goal={ytd?.goals?.money ?? null} unit="$" />
              <StatCard icon={BarChart3} label="Visitors" value={ytd?.ytd.visitors ?? 0} goal={ytd?.goals?.visitors ?? null} />
            </div>
          )}

          {month && (
            <>
              <h2 className="text-xl font-semibold pt-4">{month.monthName} This Month</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={Users} label="Referrals" value={month.month.referrals} goal={null} />
                <StatCard icon={Target} label="One-to-Ones" value={month.month.oneToOnes} goal={null} />
                <StatCard icon={DollarSign} label="Money Received" value={month.month.money} goal={null} unit="$" />
                <StatCard icon={BarChart3} label="Visitors" value={month.month.visitors} goal={null} />
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
