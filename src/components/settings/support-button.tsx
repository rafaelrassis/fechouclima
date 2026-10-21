import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const SUPPORT_PHONE = "11971023268";

export function SupportButton() {
  const waUrl = buildWhatsAppUrl(SUPPORT_PHONE, "Oi! Preciso de ajuda com o FechouClima.");

  return (
    <Card>
      <CardContent className="space-y-3 p-3">
        <div>
          <p className="text-sm font-medium">Suporte</p>
          <p className="text-xs text-muted-foreground">Dúvidas, problemas ou sugestões: fale direto com a gente.</p>
        </div>
        <Button asChild variant="outline" className="h-11 w-full">
          <a href={waUrl} target="_blank" rel="noopener">
            Falar no WhatsApp
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
