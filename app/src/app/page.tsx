import { CopyButton } from "@/components/copy-button";
import { resolveDefaultOrganizationId } from "@/lib/client-portals";
import { prisma } from "@/lib/db";
import { getRuntimeState, isRuntimeSnapshotMode } from "@/lib/runtime-state";
import { ArrowUpRight, BookOpen, Command, MessageSquareQuote } from "lucide-react";
import Link from "next/link";
import os from "node:os";
import path from "node:path";

const GUIDE_URL = "https://app.showpane.com/docs/first-portal";
const PROMPT_EXAMPLES = [
  "Create a portal for my client Acme based on my call transcript, which is here: [paste it]",
  "Create a portal for my client Acme based on my call from earlier today. Use the Granola MCP to grab the transcript.",
];

export default async function Home() {
  let portalCount = 0;
  const showpaneBinDir = path.join(os.homedir(), ".showpane", "bin");
  const resumeCommand = (process.env.PATH ?? "").split(path.delimiter).includes(showpaneBinDir)
    ? "showpane claude"
    : "npx showpane claude";
  try {
    if (isRuntimeSnapshotMode()) {
      const state = await getRuntimeState();
      portalCount = state?.portals.length ?? 0;
    } else {
      const organizationId = await resolveDefaultOrganizationId();
      if (organizationId) {
        portalCount = await prisma.clientPortal.count({
          where: { organizationId },
        });
      }
    }
  } catch {
    // DB not ready yet — show welcome page with 0 portals
  }

  return (
    <main className="min-h-screen bg-[#f6f1e8] text-slate-900">
      <div className="bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.24),_transparent_48%),linear-gradient(180deg,_#214668_0%,_#3d6f9c_100%)] px-4 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-3xl">
          <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
            Local app running
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
            Your Showpane workspace is ready
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/82 sm:text-lg">
            Open Claude in your Showpane workspace and create your first client portal.
          </p>
        </div>
      </div>

      <div className="px-4 py-10 sm:py-12">
        <div className="mx-auto max-w-3xl space-y-5">
          <section className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.16)] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
                  <Command className="h-4 w-4" />
                  Start with Claude
                </div>
                <p className="mt-3 text-sm leading-6 text-white/72">
                  This opens Claude in the right Showpane workspace so you can start creating portals immediately.
                </p>
              </div>
              <CopyButton text={resumeCommand} invert />
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
              <code className="block overflow-x-auto font-mono text-sm text-white sm:text-[15px]">
                {resumeCommand}
              </code>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.07)] sm:p-7">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <MessageSquareQuote className="h-4 w-4" />
              What to say to Claude
            </div>

            <div className="mt-5 space-y-3">
              {PROMPT_EXAMPLES.map((example, index) => (
                <div
                  key={example}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Example {index + 1}
                    </p>
                    <CopyButton text={example} />
                  </div>
                  <p className="mt-3 whitespace-pre-wrap pr-2 font-mono text-sm leading-6 text-slate-700">
                    {example}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[32px] border border-[#b8d2ee] bg-[linear-gradient(135deg,_#f8fcff_0%,_#d8ebfb_55%,_#bed8f1_100%)] p-6 shadow-[0_24px_90px_rgba(61,111,156,0.18)] sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-xl">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#214668]">
                  <BookOpen className="h-4 w-4" />
                  Need help creating your first portal?
                </div>
                <p className="mt-3 text-base leading-7 text-[#284f74]">
                  Follow the step-by-step guide with examples, best practices, and a walkthrough video.
                </p>
              </div>
              <a
                href={GUIDE_URL}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#214668] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#18344d]"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Creating Your First Portal
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </section>

          <div className="space-y-3 pt-2 text-center">
            <p className="text-xs text-slate-500">
              Need Claude Code first?{" "}
              <a
                href="https://claude.ai/code"
                className="font-medium text-[#214668] underline decoration-slate-300 underline-offset-4 hover:decoration-[#214668]"
                target="_blank"
                rel="noopener noreferrer"
              >
                Install it here
              </a>
            </p>

            <div className="space-y-1 text-xs text-slate-400">
              {portalCount > 0 && (
                <p>
                  You have {portalCount} portal{portalCount !== 1 ? "s" : ""}.{" "}
                  <Link href="/client" className="text-[#214668] hover:underline">
                    Go to login
                  </Link>
                </p>
              )}
              <p>Powered by Claude Code</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
