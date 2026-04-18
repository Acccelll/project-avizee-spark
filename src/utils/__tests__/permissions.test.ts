import { describe, expect, it } from "vitest";
import {
  checkPermission,
  checkPermissionArray,
  type Permission,
} from "@/utils/permissions";

// ─── checkPermission ──────────────────────────────────────────────────────────

describe("checkPermission", () => {
  it("retorna true para permissão específica presente no conjunto", () => {
    const perms = new Set<string>(["usuarios:criar", "financeiro:visualizar"]);
    expect(checkPermission(perms, "usuarios:criar")).toBe(true);
    expect(checkPermission(perms, "financeiro:visualizar")).toBe(true);
  });

  it("retorna false para permissão específica ausente no conjunto", () => {
    const perms = new Set<string>(["usuarios:criar"]);
    expect(checkPermission(perms, "usuarios:excluir")).toBe(false);
    expect(checkPermission(perms, "financeiro:criar")).toBe(false);
  });

  it("retorna true quando o usuário possui wildcard do recurso", () => {
    const perms = new Set<string>(["usuarios:*"]);
    expect(checkPermission(perms, "usuarios:visualizar")).toBe(true);
    expect(checkPermission(perms, "usuarios:criar")).toBe(true);
    expect(checkPermission(perms, "usuarios:excluir")).toBe(true);
  });

  it("retorna false para recurso diferente mesmo com wildcard", () => {
    const perms = new Set<string>(["usuarios:*"]);
    expect(checkPermission(perms, "financeiro:visualizar")).toBe(false);
  });

  it("retorna true ao verificar wildcard que o usuário possui", () => {
    const perms = new Set<string>(["usuarios:*"]);
    expect(checkPermission(perms, "usuarios:*")).toBe(true);
  });

  it("retorna false ao verificar wildcard que o usuário não possui", () => {
    const perms = new Set<string>(["usuarios:criar"]);
    expect(checkPermission(perms, "usuarios:*")).toBe(false);
  });

  it("retorna false para conjunto de permissões vazio", () => {
    const perms = new Set<string>();
    expect(checkPermission(perms, "usuarios:criar")).toBe(false);
  });

  it("retorna true para wildcard global '*'", () => {
    const perms = new Set<string>(["*"]);
    const cases: Permission[] = [
      "usuarios:visualizar",
      "financeiro:criar",
      "usuarios:*",
      "qualquer:coisa" as Permission,
    ];
    cases.forEach((p) => {
      expect(checkPermission(perms, p)).toBe(true);
    });
  });
});

// ─── checkPermissionArray ─────────────────────────────────────────────────────

describe("checkPermissionArray", () => {
  it("retorna true para permissão presente no array", () => {
    expect(
      checkPermissionArray(["usuarios:criar", "financeiro:visualizar"], "usuarios:criar")
    ).toBe(true);
  });

  it("retorna false para permissão ausente no array", () => {
    expect(
      checkPermissionArray(["usuarios:criar"], "usuarios:excluir")
    ).toBe(false);
  });

  it("suporta wildcard global '*' no array", () => {
    expect(checkPermissionArray(["*"], "qualquer:permissao" as never)).toBe(true);
  });

  it("suporta wildcard no array", () => {
    expect(
      checkPermissionArray(["relatorios:*"], "relatorios:exportar")
    ).toBe(true);
  });

  it("retorna false para array vazio", () => {
    expect(checkPermissionArray([], "usuarios:criar")).toBe(false);
  });
});
