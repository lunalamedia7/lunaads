"use client";

import { useActionState } from "react";
import { RefreshCw, Unplug, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { connectTikTok, disconnectTikTok, syncTikTokNow } from "@/lib/actions/tiktok";

type ConnectionStatus = "connected" | "needs_reauth" | "disconnected";

const initialState = { error: null, success: null };

function StatusBadge({ status }: { status: ConnectionStatus }) {
  if (status === "connected") {
    return (
      <Badge className="gap-1.5 border-none bg-success/10 text-success">
        <span className="h-1.5 w-1.5 rounded-full bg-success" /> Conectado
      </Badge>
    );
  }
  if (status === "needs_reauth") {
    return (
      <Badge className="gap-1.5 border-none bg-warning/10 text-warning">
        <span className="h-1.5 w-1.5 rounded-full bg-warning" /> Precisa reconectar
      </Badge>
    );
  }
  return (
    <Badge className="gap-1.5 border-none bg-secondary text-text-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-text-faint" /> Desconectado
    </Badge>
  );
}

export function TikTokConnectionCard({
  status,
  lastSyncedAt,
  bcCount,
  accountCount,
}: {
  status: ConnectionStatus;
  lastSyncedAt: string | null;
  bcCount: number;
  accountCount: number;
}) {
  const [connectState, connectAction, connectPending] = useActionState(
    () => connectTikTok(),
    initialState,
  );
  const [disconnectState, disconnectAction, disconnectPending] = useActionState(
    () => disconnectTikTok(),
    initialState,
  );
  const [syncState, syncAction, syncPending] = useActionState(
    () => syncTikTokNow(),
    initialState,
  );

  const error = connectState.error ?? disconnectState.error ?? syncState.error;
  const success = connectState.success ?? disconnectState.success ?? syncState.success;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            TikTok Ads
            <StatusBadge status={status} />
          </CardTitle>
          <CardDescription>
            {status === "connected"
              ? `${bcCount} Business Centers · ${accountCount} contas de anúncio`
              : status === "needs_reauth"
                ? "O token expirou ou foi revogado — reconecte para continuar sincronizando."
                : "Conecte sua conta do TikTok Ads para trazer BCs, contas, saldo e gasto."}
          </CardDescription>
          {lastSyncedAt ? (
            <p className="mt-1 text-xs text-text-faint">
              Último sync: {new Date(lastSyncedAt).toLocaleString("pt-BR")}
            </p>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {success ? <p className="text-sm text-success">{success}</p> : null}

        <div className="flex flex-wrap gap-2">
          {status === "disconnected" || status === "needs_reauth" ? (
            <form action={connectAction}>
              <Button type="submit" disabled={connectPending}>
                <Link2 className="h-4 w-4" />
                {connectPending
                  ? "Conectando..."
                  : status === "needs_reauth"
                    ? "Reconectar"
                    : "Conectar TikTok Ads"}
              </Button>
            </form>
          ) : (
            <>
              <form action={syncAction}>
                <Button type="submit" variant="outline" disabled={syncPending}>
                  <RefreshCw className={syncPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                  {syncPending ? "Sincronizando..." : "Sincronizar agora"}
                </Button>
              </form>
              <form action={disconnectAction}>
                <Button type="submit" variant="destructive" disabled={disconnectPending}>
                  <Unplug className="h-4 w-4" />
                  Desconectar
                </Button>
              </form>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
