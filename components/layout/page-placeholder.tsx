import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export function PagePlaceholder({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[34px] font-bold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-text-muted">{description}</p>
      </div>
      <EmptyState
        icon={icon}
        title="Em construção"
        description="Este módulo chega em uma próxima fase do LunaAds."
      />
    </div>
  );
}
