import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const maybeSingle = vi.fn();
const insertSingle = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }),
      insert: () => ({ select: () => ({ single: insertSingle }) }),
    }),
  },
}));
vi.mock("@/hooks/useCnpjLookup", () => ({ useCnpjLookup: () => ({ buscarCnpj: vi.fn(), loading: false }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { QuickAddClientModal } from "@/components/QuickAddClientModal";
import { toast } from "sonner";

const defaults = { nome_razao_social: "Cliente Teste", cpf_cnpj: "33.873.960/0001-60", tipo_pessoa: "J" as const };

function renderModal() {
  const onCreated = vi.fn();
  const onClose = vi.fn();
  render(<QuickAddClientModal open onClose={onClose} onCreated={onCreated} defaults={defaults} />);
  return { onCreated, onClose };
}

function submitForm() {
  const form = document.getElementById("quick-add-client-form") as HTMLFormElement;
  fireEvent.submit(form);
}

describe("QuickAddClientModal — CNPJ já cadastrado", () => {
  beforeEach(() => vi.clearAllMocks());

  it("seleciona o cliente existente sem tentar inserir", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "c-1", nome_razao_social: "SSA" }, error: null });
    const { onCreated, onClose } = renderModal();
    submitForm();
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("c-1"));
    expect(insertSingle).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalled();
  });

  it("trata 23505 em corrida usando o cadastro existente", async () => {
    maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: "c-2", nome_razao_social: "SSA" }, error: null });
    insertSingle.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } });
    const { onCreated } = renderModal();
    submitForm();
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("c-2"));
  });

  it("exibe a mensagem do erro do Supabase sem rejeição não tratada", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    insertSingle.mockResolvedValue({ data: null, error: { code: "42501", message: "permission denied" } });
    const { onCreated } = renderModal();
    submitForm();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Erro ao cadastrar cliente: permission denied"),
    );
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.getByText("Cadastro Rápido de Cliente")).toBeTruthy();
  });
});
