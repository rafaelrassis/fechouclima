"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { registerAction } from "@/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { maskPhone } from "@/lib/utils";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-12 w-full text-base shadow-[0_8px_16px_rgba(14,116,144,0.3)]" disabled={pending}>
      {pending ? "Criando conta..." : "Criar conta"}
    </Button>
  );
}

export function CadastroForm({ refCode }: { refCode: string }) {
  const [state, action] = useActionState(registerAction, undefined);
  const fe = state?.fieldErrors;
  const [phone, setPhone] = useState(state?.values?.phone ? maskPhone(state.values.phone) : "");

  return (
    <AuthShell title="Criar conta" subtitle="Orçamentos em menos de 60 segundos">
      <form action={action} className="space-y-4">
        {refCode && <input type="hidden" name="ref" value={refCode} />}
        <div className="space-y-2">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" name="name" autoComplete="name" required minLength={2} defaultValue={state?.values?.name} key={`n-${state?.values?.name}`} className="h-12 text-base" />
          {fe?.name && <p className="text-sm text-destructive">{fe.name[0]}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" required defaultValue={state?.values?.email} key={`e-${state?.values?.email}`} className="h-12 text-base" />
          {fe?.email && <p className="text-sm text-destructive">{fe.email[0]}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">WhatsApp</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(11) 99999-9999"
            required
            value={phone}
            onChange={(e) => setPhone(maskPhone(e.target.value))}
            className="h-12 text-base"
          />
          {fe?.phone && <p className="text-sm text-destructive">{fe.phone[0]}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={6} className="h-12 text-base" />
          {fe?.password && <p className="text-sm text-destructive">{fe.password[0]}</p>}
        </div>
        <div className="space-y-1">
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
            <input type="checkbox" name="accept" required className="mt-0.5 size-5 shrink-0" />
            <span>
              Li e aceito os{" "}
              <Link href="/termos" target="_blank" className="font-medium text-primary underline">
                Termos de uso
              </Link>{" "}
              e a{" "}
              <Link href="/privacidade" target="_blank" className="font-medium text-primary underline">
                Política de Privacidade
              </Link>
              .
            </span>
          </label>
          {fe?.accept && <p className="text-sm text-destructive">{fe.accept[0]}</p>}
        </div>
        {state?.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        <SubmitButton />
        <p className="text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link href="/login" className="inline-flex min-h-11 items-center font-medium text-foreground underline">
            Entrar
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
