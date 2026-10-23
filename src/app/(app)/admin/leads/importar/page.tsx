import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { usoMensalPlaces } from "@/lib/places-quota";
import { BuscarNoMapaForm, ColarListaForm } from "@/components/admin/lead-import-forms";

export const metadata = { title: "Importar leads" };

export default async function ImportarLeadsPage() {
  await requireAdmin();
  const temChave = !!process.env.GOOGLE_PLACES_API_KEY;
  const { usadas, limite } = await usoMensalPlaces();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Importar leads</h1>
        <Link href="/admin/leads" className="flex h-11 items-center text-sm font-semibold text-primary">
          Voltar
        </Link>
      </div>

      {temChave ? (
        <>
          <p className="text-xs text-muted-foreground">
            Cota grátis do Google este mês: {usadas}/{limite} requisições (cada busca usa até 3). Zera todo mês.
          </p>
          {usadas < limite ? (
            <BuscarNoMapaForm />
          ) : (
            <p className="rounded-md bg-muted p-3 text-sm">Cota grátis do mês esgotada. Use a lista abaixo.</p>
          )}
        </>
      ) : (
        <p className="rounded-md bg-muted p-3 text-sm">
          Busca no Maps desativada: defina <code>GOOGLE_PLACES_API_KEY</code> no ambiente (Places API New ativada no Google Cloud).
        </p>
      )}
      <ColarListaForm />
    </div>
  );
}
