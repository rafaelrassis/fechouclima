-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "templateId" TEXT,
ADD COLUMN     "videoViewedAt" TIMESTAMP(3),
ADD COLUMN     "videoViews" INTEGER NOT NULL DEFAULT 0;
