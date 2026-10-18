import Link from "next/link";
import { db } from "@/lib/db";
import { expireStaleQuotes } from "@/lib/quote-expiry";
import { requireUserId } from "@/lib/session";
import { formatBRL } from "@/lib/money";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { expiryLabel, followUpMessage, nudgedLabel, viewedLabel } from "@/lib/followup";
import { getFollowUpContext } from "@/lib/followup-context";
import { NudgeButton } from "@/components/quotes/nudge-button";
import { StatusBadge } from "@/components/quotes/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function OrcamentosPage() {
  const userId = await requireUserId();
  await expireStaleQuotes(userId);
  const quotes = await db.quote.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      number: true,
      customerName: true,
      customerPhone: true,
      status: true,
      totalCents: true,
      validUntil: true,
      publicId: true,
      lastNudgeAt: true,
      viewedAt: true,
    },
  });

  const now = new Date();
  const followUpCtx = await getFollowUpContext(userId);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Orçamentos</h1>
        <Button asChild className="h-11">
          <Link href="/orcamentos/novo">Novo</Link>
        </Button>
      </div>

      {quotes.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">Nenhum orçamento ainda.</p>
      )}

      {quotes.map((q) => (
        <Card key={q.id}>
          <CardContent className="flex items-center gap-3 p-3">
            <Link href={`/orcamentos/${q.id}`} className="flex min-h-11 min-w-0 flex-1 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  #{q.number} · {q.customerName}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <StatusBadge status={q.status} />
                  {q.status === "SENT" && expiryLabel(q.validUntil, now) && (
                    <span className="text-xs font-bold text-warning">{expiryLabel(q.validUntil, now)}</span>
                  )}
                  {q.status === "SENT" && nudgedLabel(q.lastNudgeAt, now) && (
                    <span className="text-xs font-semibold text-muted-foreground">{nudgedLabel(q.lastNudgeAt, now)}</span>
                  )}
                  {viewedLabel(q.viewedAt, q.status) && (
                    <span className="text-xs font-semibold text-muted-foreground">{viewedLabel(q.viewedAt, q.status)}</span>
                  )}
                </div>
              </div>
              <p className="shrink-0 text-sm font-semibold">{formatBRL(q.totalCents)}</p>
            </Link>
            {q.status === "SENT" && (
              <NudgeButton quoteId={q.id} href={buildWhatsAppUrl(q.customerPhone, followUpMessage(q, now, followUpCtx))} nudged={!!q.lastNudgeAt} />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
