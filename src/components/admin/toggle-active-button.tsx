"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setUserActive } from "@/actions/admin";
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

export function ToggleActiveButton({ userId, isActive }: { userId: string; isActive: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const res = await setUserActive(userId, !isActive);
      if (res.ok) toast.success(isActive ? "Conta inativada" : "Conta reativada");
      else toast.error(res.error);
      setOpen(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={isActive ? "destructive" : "default"} className="h-11 w-full">
          {isActive ? "Inativar conta" : "Reativar conta"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{isActive ? "Inativar esta conta?" : "Reativar esta conta?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {isActive
              ? "O técnico é deslogado de todos os aparelhos e não consegue entrar de novo até ser reativado. Os dados não são apagados."
              : "O técnico volta a conseguir fazer login normalmente."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="h-12" disabled={pending}>
            Voltar
          </AlertDialogCancel>
          <AlertDialogAction
            className="h-12"
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              confirm();
            }}
          >
            {pending ? "Salvando..." : "Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
