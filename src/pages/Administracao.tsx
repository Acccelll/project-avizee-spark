import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Building2, Calendar, CheckCircle2, Database, Globe, Image, Info, Loader2, Mail, MapPin, PenLine, Phone, Receipt, Reply, Send, Shield, Upload, User, Users, Wallet, XCircle } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { ModulePage } from '@/components/ModulePage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { MaskedInput } from '@/components/ui/MaskedInput';
import { useAuth } from '@/contexts/AuthContext';
import { UsuariosTab } from '@/components/usuarios/UsuariosTab';

const defaultConfig = {
  geral: {
    empresa: 'AviZee Equipamentos LTDA',
    nomeFantasia: 'AviZee',
    cnpj: '',
    inscricaoEstadual: '',
    inscricaoMunicipal: '',
    site: '',
    email: 'contato@avizee.com.br',
    telefone: '',
    whatsapp: '',
    responsavel: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    logoUrl: '/images/logoavizee.png',
    corPrimaria: '#690500',
    corSecundaria: '#b2592c',
  },
  usuarios: {
    permitirCadastro: false,
    exigir2fa: false,
    perfilPadrao: 'vendedor',
  },
  email: {
    remetenteNome: 'ERP AviZee',
    remetenteEmail: 'contato@avizee.com.br',
    responderPara: 'comercial@avizee.com.br',
    assinatura: 'Equipe AviZee',
  },
  fiscal: {
    cfopPadraoVenda: '5102',
    cfopPadraoCompra: '1102',
    cstPadrao: '000',
    ncmPadrao: '00000000',
    gerarFinanceiroPadrao: true,
  },
  financeiro: {
    condicaoPadrao: '30 dias',
    formaPagamentoPadrao: 'boleto',
    bancoPadrao: 'Inter',
    permitirBaixaParcial: true,
  },
};

interface SideNavItem {
  key: string;
  label: string;
  icon: typeof Building2;
}

const sideNavItems: SideNavItem[] = [
  { key: 'empresa', label: 'Empresa', icon: Building2 },
  { key: 'usuarios', label: 'Usuários e Permissões', icon: Users },
  { key: 'email', label: 'E-mails', icon: Mail },
  { key: 'fiscal', label: 'Parâmetros Fiscais', icon: Receipt },
  { key: 'financeiro', label: 'Parâmetros Financeiros', icon: Wallet },
  { key: 'migracao', label: 'Migração de Dados', icon: Database },
  { key: 'auditoria', label: 'Auditoria', icon: Shield },
];

