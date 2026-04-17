/**
 * Utilitários de verificação de permissões do frontend.
 *
 * Complementa `src/lib/permissions.ts` (que define o mapeamento
 * role → permissões) com funções puras de verificação, incluindo
 * suporte a wildcards (`resource:*`) e wildcard global (`*`).
 *
 * O alias `"admin"` é aceito apenas por retrocompatibilidade — novos
 * códigos devem usar `"*"` para acesso irrestrito.
 */

import type { PermissionKey } from "@/lib/permissions";

/**
 * Wildcard global — concede acesso a qualquer recurso/ação.
 * Equivale ao alias legado `"admin"` (mantido por retrocompat).
 */
export const WILDCARD_ALL = "*" as const;

/**
 * Tipo de permissão aceito pela aplicação.
 * - `${resource}:${action}` — permissão específica (ex.: `usuarios:criar`)
 * - `${resource}:*`          — wildcard de recurso
 * - `"*"`                    — wildcard global (acesso total)
 * - `"admin"`                — alias legado equivalente a `"*"` (deprecated)
 */
export type Permission =
  | PermissionKey
  | `${string}:*`
  | typeof WILDCARD_ALL
  | "admin";

/** Tipo do conjunto consolidado de permissões de um usuário. */
export type PermissionSet = Set<Permission>;

/**
 * Verifica se um conjunto de permissões satisfaz a permissão requerida.
 * Suporta wildcard global (`*`), wildcard de recurso (`resource:*`) e o
 * alias legado `"admin"` (tratado como wildcard global).
 *
 * @example
 * checkPermission(new Set(["*"]), "qualquer:coisa")            // true
 * checkPermission(new Set(["admin"]), "qualquer:coisa")        // true (legado)
 * checkPermission(new Set(["usuarios:*"]), "usuarios:criar")   // true
 * checkPermission(new Set(["usuarios:criar"]), "usuarios:criar") // true
 * checkPermission(new Set(["usuarios:criar"]), "usuarios:excluir") // false
 */
export function checkPermission(
  userPermissions: Set<string>,
  required: Permission,
): boolean {
  // Acesso total via wildcard global ou alias legado "admin"
  if (userPermissions.has(WILDCARD_ALL) || userPermissions.has("admin")) {
    return true;
  }

  // Permissão exata
  if (userPermissions.has(required)) return true;

  // Wildcard requerida pelo chamador: usuário precisa ter essa wildcard exata
  if (required.endsWith(":*")) {
    return userPermissions.has(required);
  }

  // Wildcard de recurso no usuário: `resource:*` cobre qualquer ação do recurso
  const [resource] = required.split(":");
  if (resource && userPermissions.has(`${resource}:*`)) return true;

  return false;
}

/**
 * Versão array da verificação — aceita `string[]` em vez de `Set<string>`.
 * Útil para testes e contextos onde o conjunto não está pré-computado.
 */
export function checkPermissionArray(
  userPermissions: string[],
  required: Permission,
): boolean {
  return checkPermission(new Set(userPermissions), required);
}
