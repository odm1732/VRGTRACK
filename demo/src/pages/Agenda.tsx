import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { downloadAgendaPdf } from "@/lib/agendaPdf";
import { trpc } from "@/lib/trpc";
import { CalendarDays, ChevronLeft, Clock, Download, MapPin, Megaphone, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function AgendaPage() {
  const { data: agenda, isLoading } = trpc.agenda.get.useQuery();
  const [downloading, setDownloading] = useState(false);

  const today = startOfToday();
  const upcomingSpeakers = (agenda?.speakers ?? [])
    .filter((s) => parseISODate(s.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextSpeaker = upcomingSpeakers[0];
  const upcomingEvents = (agenda?.events ?? [])
    .filter((e) => parseISODate(e.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const handleDownload = async () => {
    if (!agenda) return;
    setDownloading(true);
    try {
      await downloadAgendaPdf(agenda, upcomingSpeakers, upcomingEvents);
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
          <span className="font-bold">Meeting Agenda</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading || !agenda}>
              <Download className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">{downloading ? "Building…" : "Download PDF"}</span>
            </Button>
            <Button size="sm" asChild>
              <Link href="/submit">Submit Report</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-3xl py-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Valley Referral Group</h1>
          <p className="text-muted-foreground">{agenda?.meetingInfo ?? ""}</p>
        </div>

        {isLoading ? (
          <Card><CardContent className="h-40 animate-pulse bg-muted rounded m-4" /></Card>
        ) : !agenda ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">Agenda unavailable.</CardContent></Card>
        ) : (
          <>
            {nextSpeaker && (
              <Card className="border-primary/40 bg-primary/5">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Megaphone className="h-6 w-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      {formatDate(nextSpeaker.date)} — 10-Minute Presentation
                    </p>
                    <p className="text-xl font-bold truncate">{nextSpeaker.name}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4" />Meeting Agenda</CardTitle></CardHeader>
              <CardContent className="space-y-0 p-0 pb-3">
                {agenda.agendaItems.map((a, i) => (
                  <div key={i} className="flex gap-4 px-6 py-2 text-sm">
                    <span className="w-12 shrink-0 font-mono font-medium text-muted-foreground">{a.time}</span>
                    <span>{a.item}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4" />Upcoming Speakers</CardTitle></CardHeader>
              <CardContent className="p-0 pb-3">
                {upcomingSpeakers.length === 0 ? (
                  <p className="px-6 py-3 text-sm text-muted-foreground">No speakers scheduled.</p>
                ) : (
                  upcomingSpeakers.map((s, i) => (
                    <div key={s.date + s.name} className="flex items-center gap-4 px-6 py-2 text-sm">
                      <span className="w-24 shrink-0 text-muted-foreground">{formatDate(s.date)}</span>
                      <span className={i === 0 ? "font-semibold" : ""}>{s.name}</span>
                      {i === 0 && <Badge className="bg-primary/10 text-primary border-primary/20">This week</Badge>}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {upcomingEvents.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4" />Upcoming Events</CardTitle></CardHeader>
                <CardContent className="p-0 pb-3">
                  {upcomingEvents.map((e, i) => (
                    <div key={i} className="px-6 py-2.5 text-sm">
                      <p className="font-medium">{e.name}</p>
                      <p className="text-muted-foreground">
                        {formatDate(e.date)}{e.time ? ` · ${e.time}` : ""}{e.location ? ` · ${e.location}` : ""}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Officers & Committees</CardTitle></CardHeader>
                <CardContent className="p-0 pb-3">
                  {agenda.officers.map((o, i) => (
                    <div key={i} className="px-6 py-1.5 text-sm">
                      <span className="text-muted-foreground">{o.role}: </span>
                      <span className="font-medium">{o.name}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Educational Training</CardTitle></CardHeader>
                <CardContent className="p-0 pb-3">
                  {agenda.educational.map((t, i) => (
                    <div key={i} className="px-6 py-1.5 text-sm">
                      <span className="text-muted-foreground">{t.label}: </span>
                      <span className="font-medium">{t.name}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
