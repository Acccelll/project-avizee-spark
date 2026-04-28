/**
 * EmpresaSection — dados institucionais, contato, endereço e identidade
 * visual da empresa. Branding (logo, cores, marca) vive em
 * `empresa_config` (canônico). Campos auxiliares (site, whatsapp,
 * responsável, inscrição municipal) ficam em `app_configuracoes['geral']`
 * por compatibilidade.
 */

import { useEffect, useRef, useState } from "react";
import { Building2, Calendar, Globe, Image as ImageIcon, Info, Loader2, Mail, MapPin, Phone, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MaskedInput } from "@/components/ui/MaskedInput";
import { cn } from "@/lib/utils";
import { getUserFriendlyError, notifyError } from "@/utils/errorMessages";
import { SectionShell } from "@/pages/admin/components/SectionShell";
import { useEmpresaConfig, useAppConfig } from "@/pages/admin/hooks/useEmpresaConfig";
import { uploadDbavizeeImage } from "@/services/storage.service";

const DEFAULT_FORM = {
  empresa: "AviZee Equipamentos LTDA",
  nomeFantasia: "AviZee",
  cnpj: "",
  inscricaoEstadual: "",
  inscricaoMunicipal: "",
  site: "",
  email: "contato@avizee.com.br",
  telefone: "",
  whatsapp: "",
  responsavel: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  logoUrl: "/images/logoavizee.png",
  simboloUrl: "",
  marcaTexto: "",
  marcaSubtitulo: "ERP",
  corPrimaria: "#690500",
  corSecundaria: "#b2592c",
};

type GeralAux = {
  site?: string;
  whatsapp?: string;
  responsavel?: string;
  inscricaoMunicipal?: string;
};

const isValidHex = (hex: string) => /^#[0-9A-Fa-f]{6}$/.test(hex);
const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