export default function Administracao() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'empresa';
  const [config, setConfig] = useState(defaultConfig);
  const [activeSection, setActiveSection] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [empresaConfigId, setEmpresaConfigId] = useState<string | null>(null);
  const [empresaUpdatedAt, setEmpresaUpdatedAt] = useState<string | null>(null);
  const [empresaCreatedAt, setEmpresaCreatedAt] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [emailErrors, setEmailErrors] = useState<Record<string, string>>({});
  const [emailTestAddress, setEmailTestAddress] = useState('');
  const [emailTestLoading, setEmailTestLoading] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null);
  const [emailLastSaved, setEmailLastSaved] = useState<{ at: string | null; by: string | null }>({ at: null, by: null });
  const [emailLastTest, setEmailLastTest] = useState<string | null>(null);

  const [fiscalErrors, setFiscalErrors] = useState<Record<string, string>>({});
  const [fiscalLastSaved, setFiscalLastSaved] = useState<{ at: string | null; by: string | null }>({ at: null, by: null });

  const [financeiroLastSaved, setFinanceiroLastSaved] = useState<{ at: string | null; by: string | null }>({ at: null, by: null });

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== activeSection) setActiveSection(tab);
  }, [searchParams]);

  // ── Load config ──
  useEffect(() => {
    let mounted = true;
    const loadConfig = async () => {
      setLoading(true);
      try {
        const [{ data: empresaRows }, { data: appRows }] = await Promise.all([
          supabase.from('empresa_config').select('*').limit(1),
          supabase.from('app_configuracoes').select('chave, valor'),
        ]);
        const empresa = empresaRows?.[0];
        const appConfig = Object.fromEntries((appRows || []).map((row: { chave: string; valor: unknown }) => [row.chave, row.valor || {}]));
        const emailRaw = (appConfig.email as any) || {};
        const { _updatedAt: emailUpdatedAt, _updatedBy: emailUpdatedBy, ...emailData } = emailRaw;
        const fiscalRaw = (appConfig.fiscal as any) || {};
        const { _updatedAt: fiscalUpdatedAt, _updatedByName: fiscalUpdatedByName, ...fiscalData } = fiscalRaw;
        const financeiroRaw = (appConfig.financeiro as any) || {};
        const { _updatedAt: financeiroUpdatedAt, _updatedByName: financeiroUpdatedByName, ...financeiroData } = financeiroRaw;
        const merged = {
          ...defaultConfig,
          geral: {
            ...defaultConfig.geral,
            empresa: empresa?.razao_social || defaultConfig.geral.empresa,
            nomeFantasia: empresa?.nome_fantasia || defaultConfig.geral.nomeFantasia,
            cnpj: empresa?.cnpj || defaultConfig.geral.cnpj,
            inscricaoEstadual: empresa?.inscricao_estadual || defaultConfig.geral.inscricaoEstadual,
            inscricaoMunicipal: (empresa as any)?.inscricao_municipal || defaultConfig.geral.inscricaoMunicipal,
            site: (empresa as any)?.site || defaultConfig.geral.site,
            email: empresa?.email || defaultConfig.geral.email,
            telefone: empresa?.telefone || defaultConfig.geral.telefone,
            whatsapp: (empresa as any)?.whatsapp || defaultConfig.geral.whatsapp,
            responsavel: (empresa as any)?.responsavel || defaultConfig.geral.responsavel,
            cep: empresa?.cep || defaultConfig.geral.cep,
            logradouro: empresa?.logradouro || defaultConfig.geral.logradouro,
            numero: (empresa as any)?.numero || defaultConfig.geral.numero,
            complemento: (empresa as any)?.complemento || defaultConfig.geral.complemento,
            bairro: empresa?.bairro || defaultConfig.geral.bairro,
            cidade: empresa?.cidade || defaultConfig.geral.cidade,
            uf: empresa?.uf || defaultConfig.geral.uf,
            logoUrl: empresa?.logo_url || (appConfig.geral as any)?.logoUrl || defaultConfig.geral.logoUrl,
            corPrimaria: (appConfig.geral as any)?.corPrimaria || defaultConfig.geral.corPrimaria,
            corSecundaria: (appConfig.geral as any)?.corSecundaria || defaultConfig.geral.corSecundaria,
          },
          usuarios: { ...defaultConfig.usuarios, ...((appConfig.usuarios as any) || {}) },
          email: { ...defaultConfig.email, ...emailData },
          fiscal: { ...defaultConfig.fiscal, ...fiscalData },
          financeiro: { ...defaultConfig.financeiro, ...financeiroData },
        };
        if (mounted) {
          setEmpresaConfigId(empresa?.id || null);
          setEmpresaUpdatedAt(empresa?.updated_at || null);
          setEmpresaCreatedAt(empresa?.created_at || null);
          setConfig(merged);
          setEmailLastSaved({ at: emailUpdatedAt || null, by: emailUpdatedBy || null });
          setFiscalLastSaved({ at: fiscalUpdatedAt || null, by: fiscalUpdatedByName || null });
          setFinanceiroLastSaved({ at: financeiroUpdatedAt || null, by: financeiroUpdatedByName || null });
        }
      } catch {
        console.error('[admin] Erro ao carregar configurações do Supabase');
        if (mounted) setConfig(defaultConfig);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadConfig();
    return () => { mounted = false; };
  }, []);

  const updateSection = <T extends keyof typeof defaultConfig>(section: T, values: Partial<(typeof defaultConfig)[T]>) => {
    setConfig((current) => ({ ...current, [section]: { ...current[section], ...values } }));
  };

  const handleSectionChange = (key: string) => {
    if (key === 'migracao') {
      navigate('/migracao-dados');
      return;
    }
    setActiveSection(key);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('tab', key);
      return next;
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Formato de imagem não suportado. Use PNG, JPEG, SVG ou WebP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Arquivo muito grande. O tamanho máximo é 2 MB.');
      return;
    }
    setLogoUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'png';
      const path = `logos/logo-empresa.${ext}`;
      const { error: uploadError } = await supabase.storage.from('dbavizee').upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('dbavizee').getPublicUrl(path);
      updateSection('geral', { logoUrl: urlData.publicUrl });
      toast.success('Logo enviada com sucesso.');
    } catch (err) {
      console.error('[admin] Erro ao enviar logo:', err);
      toast.error('Erro ao enviar a logo. Verifique sua conexão e tente novamente.');
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const isValidEmailFormat = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validateEmailSection = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!config.email.remetenteNome.trim()) {
      errors.remetenteNome = 'Nome do remetente é obrigatório.';
    }
    if (!config.email.remetenteEmail.trim()) {
      errors.remetenteEmail = 'E-mail do remetente é obrigatório.';
    } else if (!isValidEmailFormat(config.email.remetenteEmail)) {
      errors.remetenteEmail = 'Informe um e-mail válido.';
    }
    if (config.email.responderPara && !isValidEmailFormat(config.email.responderPara)) {
      errors.responderPara = 'Informe um e-mail válido.';
    }
    if (config.email.assinatura.length > 1000) {
      errors.assinatura = 'A assinatura deve ter no máximo 1.000 caracteres.';
    }
    return errors;
  };

  const validateFiscalSection = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!/^\d{4}$/.test(config.fiscal.cfopPadraoVenda)) {
      errors.cfopPadraoVenda = 'CFOP deve ter exatamente 4 dígitos numéricos (ex.: 5102).';
    }
    if (!/^\d{4}$/.test(config.fiscal.cfopPadraoCompra)) {
      errors.cfopPadraoCompra = 'CFOP deve ter exatamente 4 dígitos numéricos (ex.: 1102).';
    }
    if (!/^\d{2,3}$/.test(config.fiscal.cstPadrao)) {
      errors.cstPadrao = 'CST deve ter 2 ou 3 dígitos numéricos (ex.: 00 para PIS/COFINS, 000 para ICMS).';
    }
    if (!/^\d{8}$/.test(config.fiscal.ncmPadrao)) {
      errors.ncmPadrao = 'NCM deve ter exatamente 8 dígitos numéricos (ex.: 00000000).';
    }
    return errors;
  };

  const handleEmailTest = async () => {
    if (!emailTestAddress.trim() || !isValidEmailFormat(emailTestAddress)) {
      setEmailErrors((p) => ({ ...p, emailTeste: 'Informe um e-mail válido para o teste.' }));
      return;
    }
    setEmailTestLoading(true);
    setEmailTestResult(null);
    try {
      const { error } = await supabase.functions.invoke('send-test-email', {
        body: {
          to: emailTestAddress,
          remetenteNome: config.email.remetenteNome,
          remetenteEmail: config.email.remetenteEmail,
          assinatura: config.email.assinatura,
        },
      });
      if (error) throw error;
      setEmailLastTest(new Date().toISOString());
      setEmailTestResult({
        status: 'success',
        message: `E-mail de teste enviado com sucesso para ${emailTestAddress}.`,
      });
    } catch (err) {
      console.error('[admin] Erro ao enviar e-mail de teste:', err);
      setEmailTestResult({
        status: 'error',
        message: 'Não foi possível enviar o e-mail de teste. Verifique se a configuração do serviço de envio está ativa.',
      });
    } finally {
      setEmailTestLoading(false);
    }
  };

  const handleSave = async () => {
    if (activeSection === 'email') {
      const errors = validateEmailSection();
      if (Object.keys(errors).length > 0) {
        setEmailErrors(errors);
        toast.error('Corrija os campos obrigatórios antes de salvar.');
        return;
      }
      setEmailErrors({});
    }
    if (activeSection === 'fiscal') {
      const errors = validateFiscalSection();
      if (Object.keys(errors).length > 0) {
        setFiscalErrors(errors);
        toast.error('Corrija os campos obrigatórios antes de salvar.');
        return;
      }
      setFiscalErrors({});
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const empresaPayload = {
        razao_social: config.geral.empresa,
        nome_fantasia: config.geral.nomeFantasia,
        cnpj: config.geral.cnpj || null,
        inscricao_estadual: config.geral.inscricaoEstadual || null,
        inscricao_municipal: config.geral.inscricaoMunicipal || null,
        site: config.geral.site || null,
        email: config.geral.email || null,
        telefone: config.geral.telefone || null,
        whatsapp: config.geral.whatsapp || null,
        responsavel: config.geral.responsavel || null,
        cep: config.geral.cep || null,
        logradouro: config.geral.logradouro || null,
        numero: config.geral.numero || null,
        complemento: config.geral.complemento || null,
        bairro: config.geral.bairro || null,
        cidade: config.geral.cidade || null,
        uf: config.geral.uf || null,
        logo_url: config.geral.logoUrl || null,
        updated_at: now,
        updated_by: user?.id ?? null,
      };
      if (empresaConfigId) {
        await supabase.from('empresa_config').update(empresaPayload as any).eq('id', empresaConfigId);
      } else {
        const { data: insertedEmpresa } = await supabase.from('empresa_config').insert(empresaPayload as any).select('id').single();
        if (insertedEmpresa?.id) setEmpresaConfigId(insertedEmpresa.id);
      }
      setEmpresaUpdatedAt(now);
      const appRows = [
        { chave: 'geral', valor: { logoUrl: config.geral.logoUrl, corPrimaria: config.geral.corPrimaria, corSecundaria: config.geral.corSecundaria } as any, descricao: 'Configurações gerais' },
        { chave: 'usuarios', valor: config.usuarios as any, descricao: 'Parâmetros de usuários' },
        { chave: 'email', valor: { ...config.email, _updatedAt: now, _updatedBy: user?.id ?? null } as any, descricao: 'Parâmetros de envio e remetente' },
        { chave: 'fiscal', valor: { ...config.fiscal, _updatedAt: now, _updatedBy: user?.id ?? null, _updatedByName: profile?.nome ?? user?.email ?? null } as any, descricao: 'Parâmetros fiscais' },
        { chave: 'financeiro', valor: { ...config.financeiro, _updatedAt: now, _updatedBy: user?.id ?? null, _updatedByName: profile?.nome ?? user?.email ?? null } as any, descricao: 'Parâmetros financeiros' },
      ];
      await supabase.from('app_configuracoes').upsert(appRows, { onConflict: 'chave' });
      setEmailLastSaved({ at: now, by: user?.id ?? null });
      setFiscalLastSaved({ at: now, by: profile?.nome ?? user?.email ?? null });
      setFinanceiroLastSaved({ at: now, by: profile?.nome ?? user?.email ?? null });
      toast.success('Configurações salvas com sucesso.');
    } catch (error: unknown) {
      console.error('[admin] Erro ao salvar:', error);
      toast.error('Erro ao salvar configurações. Verifique sua conexão e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <ModulePage title="Administração" subtitle="Carregando parâmetros do sistema...">
          <div className="flex items-center justify-center rounded-xl border border-dashed py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando...
          </div>
        </ModulePage>
      </AppLayout>
    );
  }

  const renderEmpresa = () => {
    const isValidHex = (hex: string) => /^#[0-9A-Fa-f]{6}$/.test(hex);

    const ColorField = ({ label, field, description }: { label: string; field: 'corPrimaria' | 'corSecundaria'; description: string }) => {
      const value = config.geral[field];
      const valid = isValidHex(value);
      return (
        <div className="space-y-1.5">
          <Label>{label}</Label>
          <div className="flex items-center gap-2">
            <div className="relative h-10 w-10 shrink-0 rounded-md border overflow-hidden cursor-pointer" style={{ backgroundColor: valid ? value : '#e5e7eb' }}>
              <input
                type="color"
                value={valid ? value : '#000000'}
                onChange={(e) => updateSection('geral', { [field]: e.target.value })}
                className="absolute inset-0 opacity-0 cursor-pointer h-full w-full"
                title={label}
              />
            </div>
            <Input
              value={value}
              onChange={(e) => updateSection('geral', { [field]: e.target.value })}
              className={cn('font-mono', !valid && value ? 'border-destructive focus-visible:ring-destructive' : '')}
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
      <div className="space-y-6">
        {/* Bloco 1 — Dados institucionais */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <CardTitle>Dados institucionais</CardTitle>
                <CardDescription>Informações legais e cadastrais da empresa. Utilizadas em documentos oficiais, notas fiscais e cabeçalho do sistema.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Razão social <span className="text-destructive">*</span></Label>
              <Input value={config.geral.empresa} onChange={(e) => updateSection('geral', { empresa: e.target.value })} placeholder="EMPRESA LTDA" />
              <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3" />Utilizada em documentos oficiais e notas fiscais.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Nome fantasia</Label>
              <Input value={config.geral.nomeFantasia} onChange={(e) => updateSection('geral', { nomeFantasia: e.target.value })} placeholder="Empresa" />
              <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3" />Exibição comercial no sistema e documentos.</p>
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ</Label>
              <MaskedInput mask="cnpj" value={config.geral.cnpj} onChange={(v) => updateSection('geral', { cnpj: v })} showValidation placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-1.5">
              <Label>Inscrição estadual</Label>
              <Input value={config.geral.inscricaoEstadual} onChange={(e) => updateSection('geral', { inscricaoEstadual: e.target.value })} placeholder="000.000.000.000" />
            </div>
            <div className="space-y-1.5">
              <Label>Inscrição municipal</Label>
              <Input value={config.geral.inscricaoMunicipal} onChange={(e) => updateSection('geral', { inscricaoMunicipal: e.target.value })} placeholder="000000000" />
            </div>
            <div className="space-y-1.5">
              <Label>Site</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={config.geral.site} onChange={(e) => updateSection('geral', { site: e.target.value })} className="pl-9" placeholder="https://www.empresa.com.br" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bloco 2 — Contato principal */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <CardTitle>Contato principal</CardTitle>
                <CardDescription>Canais de comunicação institucionais utilizados em e-mails, documentos e comunicações do sistema.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>E-mail institucional</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={config.geral.email} onChange={(e) => updateSection('geral', { email: e.target.value })} className="pl-9" placeholder="contato@empresa.com.br" type="email" />
              </div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3" />Exibido em documentos e comunicações oficiais.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <MaskedInput mask="telefone" value={config.geral.telefone} onChange={(v) => updateSection('geral', { telefone: v })} placeholder="(00) 0000-0000" />
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp / Celular</Label>
              <MaskedInput mask="celular" value={config.geral.whatsapp} onChange={(v) => updateSection('geral', { whatsapp: v })} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-1.5">
              <Label>Responsável principal</Label>
              <Input value={config.geral.responsavel} onChange={(e) => updateSection('geral', { responsavel: e.target.value })} placeholder="Nome do responsável" />
            </div>
          </CardContent>
        </Card>

        {/* Bloco 3 — Endereço */}
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
              <MaskedInput mask="cep" value={config.geral.cep} onChange={(v) => updateSection('geral', { cep: v })} placeholder="00000-000" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Logradouro</Label>
              <Input value={config.geral.logradouro} onChange={(e) => updateSection('geral', { logradouro: e.target.value })} placeholder="Rua, Avenida, etc." />
            </div>
            <div className="space-y-1.5">
              <Label>Número</Label>
              <Input value={config.geral.numero} onChange={(e) => updateSection('geral', { numero: e.target.value })} placeholder="000" />
            </div>
            <div className="space-y-1.5">
              <Label>Complemento</Label>
              <Input value={config.geral.complemento} onChange={(e) => updateSection('geral', { complemento: e.target.value })} placeholder="Sala, andar, etc." />
            </div>
            <div className="space-y-1.5">
              <Label>Bairro</Label>
              <Input value={config.geral.bairro} onChange={(e) => updateSection('geral', { bairro: e.target.value })} placeholder="Bairro" />
            </div>
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input value={config.geral.cidade} onChange={(e) => updateSection('geral', { cidade: e.target.value })} placeholder="Cidade" />
            </div>
            <div className="space-y-1.5">
              <Label>Estado (UF)</Label>
              <Select value={config.geral.uf} onValueChange={(v) => updateSection('geral', { uf: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'].map((uf) => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Bloco 4 — Identidade visual */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <Image className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <CardTitle>Identidade visual</CardTitle>
                <CardDescription>Logo e cores aplicadas no cabeçalho do sistema, PDFs e documentos comerciais.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Logo */}
            <div className="space-y-3">
              <Label>Logo da empresa</Label>
              {config.geral.logoUrl && (
                <div className="flex items-start gap-4">
                  <div className="flex h-20 w-40 items-center justify-center overflow-hidden rounded-md border bg-muted/30 p-2">
                    <img
                      src={config.geral.logoUrl}
                      alt="Logo da empresa"
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                  <p className="mt-2 truncate max-w-xs text-xs text-muted-foreground font-mono">{config.geral.logoUrl}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                >
                  {logoUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {config.geral.logoUrl ? 'Substituir logo' : 'Enviar logo'}
                </Button>
                {config.geral.logoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => updateSection('geral', { logoUrl: '' })}
                  >
                    Remover logo
                  </Button>
                )}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                className="hidden"
                onChange={handleLogoUpload}
              />
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />Formatos: PNG, JPEG, SVG, WebP. Tamanho máximo: 2 MB. Usada no cabeçalho e nos PDFs.
              </p>
            </div>

            <Separator />

            {/* Cores */}
            <div className="grid gap-6 md:grid-cols-2">
              <ColorField
                label="Cor primária"
                field="corPrimaria"
                description="Cor principal aplicada em botões, destaques e identidade do sistema."
              />
              <ColorField
                label="Cor secundária"
                field="corSecundaria"
                description="Cor complementar usada em gradientes e elementos visuais secundários."
              />
            </div>
          </CardContent>
        </Card>

        {/* Bloco 5 — Governança */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <CardTitle>Governança</CardTitle>
                <CardDescription>Rastreabilidade das alterações neste cadastro. Dados institucionais impactam cabeçalhos, documentos, PDFs e comunicações.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border bg-muted/30 p-3 space-y-0.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Última atualização</p>
                <p className="text-sm font-medium">
                  {empresaUpdatedAt
                    ? new Date(empresaUpdatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                    : '—'}
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 space-y-0.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Cadastro criado em</p>
                <p className="text-sm font-medium">
                  {empresaCreatedAt
                    ? new Date(empresaCreatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                    : '—'}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Alterações neste cadastro refletem imediatamente no cabeçalho do sistema, nos documentos comerciais, PDFs gerados e comunicações institucionais. Mantenha as informações sempre atualizadas.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderEmail = () => (
    <div className="space-y-6">
      {/* Bloco 1 — Identidade do remetente */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <User className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <CardTitle>Identidade do remetente</CardTitle>
              <CardDescription>Nome e endereço utilizados como origem dos e-mails comerciais e notificações automáticas do sistema.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Nome do remetente <span className="text-destructive">*</span></Label>
            <Input
              value={config.email.remetenteNome}
              onChange={(e) => { updateSection('email', { remetenteNome: e.target.value }); setEmailErrors((p) => ({ ...p, remetenteNome: '' })); }}
              placeholder="ERP AviZee"
              className={cn(emailErrors.remetenteNome ? 'border-destructive focus-visible:ring-destructive' : '')}
            />
            {emailErrors.remetenteNome
              ? <p className="text-[11px] text-destructive">{emailErrors.remetenteNome}</p>
              : <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3" />Nome exibido ao destinatário no campo "De:".</p>}
          </div>
          <div className="space-y-1.5">
            <Label>E-mail do remetente <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={config.email.remetenteEmail}
                onChange={(e) => { updateSection('email', { remetenteEmail: e.target.value }); setEmailErrors((p) => ({ ...p, remetenteEmail: '' })); }}
                placeholder="contato@empresa.com.br"
                className={cn('pl-9', emailErrors.remetenteEmail ? 'border-destructive focus-visible:ring-destructive' : '')}
              />
            </div>
            {emailErrors.remetenteEmail
              ? <p className="text-[11px] text-destructive">{emailErrors.remetenteEmail}</p>
              : <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3" />Endereço configurado no serviço de envio do sistema.</p>}
          </div>
        </CardContent>
      </Card>

      {/* Bloco 2 — Resposta e roteamento */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Reply className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <CardTitle>Resposta e roteamento</CardTitle>
              <CardDescription>Define para onde as respostas dos destinatários serão encaminhadas quando eles responderem a um e-mail do sistema.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Responder para</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={config.email.responderPara}
                onChange={(e) => { updateSection('email', { responderPara: e.target.value }); setEmailErrors((p) => ({ ...p, responderPara: '' })); }}
                placeholder="comercial@empresa.com.br"
                className={cn('pl-9', emailErrors.responderPara ? 'border-destructive focus-visible:ring-destructive' : '')}
              />
            </div>
            {emailErrors.responderPara
              ? <p className="text-[11px] text-destructive">{emailErrors.responderPara}</p>
              : <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3" />Opcional. Se não preenchido, as respostas chegam ao próprio remetente.</p>}
          </div>
        </CardContent>
      </Card>

      {/* Bloco 3 — Assinatura padrão */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <PenLine className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <CardTitle>Assinatura padrão</CardTitle>
              <CardDescription>Texto inserido ao final de e-mails comerciais, orçamentos, pedidos e notificações automáticas.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Assinatura</Label>
            <Textarea
              value={config.email.assinatura}
              onChange={(e) => { updateSection('email', { assinatura: e.target.value }); setEmailErrors((p) => ({ ...p, assinatura: '' })); }}
              rows={5}
              placeholder={'Equipe Comercial\ncontato@empresa.com.br\n(11) 99999-0000'}
              className={cn(emailErrors.assinatura ? 'border-destructive focus-visible:ring-destructive' : '')}
            />
            <div className="flex items-start justify-between gap-2">
              {emailErrors.assinatura
                ? <p className="text-[11px] text-destructive">{emailErrors.assinatura}</p>
                : <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3" />Aplicada em e-mails comerciais e notificações automáticas.</p>}
              <p className="text-[11px] text-muted-foreground shrink-0">{config.email.assinatura.length}/1000</p>
            </div>
          </div>
          {config.email.assinatura && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pré-visualização</p>
                <div className="rounded-md border bg-muted/30 px-4 py-3">
                  <pre className="text-sm text-foreground font-sans whitespace-pre-wrap break-words">{config.email.assinatura}</pre>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Bloco 4 — Teste de envio */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Send className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <CardTitle>Teste de envio</CardTitle>
              <CardDescription>Valide a configuração enviando uma mensagem de teste antes de usar em produção.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label>E-mail para teste</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={emailTestAddress}
                  onChange={(e) => { setEmailTestAddress(e.target.value); setEmailErrors((p) => ({ ...p, emailTeste: '' })); }}
                  placeholder="seu@email.com.br"
                  className={cn('pl-9', emailErrors.emailTeste ? 'border-destructive focus-visible:ring-destructive' : '')}
                />
              </div>
              {emailErrors.emailTeste && <p className="text-[11px] text-destructive">{emailErrors.emailTeste}</p>}
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={emailTestLoading}
              onClick={handleEmailTest}
              className="shrink-0"
            >
              {emailTestLoading
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Send className="mr-2 h-4 w-4" />}
              Enviar teste
            </Button>
          </div>
          {emailTestResult && (
            <div className={cn(
              'flex items-start gap-2 rounded-md border p-3 text-sm',
              emailTestResult.status === 'success'
                ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200'
                : 'border-destructive/30 bg-destructive/5 text-destructive',
            )}>
              {emailTestResult.status === 'success'
                ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
              <p>{emailTestResult.message}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bloco 5 — Governança e uso no sistema */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Calendar className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <CardTitle>Governança e uso no sistema</CardTitle>
              <CardDescription>Rastreabilidade desta configuração e visibilidade do seu alcance nos fluxos do ERP.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border bg-muted/30 p-3 space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Última atualização</p>
              <p className="text-sm font-medium">
                {emailLastSaved.at
                  ? new Date(emailLastSaved.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                  : '—'}
              </p>
            </div>
            <div className="rounded-md border bg-muted/30 p-3 space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Último teste realizado</p>
              <p className="text-sm font-medium">
                {emailLastTest
                  ? new Date(emailLastTest).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                  : '—'}
              </p>
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Esta configuração impacta</p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {[
                'Envio de orçamentos e pedidos',
                'Notificações automáticas do sistema',
                'E-mails de confirmação e cobrança',
                'Comunicações institucionais',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">
            Alterações nesta seção refletem imediatamente nos e-mails gerados pelo sistema. Valide a configuração com um teste de envio antes de aplicar em produção.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  const renderFiscal = () => (
    <div className="space-y-6">
      {/* Bloco 1 — Classificação fiscal padrão */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Receipt className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <CardTitle>Classificação fiscal padrão</CardTitle>
              <CardDescription>
                Valores base utilizados como ponto de partida em documentos de entrada e saída. Podem ser complementados por parametrizações específicas de produto ou operação.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>CFOP padrão para venda</Label>
            <Input
              value={config.fiscal.cfopPadraoVenda}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                updateSection('fiscal', { cfopPadraoVenda: v });
                setFiscalErrors((p) => ({ ...p, cfopPadraoVenda: '' }));
              }}
              placeholder="5102"
              maxLength={4}
              className={cn(fiscalErrors.cfopPadraoVenda ? 'border-destructive focus-visible:ring-destructive' : '')}
            />
            {fiscalErrors.cfopPadraoVenda
              ? <p className="text-[11px] text-destructive">{fiscalErrors.cfopPadraoVenda}</p>
              : <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3" />Sugerido em documentos de saída. Ex.: 5102 (venda de mercadoria adquirida).</p>}
          </div>
          <div className="space-y-1.5">
            <Label>CFOP padrão para compra</Label>
            <Input
              value={config.fiscal.cfopPadraoCompra}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                updateSection('fiscal', { cfopPadraoCompra: v });
                setFiscalErrors((p) => ({ ...p, cfopPadraoCompra: '' }));
              }}
              placeholder="1102"
              maxLength={4}
              className={cn(fiscalErrors.cfopPadraoCompra ? 'border-destructive focus-visible:ring-destructive' : '')}
            />
            {fiscalErrors.cfopPadraoCompra
              ? <p className="text-[11px] text-destructive">{fiscalErrors.cfopPadraoCompra}</p>
              : <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3" />Sugerido em documentos de entrada. Ex.: 1102 (compra de mercadoria para comercialização).</p>}
          </div>
          <div className="space-y-1.5">
            <Label>CST padrão inicial</Label>
            <Input
              value={config.fiscal.cstPadrao}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 3);
                updateSection('fiscal', { cstPadrao: v });
                setFiscalErrors((p) => ({ ...p, cstPadrao: '' }));
              }}
              placeholder="000"
              maxLength={3}
              className={cn(fiscalErrors.cstPadrao ? 'border-destructive focus-visible:ring-destructive' : '')}
            />
            {fiscalErrors.cstPadrao
              ? <p className="text-[11px] text-destructive">{fiscalErrors.cstPadrao}</p>
              : <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3" />Classificação fiscal inicial padrão do sistema. Ex.: 000 (tributada integralmente).</p>}
          </div>
          <div className="space-y-1.5">
            <Label>NCM padrão inicial</Label>
            <Input
              value={config.fiscal.ncmPadrao}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 8);
                updateSection('fiscal', { ncmPadrao: v });
                setFiscalErrors((p) => ({ ...p, ncmPadrao: '' }));
              }}
              placeholder="00000000"
              maxLength={8}
              className={cn(fiscalErrors.ncmPadrao ? 'border-destructive focus-visible:ring-destructive' : '')}
            />
            {fiscalErrors.ncmPadrao
              ? <p className="text-[11px] text-destructive">{fiscalErrors.ncmPadrao}</p>
              : <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3" />Classificação padrão quando não houver NCM específico no cadastro do produto. 8 dígitos.</p>}
          </div>
        </CardContent>
      </Card>

      {/* Bloco 2 — Comportamento fiscal do sistema */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <CardTitle>Comportamento fiscal do sistema</CardTitle>
              <CardDescription>
                Define como o ERP age automaticamente ao processar documentos fiscais. Diferente das classificações acima, esta opção controla o fluxo interno do sistema.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between rounded-lg border p-4 gap-4">
            <div className="space-y-1">
              <p className="font-medium text-sm">Gerar financeiro automaticamente por padrão</p>
              <p className="text-sm text-muted-foreground">
                Quando ativo, documentos fiscais confirmados geram lançamento financeiro automaticamente por padrão, salvo configuração específica no documento.
              </p>
            </div>
            <Switch
              checked={config.fiscal.gerarFinanceiroPadrao}
              onCheckedChange={(checked) => updateSection('fiscal', { gerarFinanceiroPadrao: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Bloco 3 — Contexto de aplicação */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Globe className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <CardTitle>Contexto de aplicação</CardTitle>
              <CardDescription>
                Padrões fiscais globais usados como base em documentos de entrada, saída e integrações com financeiro.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Esta configuração impacta</p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {[
                'Documentos de venda e saída fiscal',
                'Documentos de compra e entrada fiscal',
                'Lançamentos gerados a partir de notas fiscais',
                'Integração automática com financeiro',
                'Comportamento padrão em novos cadastros',
                'Classificação inicial de produtos sem NCM',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <Separator />
          <p className="text-xs text-muted-foreground">
            Esses valores servem como configuração inicial e podem futuramente ser complementados por parametrizações específicas por produto, tipo de documento ou operação.
          </p>
        </CardContent>
      </Card>

      {/* Bloco 4 — Governança e uso no sistema */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Calendar className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <CardTitle>Governança e uso no sistema</CardTitle>
              <CardDescription>Rastreabilidade desta configuração e visibilidade do seu alcance nos fluxos do ERP.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border bg-muted/30 p-3 space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Última atualização</p>
              <p className="text-sm font-medium">
                {fiscalLastSaved.at
                  ? new Date(fiscalLastSaved.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                  : '—'}
              </p>
            </div>
            <div className="rounded-md border bg-muted/30 p-3 space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Alterado por</p>
              <p className="text-sm font-medium">{fiscalLastSaved.by ?? '—'}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Alterações nesta seção impactam o comportamento padrão de documentos futuros, parametrizações do sistema e a integração com o módulo financeiro. Revise com atenção antes de salvar.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  const renderFinanceiro = () => (
    <div className="space-y-6">
      {/* Bloco 1 — Padrões de títulos */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Wallet className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <CardTitle>Padrões de títulos</CardTitle>
              <CardDescription>
                Valores base utilizados como ponto de partida na geração de títulos, lançamentos e baixas financeiras. Podem ser complementados por parametrizações específicas por documento ou operação.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Condição de pagamento padrão</Label>
            <Input
              value={config.financeiro.condicaoPadrao}
              onChange={(e) => updateSection('financeiro', { condicaoPadrao: e.target.value })}
              placeholder="Ex.: 30 dias"
            />
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />Sugerida como condição inicial na geração de títulos a pagar e a receber.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Forma de pagamento padrão</Label>
            <Input
              value={config.financeiro.formaPagamentoPadrao}
              onChange={(e) => updateSection('financeiro', { formaPagamentoPadrao: e.target.value })}
              placeholder="Ex.: Boleto"
            />
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />Aplicada como preenchimento inicial em lançamentos e baixas financeiras.
            </p>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Banco / conta padrão</Label>
            <Input
              value={config.financeiro.bancoPadrao}
              onChange={(e) => updateSection('financeiro', { bancoPadrao: e.target.value })}
              placeholder="Ex.: Inter — Conta Corrente"
            />
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />Conta financeira sugerida para operações de pagamento e recebimento. Futuramente selecionável a partir do cadastro de contas bancárias.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Bloco 2 — Regras operacionais financeiras */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <CardTitle>Regras operacionais financeiras</CardTitle>
              <CardDescription>
                Define como o ERP se comporta em operações financeiras. Diferente dos padrões acima, estas opções controlam fluxos e permissões globais do sistema.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between rounded-lg border p-4 gap-4">
            <div className="space-y-1">
              <p className="font-medium text-sm">Permitir baixa parcial por padrão</p>
              <p className="text-sm text-muted-foreground">
                Quando ativo, o sistema permite registrar baixas parciais em contas a pagar e a receber por padrão. A regra é global e se aplica a todos os usuários do sistema.
              </p>
            </div>
            <Switch
              checked={config.financeiro.permitirBaixaParcial}
              onCheckedChange={(checked) => updateSection('financeiro', { permitirBaixaParcial: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Bloco 3 — Contexto de aplicação */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Globe className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <CardTitle>Contexto de aplicação</CardTitle>
              <CardDescription>
                Padrões financeiros globais usados como base em títulos, baixas e lançamentos gerados pelo sistema.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Esta configuração impacta</p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {[
                'Geração de títulos a pagar e a receber',
                'Baixas financeiras manuais e automáticas',
                'Lançamentos financeiros de contas a pagar',
                'Lançamentos financeiros de contas a receber',
                'Integrações oriundas de compras e vendas',
                'Documentos com geração financeira automática',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <Separator />
          <p className="text-xs text-muted-foreground">
            Esses valores servem como configuração inicial e podem futuramente ser complementados por parametrizações específicas por tipo de operação, empresa ou filial.
          </p>
        </CardContent>
      </Card>

      {/* Bloco 4 — Governança e uso no sistema */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Calendar className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <CardTitle>Governança e uso no sistema</CardTitle>
              <CardDescription>Rastreabilidade desta configuração e visibilidade do seu alcance nos fluxos financeiros do ERP.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border bg-muted/30 p-3 space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Última atualização</p>
              <p className="text-sm font-medium">
                {financeiroLastSaved.at
                  ? new Date(financeiroLastSaved.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                  : '—'}
              </p>
            </div>
            <div className="rounded-md border bg-muted/30 p-3 space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Alterado por</p>
              <p className="text-sm font-medium">{financeiroLastSaved.by ?? '—'}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Alterações nesta seção impactam o comportamento padrão de títulos futuros, baixas financeiras e integrações com os módulos de compras, vendas e fiscal. Revise com atenção antes de salvar.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'empresa':
        return renderEmpresa();

      case 'usuarios':
        return <UsuariosTab />;

      case 'email':
        return renderEmail();

      case 'fiscal':
        return renderFiscal();

      case 'financeiro':
        return renderFinanceiro();

      case 'auditoria':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Auditoria</CardTitle>
              <CardDescription>Rastreabilidade de alterações administrativas e operacionais.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Acesse o módulo completo de auditoria para visualizar logs de alterações.
              </p>
              <Button variant="outline" onClick={() => window.location.href = '/auditoria'}>
                <Shield className="mr-2 h-4 w-4" /> Abrir Auditoria Completa
              </Button>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  const showSaveButton = activeSection !== 'auditoria' && activeSection !== 'usuarios' && activeSection !== 'migracao';

  return (
    <AppLayout>
      <ModulePage title="Administração" subtitle="Governança, parâmetros globais e gestão do sistema.">
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <nav className="space-y-1">
            {sideNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => handleSectionChange(item.key)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="space-y-4">
            {renderContent()}
            {showSaveButton && (
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar alterações
                </Button>
              </div>
            )}
          </div>
        </div>
      </ModulePage>
    </AppLayout>
  );
}
