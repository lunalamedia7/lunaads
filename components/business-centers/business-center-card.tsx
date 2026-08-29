"use client";

import { useActionState, useState, useTransition } from "react";
import { Pencil, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import { formatCurrency } from "@/lib/format";
import {
  renameBusinessCenterAlias,
  disconnectBusinessCenter,
} from "@/lib/actions/business-centers";

export type BusinessCenterCardData = {
  id: string;
  bcId: string;
  name: string;
  alias: string | null;
  companyName: string;
  currency: string;
  status: string;
  canReadFinance: boolean;
  balance: number | null;
  accountCount: number;
  totalAccounts: number;
};

const initialState = { error: null, success: null };

export function BusinessCenterCard({ bc }: { bc: BusinessCenterCardData }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isRenaming, startRenameTransition] = useTransition();
  const [, disconnectAction, disconnectPending] = useActionState(
    () => disconnectBusinessCenter(bc.id),
    initialState,
  );

  function submitRename(formData: FormData) {
    startRenameTransition(async () => {
      const result = await renameBusinessCenterAlias(bc.id, formData);
      setRenameError(result.error);
      if (!result.error) setEditing(false);
    });
  }

  const percentOfTotal = bc.totalAccounts > 0 ? Math.round((bc.accountCount / bc.totalAccounts) * 100) : 0;
  const displayName = bc.alias || bc.name;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="flex items-start justify-between gap-2">
          {editing ? (
            <form action={submitRename} className="flex flex-1 items-center gap-1.5">
              <Input
                name="alias"
                defaultValue={displayName}
                autoFocus
                disabled={isRenaming}
                onBlur={(e) => e.currentTarget.form?.requestSubmit()}
                className="h-7 text-sm"
              />
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="group flex items-center gap-1.5 text-left font-medium text-foreground hover:text-primary"
            >
              {displayName}
              <Pencil className="h-3 w-3 text-text-faint opacity-0 group-hover:opacity-100" />
            </button>
          )}
          <Badge
            className={
              bc.status === "active"
                ? "shrink-0 border-none bg-success/10 text-success"
                : "shrink-0 border-none bg-danger/10 text-danger"
            }
          >
            {bc.status === "active" ? "Ativo" : "Suspenso"}
          </Badge>
        </div>
        {renameError ? <p className="text-xs text-danger">{renameError}</p> : null}

        <p className="text-xs text-text-faint">{bc.companyName}</p>

        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="border-none text-text-muted">
            {bc.currency}
          </Badge>
          <span className="font-mono text-xs text-text-faint">{bc.bcId}</span>
          <CopyButton value={bc.bcId} />
        </div>

        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="text-xs text-text-muted">Saldo ({bc.currency})</span>
          <span className="tabular-nums font-medium text-foreground">
            {bc.canReadFinance && bc.balance !== null
              ? formatCurrency(bc.balance, bc.currency)
              : "Sem permissão financeira"}
          </span>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-text-muted">
            <span>{bc.accountCount} contas</span>
            <span>{percentOfTotal}% do total</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${percentOfTotal}%` }}
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          {confirmingDisconnect ? (
            <form
              action={async () => {
                await disconnectAction();
              }}
              className="flex items-center gap-2"
            >
              <span className="text-xs text-text-muted">Confirmar desconexão?</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmingDisconnect(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="destructive" size="sm" disabled={disconnectPending}>
                {disconnectPending ? "Desconectando..." : "Sim, desconectar"}
              </Button>
            </form>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-text-faint hover:text-danger"
              onClick={() => setConfirmingDisconnect(true)}
            >
              <Unplug className="h-3.5 w-3.5" />
              Desconectar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
