import { useState, useEffect, useCallback, useMemo } from "react";
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
  Trash2,
  Search
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

  // Estado para controlar se o demonstrativo foi gerado - AGORA VERIFICA AUTOMATICAMENTE
  const [demonstrativoGerado, setDemonstrativoGerado] = useState(false);
  
  // Verificar se há dados de faturamento processados para este período
  const verificarDemonstrativoGerado = useCallback(async () => {
    if (!periodoSelecionado) return;
    
    try {
      const { count } = await supabase
        .from('faturamento')
        .select('cliente_nome', { count: 'exact', head: true })
        .eq('periodo_referencia', periodoSelecionado);
      
      const temDados = count && count > 0;
      setDemonstrativoGerado(temDados);
      console.log('🎯 Demonstrativo gerado:', temDados, 'registros:', count, 'para período:', periodoSelecionado);
    } catch (error) {
      console.error('Erro ao verificar demonstrativo:', error);
      setDemonstrativoGerado(false);
    }
  }, [periodoSelecionado]);
  
  // Verificar status do demonstrativo quando período mudar
  useEffect(() => {
    verificarDemonstrativoGerado();
  }, [verificarDemonstrativoGerado]);

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
    const saved = sessionStorage.getItem('resultadosFaturamento');
    return saved ? JSON.parse(saved) : [];
  });

  // Estados para filtros e ordenação
  const [filtroClienteRelatorios, setFiltroClienteRelatorios] = useState("");
  const [ordemAlfabeticaRelatorios, setOrdemAlfabeticaRelatorios] = useState(true);
  const [filtroClienteStatus, setFiltroClienteStatus] = useState("");
  const [ordemAlfabeticaStatus, setOrdemAlfabeticaStatus] = useState(true);

  // Resultados filtrados e ordenados para aba Relatórios
  const resultadosFiltradosRelatorios = useMemo(() => {
    // Primeiro, remover duplicatas por clienteId
    const uniqueResults = resultados.filter((resultado, index, array) => 
      array.findIndex(r => r.clienteId === resultado.clienteId) === index
    );
    
    let filtrados = [...uniqueResults];
    
    if (filtroClienteRelatorios) {
      filtrados = filtrados.filter(resultado => 
        resultado.clienteNome.toLowerCase().includes(filtroClienteRelatorios.toLowerCase())
      );
    }
    
    filtrados.sort((a, b) => {
      const comparison = a.clienteNome.localeCompare(b.clienteNome, 'pt-BR');
      return ordemAlfabeticaRelatorios ? comparison : -comparison;
    });
    
    return filtrados;
  }, [resultados, filtroClienteRelatorios, ordemAlfabeticaRelatorios]);

  // Resultados filtrados e ordenados para aba Gerar (Status por Cliente)
  const resultadosFiltradosStatus = useMemo(() => {
    // Primeiro, remover duplicatas por clienteId
    const uniqueResults = resultados.filter((resultado, index, array) => 
      array.findIndex(r => r.clienteId === resultado.clienteId) === index
    );
    
    let filtrados = [...uniqueResults];
    
    if (filtroClienteStatus) {
      filtrados = filtrados.filter(resultado => 
        resultado.clienteNome.toLowerCase().includes(filtroClienteStatus.toLowerCase())
      );
    }
    
    filtrados.sort((a, b) => {
      const comparison = a.clienteNome.localeCompare(b.clienteNome, 'pt-BR');
      return ordemAlfabeticaStatus ? comparison : -comparison;
    });
    
    return filtrados;
  }, [resultados, filtroClienteStatus, ordemAlfabeticaStatus]);

  // Função para salvar resultados no banco de dados
  const salvarResultadosDB = useCallback(async (novosResultados: typeof resultados) => {
    try {
      // Preparar dados para inserção/atualização no banco
      const dadosParaDB = novosResultados.map(resultado => ({
        cliente_id: resultado.clienteId,
        cliente_nome: resultado.clienteNome,
        periodo: periodoSelecionado,
        relatorio_gerado: resultado.relatorioGerado,
        email_enviado: resultado.emailEnviado,
        email_destino: resultado.emailDestino,
        link_relatorio: resultado.linkRelatorio || null,
        erro: resultado.erro || null,
        erro_email: resultado.erroEmail || null,
        data_processamento: resultado.dataProcessamento ? new Date(resultado.dataProcessamento).toISOString() : null,
        data_geracao_relatorio: resultado.relatorioGerado ? new Date().toISOString() : null,
        data_envio_email: resultado.emailEnviado ? new Date().toISOString() : null,
        detalhes_relatorio: resultado.detalhesRelatorio ? JSON.stringify(resultado.detalhesRelatorio) : null
      }));

      // Usar upsert para inserir ou atualizar registros
      for (const dados of dadosParaDB) {
        await supabase
          .from('relatorios_faturamento_status')
          .upsert(dados, { 
            onConflict: 'cliente_id,periodo',
            ignoreDuplicates: false 
          });
      }

      // Também salvar no sessionStorage como backup
      const dadosLeves = novosResultados.map(({ relatorioData, ...resto }) => resto);
      sessionStorage.setItem('resultadosFaturamento', JSON.stringify(dadosLeves));
      
      // Atualizar contadores e persistir no localStorage
      const relatoriosGerados = novosResultados.filter(r => r.relatorioGerado).length;
      const emailsEnviados = novosResultados.filter(r => r.emailEnviado).length;
      setRelatoriosGerados(relatoriosGerados);
      setEmailsEnviados(emailsEnviados);
      localStorage.setItem('relatoriosGerados', relatoriosGerados.toString());
      localStorage.setItem('emailsEnviados', emailsEnviados.toString());
    } catch (error) {
      console.error('Erro ao salvar resultados no banco:', error);
      // Fallback para sessionStorage apenas
      try {
        const dadosLeves = novosResultados.map(({ relatorioData, ...resto }) => resto);
        sessionStorage.setItem('resultadosFaturamento', JSON.stringify(dadosLeves));
      } catch (sessionError) {
        console.warn('Erro ao salvar no sessionStorage:', sessionError);
        sessionStorage.removeItem('resultadosFaturamento');
      }
    }
  }, [periodoSelecionado]);

  // Função para carregar resultados do banco de dados
  const carregarResultadosDB = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('relatorios_faturamento_status')
        .select('*')
        .eq('periodo', periodoSelecionado)
        .order('cliente_nome');

      if (error) throw error;

      if (data && data.length > 0) {
        const resultadosCarregados = data.map(item => ({
          clienteId: item.cliente_id,
          clienteNome: item.cliente_nome,
          relatorioGerado: item.relatorio_gerado,
          emailEnviado: item.email_enviado,
          emailDestino: item.email_destino,
          linkRelatorio: item.link_relatorio || undefined,
          erro: item.erro || undefined,
          erroEmail: item.erro_email || undefined,
          dataProcessamento: item.data_processamento ? new Date(item.data_processamento).toLocaleString('pt-BR') : undefined,
          detalhesRelatorio: item.detalhes_relatorio ? (typeof item.detalhes_relatorio === 'string' ? JSON.parse(item.detalhes_relatorio) : item.detalhes_relatorio) : undefined
        }));

        setResultados(resultadosCarregados);
        
        // Atualizar contadores baseados nos dados carregados
        const relatoriosGerados = resultadosCarregados.filter(r => r.relatorioGerado).length;
        const emailsEnviados = resultadosCarregados.filter(r => r.emailEnviado).length;
        setRelatoriosGerados(relatoriosGerados);
        setEmailsEnviados(emailsEnviados);
        
        // Persistir contadores no localStorage
        localStorage.setItem('relatoriosGerados', relatoriosGerados.toString());
        localStorage.setItem('emailsEnviados', emailsEnviados.toString());
        
        return true; // Indica que dados foram carregados do DB
      }
    } catch (error) {
      console.error('Erro ao carregar resultados do banco:', error);
    }
    
    // Fallback para sessionStorage
    try {
      const saved = sessionStorage.getItem('resultadosFaturamento');
      if (saved) {
        const resultadosCarregados = JSON.parse(saved);
        setResultados(resultadosCarregados);
        
        const relatoriosGerados = resultadosCarregados.filter((r: any) => r.relatorioGerado).length;
        const emailsEnviados = resultadosCarregados.filter((r: any) => r.emailEnviado).length;
        setRelatoriosGerados(relatoriosGerados);
        setEmailsEnviados(emailsEnviados);
        
        // Persistir contadores no localStorage
        localStorage.setItem('relatoriosGerados', relatoriosGerados.toString());
        localStorage.setItem('emailsEnviados', emailsEnviados.toString());
        
        return true;
      }
    } catch (sessionError) {
      console.warn('Erro ao carregar do sessionStorage:', sessionError);
    }
    
    return false; // Nenhum dado foi carregado
  }, [periodoSelecionado]);
  
  const { toast } = useToast();

  // Função para carregar clientes da base de dados
  const carregarClientes = async () => {
    try {
      console.log('🔍 Carregando clientes para período:', periodoSelecionado);
      
      // BUSCAR TODOS os clientes únicos da volumetria do período usando EMPRESA (não Cliente_Nome_Fantasia)  
      const { data: clientesVolumetria, error: errorVolumetria } = await supabase
        .from('volumetria_mobilemed')
        .select('"EMPRESA"')
        .eq('periodo_referencia', periodoSelecionado) // Usar formato YYYY-MM direto
        .not('"EMPRESA"', 'is', null)
        .not('"EMPRESA"', 'eq', '');

      if (errorVolumetria) {
        console.error('❌ Erro na consulta volumetria:', errorVolumetria);
        throw errorVolumetria;
      }

      let clientesFinais: any[] = [];
      
      if (clientesVolumetria && clientesVolumetria.length > 0) {
        // Buscar apenas clientes únicos da volumetria por EMPRESA  
        const nomesUnicos = [...new Set(clientesVolumetria.map(c => c.EMPRESA).filter(Boolean))];
        console.log(`📊 Clientes únicos encontrados na volumetria: ${nomesUnicos.length}`, nomesUnicos);
        
        const clientesTemp: any[] = [];
        
        for (const nomeCliente of nomesUnicos) {
          // Buscar cliente cadastrado para obter email (sem filtros de ativo/status)
          const { data: emailCliente } = await supabase
            .from('clientes')
            .select('id, nome, email, nome_fantasia, nome_mobilemed')
            .or(`nome.eq.${nomeCliente},nome_fantasia.eq.${nomeCliente},nome_mobilemed.eq.${nomeCliente}`)
            .limit(1);

          clientesTemp.push({
            id: emailCliente?.[0]?.id || `temp-${nomeCliente}`,
            nome: nomeCliente,
            // Usar email do cliente cadastrado se encontrado, senão gerar email padrão
            email: emailCliente?.[0]?.email || `${nomeCliente.toLowerCase().replace(/[^a-z0-9]/g, '')}@cliente.com`
          });
        }
        
        // Remover duplicatas por clienteId (mesmo cliente pode ter nomes diferentes na volumetria)
        const clientesUnicos = new Map();
        clientesTemp.forEach(cliente => {
          if (!clientesUnicos.has(cliente.id)) {
            clientesUnicos.set(cliente.id, cliente);
          }
        });
        clientesFinais = Array.from(clientesUnicos.values());
      } else {
        console.log('⚠️ Nenhum cliente encontrado na volumetria para o período:', periodoSelecionado);
        toast({
          title: "Nenhum cliente encontrado",
          description: `Não há dados de volumetria para o período ${periodoSelecionado}`,
          variant: "destructive",
        });
        setClientesCarregados([]);
        localStorage.setItem('clientesCarregados', JSON.stringify([]));
        return;
      }

      console.log(`✅ ${clientesFinais.length} clientes únicos da volumetria encontrados:`, clientesFinais.map(c => c.nome));
      
      toast({
        title: "Clientes carregados da volumetria",
        description: `${clientesFinais.length} clientes únicos encontrados na volumetria do período ${periodoSelecionado}`,
        variant: "default",
      });
      
      setClientesCarregados(clientesFinais);
      localStorage.setItem('clientesCarregados', JSON.stringify(clientesFinais));
      
      // Inicializar resultados para todos os clientes SEM erros padrão
      const novosResultados = clientesFinais.map(cliente => ({
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        relatorioGerado: false,
        emailEnviado: false,
        emailDestino: cliente.email
        // Não definir erro aqui - apenas se houver erro real
      }));
      
      setResultados(novosResultados);
      salvarResultadosDB(novosResultados);
      
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
      progresso: 10
    });

    try {
      // Primeiro: Verificar quantos clientes únicos existem na volumetria
      console.log('🔍 [VERIFICACAO] Contando clientes únicos na volumetria...');
      const { data: clientesVolumetria, error: errorVolumetria } = await supabase
        .from('volumetria_mobilemed')
        .select('"EMPRESA"')
        .eq('periodo_referencia', periodoSelecionado)
        .not('"EMPRESA"', 'is', null);

      if (errorVolumetria) {
        throw new Error('Erro ao consultar volumetria: ' + errorVolumetria.message);
      }

      const clientesUnicosVolumetria = [...new Set(clientesVolumetria?.map(c => c.EMPRESA).filter(Boolean) || [])];
      console.log('📊 [VOLUMETRIA] Clientes únicos encontrados:', clientesUnicosVolumetria.length, clientesUnicosVolumetria);

      if (clientesUnicosVolumetria.length === 0) {
        throw new Error(`Nenhum cliente encontrado na volumetria para o período ${periodoSelecionado}`);
      }

      setStatusProcessamento({
        processando: true,
        mensagem: `Processando ${clientesUnicosVolumetria.length} clientes da volumetria...`,
        progresso: 30
      });

      console.log('📡 [EDGE_FUNCTION] Chamando gerar-faturamento-periodo com período:', periodoSelecionado);
      
      // Chamar edge function para gerar o faturamento
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

      setStatusProcessamento({
        processando: true,
        mensagem: 'Verificando se todos os clientes foram processados...',
        progresso: 70
      });

      // Aguardar e verificar o processamento com polling
      console.log('🔍 [VERIFICACAO] Aguardando processamento em background...');
      
      let tentativas = 0;
      const maxTentativas = 20; // 20 tentativas = até 60 segundos
      let clientesFaturamento: any[] = [];
      
      while (tentativas < maxTentativas) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // Aguardar 3 segundos entre tentativas
        tentativas++;
        
        setStatusProcessamento({
          processando: true,
          mensagem: `Verificando processamento... (${tentativas}/${maxTentativas})`,
          progresso: 70 + ((tentativas / maxTentativas) * 20) // 70% a 90%
        });

        console.log(`🔍 [VERIFICACAO] Tentativa ${tentativas}/${maxTentativas} - Verificando clientes processados...`);
        const { data: dadosFaturamento, error: errorFaturamento } = await supabase
          .from('faturamento')
          .select('cliente_nome')
          .eq('periodo_referencia', periodoSelecionado)
          .not('cliente_nome', 'is', null);

        if (errorFaturamento) {
          console.warn('⚠️ [AVISO] Erro ao verificar faturamento:', errorFaturamento);
          continue;
        }

        clientesFaturamento = dadosFaturamento || [];
        
        // Se encontrou dados, sair do loop
        if (clientesFaturamento.length > 0) {
          console.log(`✅ [SUCESSO] Encontrados ${clientesFaturamento.length} registros processados na tentativa ${tentativas}`);
          break;
        }
        
        console.log(`⏳ [AGUARDANDO] Tentativa ${tentativas}: ainda sem dados processados, aguardando...`);
      }

      if (clientesFaturamento.length === 0) {
        console.warn('⚠️ [TIMEOUT] Processamento não concluído dentro do tempo limite');
        throw new Error('Timeout: O processamento está demorando mais que o esperado. Verifique se há dados de volumetria para o período.');
      }

      const clientesUnicosFaturamento = [...new Set(clientesFaturamento?.map(c => c.cliente_nome).filter(Boolean) || [])];
      console.log('📊 [FATURAMENTO] Clientes processados no faturamento:', clientesUnicosFaturamento.length, clientesUnicosFaturamento);

      setStatusProcessamento({
        processando: true,
        mensagem: `Processados ${clientesUnicosFaturamento.length} de ${clientesUnicosVolumetria.length} clientes`,
        progresso: 90
      });

      // Verificar se todos os clientes foram processados
      if (clientesUnicosFaturamento.length < clientesUnicosVolumetria.length) {
        const clientesNaoProcessados = clientesUnicosVolumetria.filter(
          cliente => !clientesUnicosFaturamento.includes(cliente)
        );
        console.warn('⚠️ [AVISO] Alguns clientes não foram processados:', clientesNaoProcessados);
        
        toast({
          title: "Processamento parcial",
          description: `${clientesUnicosFaturamento.length} de ${clientesUnicosVolumetria.length} clientes processados. Alguns clientes podem não ter preços configurados.`,
          variant: "default",
        });
      } else {
        console.log('✅ [SUCESSO] Todos os clientes foram processados');
      }

      // Marcar demonstrativo como gerado
      setDemonstrativoGerado(true);
      localStorage.setItem('demonstrativoGerado', 'true');

      setStatusProcessamento({
        processando: false,
        mensagem: `Demonstrativo gerado com sucesso (${clientesUnicosFaturamento.length} clientes)`,
        progresso: 100
      });

      toast({
        title: "Demonstrativo gerado!",
        description: `Faturamento do período ${periodoSelecionado} processado com ${clientesUnicosFaturamento.length} clientes`,
        variant: "default",
      });

      // Recarregar dados
      setTimeout(() => {
        verificarDemonstrativoGerado();
        carregarClientes();
      }, 2000);

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
        description: error instanceof Error ? error.message : "Ocorreu um erro durante a geração do demonstrativo",
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
          setResultados(prev => {
            const novosResultados = prev.map(r => 
              r.clienteId === resultado.clienteId 
                ? { ...r, emailEnviado: true }
                : r
            );
            
            // Salvar no banco de dados
            salvarResultadosDB(novosResultados);
            return novosResultados;
          });

          enviados++;
          
        } catch (error) {
          console.error(`Erro ao enviar e-mail para ${resultado.clienteNome}:`, error);
          errors++;
          
          setResultados(prev => {
            const novosResultados = prev.map(r => 
              r.clienteId === resultado.clienteId 
                ? { ...r, erroEmail: error instanceof Error ? error.message : 'Erro desconhecido' }
                : r
            );
            
            // Salvar no banco de dados
            salvarResultadosDB(novosResultados);
            return novosResultados;
          });
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

  // Estado para controlar o período anterior (para detectar mudanças reais)
  const [periodoAnterior, setPeriodoAnterior] = useState<string | null>(null);

  // Carregar clientes quando o componente inicializa ou período muda
  useEffect(() => {
    console.log('🔄 Período selecionado:', periodoSelecionado, 'Período anterior:', periodoAnterior);
    
    const carregarDados = async () => {
      // Primeira tentativa: sempre carregar dados persistidos do banco primeiro
      const dadosCarregados = await carregarResultadosDB();
      
      if (dadosCarregados) {
        console.log('✅ Dados carregados do banco de dados');
        // Se há dados persistidos, não precisa fazer mais nada
        return;
      }
      
      // Só resetar dados se o período realmente mudou (não na primeira carga ou troca de aba)
      if (periodoAnterior !== null && periodoAnterior !== periodoSelecionado) {
        console.log('🔄 Período mudou, resetando dados...');
        // Resetar demonstrativo quando período mudar
        setDemonstrativoGerado(false);
        localStorage.setItem('demonstrativoGerado', 'false');
        
        // Resetar contadores de relatórios e emails quando período mudar
        setRelatoriosGerados(0);
        setEmailsEnviados(0);
        localStorage.setItem('relatoriosGerados', '0');
        localStorage.setItem('emailsEnviados', '0');
        sessionStorage.removeItem('resultadosFaturamento');
        setResultados([]);
      }
      
      // Se não conseguiu carregar do banco, carregar clientes normalmente
      console.log('⚠️ Sem dados persistidos, carregando clientes da volumetria...');
      carregarClientes();
    };
    
    // Atualizar período anterior
    setPeriodoAnterior(periodoSelecionado);
    
    // Executar carregamento
    carregarDados();
  }, [periodoSelecionado, carregarResultadosDB]);

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
          setResultados(prev => {
            const novosResultados = prev.map(resultado => 
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
            );
            
            // Salvar no banco de dados
            salvarResultadosDB(novosResultados);
            return novosResultados;
          });

          gerados++;
          
        } catch (error) {
          console.error(`Erro ao gerar relatório para ${cliente.nome}:`, error);
          errors++;
          
          // Atualizar resultado com erro
          setResultados(prev => {
            const novosResultados = prev.map(resultado => 
              resultado.clienteId === cliente.id 
                ? {
                    ...resultado,
                    relatorioGerado: false,
                    erro: error instanceof Error ? error.message : 'Erro desconhecido',
                    dataProcessamento: new Date().toLocaleString('pt-BR')
                  }
                : resultado
            );
            
            // Salvar no banco de dados
            salvarResultadosDB(novosResultados);
            return novosResultados;
          });
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
                {resultados.filter(r => r.erro && r.erro.trim()).length > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-red-600">Erros</span>
                      <span className="text-sm font-bold text-red-600">
                        {resultados.filter(r => r.erro && r.erro.trim()).length} de {clientesCarregados.length}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-red-400 to-red-600 transition-all duration-1000 ease-out"
                        style={{ 
                          width: clientesCarregados.length > 0 
                            ? `${Math.min(100, (resultados.filter(r => r.erro && r.erro.trim()).length / clientesCarregados.length) * 100)}%` 
                            : '0%' 
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Status dos Relatórios por Cliente - Com Filtros */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle>Status dos Relatórios por Cliente</CardTitle>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Filtrar por cliente..."
                      value={filtroClienteRelatorios}
                      onChange={(e) => setFiltroClienteRelatorios(e.target.value)}
                      className="pl-10 w-60"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOrdemAlfabeticaRelatorios(!ordemAlfabeticaRelatorios)}
                  >
                    {ordemAlfabeticaRelatorios ? 'Z-A' : 'A-Z'}
                  </Button>
                </div>
              </div>
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
                    {resultadosFiltradosRelatorios.map((resultado) => (
                      <tr key={resultado.clienteId} className="border-b">
                        <td className="p-3 font-medium">{resultado.clienteNome}</td>
                         <td className="p-3">
                           {resultado.arquivos && resultado.arquivos.length > 0 ? (
                             <div className="flex flex-col space-y-1">
                               {resultado.arquivos.map((arquivo, index) => (
                                 <a
                                   key={index}
                                   href={arquivo.url}
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
              {resultados.length > 0 && resultados.some(r => r.erro && r.erro.trim()) && (
                <div className="mt-4 space-y-2">
                  <h4 className="font-semibold text-red-600 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Erros Encontrados ({resultados.filter(r => r.erro && r.erro.trim()).length}):
                  </h4>
                   {resultados.filter(r => r.erro && r.erro.trim()).map(resultado => (
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

          {/* Status por Cliente - Com Filtros */}
          {resultados.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <CardTitle>Status por Cliente</CardTitle>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Filtrar por cliente..."
                        value={filtroClienteStatus}
                        onChange={(e) => setFiltroClienteStatus(e.target.value)}
                        className="pl-10 w-60"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOrdemAlfabeticaStatus(!ordemAlfabeticaStatus)}
                    >
                      {ordemAlfabeticaStatus ? 'Z-A' : 'A-Z'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3">Cliente</th>
                        <th className="text-center p-3">Status Demonstrativo</th>
                        <th className="text-center p-3">Status Relatório</th>
                        <th className="text-center p-3">Status E-mail</th>
                        <th className="text-left p-3">Link PDF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultadosFiltradosStatus.map((resultado) => (
                        <tr key={resultado.clienteId} className="border-b">
                          <td className="p-3 font-medium">{resultado.clienteNome}</td>
                          <td className="p-3 text-center">
                            {demonstrativoGerado ? (
                              <Badge variant="default" className="bg-green-600">
                                Concluído
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                Pendente
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {resultado.relatorioGerado ? (
                              <Badge variant="default" className="bg-green-600">
                                Concluído
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                Pendente
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {resultado.emailEnviado ? (
                              <Badge variant="default" className="bg-green-600">
                                Concluído
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                Pendente
                              </Badge>
                            )}
                          </td>
                          <td className="p-3">
                            {resultado.arquivos && resultado.arquivos.length > 0 ? (
                              <div className="flex flex-col space-y-1">
                                {resultado.arquivos.map((arquivo, index) => (
                                  <a
                                    key={index}
                                    href={arquivo.url}
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
                                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Ver PDF
                              </a>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
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