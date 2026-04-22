import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowUpRight, Bell, Building2, Calendar, CheckCircle2, ChevronDown, ChevronRight, Database, Globe, HardDrive, Image, Info, Loader2, Mail, MapPin, PenLine, Phone, Plug, Receipt, Reply, Shield, Upload, Users, Wallet, Webhook } from 'lucide-react';
import { ModulePage } from '@/components/ModulePage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Database as SupabaseDatabase } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { getUserFriendlyError } from '@/utils/errorMessages';
import { MaskedInput } from '@/components/ui/MaskedInput';
import { useAuth } from '@/contexts/AuthContext';
import { UsuariosTab } from '@/components/usuarios/UsuariosTab';
import { DashboardAdmin } from '@/pages/admin/components/DashboardAdmin';
import { PermissaoMatrix } from '@/pages/admin/components/PermissaoMatrix';

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
    simboloUrl: '',
    marcaTexto: '',
    marcaSubtitulo: 'ERP',
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
  integracoes: {
    gatewayUrl: '',
    gatewayApiKey: '',
    sefazAmbiente: 'homologacao',
    sefazCertificadoBase64: '',
    webhookUrl: '',
    webhookSecret: '',
  },
  notificacoes: {
    resumoDiario: true,
    alertasOperacionais: true,
    avisosSeguranca: true,
    canalPadrao: 'email',
  },
  backup: {
    frequencia: 'diario',
    retencaoDias: '30',
    destino: 'storage-interno',
    ultimaExecucao: '',
    ultimoStatus: 'nao-executado',
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
  behavior?: 'internal' | 'external';
}

interface SideNavGroup {
  key: string;
  label: string;
  items: SideNavItem[];
}

// Typed shapes for JSONB config values stored in app_configuracoes
interface GeralConfigRaw {
  inscricaoMunicipal?: string;
  site?: string;
  whatsapp?: string;
  responsavel?: string;
  logoUrl?: string;
  simboloUrl?: string;
  marcaTexto?: string;
  marcaSubtitulo?: string;
  corPrimaria?: string;
  corSecundaria?: string;
  [key: string]: unknown;
}

interface EmailConfigRaw {
  _updatedAt?: string;
  _updatedBy?: string;
  [key: string]: unknown;
}

interface FiscalConfigRaw {
  _updatedAt?: string;
  _updatedByName?: string;
  [key: string]: unknown;
}

interface FinanceiroConfigRaw {
  _updatedAt?: string;
  _updatedByName?: string;
  [key: string]: unknown;
}

interface IntegracoesConfigRaw {
  _updatedAt?: string;
  _updatedByName?: string;
  [key: string]: unknown;
}

interface NotificacoesConfigRaw {
  _updatedAt?: string;
  _updatedByName?: string;
  [key: string]: unknown;
}

interface BackupConfigRaw {
  _updatedAt?: string;
  _updatedByName?: string;
  [key: string]: unknown;
}

interface UsuariosConfigRaw {
  permitirCadastro?: boolean;
  exigir2fa?: boolean;
  perfilPadrao?: string;
  [key: string]: unknown;
}

/** Set of section keys that render actual content here — used to guard invalid ?tab= values */
const VALID_SECTION_KEYS = new Set([
  // `auditoria` e `migracao` NÃO entram aqui: são atalhos externos tratados em
  // `handleSectionChange` via `navigate(...)`. Se alguém colar `?tab=auditoria`
  // direto, cai no fallback `empresa` em vez de disparar `navigate` em render.
  'empresa', 'dashboard', 'usuarios', 'email', 'integracoes', 'notificacoes', 'backup', 'fiscal', 'financeiro',
]);

const sideNavGroups: SideNavGroup[] = [
  {
    key: 'empresa',
    label: 'Empresa',
    items: [
      { key: 'empresa', label: 'Dados da Empresa', icon: Building2 },
    ],
  },
  {
    key: 'acesso',
    label: 'Acesso & Segurança',
    items: [
      { key: 'dashboard', label: 'Dashboard de Segurança', icon: Shield },
      { key: 'usuarios', label: 'Usuários e Permissões', icon: Users },
    ],
  },
  {
    key: 'configuracoes',
    label: 'Configurações',
    items: [
      { key: 'email', label: 'E-mails', icon: Mail },
      { key: 'integracoes', label: 'Integrações', icon: Plug },
      { key: 'notificacoes', label: 'Notificações globais', icon: Bell },
      { key: 'backup', label: 'Backup', icon: HardDrive },
      { key: 'fiscal', label: 'Parâmetros Fiscais', icon: Receipt },
      { key: 'financeiro', label: 'Parâmetros Financeiros', icon: Wallet },
    ],
  },
  {
    key: 'dados',
    label: 'Dados & Auditoria',
    items: [
      { key: 'migracao', label: 'Migração de Dados', icon: Database },
      { key: 'auditoria', label: 'Auditoria', icon: Shield, behavior: 'external' },
    ],
  },
];

