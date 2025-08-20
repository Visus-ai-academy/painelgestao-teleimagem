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
  const [activeTab, setActiveTab] = useState("gerar");
  
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

  // Estado para controlar se o demonstrativo foi gerado
  const [demonstrativoGerado, setDemonstrativoGerado] = useState(() => {
    const saved = localStorage.getItem('demonstrativoGerado');
    return saved === 'true';
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

  // Função para carregar clientes da base de dados
  const carregarClientes = async () => {
    try {
      console.log('🔍 Carregando clientes para período:', periodoSelecionado);
      
      // Converter período (YYYY-MM) para formato mon/YY (ex.: jun/25)
      const formatPeriodo = (yyyyMM: string) => {
        const [y, m] = yyyyMM.split('-');
        const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
        const mon = meses[Math.max(0, Math.min(11, Number(m) - 1))];
        return `${mon}/${y.slice(2)}`;
      };
      const periodoRef = formatPeriodo(periodoSelecionado);
      
      console.log('🔍 Buscando clientes com faturamento para período:', periodoRef);

      // 1. PRIMEIRO: Buscar clientes que têm dados na tabela faturamento
      const { data: clientesComFaturamento, error: errorFaturamento } = await supabase
        .from('faturamento')
        .select('cliente_nome, cliente_email')
        .eq('periodo_referencia', periodoRef)
        .not('cliente_nome', 'is', null);

      if (errorFaturamento) {
        console.error('❌ Erro na consulta faturamento:', errorFaturamento);
        throw errorFaturamento;
      }

      // 2. SEGUNDO: Se não há dados na tabela faturamento, buscar da volumetria
      let clientesFinais: any[] = [];
      
      if (!clientesComFaturamento || clientesComFaturamento.length === 0) {
        console.log('⚠️ Nenhum dado no faturamento, buscando da volumetria...');
        
        // Buscar da volumetria_mobilemed
        const { data: clientesVolumetria, error: errorVolumetria } = await supabase
          .from('volumetria_mobilemed')
          .select('EMPRESA')
          .eq('periodo_referencia', periodoRef)
          .not('EMPRESA', 'is', null);

        if (errorVolumetria) {
          console.error('❌ Erro na consulta volumetria:', errorVolumetria);
          throw errorVolumetria;
        }

        if (clientesVolumetria && clientesVolumetria.length > 0) {
          // Buscar emails dos clientes na tabela clientes
          const nomesUnicos = [...new Set(clientesVolumetria.map(c => c.EMPRESA).filter(Boolean))];
          
          for (const nomeCliente of nomesUnicos) {
            const { data: emailCliente } = await supabase
              .from('clientes')
              .select('email')
              .eq('nome', nomeCliente)
              .single();
            
            clientesFinais.push({
              id: nomeCliente.toLowerCase().replace(/\s+/g, '-'),
              nome: nomeCliente,
              email: emailCliente?.email || `${nomeCliente.toLowerCase().replace(/\s+/g, '.')}@email.com`
            });
          }
        }
      } else {
        // Usar dados da tabela faturamento
        const nomesUnicos = [...new Set(clientesComFaturamento.map(c => c.cliente_nome).filter(Boolean))];
        
        for (const nomeCliente of nomesUnicos) {
          const clienteData = clientesComFaturamento.find(c => c.cliente_nome === nomeCliente);
          clientesFinais.push({
            id: nomeCliente.toLowerCase().replace(/\s+/g, '-'),
            nome: nomeCliente,
            email: clienteData?.cliente_email || `${nomeCliente.toLowerCase().replace(/\s+/g, '.')}@email.com`
          });
        }
      }

      console.log(`✅ ${clientesFinais.length} clientes encontrados:`, clientesFinais.map(c => c.nome));
      
      setClientesCarregados(clientesFinais);
      localStorage.setItem('clientesCarregados', JSON.stringify(clientesFinais));
      
      // Inicializar resultados para todos os clientes
      const novosResultados = clientesFinais.map(cliente => ({
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        relatorioGerado: false,
        emailEnviado: false,
        emailDestino: cliente.email
      }));
      
      setResultados(novosResultados);
      localStorage.setItem('resultadosFaturamento', JSON.stringify(novosResultados));
      
    } catch (error) {
      console.error('❌ Erro ao carregar clientes:', error);
      toast({
        title: "Erro ao carregar clientes",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  // Função para gerar demonstrativo de faturamento
  const gerarDemonstrativoFaturamento = async () => {
    console.log('🚀 [INICIO] Botão Gerar Demonstrativo clicado');
    console.log('🚀 [PERIODO] Período selecionado:', periodoSelecionado);
    
    if (!periodoSelecionado) {
      console.log('❌ [ERRO] Período não selecionado');
      toast({
        title: "Período não selecionado",
        description: "Selecione um período para gerar o faturamento",
        variant: "destructive",
      });
      return;
    }

    console.log('📊 [STATUS] Iniciando processamento...');
    setProcessandoTodos(true);
    setStatusProcessamento({
      processando: true,
      mensagem: 'Gerando demonstrativo de faturamento...',
      progresso: 0
    });

    try {
      console.log('📡 [EDGE_FUNCTION] Chamando gerar-faturamento-periodo com período:', periodoSelecionado);
      
      // Primeiro gerar o faturamento do período
      const { data: faturamentoData, error: faturamentoError } = await supabase.functions.invoke('gerar-faturamento-periodo', {
        body: {
          periodo: periodoSelecionado
        }
      });

      console.log('📡 [RESPOSTA] Resposta da edge function:');
      console.log('📡 [RESPOSTA] Data:', faturamentoData);
      console.log('📡 [RESPOSTA] Error:', faturamentoError);

      if (faturamentoError || !faturamentoData?.success) {
        console.log('❌ [ERRO] Erro na edge function:', faturamentoError?.message || faturamentoData?.error);
        throw new Error(faturamentoError?.message || faturamentoData?.error || 'Erro ao gerar faturamento');
      }

      console.log('✅ [SUCESSO] Demonstrativo gerado com sucesso');
      console.log('📊 [DADOS] Dados retornados:', faturamentoData);

      // Marcar demonstrativo como gerado
      setDemonstrativoGerado(true);
      localStorage.setItem('demonstrativoGerado', 'true');

      setStatusProcessamento({
        processando: false,
        mensagem: 'Demonstrativo gerado com sucesso',
        progresso: 100
      });

      toast({
        title: "Demonstrativo gerado!",
        description: `Faturamento do período ${periodoSelecionado} processado com sucesso`,
        variant: "default",
      });

      // Recarregar clientes após gerar o demonstrativo
      console.log('🔄 [RECARREGAR] Recarregando clientes em 1 segundo...');
      setTimeout(() => {
        console.log('🔄 [RECARREGAR] Executando carregarClientes()...');
        carregarClientes();
      }, 1000);

    } catch (error) {
      console.error('❌ [CATCH] Erro no processo de geração de faturamento:', error);
      console.error('❌ [CATCH] Tipo do erro:', typeof error);
      console.error('❌ [CATCH] Stack trace:', error instanceof Error ? error.stack : 'N/A');
      
      setStatusProcessamento({
        processando: false,
        mensagem: 'Erro no processamento',
        progresso: 0
      });

      toast({
        title: "Erro na geração",
        description: "Ocorreu um erro durante a geração do demonstrativo",
        variant: "destructive",
      });
    } finally {
      console.log('🏁 [FINALLY] Finalizando processo...');
      setProcessandoTodos(false);
    }
  };

  // Função para enviar emails
  const enviarTodosEmails = async () => {
    const relatóriosParaEnviar = resultados.filter(r => r.relatorioGerado && !r.emailEnviado);
    
    if (relatóriosParaEnviar.length === 0) {
      toast({
        title: "Nenhum relatório para enviar",
        description: "Todos os relatórios já foram enviados ou ainda não foram gerados",
        variant: "destructive",
      });
      return;
    }

    setProcessandoTodos(true);
    let enviados = 0;
    let errors = 0;

    try {
      for (const resultado of relatóriosParaEnviar) {
        try {
          // Enviar e-mail com o relatório
          const { error: emailError } = await supabase.functions.invoke('enviar-relatorio-email', {
            body: {
              cliente_id: resultado.clienteId,
              relatorio: resultado.relatorioData,
              anexo_pdf: resultado.arquivos?.[0]?.url ? 
                await fetch(resultado.arquivos[0].url).then(r => r.arrayBuffer()).then(ab => btoa(String.fromCharCode(...new Uint8Array(ab)))) :
                undefined
            }
          });

          if (emailError) {
            throw new Error(emailError.message);
          }

          // Atualizar status do e-mail
          setResultados(prev => prev.map(r => 
            r.clienteId === resultado.clienteId 
              ? { ...r, emailEnviado: true }
              : r
          ));

          enviados++;
          
        } catch (error) {
          console.error(`Erro ao enviar e-mail para ${resultado.clienteNome}:`, error);
          errors++;
          
          setResultados(prev => prev.map(r => 
            r.clienteId === resultado.clienteId 
              ? { ...r, erroEmail: error instanceof Error ? error.message : 'Erro desconhecido' }
              : r
          ));
        }
      }

      setEmailsEnviados(prev => prev + enviados);

      toast({
        title: "E-mails enviados!",
        description: `${enviados} e-mails enviados com sucesso${errors > 0 ? `, ${errors} com erro` : ''}`,
        variant: enviados > 0 ? "default" : "destructive",
      });

    } catch (error) {
      console.error('Erro no envio de e-mails:', error);
      
      toast({
        title: "Erro no envio",
        description: "Ocorreu um erro durante o envio dos e-mails",
        variant: "destructive",
      });
    } finally {
      setProcessandoTodos(false);
    }
  };

  // Carregar clientes quando o componente inicializa ou período muda
  useEffect(() => {
    console.log('🔄 Período selecionado mudou para:', periodoSelecionado);
    // Resetar demonstrativo quando período mudar
    setDemonstrativoGerado(false);
    localStorage.setItem('demonstrativoGerado', 'false');
    
    // Resetar contadores de relatórios e emails quando período mudar
    setRelatoriosGerados(0);
    setEmailsEnviados(0);
    localStorage.setItem('relatoriosGerados', '0');
    localStorage.setItem('emailsEnviados', '0');
    localStorage.removeItem('resultadosFaturamento');
    setResultados([]);
    
    carregarClientes();
  }, [periodoSelecionado]);

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
      localStorage.setItem('relatoriosGerados', gerados.toString());

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
          <TabsTrigger value="gerar" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Gerar
          </TabsTrigger>
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
        </TabsList>

        <TabsContent value="demonstrativo" className="space-y-6">
          <DemonstrativoFaturamento />
          <Separator />
          <ListaExamesPeriodo />
        </TabsContent>

        {/* Tab: Relatórios - Simplificada */}
        <TabsContent value="relatorios" className="space-y-6">
          {/* Progresso do Faturamento - Barras Laterais com Degradê */}
          <Card>
            <CardHeader>
              <CardTitle>Progresso do Faturamento</CardTitle>
              <CardDescription>Acompanhe o progresso da geração de relatórios</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {/* Clientes Cadastrados */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Clientes Cadastrados</span>
                    <span className="text-sm font-bold">{clientesCarregados.length}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-1000 ease-out"
                      style={{ 
                        width: clientesCarregados.length > 0 ? '100%' : '0%'
                      }}
                    />
                  </div>
                </div>

                {/* Relatórios Gerados */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Relatórios Gerados</span>
                    <span className="text-sm font-bold">
                      {relatoriosGerados} de {clientesCarregados.length}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-1000 ease-out"
                      style={{ 
                        width: clientesCarregados.length > 0 
                          ? `${Math.min(100, (relatoriosGerados / clientesCarregados.length) * 100)}%` 
                          : '0%' 
                      }}
                    />
                  </div>
                </div>

                {/* E-mails Enviados */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">E-mails Enviados</span>
                    <span className="text-sm font-bold">
                      {emailsEnviados} de {clientesCarregados.length}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all duration-1000 ease-out"
                      style={{ 
                        width: clientesCarregados.length > 0 
                          ? `${Math.min(100, (emailsEnviados / clientesCarregados.length) * 100)}%` 
                          : '0%' 
                      }}
                    />
                  </div>
                </div>

                {/* Erros */}
                {resultados.filter(r => r.erro).length > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-red-600">Erros</span>
                      <span className="text-sm font-bold text-red-600">
                        {resultados.filter(r => r.erro).length} de {clientesCarregados.length}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-red-400 to-red-600 transition-all duration-1000 ease-out"
                        style={{ 
                          width: clientesCarregados.length > 0 
                            ? `${Math.min(100, (resultados.filter(r => r.erro).length / clientesCarregados.length) * 100)}%` 
                            : '0%' 
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
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

          {/* Seletor de Período */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Seleção de Período
              </CardTitle>
              <CardDescription>
                Selecione o período para geração do faturamento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ControlePeriodoFaturamento 
                periodoSelecionado={periodoSelecionado}
                setPeriodoSelecionado={setPeriodoSelecionado}
                mostrarApenasDisponiveis={mostrarApenasEditaveis}
                setMostrarApenasDisponiveis={setMostrarApenasEditaveis}
                onPeriodoChange={setPeriodoSelecionado}
              />
            </CardContent>
          </Card>

          {/* Processo de Geração - Etapas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Processo de Geração de Faturamento
              </CardTitle>
              <CardDescription>
                Execute as etapas do processo de faturamento na ordem correta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Etapa 1: Gerar Demonstrativo */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <FileBarChart2 className="h-4 w-4" />
                  Etapa 1: Gerar Demonstrativo de Faturamento
                </h4>
                <div className="flex flex-col sm:flex-row gap-3 items-center">
                  <Button 
                    onClick={gerarDemonstrativoFaturamento}
                    disabled={processandoTodos || !periodoSelecionado}
                    size="lg"
                    className="min-w-[280px] bg-blue-600 hover:bg-blue-700"
                  >
                    {processandoTodos && statusProcessamento.mensagem.includes('demonstrativo') ? (
                      <>
                        <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <FileBarChart2 className="h-5 w-5 mr-2" />
                        🧮 Gerar Demonstrativo do Período
                      </>
                    )}
                  </Button>
                  <p className="text-sm text-blue-700">
                    Processa os dados de volumetria e gera o demonstrativo financeiro
                  </p>
                </div>
              </div>

              {/* Etapa 2: Gerar Relatórios */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Etapa 2: Gerar Relatórios PDF por Cliente
                </h4>
                <div className="flex flex-col sm:flex-row gap-3 items-center">
                  <Button 
                    onClick={gerarTodosRelatorios}
                    disabled={processandoTodos || clientesCarregados.length === 0 || !demonstrativoGerado}
                    size="lg"
                    className="min-w-[280px] bg-green-600 hover:bg-green-700"
                  >
                    {processandoTodos && statusProcessamento.mensagem.includes('relatório') ? (
                      <>
                        <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                        Gerando Relatórios...
                      </>
                    ) : (
                      <>
                        <FileText className="h-5 w-5 mr-2" />
                        📄 Gerar Relatórios ({clientesCarregados.length} clientes)
                      </>
                    )}
                  </Button>
                  <p className="text-sm text-green-700">
                    {!demonstrativoGerado 
                      ? "Execute primeiro a Etapa 1 (Gerar Demonstrativo)" 
                      : "Gera relatórios individuais em PDF para cada cliente"
                    }
                  </p>
                </div>
              </div>

              {/* Etapa 3: Enviar E-mails */}
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <h4 className="font-semibold text-orange-900 mb-3 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Etapa 3: Enviar E-mails com Relatórios
                </h4>
                <div className="flex flex-col sm:flex-row gap-3 items-center">
                  <Button 
                    onClick={enviarTodosEmails}
                    disabled={processandoTodos || resultados.filter(r => r.relatorioGerado && !r.emailEnviado).length === 0}
                    size="lg"
                    className="min-w-[280px] bg-orange-600 hover:bg-orange-700"
                  >
                    {processandoTodos && statusProcessamento.mensagem.includes('email') ? (
                      <>
                        <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                        Enviando E-mails...
                      </>
                    ) : (
                      <>
                        <Mail className="h-5 w-5 mr-2" />
                        📧 Enviar E-mails ({resultados.filter(r => r.relatorioGerado && !r.emailEnviado).length})
                      </>
                    )}
                  </Button>
                  <p className="text-sm text-orange-700">
                    Envia os relatórios por e-mail para os clientes
                  </p>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Progresso atual */}
          {statusProcessamento.processando && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="h-5 w-5 text-green-600 animate-spin" />
                    <div>
                      <h3 className="font-semibold text-green-800">{statusProcessamento.mensagem}</h3>
                      <p className="text-sm text-green-700">Progresso: {statusProcessamento.progresso}%</p>
                    </div>
                  </div>
                  <div className="w-full bg-green-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${statusProcessamento.progresso}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status por Cliente - Completo */}
          {resultados.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Status por Cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3">Cliente</th>
                        <th className="text-center p-3">Relatório</th>
                        <th className="text-left p-3">E-mail</th>
                        <th className="text-left p-3">Link PDF</th>
                        <th className="text-left p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultados.map((resultado) => (
                        <tr key={resultado.clienteId} className="border-b">
                          <td className="p-3 font-medium">{resultado.clienteNome}</td>
                          <td className="p-3 text-center">
                            {resultado.relatorioGerado ? (
                              <CheckCircle className="h-5 w-5 text-green-600 mx-auto" />
                            ) : (
                              <div className="h-5 w-5 rounded-full border-2 border-gray-300 mx-auto"></div>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{resultado.emailDestino}</span>
                              {resultado.emailEnviado && (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              )}
                            </div>
                          </td>
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
                                Ver PDF
                              </a>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            {resultado.erro ? (
                              <Badge variant="destructive">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Erro
                              </Badge>
                            ) : resultado.emailEnviado ? (
                              <Badge variant="default">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Concluído
                              </Badge>
                            ) : resultado.relatorioGerado ? (
                              <Badge variant="secondary">
                                Relatório Gerado
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                Pendente
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

        </TabsContent>

      </Tabs>
    </div>
  );
}