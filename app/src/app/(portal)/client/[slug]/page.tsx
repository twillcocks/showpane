import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { resolveDefaultOrganizationId } from "@/lib/client-portals";
import { getRuntimePortalBySlug, isRuntimeSnapshotMode } from "@/lib/runtime-state";
import Link from "next/link";

export default async function PortalFallback({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let portal: { companyName: string } | null = null;
  try {
    const orgId = await resolveDefaultOrganizationId();
    if (!orgId) redirect("/client");
    if (isRuntimeSnapshotMode()) {
      const runtimePortal = await getRuntimePortalBySlug(slug);
      portal = runtimePortal ? { companyName: runtimePortal.companyName } : null;
    } else {
      portal = await prisma.clientPortal.findFirst({
        where: { slug, isActive: true, organizationId: orgId! },
        select: { companyName: true },
      });
    }
  } catch {
    redirect("/client");
  }

  if (!portal) {
    redirect("/client");
  }

  return (
    <main className="min-h-screen bg-[#FDFBF7] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="border border-gray-200 rounded-lg p-6 bg-white text-center">
          <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto mb-4 text-lg font-bold">
            ✓
          </div>
          <h1 className="text-lg font-bold text-gray-900 mb-1">
            {portal.companyName} portal is set up
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Now add content with Claude Code.
          </p>

          <div className="space-y-2 text-left">
            <code className="block text-sm text-gray-300 font-mono bg-[#111827] px-3 py-2 rounded">
              claude
            </code>
            <code className="block text-sm text-gray-300 font-mono bg-[#111827] px-3 py-2 rounded">
              Create a portal for {slug}
            </code>
          </div>

          <p className="mt-6 text-xs text-gray-400">
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
        </div>

        <div className="mt-4 text-center">
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">
            ← Back to welcome page
          </Link>
        </div>
      </div>
    </main>
  );
}
