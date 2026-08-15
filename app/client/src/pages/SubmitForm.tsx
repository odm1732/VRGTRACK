import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { CheckCircle, ChevronLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function SubmitForm() {
  const { data: members, isLoading: membersLoading } = trpc.members.list.useQuery();

  const [memberId, setMemberId] = useState<string>("");
  const [meetingDate, setMeetingDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [attended, setAttended] = useState(true);
  const [absenceReason, setAbsenceReason] = useState("");
  const [visitorsCount, setVisitorsCount] = useState(0);
  const [referrals, setReferrals] = useState<{ toMemberId: string; count: string }[]>([]);
  const [oneToOnes, setOneToOnes] = useState<number[]>([]);
  const [moneyReceived, setMoneyReceived] = useState<{ fromMemberId: string; amount: string }[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = trpc.submissions.create.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId) { toast.error("Please select your name."); return; }
    submitMutation.mutate({
      memberId: Number(memberId),
      meetingDate: new Date(meetingDate),
      attended,
      absenceReason: attended ? null : absenceReason,
      visitorsCount,
      referrals: referrals.filter((r) => r.toMemberId && r.count),
      oneToOnes,
      moneyReceived: moneyReceived.filter((m) => m.fromMemberId && m.amount),
    });
  };

  const toggleOneToOne = (id: number) => {
    setOneToOnes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">Report Submitted!</h2>
            <p className="text-muted-foreground">Your weekly accountability report has been recorded.</p>
            <div className="flex gap-3 justify-center pt-2">
              <Button variant="outline" onClick={() => { setSubmitted(false); setMemberId(""); setReferrals([]); setOneToOnes([]); setMoneyReceived([]); }}>
                Submit Another
              </Button>
              <Button asChild><Link href="/">Back to Home</Link></Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="container flex h-16 items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/"><ChevronLeft className="h-4 w-4 mr-1" />Back</Link>
          </Button>
          <span className="font-semibold">Submit Weekly Report</span>
        </div>
      </header>

      <div className="container py-8 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Meeting Information</CardTitle>
              <CardDescription>Select your name and the meeting date.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Your Name *</Label>
                <Select value={memberId} onValueChange={setMemberId}>
                  <SelectTrigger>
                    <SelectValue placeholder={membersLoading ? "Loading members…" : "Select your name"} />
                  </SelectTrigger>
                  <SelectContent>
                    {members?.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Meeting Date *</Label>
                <Input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} required />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="attended" checked={attended} onCheckedChange={(v) => setAttended(Boolean(v))} />
                <Label htmlFor="attended">I attended this meeting</Label>
              </div>
              {!attended && (
                <div className="space-y-1.5">
                  <Label>Reason for Absence</Label>
                  <Textarea placeholder="Brief reason for absence…" value={absenceReason} onChange={(e) => setAbsenceReason(e.target.value)} />
                </div>
              )}
            </CardContent>
          </Card>

          {attended && (
            <>
              {/* Visitors */}
              <Card>
                <CardHeader>
                  <CardTitle>Visitors</CardTitle>
                  <CardDescription>How many visitors did you bring to this meeting?</CardDescription>
                </CardHeader>
                <CardContent>
                  <Input type="number" min={0} value={visitorsCount} onChange={(e) => setVisitorsCount(Number(e.target.value))} />
                </CardContent>
              </Card>

              {/* Referrals */}
              <Card>
                <CardHeader>
                  <CardTitle>Referrals Given</CardTitle>
                  <CardDescription>Add referrals you gave to other members this week.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {referrals.map((ref, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Select value={ref.toMemberId} onValueChange={(v) => setReferrals((prev) => prev.map((r, j) => j === i ? { ...r, toMemberId: v } : r))}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select member" />
                        </SelectTrigger>
                        <SelectContent>
                          {members?.filter((m) => String(m.id) !== memberId).map((m) => (
                            <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input type="number" min={1} placeholder="Count" className="w-24" value={ref.count} onChange={(e) => setReferrals((prev) => prev.map((r, j) => j === i ? { ...r, count: e.target.value } : r))} />
                      <Button type="button" variant="ghost" size="sm" onClick={() => setReferrals((prev) => prev.filter((_, j) => j !== i))}>✕</Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setReferrals((prev) => [...prev, { toMemberId: "", count: "1" }])}>
                    + Add Referral
                  </Button>
                </CardContent>
              </Card>

              {/* One-to-Ones */}
              <Card>
                <CardHeader>
                  <CardTitle>One-to-Ones</CardTitle>
                  <CardDescription>Select members you had a one-to-one with this week.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {members?.filter((m) => String(m.id) !== memberId).map((m) => (
                      <div key={m.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`oto-${m.id}`}
                          checked={oneToOnes.includes(m.id)}
                          onCheckedChange={() => toggleOneToOne(m.id)}
                        />
                        <Label htmlFor={`oto-${m.id}`} className="font-normal cursor-pointer">{m.name}</Label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Money Received */}
              <Card>
                <CardHeader>
                  <CardTitle>Money Received</CardTitle>
                  <CardDescription>Record business revenue received from referrals this week.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {moneyReceived.map((m, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Select value={m.fromMemberId} onValueChange={(v) => setMoneyReceived((prev) => prev.map((r, j) => j === i ? { ...r, fromMemberId: v } : r))}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="From member" />
                        </SelectTrigger>
                        <SelectContent>
                          {members?.filter((mem) => String(mem.id) !== memberId).map((mem) => (
                            <SelectItem key={mem.id} value={String(mem.id)}>{mem.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input type="number" min={0} placeholder="Amount $" className="w-32" value={m.amount} onChange={(e) => setMoneyReceived((prev) => prev.map((r, j) => j === i ? { ...r, amount: e.target.value } : r))} />
                      <Button type="button" variant="ghost" size="sm" onClick={() => setMoneyReceived((prev) => prev.filter((_, j) => j !== i))}>✕</Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setMoneyReceived((prev) => [...prev, { fromMemberId: "", amount: "" }])}>
                    + Add Money Received
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={submitMutation.isPending}>
            {submitMutation.isPending ? "Submitting…" : "Submit Report"}
          </Button>
        </form>
      </div>
    </div>
  );
}
