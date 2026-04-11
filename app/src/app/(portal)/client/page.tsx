"use client";

import { PortalLogin } from "@/components/portal-login";

export default function ClientLogin() {
  return (
    <PortalLogin
      companyName="Your Portal"
      companyLogo={
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-900">
          <span className="text-xs font-bold text-white">P</span>
        </div>
      }
      companyUrl="https://showpane.com"
      supportEmail="support@showpane.com"
      description="Private portal access. Sign in with the credentials you were sent."
    />
  );
}
