-- CreateTable
CREATE TABLE "QuoteVisit" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "src" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuoteVisit_quoteId_createdAt_idx" ON "QuoteVisit"("quoteId", "createdAt");

-- CreateIndex
CREATE INDEX "QuoteVisit_src_createdAt_idx" ON "QuoteVisit"("src", "createdAt");

-- AddForeignKey
ALTER TABLE "QuoteVisit" ADD CONSTRAINT "QuoteVisit_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
