import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AgendaDoc } from "@/lib/api";
import { trpc } from "@/lib/trpc";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Structured editor for the public Meeting Agenda page. Each section is a
 * list of rows; the whole document saves in one click. Past speaker and
 * event dates stay editable here but rotate off the public page on their own.
 */

type Row = Record<string, string>;
type SectionKey = "agendaItems" | "officers" | "speakers" | "educational" | "events";

const SECTIONS: {
  key: SectionKey;
  title: string;
  description: string;
  fields: { name: string; label: string; type?: string; width?: string }[];
}[] = [
  {
    key: "agendaItems",
    title: "Meeting Agenda",
    description: "The running order shown on the agenda page.",
    fields: [
      { name: "time", label: "Time", width: "w-24" },
      { name: "item", label: "Item" },
    ],
  },
  {
    key: "speakers",
    title: "Speaker Schedule",
    description:
      "10-minute presentations. Past dates drop off the public page automatically — the next date shows as \"This week\".",
    fields: [
      { name: "date", label: "Date", type: "date", width: "w-40" },
      { name: "name", label: "Speaker" },
    ],
  },
  {
    key: "officers",
    title: "Officers & Committees",
    description: "Roles and the people in them.",
    fields: [
      { name: "role", label: "Role", width: "w-52" },
      { name: "name", label: "Name(s)" },
    ],
  },
  {
    key: "educational",
    title: "Educational Training",
    description: "Who runs the educational segment (e.g. by month).",
    fields: [
      { name: "label", label: "Month / Label", width: "w-40" },
      { name: "name", label: "Name" },
    ],
  },
  {
    key: "events",
    title: "Upcoming Events",
    description: "Past dates drop off the public page automatically.",
    fields: [
      { name: "date", label: "Date", type: "date", width: "w-40" },
      { name: "time", label: "Time", width: "w-36" },
      { name: "name", label: "Event" },
      { name: "location", label: "Location" },
    ],
  },
];

export default function AgendaEditorPage() {
  const utils = trpc.useUtils();
  const { data: agenda, isLoading } = trpc.agenda.get.useQuery();

  const [meetingInfo, setMeetingInfo] = useState("");
  const [sections, setSections] = useState<Record<SectionKey, Row[]>>({
    agendaItems: [],
    officers: [],
    speakers: [],
    educational: [],
    events: [],
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!agenda || loaded) return;
    setMeetingInfo(agenda.meetingInfo);
    setSections({
      agendaItems: agenda.agendaItems as unknown as Row[],
      officers: agenda.officers as unknown as Row[],
      speakers: agenda.speakers as unknown as Row[],
      educational: agenda.educational as unknown as Row[],
      events: agenda.events as unknown as Row[],
    });
    setLoaded(true);
  }, [agenda, loaded]);

  const saveMutation = trpc.agenda.set.useMutation({
    onSuccess: () => {
      utils.agenda.get.invalidate();
      toast.success("Agenda saved. The public page is updated.");
    },
    onError: (err) => toast.error(err.message),
  });

  const setRow = (key: SectionKey, index: number, field: string, value: string) =>
    setSections((prev) => ({
      ...prev,
      [key]: prev[key].map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    }));

  const addRow = (key: SectionKey) =>
    setSections((prev) => {
      const fields = SECTIONS.find((s) => s.key === key)!.fields;
      const empty = Object.fromEntries(fields.map((f) => [f.name, ""]));
      return { ...prev, [key]: [...prev[key], empty] };
    });

  const removeRow = (key: SectionKey, index: number) =>
    setSections((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));

  const handleSave = () => {
    const clean = (rows: Row[]) => rows.filter((r) => Object.values(r).some((v) => v.trim() !== ""));
    const sortByDate = (rows: Row[]) => [...rows].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    saveMutation.mutate({
      meetingInfo,
      agendaItems: clean(sections.agendaItems),
      officers: clean(sections.officers),
      speakers: sortByDate(clean(sections.speakers)),
      educational: clean(sections.educational),
      events: sortByDate(clean(sections.events)),
    } as unknown as AgendaDoc);
  };

  if (isLoading || !loaded) {
    return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Meeting Agenda</h1>
          <p className="text-muted-foreground text-sm">
            Everything here appears on the public agenda page.{" "}
            <a href="#/agenda" className="text-primary hover:underline inline-flex items-center gap-1">
              View it <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving…" : "Save Agenda"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meeting Time & Place</CardTitle>
        </CardHeader>
        <CardContent>
          <Input value={meetingInfo} onChange={(e) => setMeetingInfo(e.target.value)} />
        </CardContent>
      </Card>

      {SECTIONS.map((section) => (
        <Card key={section.key}>
          <CardHeader>
            <CardTitle className="text-base">{section.title}</CardTitle>
            <CardDescription>{section.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sections[section.key].length > 0 && (
              <div className="hidden md:flex gap-2 pr-10">
                {section.fields.map((f) => (
                  <Label key={f.name} className={`text-xs text-muted-foreground ${f.width ?? "flex-1"}`}>
                    {f.label}
                  </Label>
                ))}
              </div>
            )}
            {sections[section.key].map((row, i) => (
              <div key={i} className="flex flex-wrap md:flex-nowrap items-center gap-2">
                {section.fields.map((f) => (
                  <Input
                    key={f.name}
                    type={f.type ?? "text"}
                    placeholder={f.label}
                    value={row[f.name] ?? ""}
                    onChange={(e) => setRow(section.key, i, f.name, e.target.value)}
                    className={f.width ? `${f.width} shrink-0` : "flex-1 min-w-40"}
                  />
                ))}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => removeRow(section.key, i)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addRow(section.key)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />Add Row
            </Button>
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving…" : "Save Agenda"}
        </Button>
      </div>
    </div>
  );
}
