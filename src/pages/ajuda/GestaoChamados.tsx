import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VisaoGeralTab } from "./gestao/VisaoGeralTab";
import { FilaTab } from "./gestao/FilaTab";
import { KanbanTab } from "./gestao/KanbanTab";

/**
 * Gestão de chamados — admin-only (recurso `suporte`). Visão geral, Fila e
 * Kanban compartilham a mesma consulta da fila (`useFilaChamados`), então
 * navegar entre abas não refaz a busca.
 */
export default function GestaoChamados() {
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Gestão de chamados</h1>
        <p className="text-sm text-muted-foreground">
          Triagem, priorização e acompanhamento de todos os chamados de suporte.
        </p>
      </header>

      <Tabs defaultValue="visao-geral">
        <TabsList>
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="fila">Fila</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
        </TabsList>
        <TabsContent value="visao-geral" className="mt-4">
          <VisaoGeralTab />
        </TabsContent>
        <TabsContent value="fila" className="mt-4">
          <FilaTab />
        </TabsContent>
        <TabsContent value="kanban" className="mt-4">
          <KanbanTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
