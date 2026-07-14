import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useFiscalWorkspace } from "@/hooks/useFiscalWorkspace";

const KEY = "avizee.fiscal.workspace.v1";

describe("useFiscalWorkspace", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("expõe defaults quando não há storage", () => {
    const { result } = renderHook(() => useFiscalWorkspace());
    expect(result.current.empresaId).toBeNull();
    expect(result.current.period).toBe("30d");
  });

  it("persiste alterações de período e empresa em localStorage", () => {
    const { result } = renderHook(() => useFiscalWorkspace());
    act(() => {
      result.current.setPeriod("7d");
      result.current.setEmpresa("emp-42");
    });
    expect(result.current.period).toBe("7d");
    expect(result.current.empresaId).toBe("emp-42");
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
    expect(raw).toMatchObject({ period: "7d", empresaId: "emp-42" });
  });

  it("reidrata a partir do storage existente", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ period: "90d", empresaId: "emp-9" }),
    );
    const { result } = renderHook(() => useFiscalWorkspace());
    expect(result.current.period).toBe("90d");
    expect(result.current.empresaId).toBe("emp-9");
  });

  it("reset volta aos defaults", () => {
    const { result } = renderHook(() => useFiscalWorkspace());
    act(() => {
      result.current.setPeriod("7d");
      result.current.reset();
    });
    expect(result.current.period).toBe("30d");
    expect(result.current.empresaId).toBeNull();
  });
});