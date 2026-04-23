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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Grid3x3, Smartphone } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { RolesCatalog } from "@/components/usuarios/RolesCatalog";
import { PermissaoMatrix } from "@/pages/admin/components/PermissaoMatrix";
import { invokeAdminUsers, type UserWithRoles } from "@/components/usuarios/_shared";

export function PerfisCatalogoSection() {
  const isMobile = useIsMobile();
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
              <TabsTrigger value="catalogo" className="gap-1.5 min-h-10">
                <Shield className="h-3.5 w-3.5" />
                Por perfil
              </TabsTrigger>
              <TabsTrigger value="matriz" className="gap-1.5 min-h-10">
                <Grid3x3 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Matriz consolidada</span>
                <span className="sm:hidden">Matriz</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="catalogo">
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                  ))}
                </div>
              ) : (
                <RolesCatalog users={users} />
              )}
            </TabsContent>
            <TabsContent value="matriz">
              {isMobile ? (
                <Alert>
                  <Smartphone className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    A matriz consolidada (recursos × perfis) é otimizada para
                    telas maiores. Use a aba <strong>Por perfil</strong> em mobile
                    ou abra esta tela em desktop para ver o cruzamento completo.
                  </AlertDescription>
                </Alert>
              ) : (
                <PermissaoMatrix />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}