import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Rocket,
  ListChecks,
  History,
  FileStack,
  Zap,
  ScrollText,
  ShieldAlert,
  Building,
  Wallet,
  Target,
  Radar,
  Users,
  Bell,
  Plug,
  Settings,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  enabled: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Visão geral",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, enabled: true },
    ],
  },
  {
    label: "Operação",
    items: [
      { label: "Nova campanha", href: "/campanhas/nova", icon: Rocket, enabled: true },
      { label: "Gerenciador", href: "/gerenciador", icon: ListChecks, enabled: true },
      { label: "Histórico", href: "/historico", icon: History, enabled: true },
      { label: "Templates", href: "/templates", icon: FileStack, enabled: true },
    ],
  },
  {
    label: "Automação",
    items: [
      { label: "Automações", href: "/automacoes", icon: Zap, enabled: true },
      { label: "Logs de automações", href: "/automacoes/logs", icon: ScrollText, enabled: true },
      { label: "Apelações", href: "/apelacoes", icon: ShieldAlert, enabled: true },
    ],
  },
  {
    label: "Estrutura",
    items: [
      { label: "Business Centers", href: "/business-centers", icon: Building, enabled: true },
      { label: "Contas", href: "/contas", icon: Wallet, enabled: true },
      { label: "Pixel", href: "/pixel", icon: Target, enabled: true },
      { label: "Tracking", href: "/tracking", icon: Radar, enabled: true },
    ],
  },
  {
    label: "Afiliados",
    items: [{ label: "Afiliados", href: "/afiliados", icon: Users, enabled: false }],
  },
  {
    label: "Sua conta",
    items: [
      { label: "Notificações", href: "/notificacoes", icon: Bell, enabled: true },
      { label: "Integrações", href: "/integracoes", icon: Plug, enabled: true },
      { label: "Configurações", href: "/configuracoes", icon: Settings, enabled: false },
    ],
  },
];
