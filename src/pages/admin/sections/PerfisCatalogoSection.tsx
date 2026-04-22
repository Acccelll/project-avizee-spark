/**
 * PerfisCatalogoSection — visão única e read-only de "Perfis e Permissões".
 *
 * Une o catálogo hierárquico (`RolesCatalog`, com permissões herdadas por role)
 * e a matriz consolidada (`PermissaoMatrix`, visão tabular cruzando recursos x
 * roles). Substitui as antigas Tabs duplicadas dentro do `usuarios`.
 *
 * O fluxo de **edição** continua sendo individual (cadastro de usuário em
 * Usuários e Permissões → modal → matriz tri-state allow/deny). Aqui é só
 * leitura para consulta e auditoria visual.
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Grid3x3, Loader2 } from "lucide-react";
import { RolesCatalog } from "@/components/usuarios/RolesCatalog";
import { PermissaoMatrix } from "@/pages/admin/components/PermissaoMatrix";
import { invokeAdminUsers, type UserWithRoles } from "@/components/usuarios/_shared";

export function PerfisCatalogoSection() {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await invokeAdminUsers({ action: "list" });
        if (mounted) setUsers((response?.users as UserWithRoles[]) ?? []);
      } catch {
        // erro silencioso — RolesCatalog renderiza count=0
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            Perfis e Catálogo de Permissões
          </CardTitle>
          <CardDescription>
            Visão somente-leitura das permissões padrão por role. Para conceder exceções a um usuário específico, use a seção Usuários e Permissões.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="catalogo">
            <TabsList className="mb-4">
              <TabsTrigger value="catalogo" className="gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                Por perfil
              </TabsTrigger>
              <TabsTrigger value="matriz" className="gap-1.5">
                <Grid3x3 className="h-3.5 w-3.5" />
                Matriz consolidada
              </TabsTrigger>
            </TabsList>
            <TabsContent value="catalogo">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando perfis…
                </div>
              ) : (
                <RolesCatalog users={users} />
              )}
            </TabsContent>
            <TabsContent value="matriz">
              <PermissaoMatrix />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}