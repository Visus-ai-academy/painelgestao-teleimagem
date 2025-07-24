
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { useMouseLight } from "@/hooks/useMouseLight";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RoleProtectedRoute } from "./components/RoleProtectedRoute";
import { Layout } from "@/components/Layout";
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Volumetria from "./pages/Volumetria";
import UploadDados from "./pages/UploadDados";

import Operacional from "./pages/Operacional";
import OperacionalProducao from "./pages/OperacionalProducao";
import OperacionalQualidade from "./pages/OperacionalQualidade";
import Escala from "./pages/Escala";
import Financeiro from "./pages/Financeiro";
import GerarFaturamento from "./pages/GerarFaturamento";
import ReguaCobranca from "./pages/ReguaCobranca";
import PagamentosMedicos from "./pages/PagamentosMedicos";
import ConfiguracaoFaturamento from "./pages/ConfiguracaoFaturamento";
import ConfiguracaoLogomarca from "./pages/ConfiguracaoLogomarca";
import ArquiteturaProjeto from "./pages/ArquiteturaProjeto";
import RelatorioImplementacoes from "./pages/RelatorioImplementacoes";
import GerenciarUsuarios from "./pages/GerenciarUsuarios";
import People from "./pages/People";
import MedicosAtivos from "./pages/MedicosAtivos";
import Desenvolvimento from "./pages/Desenvolvimento";
import PlanoCarreira from "./pages/PlanoCarreira";
import Bonificacao from "./pages/Bonificacao";
import Colaboradores from "./pages/Colaboradores";
import TreinamentoEquipe from "./pages/TreinamentoEquipe";
import ContratosClientes from "./pages/ContratosClientes";
import ContratosFornecedores from "./pages/ContratosFornecedores";
import CadastroClientes from "./pages/CadastroClientes";
import GerenciarListas from "./pages/GerenciarListas";
import EstruturaVendas from "./pages/EstruturaVendas";
import ConfiguracaoImportacao from "./pages/ConfiguracaoImportacao";
import MapeamentoVisual from "./pages/MapeamentoVisual";
import Seguranca from "./pages/Seguranca";
import Pendencias from "./pages/Pendencias";
import ControleRegras from "./pages/ControleRegras";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const { mousePosition, isVisible } = useMouseLight();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {/* Mouse Light Effect */}
        <div
          className="mouse-light"
          style={{
            left: mousePosition.x,
            top: mousePosition.y,
            opacity: isVisible ? 1 : 0,
          }}
        />
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/volumetria/*" element={
              <ProtectedRoute>
                <Layout>
                  <Volumetria />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/upload-dados" element={
              <ProtectedRoute>
                <Layout>
                  <RoleProtectedRoute requiredRoles={['manager', 'admin']}>
                    <UploadDados />
                  </RoleProtectedRoute>
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/operacional/*" element={
              <ProtectedRoute>
                <Layout>
                  <Operacional />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/operacional/producao" element={
              <ProtectedRoute>
                <Layout>
                  <RoleProtectedRoute requiredRoles={['manager', 'admin']}>
                    <OperacionalProducao />
                  </RoleProtectedRoute>
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/operacional/qualidade" element={
              <ProtectedRoute>
                <Layout>
                  <RoleProtectedRoute requiredRoles={['manager', 'admin']}>
                    <OperacionalQualidade />
                  </RoleProtectedRoute>
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/operacional/escala" element={
              <ProtectedRoute>
                <Layout>
                  <RoleProtectedRoute requiredRoles={['manager', 'admin']}>
                    <Escala />
                  </RoleProtectedRoute>
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/financeiro/*" element={
              <ProtectedRoute>
                <Layout>
                  <RoleProtectedRoute requiredRoles={['manager', 'admin']}>
                    <Financeiro />
                  </RoleProtectedRoute>
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/financeiro/gerar-faturamento" element={
              <ProtectedRoute>
                <Layout>
                  <RoleProtectedRoute requiredRoles={['manager', 'admin']}>
                    <GerarFaturamento />
                  </RoleProtectedRoute>
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/financeiro/regua-cobranca" element={
              <ProtectedRoute>
                <Layout>
                  <RoleProtectedRoute requiredRoles={['manager', 'admin']}>
                    <ReguaCobranca />
                  </RoleProtectedRoute>
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/financeiro/pagamentos" element={
              <ProtectedRoute>
                <Layout>
                  <RoleProtectedRoute requiredRoles={['admin']}>
                    <PagamentosMedicos />
                  </RoleProtectedRoute>
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/people/*" element={
              <ProtectedRoute>
                <Layout>
                  <People />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/people/medicos-ativos" element={
              <ProtectedRoute>
                <Layout>
                  <MedicosAtivos />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/people/desenvolvimento" element={
              <ProtectedRoute>
                <Layout>
                  <RoleProtectedRoute requiredRoles={['admin']}>
                    <Desenvolvimento />
                  </RoleProtectedRoute>
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/people/carreira" element={
              <ProtectedRoute>
                <Layout>
                  <RoleProtectedRoute requiredRoles={['admin']}>
                    <PlanoCarreira />
                  </RoleProtectedRoute>
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/people/bonificacao" element={
              <ProtectedRoute>
                <Layout>
                  <RoleProtectedRoute requiredRoles={['admin']}>
                    <Bonificacao />
                  </RoleProtectedRoute>
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/people/colaboradores" element={
              <ProtectedRoute>
                <Layout>
                  <RoleProtectedRoute requiredRoles={['manager', 'admin']}>
                    <Colaboradores />
                  </RoleProtectedRoute>
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/operacional/qualidade/treinamento-equipe" element={
              <ProtectedRoute>
                <Layout>
                  <TreinamentoEquipe />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/clientes/cadastro" element={
              <ProtectedRoute>
                <Layout>
                  <RoleProtectedRoute requiredRoles={['manager', 'admin']}>
                    <CadastroClientes />
                  </RoleProtectedRoute>
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/contratos/clientes" element={
              <ProtectedRoute>
                <Layout>
                  <RoleProtectedRoute requiredRoles={['manager', 'admin']}>
                    <ContratosClientes />
                  </RoleProtectedRoute>
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/contratos/fornecedores" element={
              <ProtectedRoute>
                <Layout>
                  <RoleProtectedRoute requiredRoles={['admin']}>
                    <ContratosFornecedores />
                  </RoleProtectedRoute>
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/configuracao/faturamento" element={
              <ProtectedRoute>
                <Layout>
                  <RoleProtectedRoute requiredRoles={['admin']}>
                    <ConfiguracaoFaturamento />
                  </RoleProtectedRoute>
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/configuracao/usuarios" element={
              <ProtectedRoute>
                <Layout>
                  <RoleProtectedRoute requiredRoles={['admin']}>
                    <GerenciarUsuarios />
                  </RoleProtectedRoute>
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/configuracao/logomarca" element={
              <ProtectedRoute>
                <Layout>
                  <RoleProtectedRoute requiredRoles={['admin']}>
                    <ConfiguracaoLogomarca />
                  </RoleProtectedRoute>
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/configuracao/listas" element={
              <ProtectedRoute>
                <Layout>
                  <RoleProtectedRoute requiredRoles={['admin']}>
                    <GerenciarListas />
                  </RoleProtectedRoute>
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/estrutura-vendas" element={
              <ProtectedRoute>
                <Layout>
                  <RoleProtectedRoute requiredRoles={['admin']}>
                    <EstruturaVendas />
                  </RoleProtectedRoute>
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/configuracao-importacao" element={
              <ProtectedRoute>
                <Layout>
                  <RoleProtectedRoute requiredRoles={['admin']}>
                    <ConfiguracaoImportacao />
                  </RoleProtectedRoute>
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/arquitetura" element={
              <ProtectedRoute>
                <Layout>
                  <RoleProtectedRoute requiredRoles={['admin']}>
                    <ArquiteturaProjeto />
                  </RoleProtectedRoute>
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/seguranca" element={
              <ProtectedRoute>
                <Layout>
                  <RoleProtectedRoute requiredRoles={['admin']}>
                    <Seguranca />
                  </RoleProtectedRoute>
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/mapeamento-visual" element={
              <ProtectedRoute>
                <Layout>
                  <RoleProtectedRoute requiredRoles={['admin']}>
                    <MapeamentoVisual />
                  </RoleProtectedRoute>
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/relatorio-implementacoes" element={
              <ProtectedRoute>
                <Layout>
                  <RelatorioImplementacoes />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/pendencias" element={
              <ProtectedRoute>
                <Layout>
                  <RoleProtectedRoute requiredRoles={['manager', 'admin']}>
                    <Pendencias />
                  </RoleProtectedRoute>
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/controle-regras" element={
              <ProtectedRoute>
                <Layout>
                  <RoleProtectedRoute requiredRoles={['admin']}>
                    <ControleRegras />
                  </RoleProtectedRoute>
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
