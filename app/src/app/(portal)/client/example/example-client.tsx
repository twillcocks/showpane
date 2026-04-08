"use client";

/**
 * Reference portal — the /portal create skill reads this file as the quality
 * and style guide when generating new portals. Keep it polished.
 * Login: username "example", password "demo123" (seeded by prisma/seed.ts)
 */

import { type ReactNode } from "react";
import { BarChart3, CalendarDays, ChevronDown, Download, FileText, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";
import { PortalShell } from "@/components/portal-shell";

function OverviewTab() {
  const steps = [
    {
      done: false,
      label: "Sign and return the NDA",
      text: (
        <>
          <a href="#documents" className="font-medium text-gray-900 underline underline-offset-2">
            Download here
          </a>{" "}
          sign and email to <span className="font-medium text-gray-900">jane@example.com</span>
        </>
      ),
    },
    {
      done: false,
      label: "Review an opportunity together",
      text: (
        <>
          Send the grant opportunity link to{" "}
          <span className="font-medium text-gray-900">jane@example.com</span> so we can review
          ahead of our call
        </>
      ),
    },
    {
      done: false,
      label: "Map the wider landscape",
      text: "We'll walk through the opportunity, share our market research, and project what tendering could deliver",
    },
    {
      done: false,
      label: "First bid on pay-as-you-go",
      text: "We handle it end-to-end — you see exactly what we deliver",
    },
  ] as const;

  return (
    <>
      <div className="mb-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100">
            <span className="text-sm font-bold text-blue-600">JS</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">Jane Smith</span>
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                Account Manager
              </span>
            </div>
            <div className="mt-0.5 flex gap-3">
              <span className="text-xs text-gray-400">jane@example.com</span>
            </div>
          </div>
        </div>
        <div className="px-4 py-3 sm:px-5">
          <p className="text-sm leading-relaxed text-gray-600">
            <span className="font-semibold text-gray-900">Welcome Sam and team.</span> I&apos;ve
            put everything together here: services overview, next steps, and documents. Looking
            forward to talking again next week.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="mb-4 text-base font-bold tracking-tight text-gray-900">Next steps</h3>
        <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
          <ol className="space-y-0">
            {steps.map((step, index, items) => (
              <li key={step.label} className="flex items-stretch gap-3 sm:gap-4">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                      step.done ? "bg-green-500 text-white" : "bg-gray-900 text-white"
                    )}
                  >
                    {step.done ? "✓" : index + 1}
                  </span>
                  {index < items.length - 1 ? <div className="w-px flex-1 bg-gray-100" /> : null}
                </div>
                <div className="pb-5">
                  <p className="text-sm font-semibold text-gray-900">{step.label}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-gray-500">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="mb-4 text-base font-bold tracking-tight text-gray-900">Our services</h3>
        <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
          <p className="text-sm leading-relaxed text-gray-600">
            We provide end-to-end bid management: opportunity sourcing, bid writing,
            submission handling, and post-submission feedback. Our pay-as-you-go model
            means you only pay when we work on a bid, with a success fee on wins.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              { title: "Opportunity Sourcing", desc: "We find and qualify tenders that match your capabilities" },
              { title: "Bid Writing", desc: "Professional responses tailored to each opportunity" },
              { title: "Submission Management", desc: "Portal compliance, formatting, and on-time delivery" },
              { title: "Post-Bid Analysis", desc: "Feedback review and continuous improvement" },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-gray-100 p-4">
                <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                <p className="mt-1 text-xs text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function MarketOverviewTab() {
  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold tracking-tight text-gray-900">Bids strategy</h3>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          In progress
        </span>
      </div>
      <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
        <p className="text-sm leading-relaxed text-gray-500">
          Your bids strategy starts with a thorough analysis of the tendering landscape in your
          sectors. We&apos;re currently researching historic opportunities, competitive dynamics,
          and sector fit to build a clear picture of where the strongest opportunities lie for
          Acme Health.
        </p>
        <div className="mt-5 border-t border-gray-100 pt-4">
          <p className="mb-2 text-xs font-medium text-gray-500">What this will include</p>
          <ul className="space-y-1.5">
            {[
              "Relevant tenders from the last 12 months",
              "Sector and buyer type analysis",
              "Competitive landscape overview",
              "Revenue projection from tendering",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-gray-500">
                <span className="mt-1 block h-1 w-1 shrink-0 rounded-full bg-gray-300" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              We&apos;ll share our findings and recommendations here once our analysis is complete.
            </p>
            <span className="ml-4 shrink-0 text-xs font-medium text-gray-500">
              Expected next week
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocumentsTab() {
  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold tracking-tight text-gray-900">Documents</h3>
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
              <p className="text-sm font-medium text-gray-900">Mutual Non-Disclosure Agreement</p>
              <p className="mt-1 text-sm text-gray-500">
                Please sign and return to{" "}
                <span className="font-medium text-gray-700">jane@example.com</span>
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
        <h3 className="text-base font-bold tracking-tight text-gray-900">Meetings</h3>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <h4 className="text-sm font-semibold text-gray-900">Intro Call</h4>
          <span className="text-xs font-medium text-gray-500">2 April 2026</span>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Jane (Demo Company) &amp; Sam Johnson (Acme Health) · ~25 mins
        </p>

        <div className="mt-5 space-y-4">
          <MeetingSection title="What we discussed">
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                Your current tendering setup and the challenges with the existing part-time
                arrangement
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                What we offer: the full end-to-end bid service, from opportunity sourcing through
                to feedback and continuous improvement
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                How our pricing works: pay-as-you-go to start, then
                move to a performance-guaranteed retainer if both sides want to continue
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                Capacity: we place no limits, so multiple tenders landing at once is never a problem
              </li>
            </ul>
          </MeetingSection>

          <MeetingSection title="What we noted about Acme Health">
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
                15+ years in the healthcare sector with strong public sector track record
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
                Approximately 8–12 applicable tenders per year, value ranging £150K–£3M
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
                Strategic shift toward private sector alongside continued public sector work
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
                Versatile product applicable across multiple healthcare settings
              </li>
            </ul>
          </MeetingSection>

          <MeetingSection title="Immediate opportunity">
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                Innovation grant for digital health: budget £1.5M
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                Deadline: 6 May 2026
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                Strong potential fit with your existing product applied to new patient populations
              </li>
            </ul>
          </MeetingSection>

          <MeetingSection title="Agreed next steps">
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                Sign and return the NDA (sent via this portal)
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                Sam to share the grant opportunity link
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                Sam to take materials to executive team for review
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                Follow-up call next week to review the opportunity, market research, and projected
                tendering impact
              </li>
            </ul>
            <p className="mt-3 text-xs text-gray-400">
              For the latest on these actions, see the Next steps timeline on the Services overview
              tab.
            </p>
          </MeetingSection>
        </div>
      </div>
    </div>
  );
}

export function ExamplePortalClient() {
  return (
    <PortalShell
      companyName="Demo Company"
      companyLogo={
        <span className="text-xs font-bold text-white">D</span>
      }
      clientName="Acme Health"
      clientLogoSrc="/example-logo.svg"
      clientLogoAlt="Acme Health"
      lastUpdated="2 April 2026"
      hideFooterOnTab="overview"
      contact={{
        name: "Jane Smith",
        title: "Account Manager",
        avatarSrc: "/example-avatar.svg",
        email: "jane@example.com",
      }}
      tabs={[
        { id: "overview", label: "Services overview", icon: Presentation, content: <OverviewTab /> },
        { id: "market", label: "Bids strategy", icon: BarChart3, content: <MarketOverviewTab /> },
        { id: "documents", label: "Documents", icon: FileText, badge: "amber", content: <DocumentsTab /> },
        { id: "meetings", label: "Meetings", icon: CalendarDays, content: <MeetingsTab /> },
      ]}
    />
  );
}
