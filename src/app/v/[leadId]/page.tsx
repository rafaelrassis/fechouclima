import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { LeadVideoBeacon } from "@/components/lead-video-beacon";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "FechouClima · Orçamento em 60 segundos",
  description: "Veja em 15 segundos como o técnico envia o orçamento pelo WhatsApp e o cliente aprova com 1 toque.",
  robots: { index: false, follow: false },
};

export default async function LeadVideoPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  if (!/^c[a-z0-9]{20,30}$/.test(leadId)) notFound();
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { nome: true } });
  if (!lead) notFound();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <p className="text-sm font-semibold text-primary">FechouClima</p>
      <h1 className="text-2xl font-bold leading-tight">
        Orçamento de ar-condicionado em 60 segundos
      </h1>
      <p className="line-clamp-2 text-sm text-muted-foreground">Preparado para {lead.nome}</p>

      <video
        className="aspect-[9/16] max-h-[60dvh] w-full rounded-xl bg-black object-contain"
        src="/media/fechouclima-demo.mp4"
        controls
        playsInline
        preload="metadata"
      />

      <Link
        href="/cadastro"
        className="flex h-12 items-center justify-center rounded-md bg-primary px-4 text-base font-semibold text-primary-foreground"
      >
        Testar agora
      </Link>
      <LeadVideoBeacon leadId={leadId} />
    </main>
  );
}
