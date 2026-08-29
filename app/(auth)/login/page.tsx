"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { signInWithPassword, signInWithMagicLink } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initialState = { error: null, success: null };

export default function LoginPage() {
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [passwordState, passwordAction, passwordPending] = useActionState(
    signInWithPassword,
    initialState,
  );
  const [magicState, magicAction, magicPending] = useActionState(
    signInWithMagicLink,
    initialState,
  );

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-2xl">Entrar</CardTitle>
        <CardDescription>Acesse o painel da sua operação.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {mode === "password" ? (
          <form action={passwordAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" placeholder="voce@empresa.com" required />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link href="/recuperar-senha" className="text-xs text-text-muted hover:text-primary">
                  Esqueceu a senha?
                </Link>
              </div>
              <Input id="password" name="password" type="password" required />
            </div>
            {passwordState.error ? (
              <p className="text-sm text-danger">{passwordState.error}</p>
            ) : null}
            <Button type="submit" disabled={passwordPending} className="w-full">
              {passwordPending ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        ) : (
          <form action={magicAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="magic-email">E-mail</Label>
              <Input id="magic-email" name="email" type="email" placeholder="voce@empresa.com" required />
            </div>
            {magicState.error ? <p className="text-sm text-danger">{magicState.error}</p> : null}
            {magicState.success ? (
              <p className="text-sm text-success">{magicState.success}</p>
            ) : null}
            <Button type="submit" disabled={magicPending} className="w-full">
              {magicPending ? "Enviando..." : "Enviar link de acesso"}
            </Button>
          </form>
        )}

        <button
          type="button"
          onClick={() => setMode(mode === "password" ? "magic" : "password")}
          className="flex items-center justify-center gap-1.5 text-sm text-text-muted hover:text-primary"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {mode === "password" ? "Entrar com link mágico" : "Entrar com senha"}
        </button>

        <p className="text-center text-sm text-text-muted">
          Não tem conta?{" "}
          <Link href="/cadastro" className="font-medium text-primary hover:underline">
            Criar conta
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
