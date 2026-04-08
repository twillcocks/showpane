import { prisma } from "@/lib/db";
import Link from "next/link";
import { Presentation, Briefcase, UserPlus } from "lucide-react";

const templates = [
  {
    name: "Sales Follow-up",
    description: "Meeting notes, next steps, documents",
    icon: Presentation,
  },
  {
    name: "Consulting",
    description: "Project overview, deliverables, timeline",
    icon: Briefcase,
  },
  {
    name: "Onboarding",
    description: "Welcome, setup steps, resources",
    icon: UserPlus,
  },
];

export default async function Home() {
  let portalCount = 0;
  try {
    portalCount = await prisma.clientPortal.count();
  } catch {
    // DB not ready yet — show welcome page with 0 portals
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero zone */}
      <div className="bg-gradient-to-b from-[#2C5278] to-[#5A8BB5] px-4 py-16 md:py-24 text-center relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative">
          <h1 className="sr-only">SHOWPANE</h1>
          <div
            role="img"
            aria-label="SHOWPANE"
            className="font-mono text-white text-[0.45rem] leading-[1.1] sm:text-[0.55rem] md:text-xs whitespace-pre select-none mx-auto w-fit"
          >
{`███████╗██╗  ██╗ ██████╗ ██╗    ██╗██████╗  █████╗ ███╗   ██╗███████╗
██╔════╝██║  ██║██╔═══██╗██║    ██║██╔══██╗██╔══██╗████╗  ██║██╔════╝
███████╗███████║██║   ██║██║ █╗ ██║██████╔╝███████║██╔██╗ ██║█████╗
╚════██║██╔══██║██║   ██║██║███╗██║██╔═══╝ ██╔══██║██║╚██╗██║██╔══╝
███████║██║  ██║╚██████╔╝╚███╔███╔╝██║     ██║  ██║██║ ╚████║███████╗
╚══════╝╚═╝  ╚═╝ ╚═════╝  ╚══╝╚══╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝`}
          </div>
          <p className="mt-6 text-white/90 text-lg">
            Create professional client portals with Claude Code.
          </p>
        </div>
      </div>

      {/* Action zone */}
      <div className="flex-1 bg-[#FDFBF7] px-4 py-12 md:py-16">
        <div className="max-w-lg mx-auto">
          {/* Steps */}
          <ol className="space-y-4">
            <li className="border border-gray-200 rounded-lg p-5 bg-white">
              <div className="flex items-start gap-4">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-900 text-white text-sm font-medium flex items-center justify-center">
                  1
                </span>
                <div className="min-w-0">
                  <p className="text-gray-900 font-medium mb-2">
                    Open your terminal in this directory
                  </p>
                  <code className="block text-sm text-gray-300 font-mono bg-[#111827] px-3 py-2 rounded overflow-x-auto">
                    cd app
                  </code>
                </div>
              </div>
            </li>

            <li className="border border-gray-200 rounded-lg p-5 bg-white">
              <div className="flex items-start gap-4">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-900 text-white text-sm font-medium flex items-center justify-center">
                  2
                </span>
                <div className="min-w-0">
                  <p className="text-gray-900 font-medium mb-2">
                    Launch Claude Code
                  </p>
                  <code className="block text-sm text-gray-300 font-mono bg-[#111827] px-3 py-2 rounded">
                    claude
                  </code>
                </div>
              </div>
            </li>

            <li className="border border-gray-200 rounded-lg p-5 bg-white">
              <div className="flex items-start gap-4">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-900 text-white text-sm font-medium flex items-center justify-center">
                  3
                </span>
                <div className="min-w-0">
                  <p className="text-gray-900 font-medium mb-2">
                    Tell it what to create
                  </p>
                  <code className="block text-sm text-gray-300 font-mono bg-[#111827] px-3 py-2 rounded overflow-x-auto">
                    Create a portal for my call with [client name]
                  </code>
                </div>
              </div>
            </li>
          </ol>

          <p className="mt-4 text-xs text-gray-400 text-center">
            Don&apos;t have Claude Code?{" "}
            <a
              href="https://claude.ai/code"
              className="text-blue-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Install it here
            </a>
          </p>

          {/* Template previews */}
          <div className="mt-12">
            <p className="text-sm font-medium text-gray-500 text-center mb-4">
              Claude Code generates portals from templates
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {templates.map((t) => (
                <div
                  key={t.name}
                  className="border border-gray-200 rounded-lg p-4 bg-white text-center"
                >
                  <t.icon className="h-5 w-5 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{t.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer zone */}
      <footer className="bg-[#FDFBF7] px-4 pb-8 text-center space-y-2">
        {portalCount > 0 && (
          <p className="text-sm text-gray-500">
            You have {portalCount} portal{portalCount !== 1 ? "s" : ""}.{" "}
            <Link href="/client" className="text-blue-600 hover:underline">
              Go to login
            </Link>
          </p>
        )}
        <p className="text-xs text-gray-400">
          Powered by Claude Code
        </p>
      </footer>
    </main>
  );
}
