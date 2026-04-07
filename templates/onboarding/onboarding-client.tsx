"use client";

/**
 * TEMPLATE: Client Onboarding Portal
 *
 * Use when onboarding a new client to your service/product.
 * Structure: Welcome & Setup → Getting Started Steps → Resources → Support
 *
 * This file is READ by Claude Code as a reference, not used directly.
 */

import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  LifeBuoy,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PortalShell } from "@/components/portal-shell";

// ─── Tab 1: Welcome ──────────────────────────────────────────
// Hero welcome with overview of what the client can expect.
function WelcomeTab() {
  return (
    <>
      <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-base font-bold tracking-tight text-gray-900">
          Welcome to [Your Company]
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          We&apos;re excited to have [Client Company] on board. This portal is
          your central hub for getting started. Here you&apos;ll find setup
          steps, resources, and a direct line to your account team.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            {
              title: "Your account manager",
              desc: "[Name] — [email]",
            },
            {
              title: "Plan",
              desc: "[Plan name / tier]",
            },
            {
              title: "Onboarding started",
              desc: "[Date]",
            },
            {
              title: "Target go-live",
              desc: "[Date]",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-gray-100 p-4"
            >
              <p className="text-xs text-gray-500">{item.title}</p>
              <p className="mt-0.5 text-sm font-semibold text-gray-900">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Tab 2: Getting Started ───────────────────────────────────
// Step-by-step setup checklist. Each step has a status and instructions.
function GettingStartedTab() {
  const steps = [
    {
      done: true,
      label: "Account created",
      desc: "Your account is active and ready to use.",
    },
    {
      done: false,
      label: "Complete your profile",
      desc: "Add your team members and set up your organization details.",
    },
    {
      done: false,
      label: "Connect your data",
      desc: "Follow our integration guide to connect your existing systems.",
    },
    {
      done: false,
      label: "Review the setup with us",
      desc: "Book a 30-minute call with your account manager to walk through everything.",
    },
    {
      done: false,
      label: "Go live",
      desc: "Once you're comfortable, switch to production mode.",
    },
  ];

  return (
    <div className="w-full">
      <h3 className="mb-4 text-base font-bold tracking-tight text-gray-900">
        Setup checklist
      </h3>
      <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="space-y-0">
          {steps.map((step, index, items) => (
            <div key={step.label} className="flex items-stretch gap-3 sm:gap-4">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    step.done
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-600"
                  )}
                >
                  {step.done ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    index + 1
                  )}
                </span>
                {index < items.length - 1 ? (
                  <div className="w-px flex-1 bg-gray-100" />
                ) : null}
              </div>
              <div className="pb-5">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    step.done ? "text-green-700" : "text-gray-900"
                  )}
                >
                  {step.label}
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-gray-500">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-400">
            1 of 5 steps complete. Your account manager will follow up on
            remaining items.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 3: Resources ─────────────────────────────────────────
// Links to documentation, guides, and helpful resources.
function ResourcesTab() {
  const resources = [
    {
      title: "Getting Started Guide",
      desc: "Step-by-step walkthrough for new users",
      url: "#",
    },
    {
      title: "API Documentation",
      desc: "Technical reference for integrations",
      url: "#",
    },
    {
      title: "Best Practices",
      desc: "Tips and recommendations from our team",
      url: "#",
    },
    {
      title: "FAQ",
      desc: "Answers to common questions",
      url: "#",
    },
  ];

  return (
    <div className="w-full">
      <h3 className="mb-4 text-base font-bold tracking-tight text-gray-900">
        Resources
      </h3>
      <div className="space-y-3">
        {resources.map((resource) => (
          <a
            key={resource.title}
            href={resource.url}
            className="flex items-center justify-between rounded-2xl border bg-white p-4 shadow-sm transition-colors hover:border-gray-300 sm:p-5"
          >
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 shrink-0 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {resource.title}
                </p>
                <p className="text-xs text-gray-500">{resource.desc}</p>
              </div>
            </div>
            <ExternalLink className="h-4 w-4 shrink-0 text-gray-300" />
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Assembled Portal ─────────────────────────────────────────
export function OnboardingClient() {
  return (
    <PortalShell
      companyName="[Your Company]"
      companyLogo={<span className="text-xs font-bold text-white">C</span>}
      clientName="[Client Company]"
      clientLogoSrc="/client-logo.svg"
      clientLogoAlt="[Client Company]"
      lastUpdated="[Date]"
      contact={{
        name: "[Account Manager Name]",
        title: "[Title]",
        avatarSrc: "/avatar.svg",
        email: "[email]",
      }}
      tabs={[
        { id: "welcome", label: "Welcome", icon: Rocket, content: <WelcomeTab /> },
        { id: "getting-started", label: "Getting started", icon: CheckCircle2, content: <GettingStartedTab /> },
        { id: "resources", label: "Resources", icon: BookOpen, content: <ResourcesTab /> },
        { id: "support", label: "Support", icon: LifeBuoy, content: <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6"><p className="text-sm text-gray-600">Need help? Contact your account manager at <span className="font-medium text-gray-900">[email]</span> or book a call.</p></div> },
      ]}
    />
  );
}
