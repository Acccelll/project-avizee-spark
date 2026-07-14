import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFiscalConnectivity } from "@/hooks/useFiscalConnectivity";

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  });
}

describe("useFiscalConnectivity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T12:00:00.000Z"));
    setNavigatorOnline(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    setNavigatorOnline(true);
  });

  it("inicia online quando navigator.onLine está true", () => {
    const { result } = renderHook(() => useFiscalConnectivity());

    expect(result.current.online).toBe(true);
    expect(result.current.changedAt).toBeNull();
  });

  it("inicia offline quando navigator.onLine está false", () => {
    setNavigatorOnline(false);

    const { result } = renderHook(() => useFiscalConnectivity());

    expect(result.current.online).toBe(false);
    expect(result.current.changedAt).toBeNull();
  });

  it("reage aos eventos offline e online registrando o timestamp da mudança", () => {
    const { result } = renderHook(() => useFiscalConnectivity());

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current.online).toBe(false);
    expect(result.current.changedAt).toBe("2026-07-14T12:00:00.000Z");

    vi.setSystemTime(new Date("2026-07-14T12:01:00.000Z"));

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    expect(result.current.online).toBe(true);
    expect(result.current.changedAt).toBe("2026-07-14T12:01:00.000Z");
  });
});