import { Settings } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export default function Page() {
  return (
    <PagePlaceholder
      title="Configurações"
      description="Preferências da sua conta e organização."
      icon={Settings}
    />
  );
}
