import type { Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";

export interface Cliente {
  id: string;
  tipo_pessoa: string;
  nome_razao_social: string;
  nome_fantasia: string;
  cpf_cnpj: string;
  inscricao_estadual: string;
  email: string;
  telefone: string;
  celular: string;
  contato: string;
  prazo_padrao: number;
  limite_credito: number;
  forma_pagamento_padrao: string | null;
  prazo_preferencial: number | null;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  pais: string;
  observacoes: string;
  ativo: boolean;
  created_at: string;
  grupo_economico_id: string | null;
  tipo_relacao_grupo: string | null;
  caixa_postal: string | null;
}

export interface GrupoEconomico {
  id: string;
  nome: string;
}

export function buildClienteColumns(
  grupos: GrupoEconomico[],
): Column<Cliente>[] {
  const grupoNome = (id: string | null): string =>
    !id ? "—" : grupos.find((g) => g.id === id)?.nome ?? "—";

  return [
    {
      key: "nome_razao_social",
      mobilePrimary: true,
      label: "Nome / Razão Social",
      sortable: true,
      render: (c: Cliente) => (
        <div>
          <p className="font-medium leading-tight">{c.nome_razao_social}</p>
          {c.nome_fantasia && c.nome_fantasia !== c.nome_razao_social && (
            <p className="text-xs text-muted-foreground truncate max-w-xs">{c.nome_fantasia}</p>
          )}
        </div>
      ),
    },
    {
      key: "cpf_cnpj",
      mobileCard: true,
      label: "CPF / CNPJ",
      render: (c: Cliente) => (
        <span className="font-mono text-xs">{c.cpf_cnpj || "—"}</span>
      ),
    },
    {
      key: "tipo_pessoa",
      label: "Tipo",
      render: (c: Cliente) => (
        <span
          className={`text-xs font-semibold ${
            c.tipo_pessoa === "F"
              ? "text-blue-600 dark:text-blue-400"
              : "text-violet-600 dark:text-violet-400"
          }`}
        >
          {c.tipo_pessoa === "F" ? "PF" : "PJ"}
        </span>
      ),
    },
    {
      key: "contato_principal",
      mobileCard: true,
      label: "Contato",
      render: (c: Cliente) => {
        const phone = c.celular || c.telefone;
        if (!phone && !c.email) {
          return <span className="text-muted-foreground text-xs">—</span>;
        }
        return (
          <div className="text-xs space-y-0.5">
            {phone && <p className="font-medium tabular-nums">{phone}</p>}
            {c.email && <p className="text-muted-foreground truncate max-w-xs">{c.email}</p>}
          </div>
        );
      },
    },
    {
      key: "prazo_padrao",
      label: "Prazo",
      render: (c: Cliente) =>
        c.prazo_padrao ? (
          <span className="font-mono text-xs font-medium">{c.prazo_padrao}d</span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
    {
      key: "grupo",
      label: "Grupo Econômico",
      render: (c: Cliente) => (
        <span className="text-xs">{grupoNome(c.grupo_economico_id)}</span>
      ),
    },
    {
      key: "ativo",
      mobileCard: true,
      label: "Status",
      render: (c: Cliente) => (
        <StatusBadge status={c.ativo ? "ativo" : "inativo"} />
      ),
    },
  ];
}
