import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function Home() {
  const portalCount = await prisma.clientPortal.count();

  if (portalCount > 0) {
    redirect("/client");
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Brand zone */}
      <div className="bg-gradient-to-b from-[#2C5278] to-[#5A8BB5] px-4 py-16 md:py-24 text-center relative overflow-hidden">
        {/* Subtle dot grid pattern */}
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
            Let&apos;s create your first client portal.
          </p>
        </div>
      </div>

      {/* Action zone */}
      <div className="flex-1 bg-[#FDFBF7] px-4 py-12 md:py-16">
        <ol className="max-w-lg mx-auto space-y-4">
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
                  cd showpane-acme/app
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
                  Run Claude Code
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
                  Tell Claude what to create
                </p>
                <code className="block text-sm text-gray-300 font-mono bg-[#111827] px-3 py-2 rounded overflow-x-auto">
                  Create a portal for my call with [client name]
                </code>
              </div>
            </div>
          </li>
        </ol>
      </div>

      {/* Attribution zone */}
      <footer className="bg-[#FDFBF7] px-4 pb-8 text-center">
        <p className="text-xs text-gray-400">
          Powered by Claude Code
        </p>
      </footer>
    </main>
  );
}