export function EmpresaSection() {
  const { empresaConfig, isLoading: empresaLoading, handleSave: saveEmpresa, isSaving: empresaSaving } =
    useEmpresaConfig();
  const { config: geralAux, handleSave: saveGeral, isSaving: geralSaving } = useAppConfig("geral");

  const [draft, setDraft] = useState(DEFAULT_FORM);
  const [logoUploading, setLogoUploading] = useState(false);
  const [simboloUploading, setSimboloUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const simboloInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const aux = (geralAux as GeralAux) ?? {};
    setDraft({
      ...DEFAULT_FORM,
      empresa: empresaConfig?.razao_social ?? DEFAULT_FORM.empresa,
      nomeFantasia: empresaConfig?.nome_fantasia ?? DEFAULT_FORM.nomeFantasia,
      cnpj: empresaConfig?.cnpj ?? "",
      inscricaoEstadual: empresaConfig?.inscricao_estadual ?? "",
      inscricaoMunicipal: aux.inscricaoMunicipal ?? "",
      site: aux.site ?? "",
      email: empresaConfig?.email ?? DEFAULT_FORM.email,
      telefone: empresaConfig?.telefone ?? "",
      whatsapp: aux.whatsapp ?? "",
      responsavel: aux.responsavel ?? "",
      cep: empresaConfig?.cep ?? "",
      logradouro: empresaConfig?.logradouro ?? "",
      numero: empresaConfig?.numero ?? "",
      complemento: empresaConfig?.complemento ?? "",
      bairro: empresaConfig?.bairro ?? "",
      cidade: empresaConfig?.cidade ?? "",
      uf: empresaConfig?.uf ?? "",
      logoUrl: empresaConfig?.logo_url ?? DEFAULT_FORM.logoUrl,
      simboloUrl: empresaConfig?.simbolo_url ?? "",
      marcaTexto: empresaConfig?.marca_texto ?? "",
      marcaSubtitulo: empresaConfig?.marca_subtitulo ?? DEFAULT_FORM.marcaSubtitulo,
      corPrimaria: empresaConfig?.cor_primaria ?? DEFAULT_FORM.corPrimaria,
      corSecundaria: empresaConfig?.cor_secundaria ?? DEFAULT_FORM.corSecundaria,
    });
  }, [empresaConfig, geralAux]);

  const update = <K extends keyof typeof DEFAULT_FORM>(key: K, value: (typeof DEFAULT_FORM)[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const uploadImage = async (
    file: File,
    pathPrefix: string,
    field: "logoUrl" | "simboloUrl",
    sizeLimit: number,
    setUploading: (v: boolean) => void,
    inputRef: React.RefObject<HTMLInputElement>,
  ) => {
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Formato de imagem não suportado. Use PNG, JPEG, SVG ou WebP.");
      return;
    }
    if (file.size > sizeLimit) {
      toast.error(`Arquivo muito grande. O tamanho máximo é ${sizeLimit / (1024 * 1024)} MB.`);
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${pathPrefix}.${ext}`;
      const { publicUrl } = await uploadDbavizeeImage({ path, file });
      update(field, publicUrl);
      toast.success("Imagem enviada com sucesso.");
    } catch (err) {
      console.error("[admin] Erro ao enviar imagem:", err);
      notifyError(err);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleSubmit = () => {
    saveEmpresa({
      id: empresaConfig?.id,
      razao_social: draft.empresa,
      nome_fantasia: draft.nomeFantasia,
      cnpj: draft.cnpj || null,
      inscricao_estadual: draft.inscricaoEstadual || null,
      email: draft.email || null,
      telefone: draft.telefone || null,
      cep: draft.cep || null,
      logradouro: draft.logradouro || null,
      numero: draft.numero || null,
      complemento: draft.complemento || null,
      bairro: draft.bairro || null,
      cidade: draft.cidade || null,
      uf: draft.uf || null,
      logo_url: draft.logoUrl || null,
      simbolo_url: draft.simboloUrl || null,
      marca_texto: draft.marcaTexto || null,
      marca_subtitulo: draft.marcaSubtitulo || null,
      cor_primaria: draft.corPrimaria || null,
      cor_secundaria: draft.corSecundaria || null,
    });
    saveGeral({
      site: draft.site,
      whatsapp: draft.whatsapp,
      responsavel: draft.responsavel,
      inscricaoMunicipal: draft.inscricaoMunicipal,
    });
  };

  if (empresaLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando dados da empresa...
      </div>
    );
  }

  const renderColorField = (label: string, field: "corPrimaria" | "corSecundaria", description: string) => {
    const value = draft[field];
    const valid = isValidHex(value);
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <div className="flex items-center gap-2">
          <div
            className="relative h-10 w-10 shrink-0 rounded-md border overflow-hidden cursor-pointer"
            style={{ backgroundColor: valid ? value : "hsl(var(--muted))" }}
          >
            <input
              type="color"
              value={valid ? value : "#000000"}
              onChange={(e) => update(field, e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer h-full w-full"
              title={label}
            />
          </div>
          <Input
            value={value}
            onChange={(e) => update(field, e.target.value)}
            className={cn("font-mono", !valid && value ? "border-destructive focus-visible:ring-destructive" : "")}
            maxLength={7}
            placeholder="#000000"
          />
        </div>
        {!valid && value && <p className="text-[11px] text-destructive">Formato inválido. Use #RRGGBB</p>}
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
    );
  };

  return (
    <SectionShell
      title="Dados institucionais"
      description="Cadastro institucional, marca e endereço legal da empresa."
      saveCta="Salvar dados institucionais"
      lastSavedAt={empresaConfig?.updated_at ?? null}
      isSaving={empresaSaving || geralSaving}
      onSave={handleSubmit}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <CardTitle>Dados institucionais</CardTitle>
                <CardDescription>
                  Informações legais e cadastrais da empresa. Utilizadas em documentos oficiais, notas fiscais e cabeçalho do sistema.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Razão social <span className="text-destructive">*</span></Label>
              <Input value={draft.empresa} onChange={(e) => update("empresa", e.target.value)} placeholder="EMPRESA LTDA" />
            </div>
            <div className="space-y-1.5">
              <Label>Nome fantasia</Label>
              <Input value={draft.nomeFantasia} onChange={(e) => update("nomeFantasia", e.target.value)} placeholder="Empresa" />
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ</Label>
              <MaskedInput mask="cnpj" value={draft.cnpj} onChange={(v) => update("cnpj", v)} showValidation placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-1.5">
              <Label>Inscrição estadual</Label>
              <Input value={draft.inscricaoEstadual} onChange={(e) => update("inscricaoEstadual", e.target.value)} placeholder="000.000.000.000" />
            </div>
            <div className="space-y-1.5">
              <Label>Inscrição municipal</Label>
              <Input value={draft.inscricaoMunicipal} onChange={(e) => update("inscricaoMunicipal", e.target.value)} placeholder="000000000" />
            </div>
            <div className="space-y-1.5">
              <Label>Site</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={draft.site} onChange={(e) => update("site", e.target.value)} className="pl-9" placeholder="https://www.empresa.com.br" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <CardTitle>Contato principal</CardTitle>
                <CardDescription>Canais de comunicação institucionais utilizados em e-mails e documentos.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>E-mail institucional</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={draft.email} onChange={(e) => update("email", e.target.value)} className="pl-9" placeholder="contato@empresa.com.br" type="email" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <MaskedInput mask="telefone" value={draft.telefone} onChange={(v) => update("telefone", v)} placeholder="(00) 0000-0000" />
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp / Celular</Label>
              <MaskedInput mask="celular" value={draft.whatsapp} onChange={(v) => update("whatsapp", v)} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-1.5">
              <Label>Responsável principal</Label>
              <Input value={draft.responsavel} onChange={(e) => update("responsavel", e.target.value)} placeholder="Nome do responsável" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <CardTitle>Endereço</CardTitle>
                <CardDescription>Endereço da sede da empresa. Utilizado em documentos fiscais e comunicações.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>CEP</Label>
              <MaskedInput mask="cep" value={draft.cep} onChange={(v) => update("cep", v)} placeholder="00000-000" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Logradouro</Label>
              <Input value={draft.logradouro} onChange={(e) => update("logradouro", e.target.value)} placeholder="Rua, Avenida, etc." />
            </div>
            <div className="space-y-1.5">
              <Label>Número</Label>
              <Input value={draft.numero} onChange={(e) => update("numero", e.target.value)} placeholder="000" />
            </div>
            <div className="space-y-1.5">
              <Label>Complemento</Label>
              <Input value={draft.complemento} onChange={(e) => update("complemento", e.target.value)} placeholder="Sala, andar, etc." />
            </div>
            <div className="space-y-1.5">
              <Label>Bairro</Label>
              <Input value={draft.bairro} onChange={(e) => update("bairro", e.target.value)} placeholder="Bairro" />
            </div>
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input value={draft.cidade} onChange={(e) => update("cidade", e.target.value)} placeholder="Cidade" />
            </div>
            <div className="space-y-1.5">
              <Label>Estado (UF)</Label>
              <Select value={draft.uf} onValueChange={(v) => update("uf", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {UFS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <ImageIcon className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <CardTitle>Identidade visual</CardTitle>
                <CardDescription>Logo e cores aplicadas no cabeçalho do sistema, PDFs e documentos comerciais.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Logo da empresa</Label>
              {draft.logoUrl && (
                <div className="flex items-start gap-4">
                  <div className="flex h-20 w-40 items-center justify-center overflow-hidden rounded-md border bg-muted/30 p-2">
                    <img src={draft.logoUrl} alt="Logo da empresa" className="max-h-full max-w-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  </div>
                  <p className="mt-2 truncate max-w-xs text-xs text-muted-foreground font-mono">{draft.logoUrl}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}>
                  {logoUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {draft.logoUrl ? "Substituir logo" : "Enviar logo"}
                </Button>
                {draft.logoUrl && (
                  <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => update("logoUrl", "")}>
                    Remover logo
                  </Button>
                )}
              </div>
              <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadImage(f, "logos/logo-empresa", "logoUrl", 2 * 1024 * 1024, setLogoUploading, logoInputRef);
              }} />
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />Formatos: PNG, JPEG, SVG, WebP. Tamanho máximo: 2 MB.
              </p>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label>Símbolo (ícone reduzido)</Label>
              {draft.simboloUrl && (
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border bg-muted/30 p-2">
                    <img src={draft.simboloUrl} alt="Símbolo da empresa" className="max-h-full max-w-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  </div>
                  <p className="mt-2 truncate max-w-xs text-xs text-muted-foreground font-mono">{draft.simboloUrl}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => simboloInputRef.current?.click()} disabled={simboloUploading}>
                  {simboloUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {draft.simboloUrl ? "Substituir símbolo" : "Enviar símbolo"}
                </Button>
                {draft.simboloUrl && (
                  <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => update("simboloUrl", "")}>
                    Remover símbolo
                  </Button>
                )}
              </div>
              <input ref={simboloInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadImage(f, "logos/simbolo-empresa", "simboloUrl", 1 * 1024 * 1024, setSimboloUploading, simboloInputRef);
              }} />
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />Quadrado, fundo transparente. Usado no menu lateral recolhido. Máximo 1 MB.
              </p>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="marcaTexto">Texto da marca</Label>
                <Input id="marcaTexto" value={draft.marcaTexto} onChange={(e) => update("marcaTexto", e.target.value)} placeholder="Ex.: AviZee" maxLength={40} />
                <p className="text-[11px] text-muted-foreground">Aparece no menu expandido e na tela de login.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="marcaSubtitulo">Subtítulo discreto</Label>
                <Input id="marcaSubtitulo" value={draft.marcaSubtitulo} onChange={(e) => update("marcaSubtitulo", e.target.value)} placeholder="Ex.: ERP" maxLength={20} />
                <p className="text-[11px] text-muted-foreground">Texto curto exibido em destaque sutil.</p>
              </div>
            </div>

            <Separator />

            <div className="grid gap-6 md:grid-cols-2">
              {renderColorField("Cor primária", "corPrimaria", "Cor principal aplicada em botões e destaques.")}
              {renderColorField("Cor secundária", "corSecundaria", "Cor complementar usada em gradientes e elementos visuais.")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <CardTitle>Governança</CardTitle>
                <CardDescription>Rastreabilidade das alterações neste cadastro.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border bg-muted/30 p-3 space-y-0.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Última atualização</p>
                <p className="text-sm font-medium">
                  {empresaConfig?.updated_at ? new Date(empresaConfig.updated_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 space-y-0.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Cadastro criado em</p>
                <p className="text-sm font-medium">
                  {empresaConfig?.created_at ? new Date(empresaConfig.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SectionShell>
  );
}