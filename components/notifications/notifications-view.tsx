"use client";

import { useTransition } from "react";
import Link from "next/link";
import {
  Wallet,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Zap,
  Bell,
  Check,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

const TYPE_META: Record<string, { icon: LucideIcon; className: string }> = {
  saldo_baixo: { icon: Wallet, className: "bg-warning/10 text-warning" },
  conta_limitada: { icon: AlertTriangle, className: "bg-warning/10 text-warning" },
  criativo_reprovado: { icon: XCircle, className: "bg-danger/10 text-danger" },
  lote_concluido: { icon: CheckCircle2, className: "bg-success/10 text-success" },
  lote_falhou: { icon: XCircle, className: "bg-danger/10 text-danger" },
  automacao_disparada: { icon: Zap, className: "bg-accent-soft text-primary" },
};

function NotificationIcon({ type }: { type: string }) {
  const meta = TYPE_META[type] ?? { icon: Bell, className: "bg-secondary text-text-muted" };
  const Icon = meta.icon;
  return (
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.className}`}>
      <Icon className="h-4 w-4" />
    </div>
  );
}

export function NotificationsView({ notifications }: { notifications: NotificationRow[] }) {
  const [isPending, startTransition] = useTransition();
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  function handleMarkOne(id: string) {
    startTransition(async () => {
      await markNotificationRead(id);
    });
  }

  function handleMarkAll() {
    startTransition(async () => {
      await markAllNotificationsRead();
    });
  }

  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="Nenhuma notificação ainda"
        description="Alertas de saldo baixo, contas limitadas, criativos reprovados, lotes concluídos e automações aparecem aqui."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {unreadCount > 0 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-muted">{unreadCount} não lida{unreadCount === 1 ? "" : "s"}</p>
          <Button type="button" variant="outline" size="sm" onClick={handleMarkAll} disabled={isPending}>
            <Check className="h-3.5 w-3.5" /> Marcar todas como lidas
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        {notifications.map((n) => {
          const content = (
            <div
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                n.read_at ? "border-border bg-card" : "border-primary/30 bg-accent-soft/40"
              }`}
            >
              <NotificationIcon type={n.type} />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{n.title}</p>
                {n.body ? <p className="mt-0.5 text-sm text-text-muted">{n.body}</p> : null}
                <p className="mt-1 text-xs text-text-faint">
                  {new Date(n.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
              {!n.read_at ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleMarkOne(n.id);
                  }}
                  className="shrink-0 rounded-full p-1.5 text-text-faint hover:bg-secondary hover:text-foreground"
                  title="Marcar como lida"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          );

          return n.link ? (
            <Link key={n.id} href={n.link} onClick={() => !n.read_at && handleMarkOne(n.id)}>
              {content}
            </Link>
          ) : (
            <div key={n.id}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
