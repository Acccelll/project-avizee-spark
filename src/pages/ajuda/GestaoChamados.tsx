import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VisaoGeralTab } from "./gestao/VisaoGeralTab";
import { FilaTab } from "./gestao/FilaTab";
import { KanbanTab } from "./gestao/KanbanTab";
import { HistoricoTab } from "./gestao/HistoricoTab";

/**
 * Gestão de chamados — admin-only (recurso `suporte`). Visão geral, Fila,
 * Kanban e Histórico (spec §3.2) compartilham a mesma consulta da fila
 * (`useFilaChamados`), então navegar entre abas não refaz a busca.
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
          <TabsTrigger value="historico">Histórico</TabsTrigger>
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
        <TabsContent value="historico" className="mt-4">
          <HistoricoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
