import { Zap, LayoutGrid } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function ModeSelect({
  onSelectFast,
  onSelectBuilder,
}: {
  onSelectFast: () => void;
  onSelectBuilder: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[34px] font-bold tracking-tight text-foreground">Como você quer montar?</h1>
        <p className="mt-1 text-sm text-text-muted">Escolha o formato do assistente de criação.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button type="button" onClick={onSelectFast} className="text-left">
          <Card className="h-full transition-colors hover:border-primary">
            <CardContent className="flex flex-col gap-3 pt-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-primary">
                <Zap className="h-5 w-5" />
              </div>
              <p className="font-medium text-foreground">Estilo Fast</p>
              <p className="text-sm text-text-muted">
                Assistente guiado em 5 passos: contas, campanha, conjunto, anúncio e revisão.
              </p>
            </CardContent>
          </Card>
        </button>

        <button type="button" onClick={onSelectBuilder} className="text-left">
          <Card className="h-full transition-colors hover:border-primary">
            <CardContent className="flex flex-col gap-3 pt-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-primary">
                <LayoutGrid className="h-5 w-5" />
              </div>
              <p className="font-medium text-foreground">Estilo Builder</p>
              <p className="text-sm text-text-muted">
                Tela única com árvore da campanha (N conjuntos, M anúncios), prévia e custo ao vivo.
              </p>
            </CardContent>
          </Card>
        </button>
      </div>
    </div>
  );
}
