/**
 * Catálogo de permissões granulares do Framework Fiscal.
 * O ERP já possui RBAC via `user_permissions`; este catálogo lista os pares
 * (resource, action) esperados para operações fiscais avançadas.
 */
export const PERMISSOES_FISCAIS = [
  { resource: 'fiscal_emissao', action: 'criar' },
  { resource: 'fiscal_emissao', action: 'cancelar' },
  { resource: 'fiscal_cce', action: 'criar' },
  { resource: 'fiscal_manifestacao', action: 'criar' },
  { resource: 'fiscal_recebimento', action: 'importar' },
  { resource: 'fiscal_recebimento', action: 'aprovar' },
  { resource: 'fiscal_recebimento', action: 'rejeitar' },
  { resource: 'fiscal_certificados', action: 'gerenciar' },
  { resource: 'fiscal_parametros', action: 'editar' },
  { resource: 'fiscal_apuracao', action: 'executar' },
  { resource: 'fiscal_apuracao', action: 'fechar' },
  { resource: 'fiscal_apuracao', action: 'reabrir' },
  { resource: 'fiscal_auditoria', action: 'visualizar' },
  { resource: 'fiscal_relatorios', action: 'gerar' },
  { resource: 'fiscal_administracao', action: 'acessar' },
] as const;

export type PermissaoFiscal = (typeof PERMISSOES_FISCAIS)[number];

export function ehPermissaoFiscal(resource: string, action: string): boolean {
  return PERMISSOES_FISCAIS.some((p) => p.resource === resource && p.action === action);
}
