import { toast } from "sonner";

/**
 * Helpers de toast para operações CRUD com mensagens consistentes.
 *
 * Uso:
 * ```ts
 * toastCrud.created("Cliente");      // "Cliente criado com sucesso"
 * toastCrud.updated("Pedido");       // "Pedido atualizado com sucesso"
 * toastCrud.removed("Conta");        // "Conta removida"
 * toastCrud.saved("Configuração");   // "Configuração salva"
 * ```
 *
 * Substitui strings divergentes como `"Registro criado!"`, `"Cliente cadastrado"`,
 * `"Salvo com sucesso!"`, etc., garantindo padrão único em todo o sistema.
 */
export const toastCrud = {
  created: (entity: string) => toast.success(`${entity} criado com sucesso`),
  updated: (entity: string) => toast.success(`${entity} atualizado com sucesso`),
  removed: (entity: string) => toast.success(`${entity} removido`),
  saved: (entity: string) => toast.success(`${entity} salvo`),
};
