import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FileText, 
  Send,
  CheckCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Mail,
  FileSpreadsheet,
  Download,
  ExternalLink,
  FileBarChart2,
  Zap,
  Users,
  Upload,
  Trash2
} from "lucide-react";
import { FileUpload } from "@/components/FileUpload";
import { VolumetriaUpload } from "@/components/VolumetriaUpload";
import { VolumetriaPeriodoSelector } from "@/components/volumetria/VolumetriaPeriodoSelector";
import { VolumetriaUploadStats } from '@/components/volumetria/VolumetriaUploadStats';
import { VolumetriaClientesComparison } from '@/components/volumetria/VolumetriaClientesComparison';
import { VolumetriaExamesNaoIdentificados } from '@/components/volumetria/VolumetriaExamesNaoIdentificados';

import { VolumetriaStatusPanel } from '@/components/VolumetriaStatusPanel';
// ExamesForaPadraoUpload removido - usar apenas em Gerenciar Cadastros
import { DeParaPrioridadeUpload } from '@/components/DePara/DeParaPrioridadeUpload';
import { Speedometer } from "@/components/Speedometer";
import { processContratosFile, processEscalasFile, processFinanceiroFile, processClientesFile, processFaturamentoFile, limparUploadsAntigos, limparDadosVolumetria } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ControlePeriodoFaturamento } from "@/components/ControlePeriodoFaturamento";
import LimparDadosCompleto from "@/components/LimparDadosCompleto";
import { VolumetriaProvider } from "@/contexts/VolumetriaContext";
import DemonstrativoFaturamento from "@/components/DemonstrativoFaturamento";
import { ControleFechamentoFaturamento } from '@/components/ControleFechamentoFaturamento';
import ListaExamesPeriodo from "@/components/faturamento/ListaExamesPeriodo";
import { generatePDF, downloadPDF, type FaturamentoData } from "@/lib/pdfUtils";

// Período atual - onde estão os dados carregados (junho/2025)
const PERIODO_ATUAL = "2025-06";

