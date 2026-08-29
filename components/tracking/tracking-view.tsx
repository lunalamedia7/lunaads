"use client";

import { useActionState } from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { updateAttributionSettings } from "@/lib/actions/tracking";
import { sendTestTrackingEvent } from "@/lib/actions/tracking-test";

export type AttributionSettings = { windowHours: number; model: string };
export type DomainSummary = { domain: string; lastSeenAt: string | null };

const initialState = { error: null, success: null };

export function TrackingView({
  settings,
  domains,
}: {
  settings: AttributionSettings;
  domains: DomainSummary[];
}) {
  const [settingsState, settingsAction, settingsPending] = useActionState(updateAttributionSettings, initialState);
  const [testState, testAction, testPending] = useActionState(() => sendTestTrackingEvent(), initialState);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[34px] font-bold tracking-tight text-foreground">Tracking Avançado</h1>
        <p className="mt-1 text-sm text-text-muted">Janela de atribuição, modelo e domínios.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Atribuição</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={settingsAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="windowHours">Janela de atribuição (horas)</Label>
              <Input id="windowHours" name="windowHours" type="number" min={1} defaultValue={settings.windowHours} className="w-32" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Modelo</Label>
              <RadioGroup name="model" defaultValue={settings.model} className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="last_click" /> Último clique
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="first_click" /> Primeiro clique
                </label>
              </RadioGroup>
            </div>
            {settingsState.error ? <p className="text-sm text-danger">{settingsState.error}</p> : null}
            {settingsState.success ? <p className="text-sm text-success">{settingsState.success}</p> : null}
            <Button type="submit" disabled={settingsPending} className="self-start">
              {settingsPending ? "Salvando..." : "Salvar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Domínios com o script instalado</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {domains.length === 0 ? (
            <EmptyState icon={Zap} title="Nenhum domínio detectado ainda" className="py-6" />
          ) : (
            <div className="flex flex-col gap-1">
              {domains.map((d) => (
                <div key={d.domain} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{d.domain}</span>
                  <span className="text-xs text-text-faint">
                    {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString("pt-BR") : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
          <form action={testAction} className="border-t border-border pt-3">
            <Button type="submit" variant="outline" disabled={testPending}>
              {testPending ? "Enviando..." : "Testar evento ao vivo"}
            </Button>
            {testState.success ? <p className="mt-2 text-sm text-success">{testState.success}</p> : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
