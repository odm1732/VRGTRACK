import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getRole } from "@/lib/api";
import { downloadNotesPdf } from "@/lib/notesPdf";
import { trpc } from "@/lib/trpc";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  Megaphone,
  NotebookPen,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

const WHO_KEY = "vrgtrack-notes-member";

/** The Tuesday of the week containing `base`, shifted by `offsetWeeks`. */
function tuesdayOf(base: Date, offsetWeeks: number): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const shift = (d.getDay() - 2 + 7) % 7; // days since Tuesday
  d.setDate(d.getDate() - shift + offsetWeeks * 7);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatISODate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function NotesGate({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const utils = trpc.useUtils();
  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="flex items-center justify-center min-h-[70vh] p-4">
      <div className="flex flex-col items-center gap-5 p-8 max-w-md w-full bg-background rounded-xl shadow-lg border">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <NotebookPen className="h-6 w-6 text-primary" />
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold">Meeting Notes</h1>
          <p className="text-sm text-muted-foreground">
            Enter the member password to take notes. Your notes are saved to your name, week by
            week.
          </p>
        </div>
        <form
          className="w-full space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            loginMutation.mutate({ password });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="member-password">Member Password</Label>
            <Input
              id="member-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? "Signing in…" : "Continue"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">Ask a group officer if you need the password.</p>
      </div>
    </div>
  );
}

export default function MeetingNotesPage() {
  const [authed, setAuthed] = useState(() => getRole() !== null);
  const [whoId, setWhoId] = useState<string>(() => {
    try {
      return localStorage.getItem(WHO_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [weekOffset, setWeekOffset] = useState(0);
  const meetingDate = useMemo(() => tuesdayOf(new Date(), weekOffset), [weekOffset]);

  const { data: members } = trpc.members.list.useQuery(undefined, { enabled: authed });
  const { data: agenda } = trpc.agenda.get.useQuery(undefined, { enabled: authed });
  const { data: note, isLoading: noteLoading } = trpc.notes.get.useQuery(
    { memberId: Number(whoId), meetingDate },
    { enabled: authed && whoId !== "" }
  );

  const [presentationNotes, setPresentationNotes] = useState("");
  const [educationalNotes, setEducationalNotes] = useState("");
  const [memberNotes, setMemberNotes] = useState<Record<string, string>>({});
  const [loadedKey, setLoadedKey] = useState("");
  const [dirty, setDirty] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Load the stored note whenever the person or week changes.
  const noteKey = `${whoId}|${meetingDate}`;
  useEffect(() => {
    if (!authed || whoId === "" || noteLoading) return;
    if (note === undefined) return; // fetch for this key hasn't resolved yet
    if (loadedKey === noteKey) return;
    setPresentationNotes(note?.presentationNotes ?? "");
    setEducationalNotes(note?.educationalNotes ?? "");
    setMemberNotes(note?.memberNotes ?? {});
    setLoadedKey(noteKey);
    setDirty(false);
  }, [authed, whoId, noteLoading, note, noteKey, loadedKey]);

  const saveMutation = trpc.notes.save.useMutation({
    onSuccess: () => {
      setDirty(false);
      toast.success("Notes saved.");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSave = () => {
    if (whoId === "") {
      toast.error("Select your name first.");
      return;
    }
    saveMutation.mutate({
      memberId: Number(whoId),
      meetingDate,
      presentationNotes,
      educationalNotes,
      memberNotes,
    });
  };

  const speakerThisWeek = agenda?.speakers.find((s) => s.date === meetingDate)?.name;
  const monthName = new Date(meetingDate).toLocaleString("en-US", { month: "long" });
  const trainerThisMonth = agenda?.educational.find((t) => t.label === monthName)?.name;
  const me = members?.find((m) => String(m.id) === whoId);
  const otherMembers = (members ?? []).filter((m) => String(m.id) !== whoId);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadNotesPdf({
        meetingDate,
        takerName: me?.name ?? "",
        speaker: speakerThisWeek ?? "",
        trainer: trainerThisMonth ?? "",
        presentationNotes,
        educationalNotes,
        members: otherMembers.map((m) => ({ name: m.name, note: memberNotes[String(m.id)] ?? "" })),
      });
    } catch {
      toast.error("Could not build the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="container flex h-16 items-center justify-between gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/"><ChevronLeft className="h-4 w-4 mr-1" />Home</Link>
          </Button>
          <span className="font-bold">Meeting Notes</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading || !authed}>
              <Download className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">{downloading ? "Building…" : "Download PDF"}</span>
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!authed || saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : dirty ? "Save*" : "Save"}
            </Button>
          </div>
        </div>
      </header>

      {!authed ? (
        <NotesGate onSuccess={() => setAuthed(true)} />
      ) : (
        <main className="container max-w-3xl py-6 space-y-5 pb-24">
          <Card>
            <CardContent className="flex flex-wrap items-end gap-4 pt-6">
              <div className="space-y-1.5 min-w-56 flex-1">
                <Label>Your name</Label>
                <Select
                  value={whoId}
                  onValueChange={(v) => {
                    setWhoId(v);
                    try {
                      localStorage.setItem(WHO_KEY, v);
                    } catch {
                      /* fine */
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select your name" /></SelectTrigger>
                  <SelectContent>
                    {(members ?? []).map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setWeekOffset((v) => v - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm text-center min-w-40">
                  <p className="font-medium">{formatISODate(meetingDate)}</p>
                  {weekOffset !== 0 && (
                    <button className="text-xs text-primary hover:underline" onClick={() => setWeekOffset(0)}>
                      Back to this week
                    </button>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWeekOffset((v) => v + 1)}
                  disabled={weekOffset >= 0}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {whoId === "" ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Select your name above to start taking notes.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Megaphone className="h-4 w-4" />10-Minute Presentation
                  </CardTitle>
                  {speakerThisWeek && <CardDescription>This week's speaker: {speakerThisWeek}</CardDescription>}
                </CardHeader>
                <CardContent>
                  <Textarea
                    rows={5}
                    placeholder="Notes on the presentation…"
                    value={presentationNotes}
                    onChange={(e) => { setPresentationNotes(e.target.value); setDirty(true); }}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BookOpen className="h-4 w-4" />Educational Training
                  </CardTitle>
                  {trainerThisMonth && <CardDescription>{monthName} trainer: {trainerThisMonth}</CardDescription>}
                </CardHeader>
                <CardContent>
                  <Textarea
                    rows={4}
                    placeholder="Notes on the training…"
                    value={educationalNotes}
                    onChange={(e) => { setEducationalNotes(e.target.value); setDirty(true); }}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4" />Member Notes
                  </CardTitle>
                  <CardDescription>
                    Commercials, referrals to follow up on, one-to-ones to schedule.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {otherMembers.map((m) => (
                    <div key={m.id} className="grid grid-cols-1 sm:grid-cols-[12rem_1fr] gap-1.5 sm:gap-3 sm:items-start">
                      <Label className="pt-2 font-medium">{m.name}</Label>
                      <Textarea
                        rows={1}
                        className="min-h-9"
                        placeholder="—"
                        value={memberNotes[String(m.id)] ?? ""}
                        onChange={(e) => {
                          setMemberNotes((prev) => ({ ...prev, [String(m.id)]: e.target.value }));
                          setDirty(true);
                        }}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving…" : "Save Notes"}
                </Button>
              </div>
            </>
          )}
        </main>
      )}
    </div>
  );
}
