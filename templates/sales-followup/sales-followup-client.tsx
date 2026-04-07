"use client";

/**
 * TEMPLATE: Sales Follow-Up Portal
 *
 * Use this template after a sales call or introductory meeting.
 * Structure: Overview (welcome + next steps) → Meeting Notes → Documents
 *
 * This file is READ by Claude Code as a reference, not used directly.
 * /portal create reads this to understand the tab structure and content patterns.
 */

import { type ReactNode } from "react";
import {
  CalendarDays,
  ChevronDown,
  Download,
  FileText,
  Presentation,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PortalShell } from "@/components/portal-shell";

// ─── Tab 1: Overview ──────────────────────────────────────────
// Welcome message from the account manager, followed by a numbered
// "next steps" timeline. This is always the first tab.
function OverviewTab() {
  // Contact card: shows the account manager's name, role, and a short
  // personal message to the client. Keep it warm but professional.
  const contactMessage = (
    <div className="mb-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100">
          <span className="text-sm font-bold text-blue-600">JS</span>
        </div>
        <div className="flex-1">
          <span className="text-sm font-semibold text-gray-900">
            Jane Smith
          </span>
          <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
            Account Manager
          </span>
          <div className="mt-0.5">
            <span className="text-xs text-gray-400">jane@company.com</span>
          </div>
        </div>
      </div>
      <div className="px-4 py-3 sm:px-5">
        <p className="text-sm leading-relaxed text-gray-600">
          <span className="font-semibold text-gray-900">
            Welcome [Client Name].
          </span>{" "}
          I&apos;ve put everything together here: our discussion summary, next
          steps, and documents. Looking forward to our next conversation.
        </p>
      </div>
    </div>
  );

  // Next steps: numbered timeline with completion status.
  // Each step has: done (boolean), label, and descriptive text.
  // Replace these with actual action items from the meeting.
  const steps = [
    {
      done: false,
      label: "Review and sign the NDA",
      text: "Download from the Documents tab, sign, and return via email",
    },
    {
      done: false,
      label: "Share the opportunity details",
      text: "Send the project brief so we can prepare our analysis",
    },
    {
      done: false,
      label: "Follow-up call to review findings",
      text: "We'll walk through our research and recommendations",
    },
  ];

  return (
    <>
      {contactMessage}
      <div className="mt-6">
        <h3 className="mb-4 text-base font-bold tracking-tight text-gray-900">
          Next steps
        </h3>
        <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
          <ol className="space-y-0">
            {steps.map((step, index, items) => (
              <li key={step.label} className="flex items-stretch gap-3 sm:gap-4">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                      step.done
                        ? "bg-green-500 text-white"
                        : "bg-gray-900 text-white"
                    )}
                  >
                    {step.done ? "\u2713" : index + 1}
                  </span>
                  {index < items.length - 1 ? (
                    <div className="w-px flex-1 bg-gray-100" />
                  ) : null}
                </div>
                <div className="pb-5">
                  <p className="text-sm font-semibold text-gray-900">
                    {step.label}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-gray-500">
                    {step.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </>
  );
}

// ─── Tab 2: Meetings ──────────────────────────────────────────
// Collapsible sections for each meeting. Include: date, attendees,
// key discussion points, and agreed actions.
function MeetingSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-left">
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
      </summary>
      <div className="mt-2 pl-5">{children}</div>
    </details>
  );
}

function MeetingsTab() {
  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className="text-base font-bold tracking-tight text-gray-900">
          Meetings
        </h3>
      </div>
      <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <h4 className="text-sm font-semibold text-gray-900">
            Introductory Call
          </h4>
          <span className="text-xs font-medium text-gray-500">
            [Meeting Date]
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          [Attendee 1] &amp; [Attendee 2] - ~[duration] mins
        </p>
        <div className="mt-5 space-y-4">
          <MeetingSection title="What we discussed">
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                [Key discussion point 1]
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                [Key discussion point 2]
              </li>
            </ul>
          </MeetingSection>
          <MeetingSection title="Agreed next steps">
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                [Action item 1]
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                [Action item 2]
              </li>
            </ul>
          </MeetingSection>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 3: Documents ─────────────────────────────────────────
// Document cards with download buttons. Each document has a name,
// description, and action button.
function DocumentsTab() {
  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold tracking-tight text-gray-900">
          Documents
        </h3>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          Action required
        </span>
      </div>
      <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                [Document Name]
              </p>
              <p className="mt-1 text-sm text-gray-500">
                [Brief description or instructions]
              </p>
            </div>
          </div>
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-800 sm:w-auto"
          >
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Assembled Portal ─────────────────────────────────────────
// The exported component wires everything into PortalShell.
// Replace all placeholder values with actual client/company data.
export function SalesFollowupClient() {
  return (
    <PortalShell
      companyName="[Your Company]"
      companyLogo={
        <span className="text-xs font-bold text-white">C</span>
      }
      clientName="[Client Company]"
      clientLogoSrc="/client-logo.svg"
      clientLogoAlt="[Client Company]"
      lastUpdated="[Date]"
      hideFooterOnTab="overview"
      contact={{
        name: "[Account Manager Name]",
        title: "[Title]",
        avatarSrc: "/avatar.svg",
        email: "[email]",
      }}
      tabs={[
        {
          id: "overview",
          label: "Overview",
          icon: Presentation,
          content: <OverviewTab />,
        },
        {
          id: "meetings",
          label: "Meetings",
          icon: CalendarDays,
          content: <MeetingsTab />,
        },
        {
          id: "documents",
          label: "Documents",
          icon: FileText,
          badge: "amber",
          content: <DocumentsTab />,
        },
      ]}
    />
  );
}
