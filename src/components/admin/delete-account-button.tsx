"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteUserAccount } from "@/actions/admin";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DeleteAccountButton({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function confirm() {
    startTransition(async () => {
      const res = await deleteUserAccount(userId, password);
      if (res.ok) {
        toast.success("Conta excluída");
        router.push("/admin/usuarios");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setPassword("");
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="h-11 w-full">
          Excluir conta
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir a conta de {userName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Apaga o técnico e tudo que pertence a ele: orçamentos, clientes, serviços do catálogo
            próprio, fotos e lembretes. Não tem como desfazer. Digite sua senha de admin para
            confirmar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="admin-password">Sua senha</Label>
          <Input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            className="h-11 text-base"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
          />
        </div>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="h-12" disabled={pending}>
            Voltar
          </AlertDialogCancel>
          <AlertDialogAction
            className="h-12"
            disabled={pending || password.length === 0}
            onClick={(e) => {
              e.preventDefault();
              confirm();
            }}
          >
            {pending ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
