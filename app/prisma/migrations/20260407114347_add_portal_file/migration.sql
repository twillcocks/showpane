-- CreateTable
CREATE TABLE "PortalFile" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedBy" TEXT NOT NULL DEFAULT 'operator',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PortalFile_storagePath_key" ON "PortalFile"("storagePath");

-- CreateIndex
CREATE INDEX "PortalFile_portalId_idx" ON "PortalFile"("portalId");

-- AddForeignKey
ALTER TABLE "PortalFile" ADD CONSTRAINT "PortalFile_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "ClientPortal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
