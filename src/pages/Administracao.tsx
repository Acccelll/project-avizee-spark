/**
 * Administracao — orquestrador da página de administração.
 *
 * Responsabilidade única: roteamento entre seções (sidebar agrupada).
 * Cada seção é um componente autônomo em `src/pages/admin/sections/*`,
 * com seu próprio estado, validação e botão de salvar via
 * `useSectionConfig` / `useEmpresaConfig`.
 *
 * Itens externos (Migração, Auditoria) navegam para fora — nunca alteram
 * a `?tab=` interna nem disparam render-time side-effects.
 */

import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Building2, Database, HardDrive, Mail, Plug, Bell, Receipt, Shield, Users, Wallet, KeyRound } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { AdminSidebar, type SideNavGroup } from "@/pages/admin/components/AdminSidebar";
import { DashboardAdmin } from "@/pages/admin/components/DashboardAdmin";
import { UsuariosTab } from "@/components/usuarios/UsuariosTab";
import { EmpresaSection } from "@/pages/admin/sections/EmpresaSection";
import { EmailSection } from "@/pages/admin/sections/EmailSection";
import { IntegracoesSection } from "@/pages/admin/sections/IntegracoesSection";
import { NotificacoesSection } from "@/pages/admin/sections/NotificacoesSection";
import { BackupSection } from "@/pages/admin/sections/BackupSection";
import { FiscalSection } from "@/pages/admin/sections/FiscalSection";
import { FinanceiroSection } from "@/pages/admin/sections/FinanceiroSection";
import { PerfisCatalogoSection } from "@/pages/admin/sections/PerfisCatalogoSection";

/** Seções renderizadas internamente (não inclui atalhos externos). */
const VALID_SECTION_KEYS = new Set([
  "empresa",
  "dashboard",
  "usuarios",
  "perfis",
  "email",
  "integracoes",
  "notificacoes",
  "backup",
  "fiscal",
  "financeiro",
]);

const sideNavGroups: SideNavGroup[] = [
  {
    key: "empresa",
    label: "Empresa",
    items: [{ key: "empresa", label: "Dados da Empresa", icon: Building2 }],
  },
  {
    key: "acesso",
    label: "Acesso & Segurança",
    items: [
      { key: "dashboard", label: "Dashboard de Segurança", icon: Shield },
      { key: "usuarios", label: "Usuários e Permissões", icon: Users },
      { key: "perfis", label: "Perfis e Catálogo", icon: KeyRound },
    ],
  },
  {
    key: "configuracoes",
    label: "Configurações",
    items: [
      { key: "email", label: "E-mails", icon: Mail },
      { key: "integracoes", label: "Integrações", icon: Plug },
      { key: "notificacoes", label: "Notificações globais", icon: Bell },
      { key: "backup", label: "Backup", icon: HardDrive },
      { key: "fiscal", label: "Parâmetros Fiscais", icon: Receipt },
      { key: "financeiro", label: "Parâmetros Financeiros", icon: Wallet },
    ],
  },
  {
    key: "dados",
    label: "Dados & Auditoria",
    items: [
      { key: "migracao", label: "Migração de Dados", icon: Database, behavior: "external" },
      { key: "auditoria", label: "Auditoria", icon: Shield, behavior: "external" },
    ],
  },
];

const EXTERNAL_ROUTES: Record<string, string> = {
  migracao: "/migracao-dados",
  auditoria: "/auditoria",
};

export default function Administracao() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab") || "empresa";
  const activeSection = VALID_SECTION_KEYS.has(rawTab) ? rawTab : "empresa";

  // Atalhos externos: redireciona em useEffect — nunca em render.
  useEffect(() => {
    if (rawTab in EXTERNAL_ROUTES) {
      navigate(EXTERNAL_ROUTES[rawTab], { replace: true });
    }
  }, [rawTab, navigate]);

  const handleSectionChange = (key: string) => {
    if (key in EXTERNAL_ROUTES) {
      navigate(EXTERNAL_ROUTES[key]);
      return;
    }
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("tab", key);
      return next;
    });
  };

  return (
    <ModulePage title="Administração" subtitle="Governança, parâmetros globais e gestão do sistema.">
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <AdminSidebar groups={sideNavGroups} activeKey={activeSection} onSelect={handleSectionChange} />
        <div className="space-y-4">
          <SectionContent section={activeSection} />
        </div>
      </div>
    </ModulePage>
  );
}

function SectionContent({ section }: { section: string }) {
  switch (section) {
    case "dashboard":
      return <DashboardAdmin />;
    case "empresa":
      return <EmpresaSection />;
    case "usuarios":
      return <UsuariosTab />;
    case "perfis":
      return <PerfisCatalogoSection />;
    case "email":
      return <EmailSection />;
    case "integracoes":
      return <IntegracoesSection />;
    case "notificacoes":
      return <NotificacoesSection />;
    case "backup":
      return <BackupSection />;
    case "fiscal":
      return <FiscalSection />;
    case "financeiro":
      return <FinanceiroSection />;
    default:
      return <EmpresaSection />;
  }
}