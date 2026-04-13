import { PortalLogin } from "@/components/portal-login";
import { getBrandLogoUrl } from "@/lib/branding";
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

  let companyName = "Showpane";
  let companyUrl = "https://showpane.com";
  let supportEmail = "support@showpane.com";
  let portalLabel = "Client Portal";
  let description = "Private portal access. Sign in with the credentials you were sent.";
  let companyLogoSrc: string | null = null;
  let companyLogoAlt = companyName;

  if (portalSlug) {
    try {
      if (isRuntimeSnapshotMode()) {
        const state = await getRuntimeState();
        const portal = await getRuntimePortalBySlug(portalSlug);
        if (portal) {
          const orgName = state?.organization?.name || companyName;
          companyName = orgName;
          companyLogoAlt = orgName;
          portalLabel = state?.organization?.portalLabel || `${orgName} Portal`;
          description = `Private portal created by ${orgName} for ${portal.companyName}. Sign in with the credentials you were sent.`;
          companyLogoSrc = getBrandLogoUrl({
            logoUrl: state?.organization?.logoUrl,
            websiteUrl: state?.organization?.websiteUrl,
            fallbackName: orgName,
          });
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
            select: {
              companyName: true,
            },
          });
          const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: {
              name: true,
              logoUrl: true,
              websiteUrl: true,
              supportEmail: true,
              portalLabel: true,
            },
          });

          if (portal) {
            const orgName = organization?.name || companyName;
            companyName = orgName;
            companyLogoAlt = orgName;
            portalLabel = organization?.portalLabel || `${orgName} Portal`;
            description = `Private portal created by ${orgName} for ${portal.companyName}. Sign in with the credentials you were sent.`;
            companyLogoSrc = getBrandLogoUrl({
              logoUrl: organization?.logoUrl,
              websiteUrl: organization?.websiteUrl,
              fallbackName: orgName,
            });
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
        companyLogoSrc ? (
          <img
            src={companyLogoSrc}
            alt={companyLogoAlt}
            className="h-7 w-7 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-900">
            <span className="text-xs font-bold text-white">
              {companyName[0]?.toUpperCase() || "S"}
            </span>
          </div>
        )
      }
      companyUrl={companyUrl}
      supportEmail={supportEmail}
      portalLabel={portalLabel}
      description={description}
    />
  );
}
