/**
 * Letter-size PDF of one member's meeting notes for one week. Members without
 * a typed note get a ruled blank line, so an empty download doubles as a
 * printable note-taking template.
 */

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 54;
const CONTENT_W = PAGE_W - MARGIN * 2;

export async function downloadNotesPdf(input: {
  meetingDate: string;
  takerName: string;
  speaker: string;
  trainer: string;
  presentationNotes: string;
  educationalNotes: string;
  members: { name: string; note: string }[];
}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let y = MARGIN;

  const ensureRoom = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const heading = (text: string, sub?: string) => {
    ensureRoom(44);
    y += 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text(text, MARGIN, y);
    if (sub) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(sub, PAGE_W - MARGIN, y, { align: "right" });
    }
    y += 6;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.75);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 14;
  };

  const paragraphOrRules = (text: string, blankLines: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    if (text.trim()) {
      const lines = doc.splitTextToSize(text, CONTENT_W) as string[];
      for (const line of lines) {
        ensureRoom(14);
        doc.text(line, MARGIN, y);
        y += 13;
      }
      y += 4;
    } else {
      doc.setDrawColor(226, 232, 240);
      for (let i = 0; i < blankLines; i++) {
        ensureRoom(20);
        y += 14;
        doc.line(MARGIN, y, PAGE_W - MARGIN, y);
        y += 4;
      }
      y += 2;
    }
  };

  const dateLabel = (() => {
    const [yy, mm, dd] = input.meetingDate.split("-").map(Number);
    return new Date(yy, (mm || 1) - 1, dd || 1).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  })();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text("VRG Meeting Notes", PAGE_W / 2, y + 4, { align: "center" });
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(100, 116, 139);
  doc.text(dateLabel + (input.takerName ? `  ·  ${input.takerName}` : ""), PAGE_W / 2, y, {
    align: "center",
  });
  y += 8;

  heading("10-Minute Presentation", input.speaker ? `Speaker: ${input.speaker}` : undefined);
  paragraphOrRules(input.presentationNotes, 5);

  heading("Educational Training", input.trainer ? `Trainer: ${input.trainer}` : undefined);
  paragraphOrRules(input.educationalNotes, 4);

  heading("Member Notes");
  doc.setFontSize(10);
  for (const m of input.members) {
    const noteLines = m.note.trim()
      ? (doc.splitTextToSize(m.note, CONTENT_W - 150) as string[])
      : [""];
    ensureRoom(noteLines.length * 13 + 8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);
    doc.text(m.name, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    if (m.note.trim()) {
      doc.text(noteLines, MARGIN + 150, y);
      y += noteLines.length * 13 + 5;
    } else {
      doc.setDrawColor(226, 232, 240);
      doc.line(MARGIN + 150, y + 2, PAGE_W - MARGIN, y + 2);
      y += 18;
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Valley Referral Group — Meeting Notes", MARGIN, PAGE_H - 30);
    if (pageCount > 1) doc.text(`${i} / ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 30, { align: "right" });
  }

  doc.save(`VRG-Meeting-Notes-${input.meetingDate}.pdf`);
}
