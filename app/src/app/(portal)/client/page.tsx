import { PortalLogin } from "@/components/portal-login";
import { getInitialLogo } from "@/lib/branding";
import { prisma } from "@/lib/db";
import { resolveDefaultOrganizationId } from "@/lib/client-portals";
import { getRuntimePortalBySlug, getRuntimeState, isRuntimeSnapshotMode } from "@/lib/runtime-state";

export default async function ClientLogin({
  searchParams,
}: {
  searchParams?: Promise<{ portal?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const portalSlug = params.portal?.trim() || null;

  let companyName = "Your Portal";
  let companyUrl = "https://showpane.com";
  let supportEmail = "support@showpane.com";
  let portalLabel = "Client Portal";
  let description = "Private portal access. Sign in with the credentials you were sent.";
  let companyInitial = "P";

  if (portalSlug) {
    try {
      if (isRuntimeSnapshotMode()) {
        const state = await getRuntimeState();
        const portal = await getRuntimePortalBySlug(portalSlug);
        if (portal) {
          companyName = portal.companyName;
          portalLabel = `${portal.companyName} Portal`;
          description = `Private portal for ${portal.companyName}. Sign in with the credentials you were sent.`;
          companyInitial = portal.companyName[0]?.toUpperCase() || "P";
          if (state?.organization?.websiteUrl) {
            companyUrl = state.organization.websiteUrl;
          }
          if (state?.organization?.supportEmail) {
            supportEmail = state.organization.supportEmail;
          }
        }
      } else {
        const organizationId = await resolveDefaultOrganizationId();
        if (organizationId) {
          const portal = await prisma.clientPortal.findFirst({
            where: {
              organizationId,
              slug: portalSlug,
              isActive: true,
            },
            select: { companyName: true },
          });
          const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: {
              websiteUrl: true,
              supportEmail: true,
              portalLabel: true,
            },
          });

          if (portal) {
            companyName = portal.companyName;
            portalLabel = organization?.portalLabel || `${portal.companyName} Portal`;
            description = `Private portal for ${portal.companyName}. Sign in with the credentials you were sent.`;
            companyInitial = portal.companyName[0]?.toUpperCase() || "P";
          }
          if (organization?.websiteUrl) {
            companyUrl = organization.websiteUrl;
          }
          if (organization?.supportEmail) {
            supportEmail = organization.supportEmail;
          }
        }
      }
    } catch {
      // Fall back to the generic login shell if portal-aware context cannot be resolved.
    }
  }

  return (
    <PortalLogin
      companyName={companyName}
      companyLogo={
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-900">
          <span className="text-xs font-bold text-white">{companyInitial}</span>
        </div>
      }
      companyUrl={companyUrl}
      supportEmail={supportEmail}
      portalLabel={portalLabel}
      description={description}
    />
  );
}
