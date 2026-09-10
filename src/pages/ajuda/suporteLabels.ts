/**
 * Rótulos e variantes de badge para os enums do domínio `suporte_*`.
 * Centralizado aqui para não divergir entre o formulário, a lista de
 * chamados e a página de detalhe.
 */
import type {
  SuporteAbrangencia,
  SuporteCausa,
  SuporteEvento,
  SuporteFrequencia,
  SuporteImpacto,
  SuporteStatus,
  SuporteTipo,
} from "@/services/suporte.service";

export const TIPO_LABELS: Record<SuporteTipo, string> = {
  bug: "Bug / algo quebrado",
  problema_operacional: "Problema operacional",
  duvida: "Dúvida",
  sugestao: "Sugestão",
};

// Texto exato do wireframe aprovado (spec §6/§7.3) — não reformular.
export const IMPACTO_LABELS: Record<SuporteImpacto, string> = {
  incomodo: "Incômodo",
  atrapalha_trabalho: "Atrapalha meu trabalho",
  nao_consigo_concluir: "Não consigo concluir esta tarefa",
  indisponivel: "Sistema/atividade essencial indisponível",
};

export const ABRANGENCIA_LABELS: Record<SuporteAbrangencia, string> = {
  so_eu: "Só comigo",
  mais_pessoas: "Com mais pessoas também",
  nao_sei: "Não sei dizer",
};

export const FREQUENCIA_LABELS: Record<SuporteFrequencia, string> = {
  uma_vez: "Aconteceu uma vez",
  mais_de_uma_vez: "Já aconteceu mais de uma vez",
  sempre_que_tento: "Acontece sempre que eu tento",
  nao_sei: "Não sei dizer",
};

export const CAUSA_LABELS: Record<SuporteCausa, string> = {
  bug_corrigido: "Bug corrigido",
  configuracao: "Ajuste de configuração",
  permissao: "Ajuste de permissão",
  dado_inconsistente: "Correção de dado inconsistente",
  uso_incorreto: "Uso incorreto do sistema",
  duplicado: "Duplicado de outro chamado",
  melhoria_implementada: "Melhoria implementada",
  nao_reproduzido: "Não foi possível reproduzir",
  outro: "Outro motivo",
};

export const STATUS_LABELS: Record<SuporteStatus, string> = {
  aberto: "Aberto",
  em_triagem: "Em triagem",
  em_andamento: "Em andamento",
  aguardando_usuario: "Aguardando você",
  resolvido: "Resolvido",
  fechado: "Fechado",
  cancelado: "Cancelado",
};

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export const STATUS_BADGE_VARIANT: Record<SuporteStatus, BadgeVariant> = {
  aberto: "secondary",
  em_triagem: "secondary",
  em_andamento: "default",
  aguardando_usuario: "outline",
  resolvido: "outline",
  fechado: "secondary",
  cancelado: "destructive",
};

/** Classe extra para status que merecem destaque de cor além da variante padrão do Badge. */
export const STATUS_BADGE_CLASS: Partial<Record<SuporteStatus, string>> = {
  resolvido: "bg-success/15 text-success hover:bg-success/25 border-success/30",
  em_andamento: "bg-primary/15 text-primary hover:bg-primary/25 border-primary/30",
};

export const TIPO_ICON_EMOJI: Record<SuporteTipo, string> = {
  bug: "🐛",
  problema_operacional: "⚠️",
  duvida: "❓",
  sugestao: "💡",
};

export const EVENTO_LABELS: Record<SuporteEvento["tipo"], string> = {
  abertura: "Chamado aberto",
  comentario: "Comentário",
  status_alterado: "Status alterado",
  prioridade_alterada: "Prioridade alterada",
  tipo_modulo_alterado: "Classificação alterada",
  responsavel_alterado: "Responsável alterado",
  anexo_adicionado: "Anexo adicionado",
  vinculo_dev: "Vínculo de desenvolvimento",
  resolucao: "Marcado como resolvido",
  reabertura: "Reaberto",
  fechamento: "Fechado",
  cancelamento: "Cancelado",
  duplicidade: "Marcado como duplicado",
};
