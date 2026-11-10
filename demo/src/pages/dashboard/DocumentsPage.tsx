import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText, Printer, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * The originals live in public/documents/, so they ship with the static build
 * and sit next to index.html however the app is hosted. Resolving against the
 * current page (minus the hash route) keeps the links right at the domain root
 * or in a subdirectory.
 */
function fileUrl(name: string) {
  return new URL(`documents/${name}`, window.location.href.split("#")[0]).href;
}

async function shareDoc(title: string, url: string) {
  // Phones get the real share sheet; everything else gets the link on the clipboard.
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return;
    } catch (err) {
      // A cancelled share sheet is not a failure, so say nothing and stop.
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied to the clipboard.");
  } catch {
    toast.error("Could not copy the link. The address is: " + url);
  }
}

type DocMeta = {
  id: string;
  title: string;
  description: string;
  file: string;
  fileLabel: string;
};

const DOCS: DocMeta[] = [
  {
    id: "leadership-roles",
    title: "Leadership Roles and Requirements",
    description: "What each board and support board position is responsible for.",
    file: "vrg-leadership-roles.doc",
    fileLabel: "Word (.doc)",
  },
  {
    id: "membership-procedures",
    title: "Membership Committee Procedures",
    description: "How a potential member's application is handled, start to finish.",
    file: "vrg-membership-committee-procedures.pdf",
    fileLabel: "PDF",
  },
];

