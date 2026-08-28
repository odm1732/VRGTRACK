import type { AgendaDoc } from "@/lib/api";

/**
 * Builds a letter-size PDF of the meeting agenda from the live data, so the
 * download always matches what the page shows. jsPDF is imported lazily —
 * it only loads when someone clicks Download.
 */

const PAGE_W = 612; // 8.5in * 72
const PAGE_H = 792; // 11in * 72
const MARGIN = 54;
const CONTENT_W = PAGE_W - MARGIN * 2;

function formatISODate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export async function downloadAgendaPdf(
  agenda: AgendaDoc,
  upcomingSpeakers: { date: string; name: string }[],
  upcomingEvents: AgendaDoc["events"]
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let y = MARGIN;

  const ensureRoom = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const heading = (text: string) => {
    ensureRoom(40);
    y += 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text(text, MARGIN, y);
    y += 6;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.75);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 14;
  };

  const row = (left: string, right: string, leftWidth = 90) => {
    doc.setFontSize(10);
    const rightLines = doc.splitTextToSize(right, CONTENT_W - leftWidth) as string[];
    ensureRoom(rightLines.length * 13 + 3);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(left, MARGIN, y);
    doc.setTextColor(15, 23, 42);
    doc.text(rightLines, MARGIN + leftWidth, y);
    y += rightLines.length * 13 + 3;
  };

  // Title block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text("Valley Referral Group", PAGE_W / 2, y + 6, { align: "center" });
  y += 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(100, 116, 139);
  doc.text(agenda.meetingInfo, PAGE_W / 2, y, { align: "center" });
  y += 10;

  // This week's speaker callout
  const next = upcomingSpeakers[0];
  if (next) {
    ensureRoom(46);
    y += 8;
    doc.setFillColor(238, 242, 255);
    doc.roundedRect(MARGIN, y, CONTENT_W, 34, 4, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(67, 56, 202);
    doc.text(`${formatISODate(next.date).toUpperCase()} — 10-MINUTE PRESENTATION`, MARGIN + 12, y + 14);
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(next.name, MARGIN + 12, y + 28);
    y += 40;
  }

  heading("Meeting Agenda");
  for (const item of agenda.agendaItems) row(item.time, item.item, 46);

  heading("Upcoming Speakers");
  for (const s of upcomingSpeakers) row(formatISODate(s.date), s.name, 110);

  if (upcomingEvents.length > 0) {
    heading("Upcoming Events");
    for (const e of upcomingEvents) {
      row(
        formatISODate(e.date),
        `${e.name}${e.time ? ` — ${e.time}` : ""}${e.location ? ` — ${e.location}` : ""}`,
        110
      );
    }
  }

  heading("Officers & Committees");
  for (const o of agenda.officers) row(o.role, o.name, 150);

  if (agenda.educational.length > 0) {
    heading("Educational Training");
    for (const t of agenda.educational) row(t.label, t.name, 150);
  }

  // Footer with generation date on each page
  const pageCount = doc.getNumberOfPages();
  const stamp = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`VRG Meeting Agenda — current as of ${stamp}`, MARGIN, PAGE_H - 30);
    if (pageCount > 1) doc.text(`${i} / ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 30, { align: "right" });
  }

  doc.save("VRG-Meeting-Agenda.pdf");
}
