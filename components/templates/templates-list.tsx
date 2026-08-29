"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Star, Copy, Trash2, Plus, FileStack } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import {
  createTemplate,
  duplicateTemplate,
  toggleFavoriteTemplate,
  deleteTemplate,
} from "@/lib/actions/campaign-templates";

export type TemplateRow = {
  id: string;
  name: string;
  isFavorite: boolean;
  updatedAt: string;
};

const initialState = { error: null, success: null };

export function TemplatesList({ templates }: { templates: TemplateRow[] }) {
  const [showForm, setShowForm] = useState(false);
  const [createState, createAction, createPending] = useActionState(createTemplate, initialState);

  const sorted = [...templates].sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" /> Novo template em branco
        </Button>
      </div>

      {showForm ? (
        <Card>
          <CardContent className="pt-6">
            <form
              action={async (formData) => {
                await createAction(formData);
                setShowForm(false);
              }}
              className="flex items-end gap-2"
            >
              <input type="hidden" name="config" value="{}" />
              <div className="flex-1">
                <Input name="name" placeholder="Nome do template" required />
              </div>
              <Button type="submit" disabled={createPending}>
                {createPending ? "Criando..." : "Criar"}
              </Button>
            </form>
            {createState.error ? <p className="mt-2 text-sm text-danger">{createState.error}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {sorted.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title="Nenhum template ainda"
          description="Monte uma campanha em 'Nova campanha' e salve como template na revisão, ou crie um em branco aqui."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({ template }: { template: TemplateRow }) {
  const [, favoriteAction] = useActionState(
    () => toggleFavoriteTemplate(template.id, !template.isFavorite),
    initialState,
  );
  const [, duplicateAction, duplicatePending] = useActionState(
    () => duplicateTemplate(template.id),
    initialState,
  );
  const [, deleteAction, deletePending] = useActionState(
    () => deleteTemplate(template.id),
    initialState,
  );

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-foreground">{template.name}</p>
          <form action={favoriteAction}>
            <button type="submit" aria-label="Favoritar">
              <Star
                className={`h-4 w-4 ${template.isFavorite ? "fill-gold text-gold" : "text-text-faint"}`}
              />
            </button>
          </form>
        </div>
        <p className="text-xs text-text-faint">
          Atualizado em {new Date(template.updatedAt).toLocaleDateString("pt-BR")}
        </p>
        <div className="flex items-center gap-2 pt-1">
          <Link
            href={`/campanhas/nova?template=${template.id}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Usar
          </Link>
          <form action={duplicateAction}>
            <Button type="submit" variant="ghost" size="icon-sm" disabled={duplicatePending}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </form>
          <form action={deleteAction}>
            <Button
              type="submit"
              variant="ghost"
              size="icon-sm"
              disabled={deletePending}
              className="text-text-faint hover:text-danger"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
