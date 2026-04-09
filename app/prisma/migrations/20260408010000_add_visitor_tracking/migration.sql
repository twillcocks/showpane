-- AlterTable
ALTER TABLE "PortalEvent" ADD COLUMN "visitorId" TEXT;
ALTER TABLE "PortalEvent" ADD COLUMN "metadata" TEXT;

-- CreateIndex
CREATE INDEX "PortalEvent_visitorId_idx" ON "PortalEvent"("visitorId");
