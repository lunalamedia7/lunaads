"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Target } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { syncPixelsNow } from "@/lib/actions/tracking";

export type PixelRow = { id: string; tiktokPixelId: string; name: string };
export type DomainRow = { domain: string; lastSeenAt: string | null; eventTypes: string[]; isRecent: boolean };

const EVENT_TYPES = ["PageView", "ViewContent", "InitiateCheckout", "Purchase"];

const initialState = { error: null, success: null };

export function PixelView({
  pixels,
  domains,
  scriptSnippet,
}: {
  pixels: PixelRow[];
  domains: DomainRow[];
  scriptSnippet: string;
}) {
  const [state, action, pending] = useActionState(() => syncPixelsNow(), initialState);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[34px] font-bold tracking-tight text-foreground">Ativador de Pixel</h1>
          <p className="mt-1 text-sm text-text-muted">Ative e monitore o rastreamento de conversões.</p>
        </div>
        <form action={action}>
          <Button type="submit" variant="outline" disabled={pending}>
            <RefreshCw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Sincronizar pixels
          </Button>
        </form>
      </div>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-success">{state.success}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Script do LunaAds</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm text-text-muted">
            Cole este trecho antes do fechamento da tag <code>&lt;/head&gt;</code> do seu site.
          </p>
          <div className="relative rounded-lg border border-border bg-secondary/40 p-3">
            <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-text-muted">{scriptSnippet}</pre>
            <div className="absolute right-2 top-2">
              <CopyButton value={scriptSnippet} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pixels do TikTok</CardTitle>
        </CardHeader>
        <CardContent>
          {pixels.length === 0 ? (
            <EmptyState icon={Target} title="Nenhum pixel sincronizado ainda" className="py-8" />
          ) : (
            <div className="flex flex-col gap-2">
              {pixels.map((pixel) => (
                <div key={pixel.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{pixel.name}</span>
                  <span className="font-mono text-xs text-text-faint">{pixel.tiktokPixelId}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status por domínio</CardTitle>
        </CardHeader>
        <CardContent>
          {domains.length === 0 ? (
            <EmptyState
              icon={Target}
              title="Nenhum sinal do script ainda"
              description="Depois de colar o script no seu site, o primeiro acesso já aparece aqui."
              className="py-8"
            />
          ) : (
            <div className="flex flex-col gap-3">
              {domains.map((d) => {
                return (
                  <div key={d.domain} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{d.domain}</span>
                      <Badge className={d.isRecent ? "border-none bg-success/10 text-success" : "border-none bg-warning/10 text-warning"}>
                        {d.isRecent ? "Instalado" : "Sem sinal recente"}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {EVENT_TYPES.map((et) => (
                        <Badge
                          key={et}
                          variant="secondary"
                          className={`border-none ${d.eventTypes.includes(et) ? "text-foreground" : "text-text-faint"}`}
                        >
                          {et}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
