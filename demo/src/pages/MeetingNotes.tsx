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
import { clearToken, getSession } from "@/lib/api";
import { downloadNotesPdf } from "@/lib/notesPdf";
import { trpc } from "@/lib/trpc";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  LogOut,
  Megaphone,
  NotebookPen,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
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
  const { data: members } = trpc.members.list.useQuery();
  const [memberId, setMemberId] = useState<string>(() => {
    try {
      return localStorage.getItem(WHO_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [password, setPassword] = useState("");
  const [groupCode, setGroupCode] = useState("");

  const selected = members?.find((m) => String(m.id) === memberId);
  const firstTime = selected ? selected.hasPassword === false : false;

  const utils = trpc.useUtils();
  const loginMutation = trpc.auth.memberLogin.useMutation({
    onSuccess: (r) => {
      utils.auth.me.invalidate();
      if (r.created) toast.success("Password created. It's yours from now on — don't lose it!");
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
            Sign in with your personal password. Your notes are private and saved week by week.
          </p>
        </div>
        <form
          className="w-full space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (memberId === "") {
              toast.error("Select your name first.");
              return;
            }
            loginMutation.mutate({
              memberId: Number(memberId),
              password,
              groupCode: firstTime ? groupCode : undefined,
            });
          }}
        >
          <div className="space-y-1.5">
            <Label>Your name</Label>
            <Select
              value={memberId}
              onValueChange={(v) => {
                setMemberId(v);
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
          <div className="space-y-1.5">
            <Label htmlFor="member-password">{firstTime ? "Create your password" : "Your password"}</Label>
            <Input
              id="member-password"
              type="password"
              placeholder={firstTime ? "At least 6 characters" : "Your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={firstTime ? 6 : 1}
              autoComplete={firstTime ? "new-password" : "current-password"}
            />
          </div>
          {firstTime && (
            <div className="space-y-1.5">
              <Label htmlFor="group-code">Group code</Label>
              <Input
                id="group-code"
                type="password"
                placeholder="Ask a group officer"
                value={groupCode}
                onChange={(e) => setGroupCode(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                First time here? Enter the group code once to create your personal password.
              </p>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
            {loginMutation.isPending
              ? "Signing in…"
              : firstTime
                ? "Create Password & Sign In"
                : "Sign In"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground text-center">
          Forgot your password? An admin can reset it from Manage Members, then sign in again
          with the group code.
        </p>
      </div>
    </div>
  );
}

export default function MeetingNotesPage() {
  const [session, setSession] = useState(() => getSession());
  const authed = session !== null;
  // Members are locked to their own notes; admins may pick anyone.
  const [adminWhoId, setAdminWhoId] = useState<string>("");
  const whoId = session?.role === "member" ? String(session.memberId) : adminWhoId;
  const [weekOffset, setWeekOffset] = useState(0);
  const meetingDate = useMemo(() => tuesdayOf(new Date(), weekOffset), [weekOffset]);

  const { data: members } = trpc.members.list.useQuery(undefined, { enabled: authed });
  const { data: agenda } = trpc.agenda.get.useQuery(undefined, { enabled: authed });
  const { data: note, isLoading: noteLoading } = trpc.notes.get.useQuery(
    { memberId: Number(whoId), meetingDate },
    { enabled: authed && whoId !== "" }
  );
  const { data: savedWeeks } = trpc.notes.index.useQuery(
    { memberId: Number(whoId) },
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

  const saveMutation = trpc.notes.save.useMutation();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const doSave = useCallback(
    async (silent: boolean) => {
      if (whoId === "") {
        if (!silent) toast.error("Select your name first.");
        return;
      }
      setSaveState("saving");
      try {
        await saveMutation.mutateAsync({
          memberId: Number(whoId),
          meetingDate,
          presentationNotes,
          educationalNotes,
          memberNotes,
        });
        setDirty(false);
        setSaveState("saved");
        if (!silent) toast.success("Notes saved.");
      } catch (e) {
        setSaveState("error");
        if (!silent) toast.error(e instanceof Error ? e.message : "Save failed.");
      }
    },
    [whoId, meetingDate, presentationNotes, educationalNotes, memberNotes, saveMutation]
  );
  const doSaveRef = useRef(doSave);
  doSaveRef.current = doSave;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // Autosave ~1.5s after typing stops.
  useEffect(() => {
    if (!dirty || whoId === "") return;
    const t = setTimeout(() => void doSaveRef.current(true), 1500);
    return () => clearTimeout(t);
  }, [dirty, whoId, presentationNotes, educationalNotes, memberNotes]);

  /** Save any unsaved changes immediately, then run a navigation action. */
  const flushThen = useCallback((action: () => void) => {
    if (dirtyRef.current) void doSaveRef.current(true);
    action();
  }, []);

  const handleSave = () => void doSave(false);

  const jumpToWeek = (iso: string) => {
    const currentTuesday = isoToDate(tuesdayOf(new Date(), 0));
    const offset = Math.round((isoToDate(iso).getTime() - currentTuesday.getTime()) / (7 * 86_400_000));
    flushThen(() => setWeekOffset(offset));
  };

  // Until the stored note for this member+week has arrived, typing would be
  // overwritten by the load — keep the fields disabled for that moment.
  const noteReady = whoId !== "" && !noteLoading && note !== undefined && loadedKey === noteKey;

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
              {saveState === "saving"
                ? "Saving…"
                : dirty
                  ? "Save*"
                  : saveState === "saved"
                    ? "Saved ✓"
                    : saveState === "error"
                      ? "Retry Save"
                      : "Save"}
            </Button>
          </div>
        </div>
      </header>

      {!authed ? (
        <NotesGate onSuccess={() => setSession(getSession())} />
      ) : (
        <main className="container max-w-3xl py-6 space-y-5 pb-24">
          <Card>
            <CardContent className="flex flex-wrap items-end gap-4 pt-6">
              <div className="space-y-1.5 min-w-56 flex-1">
                {session?.role === "member" ? (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label className="text-muted-foreground text-xs">Taking notes as</Label>
                      <p className="font-semibold">{me?.name ?? "…"}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        flushThen(() => {
                          clearToken();
                          setSession(null);
                        })
                      }
                    >
                      <LogOut className="h-4 w-4 mr-1.5" />Sign out
                    </Button>
                  </div>
                ) : (
                  <>
                    <Label>Member (admin view)</Label>
                    <Select value={adminWhoId} onValueChange={(v) => flushThen(() => setAdminWhoId(v))}>
                      <SelectTrigger><SelectValue placeholder="Select a member" /></SelectTrigger>
                      <SelectContent>
                        {(members ?? []).map((m) => (
                          <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => flushThen(() => setWeekOffset((v) => v - 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm text-center min-w-40">
                  <p className="font-medium">{formatISODate(meetingDate)}</p>
                  {weekOffset !== 0 && (
                    <button className="text-xs text-primary hover:underline" onClick={() => flushThen(() => setWeekOffset(0))}>
                      Back to this week
                    </button>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => flushThen(() => setWeekOffset((v) => v + 1))}
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
                    disabled={!noteReady}
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
                    disabled={!noteReady}
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
                        disabled={!noteReady}
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

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Notes auto-save a moment after you stop typing.
                </p>
                <Button onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveState === "saving" ? "Saving…" : "Save Notes"}
                </Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <History className="h-4 w-4" />Saved Weeks
                  </CardTitle>
                  <CardDescription>Jump back to any week you took notes.</CardDescription>
                </CardHeader>
                <CardContent>
                  {!savedWeeks || savedWeeks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No saved weeks yet — this week will appear here once you save.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {savedWeeks.map((w) => (
                        <Button
                          key={w.meetingDate}
                          size="sm"
                          variant={w.meetingDate === meetingDate ? "default" : "outline"}
                          onClick={() => jumpToWeek(w.meetingDate)}
                        >
                          {formatISODate(w.meetingDate)}
                        </Button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </main>
      )}
    </div>
  );
}
