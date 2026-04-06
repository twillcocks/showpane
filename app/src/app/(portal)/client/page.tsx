"use client";

import { PortalLogin } from "@/components/portal-login";

export default function ClientLogin() {
  return (
    <PortalLogin
      companyName="Demo Company"
      companyLogo={
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-900">
          <span className="text-xs font-bold text-white">D</span>
        </div>
      }
      companyUrl="https://example.com"
      supportEmail="support@example.com"
    />
  );
}