export default function Administracao() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Fallback to 'empresa' for any unknown/invalid ?tab= value
  const rawTab = searchParams.get('tab') || 'empresa';
  const initialTab = VALID_SECTION_KEYS.has(rawTab) ? rawTab : 'empresa';
  const [config, setConfig] = useState(defaultConfig);
  const [activeSection, setActiveSection] = useState(initialTab);

  // Grouped accordion nav – track which group is open
  const getActiveGroupKey = (section: string) =>
    sideNavGroups.find((g) => g.items.some((i) => i.key === section))?.key ?? 'empresa';

  const [openGroupKey, setOpenGroupKey] = useState<string>(() => getActiveGroupKey(initialTab));

  const toggleGroup = (key: string) => setOpenGroupKey((prev) => (prev === key ? '' : key));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSefazCertificado, setShowSefazCertificado] = useState(false);
  const [empresaConfigId, setEmpresaConfigId] = useState<string | null>(null);
  const [empresaUpdatedAt, setEmpresaUpdatedAt] = useState<string | null>(null);
  const [empresaCreatedAt, setEmpresaCreatedAt] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [simboloUploading, setSimboloUploading] = useState(false);
  const simboloInputRef = useRef<HTMLInputElement>(null);

  const [emailErrors, setEmailErrors] = useState<Record<string, string>>({});
  const [emailLastSaved, setEmailLastSaved] = useState<{ at: string | null; by: string | null }>({ at: null, by: null });
  const [integracoesLastSaved, setIntegracoesLastSaved] = useState<{ at: string | null; by: string | null }>({ at: null, by: null });
  const [notificacoesLastSaved, setNotificacoesLastSaved] = useState<{ at: string | null; by: string | null }>({ at: null, by: null });
  const [backupLastSaved, setBackupLastSaved] = useState<{ at: string | null; by: string | null }>({ at: null, by: null });

  const [fiscalErrors, setFiscalErrors] = useState<Record<string, string>>({});
  const [fiscalLastSaved, setFiscalLastSaved] = useState<{ at: string | null; by: string | null }>({ at: null, by: null });

  const [financeiroLastSaved, setFinanceiroLastSaved] = useState<{ at: string | null; by: string | null }>({ at: null, by: null });

  type AppConfigInsert = SupabaseDatabase['public']['Tables']['app_configuracoes']['Insert'];

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== activeSection) {
      const validated = VALID_SECTION_KEYS.has(tab) ? tab : 'empresa';
      setActiveSection(validated);
    }
  }, [searchParams, activeSection]);

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
        const geralRaw: GeralConfigRaw = (appConfig.geral as GeralConfigRaw) || {};
        const emailRaw: EmailConfigRaw = (appConfig.email as EmailConfigRaw) || {};
        const { _updatedAt: emailUpdatedAt, _updatedBy: emailUpdatedBy, ...emailData } = emailRaw;
        const fiscalRaw: FiscalConfigRaw = (appConfig.fiscal as FiscalConfigRaw) || {};
        const { _updatedAt: fiscalUpdatedAt, _updatedByName: fiscalUpdatedByName, ...fiscalData } = fiscalRaw;
        const financeiroRaw: FinanceiroConfigRaw = (appConfig.financeiro as FinanceiroConfigRaw) || {};
        const { _updatedAt: financeiroUpdatedAt, _updatedByName: financeiroUpdatedByName, ...financeiroData } = financeiroRaw;
        const integracoesRaw: IntegracoesConfigRaw = (appConfig.integracoes as IntegracoesConfigRaw) || {};
        const { _updatedAt: integracoesUpdatedAt, _updatedByName: integracoesUpdatedByName, ...integracoesData } = integracoesRaw;
        const notificacoesRaw: NotificacoesConfigRaw = (appConfig.notificacoes as NotificacoesConfigRaw) || {};
        const { _updatedAt: notificacoesUpdatedAt, _updatedByName: notificacoesUpdatedByName, ...notificacoesData } = notificacoesRaw;
        const backupRaw: BackupConfigRaw = (appConfig.backup as BackupConfigRaw) || {};
        const { _updatedAt: backupUpdatedAt, _updatedByName: backupUpdatedByName, ...backupData } = backupRaw;
        const merged = {
          ...defaultConfig,
          geral: {
            ...defaultConfig.geral,
            empresa: empresa?.razao_social || defaultConfig.geral.empresa,
            nomeFantasia: empresa?.nome_fantasia || defaultConfig.geral.nomeFantasia,
            cnpj: empresa?.cnpj || defaultConfig.geral.cnpj,
            inscricaoEstadual: empresa?.inscricao_estadual || defaultConfig.geral.inscricaoEstadual,
            inscricaoMunicipal: geralRaw.inscricaoMunicipal || defaultConfig.geral.inscricaoMunicipal,
            site: geralRaw.site || defaultConfig.geral.site,
            email: empresa?.email || defaultConfig.geral.email,
            telefone: empresa?.telefone || defaultConfig.geral.telefone,
            whatsapp: geralRaw.whatsapp || defaultConfig.geral.whatsapp,
            responsavel: geralRaw.responsavel || defaultConfig.geral.responsavel,
            cep: empresa?.cep || defaultConfig.geral.cep,
            logradouro: empresa?.logradouro || defaultConfig.geral.logradouro,
            numero: empresa?.numero || defaultConfig.geral.numero,
            complemento: empresa?.complemento || defaultConfig.geral.complemento,
            bairro: empresa?.bairro || defaultConfig.geral.bairro,
            cidade: empresa?.cidade || defaultConfig.geral.cidade,
            uf: empresa?.uf || defaultConfig.geral.uf,
            logoUrl: empresa?.logo_url || geralRaw.logoUrl || defaultConfig.geral.logoUrl,
            simboloUrl: (empresa as { simbolo_url?: string | null } | undefined)?.simbolo_url || geralRaw.simboloUrl || defaultConfig.geral.simboloUrl,
            marcaTexto: (empresa as { marca_texto?: string | null } | undefined)?.marca_texto || geralRaw.marcaTexto || defaultConfig.geral.marcaTexto,
            marcaSubtitulo: (empresa as { marca_subtitulo?: string | null } | undefined)?.marca_subtitulo || geralRaw.marcaSubtitulo || defaultConfig.geral.marcaSubtitulo,
            corPrimaria: empresa?.cor_primaria || geralRaw.corPrimaria || defaultConfig.geral.corPrimaria,
            corSecundaria: empresa?.cor_secundaria || geralRaw.corSecundaria || defaultConfig.geral.corSecundaria,
          },
          usuarios: { ...defaultConfig.usuarios, ...((appConfig.usuarios as UsuariosConfigRaw) || {}) },
          email: { ...defaultConfig.email, ...emailData },
          integracoes: { ...defaultConfig.integracoes, ...integracoesData },
          notificacoes: { ...defaultConfig.notificacoes, ...notificacoesData },
          backup: { ...defaultConfig.backup, ...backupData },
          fiscal: { ...defaultConfig.fiscal, ...fiscalData },
          financeiro: { ...defaultConfig.financeiro, ...financeiroData },
        };
        if (mounted) {
          setEmpresaConfigId(empresa?.id || null);
          setEmpresaUpdatedAt(empresa?.updated_at || null);
          setEmpresaCreatedAt(empresa?.created_at || null);
          setConfig(merged);
          setEmailLastSaved({ at: emailUpdatedAt || null, by: emailUpdatedBy || null });
          setIntegracoesLastSaved({ at: integracoesUpdatedAt || null, by: integracoesUpdatedByName || null });
          setNotificacoesLastSaved({ at: notificacoesUpdatedAt || null, by: notificacoesUpdatedByName || null });
          setBackupLastSaved({ at: backupUpdatedAt || null, by: backupUpdatedByName || null });
          setFiscalLastSaved({ at: fiscalUpdatedAt || null, by: fiscalUpdatedByName || null });
          setFinanceiroLastSaved({ at: financeiroUpdatedAt || null, by: financeiroUpdatedByName || null });
        }
      } catch (err) {
        console.error('[admin] Erro ao carregar configurações do Supabase:', err);
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
    if (key === 'auditoria') {
      navigate('/auditoria');
      return;
    }
    setActiveSection(key);
    setOpenGroupKey(getActiveGroupKey(key));
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('tab', key);
      return next;
    });
  };

  const getSectionMeta = (section: string) => {
    switch (section) {
      case 'empresa':
        return { title: 'Dados institucionais', description: 'Cadastro institucional, marca e endereço legal da empresa.' };
      case 'dashboard':
        return { title: 'Segurança e acesso', description: 'Leitura operacional de sessões e governança administrativa.' };
      case 'usuarios':
        return { title: 'Usuários e permissões', description: 'Gestão de papéis, permissões complementares e revogações individuais.' };
      case 'email':
        return { title: 'Parâmetros de comunicação', description: 'Identidade do remetente e assinatura institucional de e-mails.' };
      case 'integracoes':
        return { title: 'Integrações globais', description: 'Conexões sistêmicas (gateway, SEFAZ e webhooks) válidas para toda a operação.' };
      case 'notificacoes':
        return { title: 'Notificações globais', description: 'Políticas administrativas de comunicação automática do sistema.' };
      case 'backup':
        return { title: 'Backup e retenção', description: 'Políticas globais de proteção de dados, agendamento e histórico operacional.' };
      case 'fiscal':
        return { title: 'Parâmetros fiscais', description: 'Padrões fiscais globais usados como base no sistema.' };
      case 'financeiro':
        return { title: 'Parâmetros financeiros', description: 'Regras e defaults financeiros globais da operação.' };
      default:
        return { title: 'Administração', description: 'Governança, segurança e configurações globais do sistema.' };
    }
  };

  const getSaveMeta = () => {
    if (activeSection === 'empresa') {
      return { cta: 'Salvar dados institucionais', lastSaved: empresaUpdatedAt, message: 'Dados institucionais e branding atualizados.' };
    }
    if (activeSection === 'email') {
      return { cta: 'Salvar parâmetros de e-mail', lastSaved: emailLastSaved.at, message: 'Parâmetros de e-mail atualizados.' };
    }
    if (activeSection === 'integracoes') {
      return { cta: 'Salvar integrações globais', lastSaved: integracoesLastSaved.at, message: 'Parâmetros globais de integração atualizados.' };
    }
    if (activeSection === 'notificacoes') {
      return { cta: 'Salvar notificações globais', lastSaved: notificacoesLastSaved.at, message: 'Política global de notificações atualizada.' };
    }
    if (activeSection === 'backup') {
      return { cta: 'Salvar política de backup', lastSaved: backupLastSaved.at, message: 'Política global de backup atualizada.' };
    }
    if (activeSection === 'fiscal') {
      return { cta: 'Salvar parâmetros fiscais', lastSaved: fiscalLastSaved.at, message: 'Parâmetros fiscais atualizados.' };
    }
    return { cta: 'Salvar parâmetros financeiros', lastSaved: financeiroLastSaved.at, message: 'Parâmetros financeiros atualizados.' };
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
      toast.error(getUserFriendlyError(err));
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleSimboloUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Formato de imagem não suportado. Use PNG, JPEG, SVG ou WebP.');
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      toast.error('Arquivo muito grande. O tamanho máximo do símbolo é 1 MB.');
      return;
    }
    setSimboloUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'png';
      const path = `logos/simbolo-empresa.${ext}`;
      const { error: uploadError } = await supabase.storage.from('dbavizee').upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('dbavizee').getPublicUrl(path);
      updateSection('geral', { simboloUrl: urlData.publicUrl });
      toast.success('Símbolo enviado com sucesso.');
    } catch (err) {
      console.error('[admin] Erro ao enviar símbolo:', err);
      toast.error(getUserFriendlyError(err));
    } finally {
      setSimboloUploading(false);
      if (simboloInputRef.current) simboloInputRef.current.value = '';
    }
  };

  const isValidEmailFormat = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidBase64 = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return true;
    if (/\s/.test(trimmed)) return false;
    if (!/^[A-Za-z0-9+/=]+$/.test(trimmed)) return false;
    return trimmed.length % 4 === 0;
  };

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

  const handleSave = async () => {
    if (activeSection === 'integracoes' && !isValidBase64(config.integracoes.sefazCertificadoBase64)) {
      toast.error('Corrija o certificado SEFAZ: o conteúdo deve estar em Base64 válido.');
      return;
    }
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
      // Use friendly name for governance metadata (never raw UUID)
      const updatedByName = profile?.nome ?? user?.email ?? null;

      if (activeSection === 'empresa') {
        // Branding (logo + cores) e identidade institucional vivem em empresa_config.
        // Cores primária/secundária ganharam colunas dedicadas (cor_primaria/cor_secundaria).
        const empresaPayload = {
          razao_social: config.geral.empresa,
          nome_fantasia: config.geral.nomeFantasia,
          cnpj: config.geral.cnpj || null,
          inscricao_estadual: config.geral.inscricaoEstadual || null,
          email: config.geral.email || null,
          telefone: config.geral.telefone || null,
          cep: config.geral.cep || null,
          logradouro: config.geral.logradouro || null,
          numero: config.geral.numero || null,
          complemento: config.geral.complemento || null,
          bairro: config.geral.bairro || null,
          cidade: config.geral.cidade || null,
          uf: config.geral.uf || null,
          logo_url: config.geral.logoUrl || null,
          simbolo_url: config.geral.simboloUrl || null,
          marca_texto: config.geral.marcaTexto || null,
          marca_subtitulo: config.geral.marcaSubtitulo || null,
          cor_primaria: config.geral.corPrimaria || null,
          cor_secundaria: config.geral.corSecundaria || null,
          updated_at: now,
        };
        if (empresaConfigId) {
          const { error: empError } = await supabase.from('empresa_config').update(empresaPayload).eq('id', empresaConfigId);
          if (empError) throw empError;
        } else {
          const { data: insertedEmpresa, error: empError } = await supabase.from('empresa_config').insert(empresaPayload).select('id').single();
          if (empError) throw empError;
          if (insertedEmpresa?.id) setEmpresaConfigId(insertedEmpresa.id);
        }
        // app_configuracoes['geral'] mantém apenas campos auxiliares que ainda não
        // têm coluna dedicada em empresa_config (site, whatsapp, responsável, IM).
        const geralRow: AppConfigInsert = {
          chave: 'geral',
          valor: {
            site: config.geral.site,
            whatsapp: config.geral.whatsapp,
            responsavel: config.geral.responsavel,
            inscricaoMunicipal: config.geral.inscricaoMunicipal,
          },
          categoria: 'geral',
          sensibilidade: 'interno',
        };
        const { error: appError } = await supabase.from('app_configuracoes').upsert([geralRow], { onConflict: 'chave' });
        if (appError) throw appError;
        setEmpresaUpdatedAt(now);

      } else if (activeSection === 'email') {
        const emailRow: AppConfigInsert = {
          chave: 'email',
          valor: { ...config.email, _updatedAt: now, _updatedBy: updatedByName },
        };
        const { error } = await supabase.from('app_configuracoes').upsert([emailRow], { onConflict: 'chave' });
        if (error) throw error;
        setEmailLastSaved({ at: now, by: updatedByName });

      } else if (activeSection === 'integracoes') {
        const row: AppConfigInsert = {
          chave: 'integracoes',
          valor: { ...config.integracoes, _updatedAt: now, _updatedByName: updatedByName },
          categoria: 'integracoes',
          sensibilidade: 'sensivel',
        };
        const { error } = await supabase.from('app_configuracoes').upsert([row], { onConflict: 'chave' });
        if (error) throw error;
        setIntegracoesLastSaved({ at: now, by: updatedByName });

      } else if (activeSection === 'notificacoes') {
        const row: AppConfigInsert = {
          chave: 'notificacoes',
          valor: { ...config.notificacoes, _updatedAt: now, _updatedByName: updatedByName },
          categoria: 'comunicacao',
          sensibilidade: 'interno',
        };
        const { error } = await supabase.from('app_configuracoes').upsert([row], { onConflict: 'chave' });
        if (error) throw error;
        setNotificacoesLastSaved({ at: now, by: updatedByName });

      } else if (activeSection === 'backup') {
        const row: AppConfigInsert = {
          chave: 'backup',
          valor: { ...config.backup, _updatedAt: now, _updatedByName: updatedByName },
          categoria: 'infraestrutura',
          sensibilidade: 'sensivel',
        };
        const { error } = await supabase.from('app_configuracoes').upsert([row], { onConflict: 'chave' });
        if (error) throw error;
        setBackupLastSaved({ at: now, by: updatedByName });

      } else if (activeSection === 'fiscal') {
        const fiscalRow: AppConfigInsert = {
          chave: 'fiscal',
          valor: { ...config.fiscal, _updatedAt: now, _updatedByName: updatedByName },
        };
        const { error } = await supabase.from('app_configuracoes').upsert([fiscalRow], { onConflict: 'chave' });
        if (error) throw error;
        setFiscalLastSaved({ at: now, by: updatedByName });

      } else if (activeSection === 'financeiro') {
        const financeiroRow: AppConfigInsert = {
          chave: 'financeiro',
          valor: { ...config.financeiro, _updatedAt: now, _updatedByName: updatedByName },
        };
        const { error } = await supabase.from('app_configuracoes').upsert([financeiroRow], { onConflict: 'chave' });
        if (error) throw error;
        setFinanceiroLastSaved({ at: now, by: updatedByName });
      }

      toast.success(getSaveMeta().message);
    } catch (error: unknown) {
      console.error('[admin] Erro ao salvar:', error);
      toast.error(getUserFriendlyError(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <><ModulePage title="Administração" subtitle="Carregando parâmetros do sistema...">
          <div className="flex items-center justify-center rounded-xl border border-dashed py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando...
          </div>
        </ModulePage>
      </>
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
                  aria-label={config.geral.logoUrl ? 'Substituir logo da empresa' : 'Enviar logo da empresa'}
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
                    aria-label="Remover logo da empresa"
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

            {/* Símbolo (ícone reduzido) */}
            <div className="space-y-3">
              <Label>Símbolo (ícone reduzido)</Label>
              {config.geral.simboloUrl && (
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border bg-muted/30 p-2">
                    <img
                      src={config.geral.simboloUrl}
                      alt="Símbolo da empresa"
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                  <p className="mt-2 truncate max-w-xs text-xs text-muted-foreground font-mono">{config.geral.simboloUrl}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => simboloInputRef.current?.click()}
                  disabled={simboloUploading}
                  aria-label={config.geral.simboloUrl ? 'Substituir símbolo' : 'Enviar símbolo'}
                >
                  {simboloUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {config.geral.simboloUrl ? 'Substituir símbolo' : 'Enviar símbolo'}
                </Button>
                {config.geral.simboloUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => updateSection('geral', { simboloUrl: '' })}
                    aria-label="Remover símbolo"
                  >
                    Remover símbolo
                  </Button>
                )}
              </div>
              <input
                ref={simboloInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                className="hidden"
                onChange={handleSimboloUpload}
              />
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />Quadrado, idealmente com fundo transparente. Usado no menu lateral recolhido e em favicons. Máximo 1 MB.
              </p>
            </div>

            <Separator />

            {/* Marca textual exibida ao lado do símbolo no menu lateral expandido e nas telas de login. */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="marcaTexto">Texto da marca</Label>
                <Input
                  id="marcaTexto"
                  value={config.geral.marcaTexto || ''}
                  onChange={(e) => updateSection('geral', { marcaTexto: e.target.value })}
                  placeholder="Ex.: AviZee"
                  maxLength={40}
                />
                <p className="text-[11px] text-muted-foreground">Aparece no menu expandido e na tela de login. Deixe em branco para usar apenas a logo.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="marcaSubtitulo">Subtítulo discreto</Label>
                <Input
                  id="marcaSubtitulo"
                  value={config.geral.marcaSubtitulo || ''}
                  onChange={(e) => updateSection('geral', { marcaSubtitulo: e.target.value })}
                  placeholder="Ex.: ERP"
                  maxLength={20}
                />
                <p className="text-[11px] text-muted-foreground">Texto curto exibido em destaque sutil ao lado da marca.</p>
              </div>
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
            <Users className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
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

      {/* Bloco 4 — Pré-visualização do remetente */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <CardTitle>Pré-visualização do remetente</CardTitle>
              <CardDescription>
                Confira como o campo "De:" aparecerá para os destinatários dos e-mails gerados pelo sistema.
                O envio efetivo depende da infraestrutura SMTP configurada no servidor — não é testável aqui.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border bg-muted/30 px-4 py-3 space-y-1.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Campo "De:" nos e-mails</p>
            <p className="text-sm font-medium font-mono">
              {config.email.remetenteNome
                ? `${config.email.remetenteNome} <${config.email.remetenteEmail}>`
                : config.email.remetenteEmail || '—'}
            </p>
            {config.email.responderPara && (
              <>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-2">Campo "Reply-To:"</p>
                <p className="text-sm font-medium font-mono">{config.email.responderPara}</p>
              </>
            )}
          </div>
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              Esta seção configura apenas a <strong>identidade do remetente</strong> (nome e endereço de origem).
              Para testar a entrega de e-mails, a configuração SMTP do servidor deve ser realizada
              separadamente na infraestrutura do sistema.
            </p>
          </div>
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
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Alterado por</p>
              <p className="text-sm font-medium">{emailLastSaved.by ?? '—'}</p>
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Esta configuração impacta</p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {[
                'Campo "De:" em e-mails de orçamentos e pedidos',
                'Notificações automáticas do sistema',
                'E-mails de confirmação e cobrança',
                'Assinatura de comunicações institucionais',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">
            Alterações nesta seção refletem imediatamente na identidade do remetente dos e-mails gerados pelo sistema. Salve as configurações para aplicar as mudanças.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  const renderIntegracoes = () => (
    <div className="space-y-6">
      <Card className="border-dashed bg-muted/30">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Estas integrações são <strong className="text-foreground">globais</strong>. Qualquer alteração impacta todos os usuários e fluxos administrativos do sistema.
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plug className="h-4 w-4 text-muted-foreground" />Gateway externo</CardTitle>
          <CardDescription>Conexão global com serviço de gateway. O teste desta tela valida apenas preenchimento básico dos parâmetros.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label>URL do gateway</Label>
            <Input placeholder="https://api.gateway.com/v1" value={config.integracoes.gatewayUrl} onChange={(e) => updateSection('integracoes', { gatewayUrl: e.target.value })} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>API key do gateway</Label>
            <Input type="password" placeholder="••••••••••••" value={config.integracoes.gatewayApiKey} onChange={(e) => updateSection('integracoes', { gatewayApiKey: e.target.value })} />
          </div>
          <div className="md:col-span-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <p>Teste disponível nesta tela: validação de preenchimento local. Reachability e teste funcional real dependem de endpoint de backend dedicado.</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Receipt className="h-4 w-4 text-muted-foreground" />SEFAZ</CardTitle>
          <CardDescription>Parâmetros globais para emissão fiscal. Certificado em Base64 é aceito temporariamente enquanto o fluxo de upload dedicado não é implementado.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Ambiente SEFAZ</Label>
            <Select value={config.integracoes.sefazAmbiente} onValueChange={(v) => updateSection('integracoes', { sefazAmbiente: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="homologacao">Homologação</SelectItem>
                <SelectItem value="producao">Produção</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Certificado digital (Base64)</Label>
            <div className="space-y-2 rounded-md border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">Campo sensível. O conteúdo fica oculto por padrão para reduzir exposição acidental.</p>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowSefazCertificado((prev) => !prev)}>
                  {showSefazCertificado ? 'Ocultar conteúdo' : 'Mostrar conteúdo'}
                </Button>
              </div>
              {showSefazCertificado ? (
                <Textarea
                  rows={4}
                  placeholder="Cole aqui o conteúdo Base64 (sem cabeçalhos PEM)."
                  value={config.integracoes.sefazCertificadoBase64}
                  onChange={(e) => updateSection('integracoes', { sefazCertificadoBase64: e.target.value.trim() })}
                  className="font-mono text-xs"
                />
              ) : (
                <Input
                  type="password"
                  value={config.integracoes.sefazCertificadoBase64}
                  placeholder="Conteúdo oculto"
                  onChange={(e) => updateSection('integracoes', { sefazCertificadoBase64: e.target.value.trim() })}
                  className="font-mono text-xs"
                />
              )}
            </div>
            {!isValidBase64(config.integracoes.sefazCertificadoBase64) && (
              <p className="text-[11px] text-destructive">Formato inválido: informe um Base64 contínuo (sem espaços e sem cabeçalhos PEM).</p>
            )}
            <p className="text-[11px] text-muted-foreground">Hint: use apenas conteúdo Base64 limpo. Em breve este campo será substituído por upload seguro de certificado.</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Webhook className="h-4 w-4 text-muted-foreground" />Webhooks</CardTitle>
          <CardDescription>Canal global de eventos para sistemas externos.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Endpoint do webhook</Label>
            <Input placeholder="https://sua-api.com/webhooks/erp" value={config.integracoes.webhookUrl} onChange={(e) => updateSection('integracoes', { webhookUrl: e.target.value })} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Segredo de assinatura</Label>
            <Input type="password" placeholder="chave de assinatura HMAC" value={config.integracoes.webhookSecret} onChange={(e) => updateSection('integracoes', { webhookSecret: e.target.value })} />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderNotificacoes = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4 text-muted-foreground" />Política global de notificações</CardTitle>
          <CardDescription>Estas opções definem notificações automáticas em nível de sistema — não são preferências pessoais de usuário.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-4"><div><p className="font-medium text-sm">Resumo diário operacional</p><p className="text-sm text-muted-foreground">Envia panorama diário para perfis administrativos.</p></div><Switch checked={config.notificacoes.resumoDiario} onCheckedChange={(checked) => updateSection('notificacoes', { resumoDiario: checked })} /></div>
          <div className="flex items-center justify-between rounded-lg border p-4"><div><p className="font-medium text-sm">Alertas operacionais críticos</p><p className="text-sm text-muted-foreground">Falhas de integração, filas e indisponibilidades relevantes.</p></div><Switch checked={config.notificacoes.alertasOperacionais} onCheckedChange={(checked) => updateSection('notificacoes', { alertasOperacionais: checked })} /></div>
          <div className="flex items-center justify-between rounded-lg border p-4"><div><p className="font-medium text-sm">Avisos de segurança</p><p className="text-sm text-muted-foreground">Mudanças sensíveis, tentativas de acesso e revogações.</p></div><Switch checked={config.notificacoes.avisosSeguranca} onCheckedChange={(checked) => updateSection('notificacoes', { avisosSeguranca: checked })} /></div>
          <div className="space-y-1.5 max-w-sm">
            <Label>Canal padrão das notificações globais</Label>
            <Select value={config.notificacoes.canalPadrao} onValueChange={(v) => updateSection('notificacoes', { canalPadrao: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="painel">Painel interno</SelectItem>
                <SelectItem value="email-painel">E-mail + painel</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderBackup = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><HardDrive className="h-4 w-4 text-muted-foreground" />Política de backup global</CardTitle>
          <CardDescription>Define frequência, retenção e destino. Esta tela configura política; a execução real depende da infraestrutura de backup.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Frequência</Label>
            <Select value={config.backup.frequencia} onValueChange={(v) => updateSection('backup', { frequencia: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="diario">Diário</SelectItem>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Retenção (dias)</Label>
            <Input value={config.backup.retencaoDias} onChange={(e) => updateSection('backup', { retencaoDias: e.target.value.replace(/\D/g, '') })} placeholder="30" />
          </div>
          <div className="space-y-1.5">
            <Label>Destino</Label>
            <Select value={config.backup.destino} onValueChange={(v) => updateSection('backup', { destino: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="storage-interno">Storage interno</SelectItem>
                <SelectItem value="s3-externo">Bucket externo (S3)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status operacional</CardTitle>
          <CardDescription>Leitura do último ciclo conhecido e do próximo passo previsto.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border bg-muted/30 p-3"><p className="text-[11px] uppercase text-muted-foreground">Última execução</p><p className="text-sm font-medium">{config.backup.ultimaExecucao || 'Sem execução registrada'}</p></div>
          <div className="rounded-md border bg-muted/30 p-3"><p className="text-[11px] uppercase text-muted-foreground">Status</p><p className="text-sm font-medium flex items-center gap-1.5">{config.backup.ultimoStatus === 'sucesso' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : config.backup.ultimoStatus === 'falha' ? <AlertCircle className="h-4 w-4 text-destructive" /> : <Info className="h-4 w-4 text-muted-foreground" />}{config.backup.ultimoStatus}</p></div>
          <div className="rounded-md border bg-muted/30 p-3"><p className="text-[11px] uppercase text-muted-foreground">Próximo agendamento</p><p className="text-sm font-medium">Calculado pela infraestrutura ({config.backup.frequencia})</p></div>
          <div className="md:col-span-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300"><Info className="h-4 w-4 mt-0.5 shrink-0" /><p>Esta interface não dispara backup manual nem valida execução remota. Ela mantém a política global para consumo dos serviços de infraestrutura.</p></div>
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
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Esta configuração serve como referência para</p>
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
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              Esses valores são <strong>parâmetros armazenados</strong> e ainda não são consumidos automaticamente por todos os módulos fiscais. Servem como referência e base para futuras integrações.
            </p>
          </div>
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
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Esta configuração serve como referência para</p>
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
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              Esses valores são <strong>parâmetros armazenados</strong> e ainda não são consumidos automaticamente por todos os módulos financeiros. Servem como referência e base para futuras integrações.
            </p>
          </div>
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
      case 'dashboard':
        return <DashboardAdmin />;

      case 'empresa':
        return renderEmpresa();

      case 'usuarios':
        return (
          <div className="space-y-4">
            <Tabs defaultValue="usuarios" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="usuarios" className="gap-1.5"><Users className="h-3.5 w-3.5" />Usuários</TabsTrigger>
                <TabsTrigger value="permissoes" className="gap-1.5"><Shield className="h-3.5 w-3.5" />Matriz de Permissões</TabsTrigger>
              </TabsList>
              <TabsContent value="usuarios">
                <UsuariosTab />
              </TabsContent>
              <TabsContent value="permissoes">
                <Card>
                  <CardHeader>
                    <CardTitle>Matriz de Permissões</CardTitle>
                    <CardDescription>Gerencie visualmente as permissões por perfil de acesso.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PermissaoMatrix />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        );

      case 'email':
        return renderEmail();
      case 'integracoes':
        return renderIntegracoes();
      case 'notificacoes':
        return renderNotificacoes();
      case 'backup':
        return renderBackup();

      case 'fiscal':
        return renderFiscal();

      case 'financeiro':
        return renderFinanceiro();

      default:
        // Fallback for any unknown section key — show empresa
        return renderEmpresa();
    }
  };

  const showSaveButton = activeSection !== 'usuarios' && activeSection !== 'dashboard';
  const sectionMeta = getSectionMeta(activeSection);
  const saveMeta = getSaveMeta();

  return (
    <><ModulePage title="Administração" subtitle="Governança, parâmetros globais e gestão do sistema.">
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <nav className="w-full lg:w-60 space-y-5" aria-label="Navegação administrativa">
            {sideNavGroups.map((group, gIdx) => (
              <div key={group.key}>
                <p className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.key;
                    const external = item.behavior === 'external' || item.key === 'migracao';
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => handleSectionChange(item.key)}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-left transition-colors',
                          isActive
                            ? 'bg-accent/40 text-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent/30',
                        )}
                      >
                        {isActive && (
                          <span aria-hidden className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-primary" />
                        )}
                        <span
                          className={cn(
                            'flex h-6 w-6 items-center justify-center rounded-md shrink-0 transition-colors',
                            isActive ? 'bg-primary/10 text-primary' : 'bg-muted/40 text-muted-foreground group-hover:text-foreground',
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="flex-1 truncate">{item.label}</span>
                        {external && <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />}
                      </button>
                    );
                  })}
                </div>
                {gIdx < sideNavGroups.length - 1 && <Separator className="mt-4 opacity-60" />}
              </div>
            ))}
          </nav>
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">{sectionMeta.title}</CardTitle>
                <CardDescription>{sectionMeta.description}</CardDescription>
              </CardHeader>
            </Card>
            {renderContent()}
            {showSaveButton && (
              <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {saveMeta.lastSaved
                    ? `Última atualização: ${new Date(saveMeta.lastSaved).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`
                    : 'Ainda não há atualização registrada para esta seção.'}
                </p>
                <Button onClick={handleSave} disabled={saving} className="gap-2" aria-label="Salvar alterações de configuração">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saveMeta.cta}
                </Button>
              </div>
            )}
          </div>
        </div>
      </ModulePage>
    </>
  );
}