export default function DocumentsPage() {
  // The card being printed is tagged just before the dialog opens, so the print
  // stylesheet can hide the dashboard and everything but that one document.
  const [printingId, setPrintingId] = useState<string | null>(null);

  useEffect(() => {
    if (!printingId) return;
    window.print();
    setPrintingId(null);
  }, [printingId]);

  return (
    <div className="space-y-6">
      <div data-print-hide>
        <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground">
          VRG's governing documents, ready to print or send. Each one is reproduced below, and the
          original file is available to download.
        </p>
      </div>

      {DOCS.map((doc) => (
        <Card key={doc.id} data-print-area={printingId === doc.id ? "" : undefined}>
          <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary shrink-0" data-print-hide />
                {doc.title}
              </CardTitle>
              <CardDescription>{doc.description}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0" data-print-hide>
              <Button variant="default" size="sm" onClick={() => setPrintingId(doc.id)}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={fileUrl(doc.file)} download={doc.file}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </a>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => shareDoc(`VRG — ${doc.title}`, fileUrl(doc.file))}
              >
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-6" data-print-hide>
              Original file: {doc.fileLabel} · {doc.file}
            </p>
            {doc.id === "leadership-roles" ? <LeadershipRoles /> : <MembershipProcedures />}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ---------- shared document typography ---------- */

function DocTitle({ org, title }: { org: string; title: string }) {
  return (
    <header className="text-center border-b pb-4 mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{org}</p>
      <h2 className="text-xl font-bold tracking-tight mt-1">{title}</h2>
    </header>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="font-bold text-sm uppercase tracking-wide mt-6 mb-2">{children}</h3>;
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc pl-6 space-y-1.5 text-sm leading-relaxed">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/** The "** … **" asides in the source document, kept as their own callout. */
function Aside({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm leading-relaxed font-medium border-l-2 border-primary/40 pl-3 my-4">
      {children}
    </p>
  );
}

/* ---------- document 1 ---------- */

const BOARD = ["President", "Vice President", "Secretary", "Treasurer"];
const SUPPORT_BOARD = ["Membership Committee", "Events Coordinator", "Educational Coordinator"];

const ROLES: { role: string; duties: string[] }[] = [
  {
    role: "President",
    duties: [
      "Run each meeting according to the VRG Agenda and policies",
      "Notify the chapter of weather cancellations, meeting changes.",
      "Ensure that all members follow the policies and procedures",
    ],
  },
  {
    role: "Vice President",
    duties: [
      "In the absence of the President, run each meeting according to the VRG Agenda and policies",
      "Maintaining attendance records and reporting to the group weekly the number of referrals passed; visitors; and amount of closed business passed within the group.",
    ],
  },
  {
    role: "Secretary",
    duties: [
      "In the absence of the President and Vice President, run the meeting according to the VRG Agenda and policies",
      "Maintain meeting agenda file and print meeting agenda forms for each meeting",
      "Maintain the group's speaker schedule. Remind the speakers they are to submit a current Bio prior to their presentation",
      "Introduce the speaker(s) each week.",
    ],
  },
  {
    role: "Treasurer",
    duties: [
      "Collect application fees – new members and renewals",
      "Collect room fees and make payment of room fees",
      "Maintain bank account/accounts",
      "File legal documents; tax returns",
      "Address questions from visitors regarding the amount or use of fees after the meeting",
      "Current arrangement: liase with Jesse Daniel to ensure all of the above are done, obtain payment details from new members, report on balances weekly",
    ],
  },
  {
    role: "Membership Committee",
    duties: [
      "Consists of three to five members, with 1 member heading the committee (scheduling interviews, leading interviews, etc)",
      "Interview persons applying for membership in accordance with VRG General Policies and Guidelines for Membership",
      "Interview members renewing their memberships",
      "Review attendance records",
      "Evaluate complaints about members",
      "Report briefly each week on who is up for renewal, who has been accepted for membership, and/or who has stepped down from VRG",
    ],
  },
  {
    role: "Events Coordinator",
    duties: [
      "Schedule group events (1-2/year)",
      "Coordinate venue, event, food",
      "Report updates to the group",
      "Typically, 1 person, but extra help is always welcome",
    ],
  },
  {
    role: "Educational Coordinator",
    duties: [
      "Each member who volunteers will provide 2-3 minute presentations on information they feel will be beneficial to the group.",
      "Each volunteer will present for 1 month at a time",
    ],
  },
];

function LeadershipRoles() {
  return (
    <article className="max-w-3xl">
      <DocTitle org="Valley Referral Group" title="Leadership Roles and Requirements" />

      <div className="grid sm:grid-cols-2 gap-6 mb-2">
        <div>
          <Heading>Board Members</Heading>
          <Bullets items={BOARD} />
        </div>
        <div>
          <Heading>Support Board Members</Heading>
          <Bullets items={SUPPORT_BOARD} />
        </div>
      </div>

      <Heading>Roles and Requirements</Heading>
      {ROLES.map(({ role, duties }) => (
        <section key={role} className="mt-4">
          <h4 className="font-semibold text-sm mb-1.5">{role}:</h4>
          <Bullets items={duties} />
        </section>
      ))}
    </article>
  );
}

/* ---------- document 2 ---------- */

const INVITING_MEMBER = [
  "If your guest has potential conflict with ANY member of the group, it is your responsibility to talk to the member about the possible overlap. Do this in a 1-1, in person or over the phone. Handing someone a card is not enough. If the current member justifiably feels there is too much overlap, respect their feelings and don't invite the guest.",
  "Explain to your guest that they may overlap with a current member and that member is interested in speaking with them to see if the 2 can work out any overlap. Don't surprise your guest!",
];

const NO_OVERLAP = [
  "Applicant turns application and check over to the head of the MC",
  "Head of MC hands check to Treasurer and meets with MC and applicant to schedule an interview",
  "Applicant is interviewed, MC meets and discusses",
  "Applicant is notified of approval or disapproval",
  "VRG members are notified of new member",
];

const WITH_OVERLAP = [
  "Applicant indicates interest in joining VRG.",
  "Head of MC, or any other member of MC, checks with the member with overlap and asks that member to meet with the applicant to determine if the two can work together (member has the right to agree or disagree to meet with the applicant, especially if it is a significant overlap).",
  "Applicant is notified of the potential conflict, and may turn in application, but is informed that it is held and no interview is set until the member returns to the MC and states there is no conflict (possibly on paper so we have a paper trail?)",
  "If there IS conflict, the application is automatically denied and the Head of the MC is tasked with letting the applicant know",
  "If there is NO conflict, the application process can move forward",
  "Applicant is interviewed, MC meets and discusses",
  "Applicant is notified of approval or disapproval",
  "VRG members are notified of new member",
];

const CONCERN_REASONS = [
  "Prior business with the applicant that was not conducted professionally",
  "Applicant's attendance or behavior in another organization that a member is also a part of",
  "Knowledge of applicant's unwillingness to abide by the policies and procedures of VRG",
];

const CONCERNS_NOTICE =
  "Any member may bring any concerns regarding a potential member to any MC member up until the interview is held. All concerns must be addressed BEFORE the interview is conducted.";

function Lettered({ items }: { items: string[] }) {
  return (
    <ol className="list-[lower-alpha] pl-6 space-y-1.5 text-sm leading-relaxed">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ol>
  );
}

function MembershipProcedures() {
  return (
    <article className="max-w-3xl">
      <DocTitle org="Valley Referral Group" title="Membership Committee Procedures" />
      <p className="text-sm font-medium text-center -mt-3 mb-6">
        Application of Potential Member Processes
      </p>

      <Heading>Inviting Member's Responsibilities</Heading>
      <ol className="list-decimal pl-6 space-y-2 text-sm leading-relaxed">
        {INVITING_MEMBER.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>

      <Heading>Membership Committee Responsibilities</Heading>
      <Aside>
        In the event the inviting member is on the Membership Committee, it is the responsibility of
        that member to recuse themselves from the interview process as soon as the applicant has
        turned in application. If the member does not, it is the responsibility of the head of the MC
        to ask them to not participate in the application process.
      </Aside>

      <section className="mt-5">
        <h4 className="font-semibold text-sm mb-1.5">1. Application without overlap of a current member</h4>
        <Lettered items={NO_OVERLAP} />
        <Aside>{CONCERNS_NOTICE}</Aside>
      </section>

      <section className="mt-5">
        <h4 className="font-semibold text-sm mb-1.5">2. Application with overlap of a current member</h4>
        <Lettered items={WITH_OVERLAP} />
        <Aside>{CONCERNS_NOTICE}</Aside>
      </section>

      <section className="mt-5">
        <h4 className="font-semibold text-sm mb-1.5">3. Application with concern</h4>
        <ol className="list-[lower-alpha] pl-6 space-y-2 text-sm leading-relaxed">
          <li>
            If an application is submitted and a member of VRG has a concern about the applicant, or
            the applicant's business, that member must approach one of the members of the MC and voice
            that concern. The MC will in turn investigate the concern, and determine whether or not to
            move forward with the application
            <ol className="list-[lower-roman] pl-6 mt-1.5 space-y-1.5">
              <li>
                Possible reasons for concern:
                <ol className="list-decimal pl-6 mt-1.5 space-y-1">
                  {CONCERN_REASONS.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ol>
              </li>
            </ol>
          </li>
          <li>
            If the MC feels the Member's concerns are not justified, and the member is unwilling to
            move past those concerns, the MC will take the application to the group for a vote. The MC
            will abide by the vote of the majority.
          </li>
        </ol>
      </section>
    </article>
  );
}
