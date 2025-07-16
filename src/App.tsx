
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
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
import ConfiguracaoFaturamento from "./pages/ConfiguracaoFaturamento";
import People from "./pages/People";
import MedicosAtivos from "./pages/MedicosAtivos";
import Desenvolvimento from "./pages/Desenvolvimento";
import PlanoCarreira from "./pages/PlanoCarreira";
import Bonificacao from "./pages/Bonificacao";
import Colaboradores from "./pages/Colaboradores";
import TreinamentoEquipe from "./pages/TreinamentoEquipe";
import ContratosClientes from "./pages/ContratosClientes";
import ContratosFornecedores from "./pages/ContratosFornecedores";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
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
                    <Route path="/operacional/producao" element={<OperacionalProducao />} />
                    <Route path="/operacional/qualidade" element={<OperacionalQualidade />} />
                    <Route path="/operacional/escala" element={<Escala />} />
                    <Route path="/financeiro/*" element={<Financeiro />} />
                    <Route path="/financeiro/gerar-faturamento" element={<GerarFaturamento />} />
                    <Route path="/financeiro/regua-cobranca" element={<ReguaCobranca />} />
                    <Route path="/people/*" element={<People />} />
                    <Route path="/people/medicos-ativos" element={<MedicosAtivos />} />
                    <Route path="/people/desenvolvimento" element={<Desenvolvimento />} />
                    <Route path="/people/carreira" element={<PlanoCarreira />} />
                    <Route path="/people/bonificacao" element={<Bonificacao />} />
                    <Route path="/people/colaboradores" element={<Colaboradores />} />
                    <Route path="/operacional/qualidade/treinamento-equipe" element={<TreinamentoEquipe />} />
                    <Route path="/contratos/clientes" element={<ContratosClientes />} />
                    <Route path="/contratos/fornecedores" element={<ContratosFornecedores />} />
                    <Route path="/configuracao/faturamento" element={<ConfiguracaoFaturamento />} />
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

export default App;
