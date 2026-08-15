import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";

export default function GoalsPage() {
  const utils = trpc.useUtils();
  const { data: ytd, isLoading } = trpc.goals.ytdSummary.useQuery();

  const [referrals, setReferrals] = useState("");
  const [oneToOnes, setOneToOnes] = useState("");
  const [money, setMoney] = useState("");
  const [visitors, setVisitors] = useState("");
  const [editing, setEditing] = useState(false);

  const setGoalsMutation = trpc.goals.set.useMutation({
    onSuccess: () => {
      utils.goals.ytdSummary.invalidate();
      utils.goals.monthSummary.invalidate();
      setEditing(false);
      toast.success("Annual goals updated.");
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const handleStartEdit = () => {
    setReferrals(String(ytd?.goals?.referrals ?? ""));
    setOneToOnes(String(ytd?.goals?.oneToOnes ?? ""));
    setMoney(String(ytd?.goals?.money ?? ""));
    setVisitors(String(ytd?.goals?.visitors ?? ""));
    setEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setGoalsMutation.mutate({
      year: new Date().getFullYear(),
      referrals: Number(referrals) || 0,
      oneToOnes: Number(oneToOnes) || 0,
      money: Number(money) || 0,
      visitors: Number(visitors) || 0,
    });
  };

  const year = new Date().getFullYear();

  const metrics = [
    { label: "Referrals", ytdVal: ytd?.ytd.referrals ?? 0, goal: ytd?.goals?.referrals ?? 0 },
    { label: "One-to-Ones", ytdVal: ytd?.ytd.oneToOnes ?? 0, goal: ytd?.goals?.oneToOnes ?? 0 },
    { label: "Money Exchanged ($)", ytdVal: ytd?.ytd.money ?? 0, goal: ytd?.goals?.money ?? 0 },
    { label: "Visitors", ytdVal: ytd?.ytd.visitors ?? 0, goal: ytd?.goals?.visitors ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Annual Goals</h1>
          <p className="text-muted-foreground text-sm">Set and track group goals for {year}.</p>
        </div>
        {!editing && (
          <Button onClick={handleStartEdit}>
            {ytd?.goals ? "Edit Goals" : "Set Goals"}
          </Button>
        )}
      </div>

      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>Set Annual Goals for {year}</CardTitle>
            <CardDescription>Enter the group's targets for this year.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Referrals Goal</Label>
                  <Input type="number" min={0} value={referrals} onChange={(e) => setReferrals(e.target.value)} placeholder="e.g. 500" />
                </div>
                <div className="space-y-1.5">
                  <Label>One-to-Ones Goal</Label>
                  <Input type="number" min={0} value={oneToOnes} onChange={(e) => setOneToOnes(e.target.value)} placeholder="e.g. 200" />
                </div>
                <div className="space-y-1.5">
                  <Label>Money Exchanged Goal ($)</Label>
                  <Input type="number" min={0} value={money} onChange={(e) => setMoney(e.target.value)} placeholder="e.g. 100000" />
                </div>
                <div className="space-y-1.5">
                  <Label>Visitors Goal</Label>
                  <Input type="number" min={0} value={visitors} onChange={(e) => setVisitors(e.target.value)} placeholder="e.g. 50" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={setGoalsMutation.isPending}>
                  {setGoalsMutation.isPending ? "Saving…" : "Save Goals"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isLoading ? (
            [...Array(4)].map((_, i) => (
              <Card key={i}><CardContent className="h-24 animate-pulse bg-muted rounded mt-4" /></Card>
            ))
          ) : metrics.map(({ label, ytdVal, goal }) => {
            const pct = goal > 0 ? Math.min(100, Math.round((ytdVal / goal) * 100)) : 0;
            return (
              <Card key={label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold">{ytdVal.toLocaleString()}</span>
                    <span className="text-sm text-muted-foreground">/ {goal > 0 ? goal.toLocaleString() : "No goal set"}</span>
                  </div>
                  {goal > 0 && (
                    <>
                      <Progress value={pct} className="h-2" />
                      <p className="text-xs text-muted-foreground">{pct}% of annual goal</p>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
