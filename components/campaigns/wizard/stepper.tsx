"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Contas & Template", "Campanha", "Conjunto", "Anúncio", "Revisão"];

export function Stepper({
  current,
  maxReached,
  onSelect,
}: {
  current: number;
  maxReached: number;
  onSelect: (step: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border bg-card p-2">
      {STEPS.map((label, i) => {
        const stepNumber = i + 1;
        const isActive = stepNumber === current;
        const isDone = stepNumber < current;
        const isClickable = stepNumber <= maxReached;
        return (
          <button
            key={label}
            type="button"
            disabled={!isClickable}
            onClick={() => onSelect(stepNumber)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              isActive && "bg-accent-soft text-primary",
              !isActive && isClickable && "text-text-muted hover:bg-secondary hover:text-foreground",
              !isClickable && "cursor-not-allowed text-text-faint",
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full border text-[10px]",
                isActive && "border-primary text-primary",
                isDone && "border-success bg-success/10 text-success",
                !isActive && !isDone && "border-border text-text-faint",
              )}
            >
              {isDone ? <Check className="h-3 w-3" /> : stepNumber}
            </span>
            {label}
          </button>
        );
      })}
    </div>
  );
}
