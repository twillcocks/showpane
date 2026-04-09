"use client";

/**
 * TEMPLATE: Consulting Engagement Portal
 *
 * Use for ongoing consulting/advisory engagements.
 * Structure: Project Overview → Deliverables & Timeline → Documents → Meetings
 *
 * This file is READ by Claude Code as a reference, not used directly.
 */

import { type ReactNode } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  FileText,
  LayoutDashboard,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PortalShell } from "@/components/portal-shell";

// ─── Tab 1: Project Overview ──────────────────────────────────
// High-level summary: what the engagement covers, current phase,
// key contacts, and engagement terms.
function ProjectOverviewTab() {
  return (
    <>
      <div className="mb-6 rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold tracking-tight text-gray-900">
            Engagement summary
          </h3>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            Active
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          [Brief description of the consulting engagement: what problem you are
          solving, the approach, and expected outcomes. 2-3 sentences.]
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Started", value: "[Start Date]" },
            { label: "Phase", value: "[Current Phase]" },
            { label: "Next milestone", value: "[Milestone]" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-gray-100 p-3"
            >
              <p className="text-xs text-gray-500">{item.label}</p>
              <p className="mt-0.5 text-sm font-semibold text-gray-900">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
        <h3 className="mb-3 text-base font-bold tracking-tight text-gray-900">
          Scope of work
        </h3>
        <ul className="space-y-2">
          {[
            "[Workstream 1: description]",
            "[Workstream 2: description]",
            "[Workstream 3: description]",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-gray-600">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

// ─── Tab 2: Deliverables & Timeline ───────────────────────────
// Phase-based timeline showing what has been delivered and what is
// coming next. Each phase has status (complete/in-progress/upcoming).
function DeliverablesTab() {
  const phases = [
    {
      name: "Phase 1: Discovery",
      status: "complete" as const,
      items: ["Stakeholder interviews", "Current state assessment", "Gap analysis report"],
    },
    {
      name: "Phase 2: Recommendations",
      status: "in-progress" as const,
      items: ["Strategy document", "Implementation roadmap", "Cost-benefit analysis"],
    },
    {
      name: "Phase 3: Implementation Support",
      status: "upcoming" as const,
      items: ["Vendor selection", "Migration plan", "Go-live support"],
    },
  ];

  const statusConfig = {
    complete: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-400", label: "Complete" },
    "in-progress": { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-400", label: "In progress" },
    upcoming: { bg: "bg-gray-50", text: "text-gray-500", dot: "bg-gray-300", label: "Upcoming" },
  };

  return (
    <div className="w-full space-y-4">
      <h3 className="text-base font-bold tracking-tight text-gray-900">
        Deliverables & timeline
      </h3>
      {phases.map((phase) => {
        const config = statusConfig[phase.status];
        return (
          <div key={phase.name} className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900">{phase.name}</h4>
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", config.bg, config.text)}>
                <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
                {config.label}
              </span>
            </div>
            <ul className="mt-3 space-y-1.5">
              {phase.items.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                  {phase.status === "complete" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                  )}
                  {item}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab 3: Documents ─────────────────────────────────────────
function DocumentsTab() {
  const docs = [
    { name: "[Deliverable 1]", type: "PDF", date: "[Date]" },
    { name: "[Deliverable 2]", type: "PDF", date: "[Date]" },
  ];

  return (
    <div className="w-full">
      <h3 className="mb-4 text-base font-bold tracking-tight text-gray-900">
        Documents
      </h3>
      <div className="space-y-3">
        {docs.map((doc) => (
          <div key={doc.name} className="flex items-center justify-between rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 shrink-0 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                <p className="text-xs text-gray-500">{doc.type} - {doc.date}</p>
              </div>
            </div>
            <button type="button" className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-gray-800">
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Assembled Portal ─────────────────────────────────────────
export function ConsultingClient() {
  return (
    <PortalShell
      companyName="[Your Company]"
      companyLogo={<span className="text-xs font-bold text-white">C</span>}
      clientName="[Client Company]"
      clientLogoSrc="/client-logo.svg"
      clientLogoAlt="[Client Company]"
      lastUpdated="[Date]"
      contact={{
        name: "[Consultant Name]",
        title: "[Title]",
        avatarSrc: "/avatar.svg",
        email: "[email]",
      }}
      tabs={[
        { id: "overview", label: "Project overview", icon: LayoutDashboard, content: <ProjectOverviewTab /> },
        { id: "deliverables", label: "Deliverables", icon: ListChecks, content: <DeliverablesTab /> },
        { id: "documents", label: "Documents", icon: FileText, content: <DocumentsTab /> },
      ]}
    />
  );
}
