/**
 * Utilitários de verificação de permissões do frontend.
 *
 * Complementa `src/lib/permissions.ts` (que define o mapeamento
 * role → permissões) com funções puras de verificação, incluindo
 * suporte a wildcards (ex.: `usuarios:*`).
 */

import type { PermissionKey } from "@/lib/permissions";

/**
 * Tipo de permissão aceito pela aplicação.
 * - `${resource}:${action}` — permissão específica (ex.: `usuarios:criar`)
 * - `${resource}:*`          — wildcard para todas as ações de um recurso
 * - `admin`                  — acesso irrestrito (equivale a ter todas as permissões)
 */
export type Permission = PermissionKey | `${string}:*` | "admin";

/**
 * Verifica se um conjunto de permissões do usuário satisfaz a permissão
 * requerida, incluindo suporte a wildcards e à pseudo-permissão `admin`.
 *
 * @param userPermissions - Conjunto (Set) de permissões atribuídas ao usuário.
 * @param required        - Permissão exigida para a operação.
 * @returns `true` se o usuário possuir a permissão requerida.
 *
 * @example
 * const perms = new Set(["usuarios:visualizar", "usuarios:criar"]);
 * checkPermission(perms, "usuarios:criar")  // true
 * checkPermission(perms, "usuarios:*")      // false – o usuário não tem wildcard
 * checkPermission(perms, "usuarios:excluir") // false
 *
 * // Com wildcard no conjunto do usuário:
 * const adminPerms = new Set(["admin"]);
 * checkPermission(adminPerms, "qualquer:coisa") // true
 */
export function checkPermission(
  userPermissions: Set<string>,
  required: Permission
): boolean {
  // Acesso total via pseudo-permissão "admin"
  if (userPermissions.has("admin")) return true;

  // Permissão exata
  if (userPermissions.has(required)) return true;

  // Wildcard requerida: o usuário precisa ter a wildcard no seu Set
  if (required.endsWith(":*")) {
    return userPermissions.has(required);
  }

  // Wildcard do usuário: usuário tem `resource:*`, que cobre qualquer ação
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
  required: Permission
): boolean {
  return checkPermission(new Set(userPermissions), required);
}
