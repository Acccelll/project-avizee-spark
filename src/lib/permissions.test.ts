import { describe, expect, it } from "vitest";
import { buildPermissionSet, ERP_ACTIONS, ERP_RESOURCES, getRolePermissions } from "@/lib/permissions";

describe("getRolePermissions", () => {
  it("admin tem todas as permissões", () => {
    const adminPerms = getRolePermissions("admin");
    const expected = ERP_RESOURCES.length * ERP_ACTIONS.length;
    expect(adminPerms).toHaveLength(expected);
    expect(adminPerms).toContain("financeiro:editar");
    expect(adminPerms).toContain("orcamentos:criar");
    expect(adminPerms).toContain("usuarios:excluir");
  });

  it("vendedor NÃO tem permissão financeiro:editar", () => {
    const perms = getRolePermissions("vendedor");
    expect(perms).not.toContain("financeiro:editar");
  });

  it("vendedor tem permissão orcamentos:visualizar", () => {
    const perms = getRolePermissions("vendedor");
    expect(perms).toContain("orcamentos:visualizar");
  });

  it("estoquista NÃO tem permissão orcamentos:criar", () => {
    const perms = getRolePermissions("estoquista");
    expect(perms).not.toContain("orcamentos:criar");
  });

  it("estoquista tem permissão estoque:editar", () => {
    const perms = getRolePermissions("estoquista");
    expect(perms).toContain("estoque:editar");
  });

  it("financeiro tem permissão financeiro:editar mas não produtos:editar", () => {
    const perms = getRolePermissions("financeiro");
    expect(perms).toContain("financeiro:editar");
    expect(perms).not.toContain("produtos:editar");
  });
});

describe("buildPermissionSet", () => {
  it("retorna conjunto vazio para lista de roles vazia", () => {
    const set = buildPermissionSet([]);
    expect(set.size).toBe(0);
  });

  it("extraPermissions adiciona permissão além do role", () => {
    const set = buildPermissionSet(["vendedor"], ["financeiro:editar"]);
    expect(set.has("financeiro:editar")).toBe(true);
    expect(set.has("orcamentos:visualizar")).toBe(true);
  });

  it("buildPermissionSet com múltiplos roles une corretamente", () => {
    const set = buildPermissionSet(["vendedor", "estoquista"]);
    // vendedor permissions
    expect(set.has("orcamentos:visualizar")).toBe(true);
    expect(set.has("clientes:visualizar")).toBe(true);
    // estoquista permissions
    expect(set.has("estoque:editar")).toBe(true);
    expect(set.has("logistica:editar")).toBe(true);
    // neither role has this
    expect(set.has("financeiro:editar")).toBe(false);
    expect(set.has("orcamentos:criar")).toBe(false);
  });

  it("admin no buildPermissionSet contém todos os recursos e ações", () => {
    const set = buildPermissionSet(["admin"]);
    for (const resource of ERP_RESOURCES) {
      for (const action of ERP_ACTIONS) {
        expect(set.has(`${resource}:${action}`)).toBe(true);
      }
    }
  });

  it("não duplica permissões ao combinar roles com permissões sobrepostas", () => {
    // Both vendedor and financeiro have dashboard:visualizar
    const set = buildPermissionSet(["vendedor", "financeiro"]);
    const dashboardVisualizar = [...set].filter((p) => p === "dashboard:visualizar");
    expect(dashboardVisualizar).toHaveLength(1);
  });
});
