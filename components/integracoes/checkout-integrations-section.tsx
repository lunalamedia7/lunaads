"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyButton } from "@/components/copy-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  createCheckoutIntegration,
  toggleCheckoutIntegration,
  deleteCheckoutIntegration,
  reprocessEvent,
} from "@/lib/actions/checkout";
import { EmptyState } from "@/components/empty-state";
import { Webhook } from "lucide-react";

const PLATFORM_LABELS: Record<string, string> = {
  hotmart: "Hotmart",
  kiwify: "Kiwify",
  generic: "Genérico (mapeamento customizado)",
};

export type CheckoutIntegrationRow = {
  id: string;
  platform: string;
  isActive: boolean;
  webhookUrl: string;
};

export type FailedWebhookEventRow = {
  id: string;
  platform: string;
  error: string;
  createdAt: string;
};

const initialState = { error: null, success: null };

export function CheckoutIntegrationsSection({
  integrations,
  failedEvents,
}: {
  integrations: CheckoutIntegrationRow[];
  failedEvents: FailedWebhookEventRow[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [platform, setPlatform] = useState("hotmart");
  const [createState, createAction, createPending] = useActionState(
    createCheckoutIntegration,
    initialState,
  );

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Plataformas de checkout</CardTitle>
            <CardDescription>
              Receba vendas via webhook de Hotmart, Kiwify ou qualquer plataforma customizada.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {showForm ? (
            <form
              action={async (formData) => {
                await createAction(formData);
                setShowForm(false);
              }}
              className="flex flex-col gap-3 rounded-xl border border-border p-4"
            >
              <div className="flex flex-col gap-2">
                <Label>Plataforma</Label>
                <input type="hidden" name="platform" value={platform} />
                <Select value={platform} onValueChange={(v) => setPlatform(v ?? "hotmart")}>
                  <SelectTrigger className="w-full">
                    <span>{PLATFORM_LABELS[platform]}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="secret">Token/secret do webhook (opcional)</Label>
                <Input id="secret" name="secret" placeholder="Cole o token de assinatura da plataforma" />
              </div>
              {platform === "generic" ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="fieldMap">Mapeamento de campos (JSON)</Label>
                  <textarea
                    id="fieldMap"
                    name="fieldMap"
                    rows={6}
                    className="rounded-lg border border-input bg-transparent p-2 font-mono text-xs"
                    placeholder='{"externalIdPath":"order.id","statusPath":"order.status","statusMap":{"paid":"paid"},"grossAmountPath":"order.total"}'
                  />
                </div>
              ) : null}
              {createState.error ? <p className="text-sm text-danger">{createState.error}</p> : null}
              <Button type="submit" disabled={createPending} className="self-start">
                {createPending ? "Criando..." : "Criar integração"}
              </Button>
            </form>
          ) : null}

          {integrations.length === 0 ? (
            <EmptyState
              icon={Webhook}
              title="Nenhuma plataforma de checkout conectada"
              description="Adicione a Hotmart, Kiwify ou uma plataforma customizada para começar a ver vendas."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {integrations.map((integration) => (
                <IntegrationRow key={integration.id} integration={integration} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {failedEvents.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Webhooks com erro</CardTitle>
            <CardDescription>Reprocesse eventos que falharam ao virar venda.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {failedEvents.map((event) => (
              <FailedEventRow key={event.id} event={event} />
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function IntegrationRow({ integration }: { integration: CheckoutIntegrationRow }) {
  const [, toggleAction, togglePending] = useActionState(
    () => toggleCheckoutIntegration(integration.id, !integration.isActive),
    initialState,
  );
  const [, deleteAction, deletePending] = useActionState(
    () => deleteCheckoutIntegration(integration.id),
    initialState,
  );

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-foreground">{PLATFORM_LABELS[integration.platform]}</p>
          <Badge className={integration.isActive ? "border-none bg-success/10 text-success" : "border-none bg-secondary text-text-muted"}>
            {integration.isActive ? "Ativa" : "Pausada"}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <span className="truncate font-mono text-xs text-text-faint">{integration.webhookUrl}</span>
          <CopyButton value={integration.webhookUrl} />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Switch
          checked={integration.isActive}
          disabled={togglePending}
          onCheckedChange={() => toggleAction()}
        />
        <form action={deleteAction}>
          <Button type="submit" variant="ghost" size="icon-sm" disabled={deletePending} className="text-text-faint hover:text-danger">
            <Trash2 className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

function FailedEventRow({ event }: { event: FailedWebhookEventRow }) {
  const [state, action, pending] = useActionState(() => reprocessEvent(event.id), initialState);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm">
      <div className="min-w-0">
        <p className="font-medium text-foreground">{PLATFORM_LABELS[event.platform] ?? event.platform}</p>
        <p className="truncate text-xs text-danger">{event.error}</p>
        <p className="text-xs text-text-faint">{new Date(event.createdAt).toLocaleString("pt-BR")}</p>
      </div>
      <form action={action}>
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          <RotateCcw className="h-3.5 w-3.5" />
          {pending ? "Reprocessando..." : "Reprocessar"}
        </Button>
      </form>
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
    </div>
  );
}
