import { toast } from "sonner";

/**
 * Helpers de toast para operações CRUD com mensagens consistentes.
 */
export const toastCrud = {
  created: (entity: string) => toast.success(`${entity} criado com sucesso`),
  updated: (entity: string) => toast.success(`${entity} atualizado com sucesso`),
  removed: (entity: string) => toast.success(`${entity} removido`),
  saved: (entity: string) => toast.success(`${entity} salvo`),
  /**
   * Toast de criação com identificador (número de documento, código).
   * Ex.: toastCrud.createdWithId("Orçamento", "PV-0123")
   */
  createdWithId: (entity: string, id: string) =>
    toast.success(`${entity} criado`, {
      description: `Identificador: ${id}`,
      duration: 5000,
    }),
};
