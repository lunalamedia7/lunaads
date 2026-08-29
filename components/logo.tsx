import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <path
        d="M20.5 4.5C15.2 5.6 11.3 10.3 11.3 16c0 5.7 3.9 10.4 9.2 11.5C18.9 28.5 17 29 15 29 8.4 29 3 23.6 3 17S8.4 5 15 5c2 0 3.9.5 5.5 1.5Z"
        fill="url(#luna-moon-gradient)"
      />
      <path
        d="M25.5 3.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z"
        fill="#EAB308"
      />
      <path
        d="M26.5 14.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6.6-1.4Z"
        fill="#EAB308"
        opacity="0.8"
      />
      <defs>
        <linearGradient
          id="luna-moon-gradient"
          x1="3"
          y1="5"
          x2="20.5"
          y2="29"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#4F7BFF" />
          <stop offset="1" stopColor="#A855F7" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <LogoMark className="h-7 w-7" />
      <span className="text-lg font-semibold tracking-tight text-foreground">
        Luna<span className="text-primary">Ads</span>
      </span>
    </div>
  );
}
