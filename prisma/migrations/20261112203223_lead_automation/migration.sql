-- CreateTable
CREATE TABLE "LeadAutomation" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "cidades" TEXT NOT NULL,
    "termo" TEXT NOT NULL DEFAULT 'ar condicionado instalação',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadAutomation_pkey" PRIMARY KEY ("id")
);

