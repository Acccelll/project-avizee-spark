import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/format";
import { Tables } from "@/integrations/supabase/types";

export interface ProductWithForn extends Tables<"produtos"> {
  produtos_fornecedores?: (Tables<"produtos_fornecedores"> & {
    fornecedores?: { nome_razao_social: string } | null;
  })[];
}

interface ProductSelectorProps {
  produtos: ProductWithForn[];
  onSelect: (produto: ProductWithForn) => void;
  trigger?: React.ReactNode;
}

export function ProductSelector({ produtos, onSelect, trigger }: ProductSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return produtos;
    return produtos.filter(p =>
      (p.nome || "").toLowerCase().includes(q) ||
      (p.sku || "").toLowerCase().includes(q) ||
      (p.codigo_interno || "").toLowerCase().includes(q)
    );
  }, [produtos, search]);

  const handleSelect = (p: any) => {
    onSelect(p);
    setOpen(false);
    setSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="icon" className="h-8 w-8">
            <Search className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Selecionar Produto</DialogTitle>
          <DialogDescription>
            Pesquise e selecione um produto da lista abaixo.
          </DialogDescription>
        </DialogHeader>
        <div className="relative my-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, SKU ou código..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <ScrollArea className="flex-1 border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[120px]">Cód/SKU</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-[60px] text-center">UN</TableHead>
                <TableHead className="w-[150px]">Fornecedor Principal</TableHead>
                <TableHead className="text-right w-[100px]">Preço</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum produto encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => {
                  const principalForn = p.produtos_fornecedores?.find((f: any) => f.eh_principal)?.fornecedores?.nome_razao_social;
                  return (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSelect(p)}
                    >
                      <TableCell className="font-mono text-xs">{p.sku || p.codigo_interno || "—"}</TableCell>
                      <TableCell className="font-medium text-sm">{p.nome}</TableCell>
                      <TableCell className="text-center text-xs">{p.unidade_medida || "UN"}</TableCell>
                      <TableCell className="text-xs truncate max-w-[150px]">{principalForn || "—"}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatCurrency(p.preco_venda || 0)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

interface ClientSelectorProps {
  clientes: Tables<"clientes">[];
  onSelect: (cliente: Tables<"clientes">) => void;
  trigger?: React.ReactNode;
}

export function ClientSelector({ clientes, onSelect, trigger }: ClientSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return clientes;
    return clientes.filter(c =>
      (c.nome_razao_social || "").toLowerCase().includes(q) ||
      (c.nome_fantasia || "").toLowerCase().includes(q) ||
      (c.cpf_cnpj || "").toLowerCase().includes(q)
    );
  }, [clientes, search]);

  const handleSelect = (c: any) => {
    onSelect(c);
    setOpen(false);
    setSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="icon" className="h-10 w-10">
            <Search className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Selecionar Cliente</DialogTitle>
          <DialogDescription>
            Pesquise e selecione um cliente da lista abaixo.
          </DialogDescription>
        </DialogHeader>
        <div className="relative my-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, fantasia ou documento..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <ScrollArea className="flex-1 border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Nome / Razão Social</TableHead>
                <TableHead className="w-[160px]">Documento</TableHead>
                <TableHead className="w-[180px]">Cidade / UF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    Nenhum cliente encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSelect(c)}
                  >
                    <TableCell>
                      <div className="font-medium text-sm">{c.nome_razao_social}</div>
                      {c.nome_fantasia && (
                        <div className="text-xs text-muted-foreground">{c.nome_fantasia}</div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{c.cpf_cnpj || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {c.cidade ? `${c.cidade} / ${c.uf || ""}` : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
