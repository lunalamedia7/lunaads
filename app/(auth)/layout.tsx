import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-1 flex-col items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div className="starfield pointer-events-none absolute inset-0 opacity-70 dark:opacity-100" />
      <div className="relative z-10 mb-8">
        <Logo />
      </div>
      <div className="relative z-10 w-full max-w-sm">{children}</div>
    </div>
  );
}
