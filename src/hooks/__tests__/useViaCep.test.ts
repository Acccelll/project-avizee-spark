import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useViaCep } from "@/hooks/useViaCep";

const { successToast, errorToast } = vi.hoisted(() => ({
  successToast: vi.fn(),
  errorToast: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: successToast,
    error: errorToast,
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeResponse(data: object, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(data),
  });
}

describe("useViaCep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns buscarCep and loading=false initially", () => {
    const { result } = renderHook(() => useViaCep());
    expect(typeof result.current.buscarCep).toBe("function");
    expect(result.current.loading).toBe(false);
  });

  it("returns null and does not fetch when CEP has less than 8 digits", async () => {
    const { result } = renderHook(() => useViaCep());
    let value: unknown;
    await act(async () => {
      value = await result.current.buscarCep("1234567");
    });
    expect(value).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("strips non-digits from CEP before fetching", async () => {
    mockFetch.mockReturnValueOnce(
      makeResponse({ logradouro: "Rua A", bairro: "Centro", localidade: "SP", uf: "SP" })
    );
    const { result } = renderHook(() => useViaCep());
    await act(async () => {
      await result.current.buscarCep("01310-100");
    });
    expect(mockFetch).toHaveBeenCalledWith("https://viacep.com.br/ws/01310100/json/");
  });

  it("returns address data on successful fetch", async () => {
    mockFetch.mockReturnValueOnce(
      makeResponse({ logradouro: "Av. Paulista", bairro: "Bela Vista", localidade: "São Paulo", uf: "SP" })
    );
    const { result } = renderHook(() => useViaCep());
    let address: unknown;
    await act(async () => {
      address = await result.current.buscarCep("01310100");
    });
    expect(address).toEqual({
      logradouro: "Av. Paulista",
      bairro: "Bela Vista",
      localidade: "São Paulo",
      uf: "SP",
    });
  });

  it("returns null and shows error toast when CEP is not found (data.erro)", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ erro: true }));
    const { result } = renderHook(() => useViaCep());
    let address: unknown;
    await act(async () => {
      address = await result.current.buscarCep("99999999");
    });
    expect(address).toBeNull();
    expect(errorToast).toHaveBeenCalledWith("CEP não encontrado");
  });

  it("returns null and shows error toast on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    const { result } = renderHook(() => useViaCep());
    let address: unknown;
    await act(async () => {
      address = await result.current.buscarCep("01310100");
    });
    expect(address).toBeNull();
    expect(errorToast).toHaveBeenCalledWith("Erro ao consultar CEP");
  });

  it("sets loading=true during fetch and false after", async () => {
    let resolveJson: (v: unknown) => void;
    const jsonPromise = new Promise((res) => { resolveJson = res; });
    mockFetch.mockReturnValueOnce(Promise.resolve({ json: () => jsonPromise }));

    const { result } = renderHook(() => useViaCep());

    let fetchPromise: Promise<unknown>;
    act(() => {
      fetchPromise = result.current.buscarCep("01310100");
    });

    // loading should be true while fetch is pending
    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveJson!({ logradouro: "Rua A", bairro: "", localidade: "", uf: "" });
      await fetchPromise;
    });

    expect(result.current.loading).toBe(false);
  });

  it("fills in empty strings for missing optional fields", async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ localidade: "Brasília", uf: "DF" }));
    const { result } = renderHook(() => useViaCep());
    let address: unknown;
    await act(async () => {
      address = await result.current.buscarCep("70040010");
    });
    expect(address).toEqual({ logradouro: "", bairro: "", localidade: "Brasília", uf: "DF" });
  });
});
