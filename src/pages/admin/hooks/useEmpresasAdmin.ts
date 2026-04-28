/**
 * useEmpresasAdmin — hooks React Query para gestão de empresas e vínculos
 * (Onda 1 do multi-tenant). Admin-only via RLS.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createEmpresa,
  deleteEmpresa,
  listEmpresaBindings,
  listEmpresas,
  listUnboundUsers,
  removeUserEmpresa,
  setUserEmpresa,
  updateEmpresa,
  type Empresa,
  type EmpresaUserBinding,
  type UnboundUser,
} from "@/services/empresas.service";

const KEY = ["empresas-admin"] as const;

export function useEmpresasList() {
  return useQuery<Empresa[]>({
    queryKey: [...KEY, "list"],
    queryFn: listEmpresas,
    staleTime: 30_000,
  });
}

export function useEmpresaBindings() {
  return useQuery<EmpresaUserBinding[]>({
    queryKey: [...KEY, "bindings"],
    queryFn: listEmpresaBindings,
    staleTime: 30_000,
  });
}

export function useUnboundUsers() {
  return useQuery<UnboundUser[]>({
    queryKey: [...KEY, "unbound"],
    queryFn: listUnboundUsers,
    staleTime: 30_000,
  });
}

export function useEmpresasMutations() {
  const qc = useQueryClient();
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: KEY });
  };

  const create = useMutation({
    mutationFn: createEmpresa,
    onSuccess: () => {
      toast.success("Empresa criada");
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message ?? "Falha ao criar empresa"),
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<Empresa, "nome" | "cnpj" | "ativo">> }) =>
      updateEmpresa(id, patch),
    onSuccess: () => {
      toast.success("Empresa atualizada");
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message ?? "Falha ao atualizar empresa"),
  });

  const remove = useMutation({
    mutationFn: deleteEmpresa,
    onSuccess: () => {
      toast.success("Empresa removida");
      invalidateAll();
    },
    onError: (err: Error) =>
      toast.error(
        err.message?.includes("violates foreign key")
          ? "Não é possível remover: existem usuários ou cadastros vinculados a esta empresa."
          : err.message ?? "Falha ao remover empresa",
      ),
  });

  const bind = useMutation({
    mutationFn: ({ userId, empresaId }: { userId: string; empresaId: string }) =>
      setUserEmpresa(userId, empresaId),
    onSuccess: () => {
      toast.success("Vínculo atualizado");
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message ?? "Falha ao vincular usuário"),
  });

  const unbind = useMutation({
    mutationFn: removeUserEmpresa,
    onSuccess: () => {
      toast.success("Vínculo removido");
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message ?? "Falha ao remover vínculo"),
  });

  return { create, update, remove, bind, unbind };
}