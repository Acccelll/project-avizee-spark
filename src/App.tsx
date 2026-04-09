import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppConfigProvider } from "@/contexts/AppConfigContext";
import { RelationalNavigationProvider } from "@/contexts/RelationalNavigationContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { SocialRoute } from "@/components/SocialRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { OfflineBanner } from "@/components/OfflineBanner";

// Lazy-loaded pages
const Index = lazy(() => import("./pages/Index"));
const Produtos = lazy(() => import("./pages/Produtos"));
const Clientes = lazy(() => import("./pages/Clientes"));
const GruposEconomicos = lazy(() => import("./pages/GruposEconomicos"));
const Fornecedores = lazy(() => import("./pages/Fornecedores"));
const Orcamentos = lazy(() => import("./pages/Orcamentos"));
const OrcamentoForm = lazy(() => import("./pages/OrcamentoForm"));
const OrdensVenda = lazy(() => import("./pages/OrdensVenda"));
const Estoque = lazy(() => import("./pages/Estoque"));
const Fiscal = lazy(() => import("./pages/Fiscal"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const ContasBancarias = lazy(() => import("./pages/ContasBancarias"));
const FluxoCaixa = lazy(() => import("./pages/FluxoCaixa"));
const ContasContabeis = lazy(() => import("./pages/ContasContabeis"));
const Login = lazy(() => import("./pages/Login"));
const Pedidos = lazy(() => import("./pages/Pedidos"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Administracao = lazy(() => import("./pages/Administracao"));
const MigracaoDados = lazy(() => import("./pages/MigracaoDados"));
const Auditoria = lazy(() => import("./pages/Auditoria"));
const Perfil = lazy(() => import("./pages/Perfil"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Transportadoras = lazy(() => import("./pages/Transportadoras"));
const FormasPagamento = lazy(() => import("./pages/FormasPagamento"));
const CotacoesCompra = lazy(() => import("./pages/CotacoesCompra"));
const PedidosCompra = lazy(() => import("./pages/PedidosCompra"));
const Remessas = lazy(() => import("./pages/Remessas"));
const Logistica = lazy(() => import("./pages/Logistica"));
const Funcionarios = lazy(() => import("./pages/Funcionarios"));
const OrcamentoPublico = lazy(() => import("./pages/OrcamentoPublico"));
const Conciliacao = lazy(() => import("./pages/Conciliacao"));
const Social = lazy(() => import("./pages/Social"));

// Redirect component that properly maps :id param
function CotacaoIdRedirect() {
  const { id } = useParams();
  return <Navigate to={`/orcamentos/${id}`} replace />;
}

// Per-route Suspense wrapper — shows loading spinner only in the content area
function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center flex-1 min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    }>
      {children}
    </Suspense>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <OfflineBanner />
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <RelationalNavigationProvider>
          <AuthProvider>
          <AppConfigProvider>
          <ErrorBoundary>
          <Routes>
            <Route path="/orcamento-publico" element={<LazyPage><OrcamentoPublico /></LazyPage>} />
            <Route path="/login" element={<LazyPage><Login /></LazyPage>} />
            <Route path="/signup" element={<LazyPage><Signup /></LazyPage>} />
            <Route path="/forgot-password" element={<LazyPage><ForgotPassword /></LazyPage>} />
            <Route path="/reset-password" element={<LazyPage><ResetPassword /></LazyPage>} />
            <Route path="/" element={<ProtectedRoute><LazyPage><Index /></LazyPage></ProtectedRoute>} />
            <Route path="/produtos" element={<ProtectedRoute><LazyPage><Produtos /></LazyPage></ProtectedRoute>} />
            <Route path="/clientes" element={<ProtectedRoute><LazyPage><Clientes /></LazyPage></ProtectedRoute>} />
            <Route path="/fornecedores" element={<ProtectedRoute><LazyPage><Fornecedores /></LazyPage></ProtectedRoute>} />
            <Route path="/transportadoras" element={<ProtectedRoute><LazyPage><Transportadoras /></LazyPage></ProtectedRoute>} />
            <Route path="/formas-pagamento" element={<ProtectedRoute><LazyPage><FormasPagamento /></LazyPage></ProtectedRoute>} />
            <Route path="/grupos-economicos" element={<ProtectedRoute><LazyPage><GruposEconomicos /></LazyPage></ProtectedRoute>} />
            <Route path="/funcionarios" element={<ProtectedRoute><LazyPage><Funcionarios /></LazyPage></ProtectedRoute>} />
            <Route path="/compras" element={<Navigate to="/pedidos-compra" replace />} />
            <Route path="/cotacoes-compra" element={<ProtectedRoute><LazyPage><CotacoesCompra /></LazyPage></ProtectedRoute>} />
            <Route path="/pedidos-compra" element={<ProtectedRoute><LazyPage><PedidosCompra /></LazyPage></ProtectedRoute>} />
            <Route path="/logistica" element={<ProtectedRoute><LazyPage><Logistica /></LazyPage></ProtectedRoute>} />
            <Route path="/remessas" element={<ProtectedRoute><LazyPage><Remessas /></LazyPage></ProtectedRoute>} />
            <Route path="/cotacoes" element={<Navigate to="/orcamentos" replace />} />
            <Route path="/cotacoes/novo" element={<Navigate to="/orcamentos/novo" replace />} />
            <Route path="/cotacoes/:id" element={<CotacaoIdRedirect />} />
            <Route path="/orcamentos" element={<ProtectedRoute><LazyPage><Orcamentos /></LazyPage></ProtectedRoute>} />
            <Route path="/orcamentos/novo" element={<ProtectedRoute><LazyPage><OrcamentoForm /></LazyPage></ProtectedRoute>} />
            <Route path="/orcamentos/:id" element={<ProtectedRoute><LazyPage><OrcamentoForm /></LazyPage></ProtectedRoute>} />
            <Route path="/ordens-venda" element={<ProtectedRoute><LazyPage><OrdensVenda /></LazyPage></ProtectedRoute>} />
            <Route path="/pedidos" element={<ProtectedRoute><LazyPage><Pedidos /></LazyPage></ProtectedRoute>} />
            <Route path="/estoque" element={<ProtectedRoute><LazyPage><Estoque /></LazyPage></ProtectedRoute>} />
            <Route path="/fiscal" element={<ProtectedRoute><LazyPage><Fiscal /></LazyPage></ProtectedRoute>} />
            <Route path="/financeiro" element={<ProtectedRoute><LazyPage><Financeiro /></LazyPage></ProtectedRoute>} />
            <Route path="/contas-bancarias" element={<ProtectedRoute><LazyPage><ContasBancarias /></LazyPage></ProtectedRoute>} />
            <Route path="/fluxo-caixa" element={<ProtectedRoute><LazyPage><FluxoCaixa /></LazyPage></ProtectedRoute>} />
            <Route path="/caixa" element={<Navigate to="/financeiro" replace />} />
            <Route path="/relatorios" element={<ProtectedRoute><LazyPage><Relatorios /></LazyPage></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute><LazyPage><Configuracoes /></LazyPage></ProtectedRoute>} />
            <Route path="/administracao" element={<AdminRoute><LazyPage><Administracao /></LazyPage></AdminRoute>} />
            <Route path="/migracao-dados" element={<AdminRoute><LazyPage><MigracaoDados /></LazyPage></AdminRoute>} />
            <Route path="/auditoria" element={<AdminRoute><LazyPage><Auditoria /></LazyPage></AdminRoute>} />
            <Route path="/perfil" element={<ProtectedRoute><LazyPage><Perfil /></LazyPage></ProtectedRoute>} />
            <Route path="/contas-contabeis-plano" element={<ProtectedRoute><LazyPage><ContasContabeis /></LazyPage></ProtectedRoute>} />
            <Route path="/conciliacao" element={<ProtectedRoute><LazyPage><Conciliacao /></LazyPage></ProtectedRoute>} />
            <Route path="/social" element={<SocialRoute><LazyPage><Social /></LazyPage></SocialRoute>} />
            <Route path="*" element={<LazyPage><NotFound /></LazyPage>} />
          </Routes>
          </ErrorBoundary>
          </AppConfigProvider>
          </AuthProvider>
          </RelationalNavigationProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
