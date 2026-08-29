"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { CTA_OPTIONS, type Step4Data } from "@/lib/campaigns/schema";

const SOURCE_LABELS: Record<string, string> = {
  UPLOAD: "Enviar novo arquivo",
  LIBRARY: "Biblioteca da conta",
  SPARK: "Spark Ads (post autorizado)",
};

const CREATIVE_REF_PLACEHOLDER: Record<string, string> = {
  UPLOAD: "nome-do-arquivo.mp4",
  LIBRARY: "ID do vídeo/imagem na biblioteca",
  SPARK: "ID do post autorizado",
};

export function Step4Ad({
  value,
  onChange,
  errors,
}: {
  value: Partial<Step4Data>;
  onChange: (value: Partial<Step4Data>) => void;
  errors: Record<string, string>;
}) {
  const source = value.creativeSource ?? "LIBRARY";
  const ctaLabel = CTA_OPTIONS.find((c) => c.value === value.cta)?.label;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Anúncio</h2>
        <p className="text-sm text-text-muted">Criativo, texto e destino.</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Fonte do criativo</Label>
        <RadioGroup
          value={source}
          onValueChange={(v) => onChange({ ...value, creativeSource: v as Step4Data["creativeSource"] })}
          className="flex flex-wrap gap-4"
        >
          {Object.entries(SOURCE_LABELS).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <RadioGroupItem value={key} /> {label}
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="creativeRef">Criativo</Label>
        <Input
          id="creativeRef"
          placeholder={CREATIVE_REF_PLACEHOLDER[source]}
          value={value.creativeRef ?? ""}
          onChange={(e) => onChange({ ...value, creativeRef: e.target.value })}
        />
        {errors.creativeRef ? <p className="text-sm text-danger">{errors.creativeRef}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="adText">Texto do anúncio</Label>
        <Textarea
          id="adText"
          rows={3}
          maxLength={300}
          value={value.adText ?? ""}
          onChange={(e) => onChange({ ...value, adText: e.target.value })}
        />
        {errors.adText ? <p className="text-sm text-danger">{errors.adText}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>Call to action</Label>
          <Select
            value={value.cta ?? ""}
            onValueChange={(v) => onChange({ ...value, cta: (v ?? undefined) as Step4Data["cta"] })}
          >
            <SelectTrigger className="w-full">
              <span>{ctaLabel ?? "Selecione"}</span>
            </SelectTrigger>
            <SelectContent>
              {CTA_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.cta ? <p className="text-sm text-danger">{errors.cta}</p> : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="identityRef">Identidade (opcional)</Label>
          <Input
            id="identityRef"
            placeholder="Nome de exibição do anunciante"
            value={value.identityRef ?? ""}
            onChange={(e) => onChange({ ...value, identityRef: e.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="destinationUrl">URL de destino</Label>
        <Input
          id="destinationUrl"
          placeholder="https://seusite.com/pagina"
          value={value.destinationUrl ?? ""}
          onChange={(e) => onChange({ ...value, destinationUrl: e.target.value })}
        />
        <p className="text-xs text-text-faint">
          Os parâmetros de atribuição (UTM) são adicionados automaticamente na publicação.
        </p>
        {errors.destinationUrl ? <p className="text-sm text-danger">{errors.destinationUrl}</p> : null}
      </div>
    </div>
  );
}
