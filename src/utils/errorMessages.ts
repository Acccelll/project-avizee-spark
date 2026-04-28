/**
 * Maps Supabase/PostgreSQL error codes and messages to user-friendly Portuguese strings.
 */

interface SupabaseError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

const ERROR_CODE_MAP: Record<string, string> = {
  // PostgreSQL constraint violations
  "23505": "Registro já existe. Verifique os dados e tente novamente.",
  "23503": "Operação não permitida: este registro está sendo usado em outro lugar.",
  "23502": "Campo obrigatório não preenchido.",
  "23514": "Valor fora do intervalo permitido.",
  "23P01": "Conflito de exclusão em cascata.",

  // PostgreSQL auth/permission
  "42501": "Você não tem permissão para realizar esta ação.",
  "42P01": "Tabela não encontrada. Contate o suporte.",

  // Supabase-specific
  "PGRST116": "Registro não encontrado.",
  "PGRST301": "Permissão negada pelo servidor.",
  "PGRST204": "Sem resultados para a consulta.",

  // Network / generic
  "NETWORK_ERROR": "Erro de conexão. Verifique sua internet e tente novamente.",
  "TIMEOUT": "A operação demorou muito. Tente novamente.",
};

const MESSAGE_PATTERN_MAP: Array<[RegExp, string]> = [
  [/duplicate key value violates unique constraint/i, "Registro já existe com esses dados."],
  [/foreign key constraint/i, "Este registro está vinculado a outros dados e não pode ser removido."],
  [/not-null constraint/i, "Um campo obrigatório não foi preenchido."],
  [/check constraint/i, "Os dados informados estão fora do permitido."],
  [/permission denied/i, "Permissão negada para esta operação."],
  [/jwt expired/i, "Sua sessão expirou. Faça login novamente."],
  [/invalid login credentials/i, "Credenciais inválidas. Verifique e-mail e senha."],
  [/email already registered/i, "Este e-mail já está cadastrado."],
  [/row-level security/i, "Acesso negado a este registro."],
  [/network|fetch|failed to fetch/i, "Erro de conexão. Verifique sua internet e tente novamente."],
];

/**
 * Converts a raw Supabase or JavaScript error into a user-friendly message.
 *
 * @param error - Any error object (Supabase error, PostgrestError, or native Error)
 * @returns A concise, friendly error message in Portuguese
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getUserFriendlyError(error: any): string {
  if (!error) return "Ocorreu um erro inesperado.";

  const err = error as SupabaseError & { message?: string };

  // AbortError: requisição cancelada intencionalmente (ex.: drawer fechou
  // durante fetch, navegação, troca rápida de registro). NÃO é um erro real
  // do ponto de vista do usuário — retornamos string vazia para que
  // `notifyError` não exiba toast.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyErr = error as any;
  if (
    anyErr?.name === "AbortError" ||
    /signal is aborted|aborted without reason|the operation was aborted/i.test(
      String(anyErr?.message ?? ""),
    )
  ) {
    return "";
  }

  // 1. Try exact error code mapping
  if (err.code && ERROR_CODE_MAP[err.code]) {
    return ERROR_CODE_MAP[err.code];
  }

  // 2. Try pattern matching on message
  const message = err.message || err.details || "";
  for (const [pattern, friendly] of MESSAGE_PATTERN_MAP) {
    if (pattern.test(message)) {
      return friendly;
    }
  }

  // 3. Fallback to a sanitised version of the original message (no raw SQL details)
  if (message && message.length > 0 && message.length < 200) {
    // Only expose short, non-technical messages
    const isTechnical = /sql|pg|postgres|supabase|schema|column|table|constraint/i.test(message);
    if (!isTechnical) return message;
  }

  return "Ocorreu um erro inesperado. Tente novamente.";
}

/**
 * Helper para reportar erros via toast suprimindo cancelamentos (AbortError).
 * Use sempre que for fazer `toast.error(getUserFriendlyError(err))` em handlers
 * de mutations/queries — evita que cancelamentos legítimos virem ruído visual.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function notifyError(error: any, fallback?: string): void {
  const msg = getUserFriendlyError(error);
  if (!msg) return; // AbortError ou similar — silenciar
  // Import dinâmico evita ciclo com sonner em módulos que não usam toast.
  void import("sonner").then(({ toast }) => {
    toast.error(fallback ?? msg);
  });
}
