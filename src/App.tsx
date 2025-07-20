
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
import Dashboard from "./pages/Dashboard";
import Volumetria from "./pages/Volumetria";
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
import GerenciarListas from "./pages/GerenciarListas";
import EstruturaVendas from "./pages/EstruturaVendas";
import ConfiguracaoImportacao from "./pages/ConfiguracaoImportacao";
import ArquiteturaProjeto from "./pages/ArquiteturaProjeto";
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
            <Route path="/*" element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/volumetria/*" element={<Volumetria />} />
                    <Route path="/operacional/*" element={<Operacional />} />
                    <Route path="/operacional/producao" element={
                      <RoleProtectedRoute requiredRoles={['manager', 'admin']}>
                        <OperacionalProducao />
                      </RoleProtectedRoute>
                    } />
                    <Route path="/operacional/qualidade" element={
                      <RoleProtectedRoute requiredRoles={['manager', 'admin']}>
                        <OperacionalQualidade />
                      </RoleProtectedRoute>
                    } />
                    <Route path="/operacional/escala" element={
                      <RoleProtectedRoute requiredRoles={['manager', 'admin']}>
                        <Escala />
                      </RoleProtectedRoute>
                    } />
                    <Route path="/financeiro/*" element={
                      <RoleProtectedRoute requiredRoles={['manager', 'admin']}>
                        <Financeiro />
                      </RoleProtectedRoute>
                    } />
                    <Route path="/financeiro/gerar-faturamento" element={
                      <RoleProtectedRoute requiredRoles={['manager', 'admin']}>
                        <GerarFaturamento />
                      </RoleProtectedRoute>
                    } />
                    <Route path="/financeiro/regua-cobranca" element={
                      <RoleProtectedRoute requiredRoles={['manager', 'admin']}>
                        <ReguaCobranca />
                      </RoleProtectedRoute>
                    } />
                    <Route path="/financeiro/pagamentos" element={
                      <RoleProtectedRoute requiredRoles={['admin']}>
                        <PagamentosMedicos />
                      </RoleProtectedRoute>
                    } />
                    <Route path="/people/*" element={<People />} />
                    <Route path="/people/medicos-ativos" element={<MedicosAtivos />} />
                    <Route path="/people/desenvolvimento" element={
                      <RoleProtectedRoute requiredRoles={['admin']}>
                        <Desenvolvimento />
                      </RoleProtectedRoute>
                    } />
                    <Route path="/people/carreira" element={
                      <RoleProtectedRoute requiredRoles={['admin']}>
                        <PlanoCarreira />
                      </RoleProtectedRoute>
                    } />
                    <Route path="/people/bonificacao" element={
                      <RoleProtectedRoute requiredRoles={['admin']}>
                        <Bonificacao />
                      </RoleProtectedRoute>
                    } />
                    <Route path="/people/colaboradores" element={
                      <RoleProtectedRoute requiredRoles={['manager', 'admin']}>
                        <Colaboradores />
                      </RoleProtectedRoute>
                    } />
                    <Route path="/operacional/qualidade/treinamento-equipe" element={<TreinamentoEquipe />} />
                    <Route path="/contratos/clientes" element={
                      <RoleProtectedRoute requiredRoles={['manager', 'admin']}>
                        <ContratosClientes />
                      </RoleProtectedRoute>
                    } />
                    <Route path="/contratos/fornecedores" element={
                      <RoleProtectedRoute requiredRoles={['admin']}>
                        <ContratosFornecedores />
                      </RoleProtectedRoute>
                    } />
                    <Route path="/configuracao/faturamento" element={
                      <RoleProtectedRoute requiredRoles={['admin']}>
                        <ConfiguracaoFaturamento />
                      </RoleProtectedRoute>
                    } />
                    <Route path="/configuracao/usuarios" element={
                      <RoleProtectedRoute requiredRoles={['admin']}>
                        <GerenciarUsuarios />
                      </RoleProtectedRoute>
                    } />
                    <Route path="/configuracao/logomarca" element={
                      <RoleProtectedRoute requiredRoles={['admin']}>
                        <ConfiguracaoLogomarca />
                      </RoleProtectedRoute>
                    } />
                    <Route path="/configuracao/listas" element={
                      <RoleProtectedRoute requiredRoles={['admin']}>
                        <GerenciarListas />
                      </RoleProtectedRoute>
                    } />
                     <Route path="/estrutura-vendas" element={
                       <RoleProtectedRoute requiredRoles={['admin']}>
                         <EstruturaVendas />
                       </RoleProtectedRoute>
                     } />
                     <Route path="/configuracao-importacao" element={
                       <RoleProtectedRoute requiredRoles={['admin']}>
                         <ConfiguracaoImportacao />
                       </RoleProtectedRoute>
                     } />
                    <Route path="/arquitetura" element={
                      <RoleProtectedRoute requiredRoles={['admin']}>
                        <ArquiteturaProjeto />
                      </RoleProtectedRoute>
                    } />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            } />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