export default function GerarFaturamento() {
  const [activeTab, setActiveTab] = useState("demonstrativo");
  
  // Estados persistentes que não devem zerar ao trocar de aba
  const [relatoriosGerados, setRelatoriosGerados] = useState(() => {
    const saved = localStorage.getItem('relatoriosGerados');
    return saved ? parseInt(saved) : 0;
  });
  const [emailsEnviados, setEmailsEnviados] = useState(() => {
    const saved = localStorage.getItem('emailsEnviados');
    return saved ? parseInt(saved) : 0;
  });
  
  const [processandoTodos, setProcessandoTodos] = useState(false);
  const [refreshUploadStatus, setRefreshUploadStatus] = useState(0);
  const [isClearing, setIsClearing] = useState(false);
  const [sistemaProntoParagerar, setSistemaProntoParagerar] = useState(true);
  
  // Controle de período para volumetria retroativa
  const [periodoFaturamentoVolumetria, setPeriodoFaturamentoVolumetria] = useState<{ ano: number; mes: number } | null>(null);
  
  // Controle de período para upload
  const [periodoSelecionado, setPeriodoSelecionado] = useState("2025-06"); // Período com dados
  const [mostrarApenasEditaveis, setMostrarApenasEditaveis] = useState(true);
  
  const [clientesCarregados, setClientesCarregados] = useState<Array<{
    id: string;
    nome: string;
    email: string;
  }>>(() => {
    const saved = localStorage.getItem('clientesCarregados');
    return saved ? JSON.parse(saved) : [];
  });

  // Estado para arquivo de faturamento
  const [arquivoFaturamento, setArquivoFaturamento] = useState<File | null>(null);
  const [enviarEmails, setEnviarEmails] = useState(false);
  const [statusProcessamento, setStatusProcessamento] = useState<{
    processando: boolean;
    mensagem: string;
    progresso: number;
  }>({
    processando: false,
    mensagem: '',
    progresso: 0
  });
  
  const [resultados, setResultados] = useState<Array<{
    clienteId: string;
    clienteNome: string;
    relatorioGerado: boolean;
    emailEnviado: boolean;
    emailDestino: string;
    linkRelatorio?: string;
    arquivos?: Array<{ tipo: string; url: string; nome: string }>;
    erro?: string;
    erroEmail?: string;
    dataProcessamento?: string;
    relatorioData?: any;
    detalhesRelatorio?: {
      total_laudos: number;
      valor_total: number;
    };
  }>>(() => {
    const saved = localStorage.getItem('resultadosFaturamento');
    return saved ? JSON.parse(saved) : [];
  });
  
  const { toast } = useToast();

  // Função para gerar todos os relatórios (nova aba "Relatórios")
  const gerarTodosRelatorios = async () => {
    if (clientesCarregados.length === 0) {
      toast({
        title: "Nenhum cliente encontrado",
        description: "Certifique-se de que há clientes com faturamento no período selecionado",
        variant: "destructive",
      });
      return;
    }

    setProcessandoTodos(true);
    setStatusProcessamento({
      processando: true,
      mensagem: 'Iniciando geração de relatórios...',
      progresso: 0
    });

    try {
      const total = clientesCarregados.length;
      let gerados = 0;
      let errors = 0;

      for (let i = 0; i < clientesCarregados.length; i++) {
        const cliente = clientesCarregados[i];
        
        setStatusProcessamento({
          processando: true,
          mensagem: `Gerando relatório para ${cliente.nome} (${i + 1}/${total})...`,
          progresso: Math.round((i / total) * 100)
        });

        try {
          // Gerar relatório para o cliente
          const { data: relatorioData, error: relatorioError } = await supabase.functions.invoke('gerar-relatorio-faturamento', {
            body: {
              cliente_id: cliente.id,
              periodo: periodoSelecionado
            }
          });

          if (relatorioError || !relatorioData?.success) {
            throw new Error(relatorioError?.message || relatorioData?.error || 'Erro ao gerar relatório');
          }

          // Atualizar resultado do cliente
          setResultados(prev => prev.map(resultado => 
            resultado.clienteId === cliente.id 
              ? {
                  ...resultado,
                  relatorioGerado: true,
                  linkRelatorio: relatorioData.arquivos?.[0]?.url,
                  arquivos: relatorioData.arquivos,
                  dataProcessamento: new Date().toLocaleString('pt-BR'),
                  relatorioData: relatorioData,
                  erro: undefined
                }
              : resultado
          ));

          gerados++;
          
        } catch (error) {
          console.error(`Erro ao gerar relatório para ${cliente.nome}:`, error);
          errors++;
          
          // Atualizar resultado com erro
          setResultados(prev => prev.map(resultado => 
            resultado.clienteId === cliente.id 
              ? {
                  ...resultado,
                  relatorioGerado: false,
                  erro: error instanceof Error ? error.message : 'Erro desconhecido',
                  dataProcessamento: new Date().toLocaleString('pt-BR')
                }
              : resultado
          ));
        }
      }

      setRelatoriosGerados(gerados);

      setStatusProcessamento({
        processando: false,
        mensagem: 'Processo concluído',
        progresso: 100
      });

      toast({
        title: "Relatórios gerados!",
        description: `${gerados} relatórios gerados com sucesso${errors > 0 ? `, ${errors} com erro` : ''}`,
        variant: gerados > 0 ? "default" : "destructive",
      });

    } catch (error) {
      console.error('Erro no processo de geração de relatórios:', error);
      
      setStatusProcessamento({
        processando: false,
        mensagem: 'Erro no processamento',
        progresso: 0
      });

      toast({
        title: "Erro na geração",
        description: "Ocorreu um erro durante a geração dos relatórios",
        variant: "destructive",
      });
    } finally {
      setProcessandoTodos(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Gerar Faturamento</h1>
        <p className="text-gray-600 mt-1">Geração e envio automático de relatórios de faturamento para todos os clientes</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="demonstrativo" className="flex items-center gap-2">
            <FileBarChart2 className="h-4 w-4" />
            Demonstrativo
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Relatórios
          </TabsTrigger>
          <TabsTrigger value="fechamento" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Fechamento de Período
          </TabsTrigger>
          <TabsTrigger value="gerar" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Gerar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="demonstrativo" className="space-y-6">
          <DemonstrativoFaturamento />
          <Separator />
          <ListaExamesPeriodo />
        </TabsContent>

        {/* Tab: Relatórios - Simplificada */}
        <TabsContent value="relatorios" className="space-y-6">
          {/* Progresso do Faturamento */}
          <Card>
            <CardHeader>
              <CardTitle>{processandoTodos ? "Processando..." : "Progresso do Faturamento"}</CardTitle>
            </CardHeader>
            <CardContent>
              {processandoTodos ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                  <div className="flex flex-col items-center space-y-4">
                    <h3 className="text-lg font-semibold text-green-400">SISTEMA ATIVO</h3>
                    <div className="w-[350px] h-[250px] bg-gray-900 rounded flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-green-400 text-2xl font-mono mb-2">⚡</div>
                        <p className="text-green-400 font-mono">PROCESSANDO...</p>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-green-600 font-mono">GERANDO RELATÓRIOS...</p>
                      <p className="text-xs text-muted-foreground mt-1">Processando dados dos clientes</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center space-y-4">
                    <h3 className="text-lg font-semibold text-green-400">STATUS: ONLINE</h3>
                    <div className="w-[350px] h-[250px] bg-gray-900 rounded flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-green-400 text-2xl font-mono mb-2">🟢</div>
                        <p className="text-green-400 font-mono">SISTEMA ONLINE</p>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-green-600 font-mono">SISTEMA OPERACIONAL</p>
                      <p className="text-xs text-muted-foreground mt-1">Aguarde a conclusão do processo</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-4">
                  <Speedometer
                    value={clientesCarregados.length}
                    max={clientesCarregados.length}
                    label="Clientes Cadastrados"
                    unit=""
                    colorThresholds={{
                      low: { threshold: 30, color: "#3b82f6" },
                      medium: { threshold: 70, color: "#3b82f6" },
                      high: { threshold: 100, color: "#3b82f6" }
                    }}
                  />
                  
                  <Speedometer
                    value={relatoriosGerados}
                    max={clientesCarregados.length}
                    label="Relatórios Gerados"
                    unit=""
                    colorThresholds={{
                      low: { threshold: 40, color: "#f59e0b" },
                      medium: { threshold: 80, color: "#10b981" },
                      high: { threshold: 100, color: "#10b981" }
                    }}
                  />
                  
                  <Speedometer
                    value={emailsEnviados}
                    max={clientesCarregados.length}
                    label="E-mails Enviados"
                    unit=""
                    colorThresholds={{
                      low: { threshold: 40, color: "#ef4444" },
                      medium: { threshold: 80, color: "#f59e0b" },
                      high: { threshold: 100, color: "#10b981" }
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status dos Relatórios por Cliente - Simplificado */}
          <Card>
            <CardHeader>
              <CardTitle>Status dos Relatórios por Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">Cliente</th>
                      <th className="text-left p-3">Link do Relatório</th>
                      <th className="text-left p-3">Data/Hora Gerado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultados.map((resultado) => (
                      <tr key={resultado.clienteId} className="border-b">
                        <td className="p-3 font-medium">{resultado.clienteNome}</td>
                         <td className="p-3">
                           {resultado.arquivos && resultado.arquivos.length > 0 ? (
                             <div className="flex flex-col space-y-1">
                               {resultado.arquivos.map((arquivo, index) => (
                                 <a
                                   key={index}
                                   href={arquivo.url}
                                   target="_blank"
                                   rel="noopener noreferrer"
                                   className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                                 >
                                   <ExternalLink className="h-3 w-3" />
                                   {arquivo.tipo.toUpperCase()}
                                 </a>
                               ))}
                             </div>
                           ) : resultado.linkRelatorio ? (
                             <a 
                               href={resultado.linkRelatorio} 
                               target="_blank" 
                               rel="noopener noreferrer"
                               className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                             >
                               <ExternalLink className="h-3 w-3" />
                               Ver Relatório
                             </a>
                           ) : (
                             <span className="text-sm text-muted-foreground">-</span>
                           )}
                         </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {resultado.dataProcessamento || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Mostrar erros se houver */}
              {resultados.length > 0 && resultados.some(r => r.erro) && (
                <div className="mt-4 space-y-2">
                  <h4 className="font-semibold text-red-600 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Erros Encontrados ({resultados.filter(r => r.erro).length}):
                  </h4>
                  {resultados.filter(r => r.erro).map(resultado => (
                    <div key={resultado.clienteId} className="text-sm p-3 bg-red-50 border border-red-200 rounded">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium text-red-800">{resultado.clienteNome}:</span>
                          <p className="text-red-700 mt-1">{resultado.erro}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fechamento" className="space-y-6 mt-6">
          <ControleFechamentoFaturamento />
        </TabsContent>

        <TabsContent value="gerar" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Gerar Relatórios de Faturamento
              </CardTitle>
              <CardDescription>
                Processo para gerar todos os relatórios dos clientes ativos - {PERIODO_ATUAL}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-center">
                <Button
                  onClick={gerarTodosRelatorios}
                  disabled={processandoTodos || clientesCarregados.length === 0}
                  size="lg"
                  className="min-w-[400px] bg-blue-600 hover:bg-blue-700 h-14 text-lg"
                >
                  {processandoTodos ? (
                    <>
                      <RefreshCw className="h-6 w-6 mr-3 animate-spin" />
                      Processando Relatórios...
                    </>
                  ) : (
                    <>
                      <FileText className="h-6 w-6 mr-3" />
                      📄 Gerar Todos os Relatórios ({clientesCarregados.length} clientes)
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}