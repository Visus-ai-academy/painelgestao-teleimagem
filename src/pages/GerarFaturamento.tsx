import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { DemonstrativoFaturamentoCompleto } from "@/components/DemonstrativoFaturamentoCompleto";
import { ControleFechamentoFaturamento } from '@/components/ControleFechamentoFaturamento';
import ListaExamesPeriodo from "@/components/faturamento/ListaExamesPeriodo";
import { ExamesValoresZerados } from "@/components/ExamesValorezrados";
import { DiagnosticoClientePrecos } from "@/components/DiagnosticoClientePrecos";

import { generatePDF, downloadPDF, type FaturamentoData } from "@/lib/pdfUtils";

// Período atual - onde estão os dados carregados (junho/2025)
const PERIODO_ATUAL = "2025-06";

export default function GerarFaturamento() {
  const [activeTab, setActiveTab] = useState("gerar");
  
  // Ensure activeTab never gets set to removed values
  const safeSetActiveTab = (value: string) => {
    const validTabs = ["gerar", "demonstrativo", "relatorios", "analise", "fechamento"];
    if (validTabs.includes(value)) {
      setActiveTab(value);
    } else {
      setActiveTab("gerar"); // fallback to default
    }
  };

  // Estado para controlar clientes selecionados para NF
  const [clientesSelecionadosNF, setClientesSelecionadosNF] = useState<Set<string>>(new Set());
  // Estados persistentes que não devem zerar ao trocar de aba
  const [relatoriosGerados, setRelatoriosGerados] = useState(() => {
    const saved = localStorage.getItem('relatoriosGerados');
    return saved ? parseInt(saved) : 0;
  });
  const [emailsEnviados, setEmailsEnviados] = useState(() => {
    const saved = localStorage.getItem('emailsEnviados');
    return saved ? parseInt(saved) : 0;
  });
  const [nfsGeradas, setNfsGeradas] = useState(() => {
    const saved = localStorage.getItem('nfsGeradas');
    return saved ? parseInt(saved) : 0;
  });
  
  const [processandoTodos, setProcessandoTodos] = useState(false);
  const [gerandoRelatorios, setGerandoRelatorios] = useState(false);
  const [enviandoEmails, setEnviandoEmails] = useState(false);
  const [gerandoNFOmie, setGerandoNFOmie] = useState(false);
  const [resetandoNFOmie, setResetandoNFOmie] = useState(false);
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
  const [demonstrativosGeradosPorCliente, setDemonstrativosGeradosPorCliente] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(`demonstrativosGerados_${periodoSelecionado}`);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [demonstrativoGerado, setDemonstrativoGerado] = useState(false);
  
  // Verificar se há dados de faturamento processados para este período
  const verificarDemonstrativoGerado = useCallback(async () => {
    if (!periodoSelecionado) return;
    
    // 1) Verificar demonstrativos salvos no localStorage
    try {
      const saved = localStorage.getItem(`demonstrativos_completos_${periodoSelecionado}`);
      if (saved) {
        const dados = JSON.parse(saved);
        const temLocal = Array.isArray(dados?.demonstrativos) && dados.demonstrativos.length > 0;
        if (temLocal) {
          setDemonstrativoGerado(true);
          console.log('🎯 Demonstrativo encontrado no localStorage para', periodoSelecionado);
          return;
        }
      }
    } catch (e) {
      console.warn('Falha ao ler demonstrativos do localStorage:', e);
    }
    
    // 2) Fallback: verificar na tabela de faturamento (DB)
    try {
      const { count } = await supabase
        .from('faturamento')
        .select('cliente_nome', { count: 'exact', head: true })
        .eq('periodo_referencia', periodoSelecionado);
      
      const temDados = !!count && count > 0;
      setDemonstrativoGerado(temDados);
      console.log('🎯 Demonstrativo (DB) gerado:', temDados, 'registros:', count, 'período:', periodoSelecionado);
    } catch (error) {
      console.error('Erro ao verificar demonstrativo (DB):', error);
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
    tipo_faturamento?: string;
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
    omieNFGerada?: boolean;
    omieCodigoPedido?: string;
    omieNumeroPedido?: string;
    dataGeracaoNFOmie?: string;
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
    // Primeiro, remover duplicatas por clienteNome (mais confiável que clienteId)
    const uniqueResults = resultados.filter((resultado, index, array) => 
      array.findIndex(r => r.clienteNome === resultado.clienteNome) === index
    );
    
    // Não filtrar por tipo_faturamento aqui - a filtragem de clientes inativos/cancelados
    // já acontece no carregamento dos dados do banco (carregarResultadosDB)
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
      // Função para validar e converter data
      const converterDataSegura = (dataStr: any): string | null => {
        if (!dataStr) return null;
        
        try {
          // Se já é uma string de data ISO, usar direto
          if (typeof dataStr === 'string' && dataStr.includes('T')) {
            const date = new Date(dataStr);
            return isNaN(date.getTime()) ? null : date.toISOString();
          }
          
          // Se é uma string de data brasileira, converter
          if (typeof dataStr === 'string' && dataStr.includes('/')) {
            const [datePart, timePart] = dataStr.split(',').map(s => s.trim());
            const [day, month, year] = datePart.split('/');
            const dateISO = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            
            if (timePart) {
              const date = new Date(`${dateISO}T${timePart}`);
              return isNaN(date.getTime()) ? null : date.toISOString();
            } else {
              const date = new Date(dateISO);
              return isNaN(date.getTime()) ? null : date.toISOString();
            }
          }
          
          // Tentar converter diretamente
          const date = new Date(dataStr);
          return isNaN(date.getTime()) ? null : date.toISOString();
        } catch (error) {
          console.warn('Erro ao converter data:', dataStr, error);
          return null;
        }
      };

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
        data_processamento: converterDataSegura(resultado.dataProcessamento),
        data_geracao_relatorio: resultado.relatorioGerado ? new Date().toISOString() : null,
        data_envio_email: resultado.emailEnviado ? new Date().toISOString() : null,
        detalhes_relatorio: resultado.relatorioData ? JSON.stringify(resultado.relatorioData) : null
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
      
      // Atualizar contadores (deduplicados por cliente) e persistir no localStorage
      const resultadosUnicos = Array.from(new Map(novosResultados.map(r => [(r.clienteId || r.clienteNome), r])).values());
      const relatoriosGerados = resultadosUnicos.filter(r => r.relatorioGerado).length;
      const emailsEnviados = resultadosUnicos.filter(r => r.emailEnviado).length;
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
        // Primeira consulta: buscar relatorios com JOIN para filtrar clientes ativos
        const { data, error } = await supabase
        .from('relatorios_faturamento_status')
        .select(`
          *,
          clientes!inner(id, nome)
        `)
        .eq('periodo', periodoSelecionado)
        .order('cliente_nome');

      if (error) throw error;

      if (data && data.length > 0) {
        // Segunda consulta: buscar parâmetros para filtrar clientes inativos/cancelados
        const clienteIds = data.map(item => item.cliente_id).filter(Boolean);
        const { data: parametrosData } = await supabase
          .from('parametros_faturamento')
          .select('cliente_id, status')
          .in('cliente_id', clienteIds);

        // Filtrar clientes que NÃO têm status Inativo (I) ou Cancelado (C) nos parâmetros
        const dataFiltrada = data.filter(item => {
          const parametros = parametrosData?.filter(p => p.cliente_id === item.cliente_id);
          if (!parametros || parametros.length === 0) return true; // Se não tem parâmetros, incluir
          
          // Se tem parâmetros, excluir apenas se TODOS são Inativos ou Cancelados
          const todosInativos = parametros.every((p: any) => 
            p.status === 'I' || p.status === 'C'
          );
          
          return !todosInativos;
        });

        const resultadosCarregados = dataFiltrada.map(item => ({
          clienteId: item.cliente_id,
          clienteNome: item.cliente_nome,
          relatorioGerado: item.relatorio_gerado,
          emailEnviado: item.email_enviado,
          emailDestino: item.email_destino,
          linkRelatorio: item.link_relatorio || undefined,
          erro: item.erro || undefined,
          erroEmail: item.erro_email || undefined,
          dataProcessamento: item.data_processamento ? new Date(item.data_processamento).toLocaleString('pt-BR') : undefined,
          detalhesRelatorio: item.detalhes_relatorio ? (typeof item.detalhes_relatorio === 'string' ? JSON.parse(item.detalhes_relatorio) : item.detalhes_relatorio) : undefined,
          omieNFGerada: item.omie_nf_gerada || false,
          omieCodigoPedido: item.omie_codigo_pedido || undefined,
          omieNumeroPedido: item.omie_numero_pedido || undefined,
          dataGeracaoNFOmie: item.data_geracao_nf_omie ? new Date(item.data_geracao_nf_omie).toLocaleString('pt-BR') : undefined
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
          
          // Atualizar contador de NFs geradas
          const nfsGeradas = resultadosCarregados.filter(r => r.omieNFGerada).length;
          setNfsGeradas(nfsGeradas);
          localStorage.setItem('nfsGeradas', nfsGeradas.toString());
        
        return true; // Indica que dados foram carregados do DB
      }
    } catch (error) {
      console.error('Erro ao carregar resultados do banco:', error);
    }
    
    // Fallback para sessionStorage
    try {
      const saved = sessionStorage.getItem('resultadosFaturamento');
      const ultimoEstado = localStorage.getItem('ultimoEstadoResultados');
      
      // Priorizar último estado salvo (preserva status)
      const dadosParaCarregar = ultimoEstado || saved;
      
      if (dadosParaCarregar) {
        const resultadosCarregados = JSON.parse(dadosParaCarregar);
        setResultados(resultadosCarregados);
        
        const resultadosUnicos = Array.from(new Map(resultadosCarregados.map((r: any) => [(r.clienteId || r.clienteNome), r])).values());
        const relatoriosGerados = resultadosUnicos.filter((r: any) => r.relatorioGerado).length;
        const emailsEnviados = resultadosUnicos.filter((r: any) => r.emailEnviado).length;
        const nfsGeradas = resultadosUnicos.filter((r: any) => r.omieNFGerada).length;
        
        setRelatoriosGerados(relatoriosGerados);
        setEmailsEnviados(emailsEnviados);
        setNfsGeradas(nfsGeradas);
        
        // Persistir contadores no localStorage
        localStorage.setItem('relatoriosGerados', relatoriosGerados.toString());
        localStorage.setItem('emailsEnviados', emailsEnviados.toString());
        localStorage.setItem('nfsGeradas', nfsGeradas.toString());
        
        console.log(`✅ Status preservado: ${ultimoEstado ? 'último estado' : 'sessionStorage'} - ${resultadosCarregados.length} registros`);
        
        return true;
      }
    } catch (sessionError) {
      console.warn('Erro ao carregar do sessionStorage:', sessionError);
    }
    
    return false; // Nenhum dado foi carregado
  }, [periodoSelecionado]);
  
  const { toast } = useToast();

  // Resolver cliente_id válido a partir do nome quando necessário
  const resolveClienteId = useCallback(async (idAtual: string | undefined, nomeCliente: string): Promise<string | undefined> => {
    const isUuid = (v?: string) => !!v && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
    if (isUuid(idAtual)) return idAtual as string;
    try {
      let { data: c1 } = await supabase
        .from('clientes')
        .select('id')
        .eq('nome', nomeCliente)
        .maybeSingle();
      if (c1?.id) return c1.id as string;

      let { data: c2 } = await supabase
        .from('clientes')
        .select('id')
        .eq('nome_fantasia', nomeCliente)
        .maybeSingle();
      if (c2?.id) return c2.id as string;

      let { data: c3 } = await supabase
        .from('clientes')
        .select('id')
        .eq('nome_mobilemed', nomeCliente)
        .maybeSingle();
      if (c3?.id) return c3.id as string;
    } catch (e) {
      console.warn('Falha ao resolver cliente_id para', nomeCliente, e);
    }
    return undefined;
  }, []);


  // Função para carregar clientes da base de dados
  const carregarClientes = useCallback(async () => {
    try {
      console.log('🔍 Carregando clientes para período:', periodoSelecionado);
      
      // ✅ PRIORIZAR DADOS DOS DEMONSTRATIVOS SALVOS
      const demonstrativosCompletos = localStorage.getItem(`demonstrativos_completos_${periodoSelecionado}`);
      if (demonstrativosCompletos) {
        try {
          const dados = JSON.parse(demonstrativosCompletos);
          if (dados.demonstrativos && Array.isArray(dados.demonstrativos) && dados.demonstrativos.length > 0) {
            const clientesDoDemonstrativo = dados.demonstrativos.map((demo: any) => ({
              id: demo.cliente_id || `temp-${demo.cliente_nome}`,
              nome: demo.cliente_nome || demo.nome_cliente,
              email: demo.cliente_email || demo.email_cliente || `${(demo.cliente_nome || '').toLowerCase().replace(/[^a-z0-9]/g, '')}@cliente.com`
            }));
            
            console.log(`✅ Clientes carregados dos demonstrativos salvos: ${clientesDoDemonstrativo.length}`);
            setClientesCarregados(clientesDoDemonstrativo);
            localStorage.setItem('clientesCarregados', JSON.stringify(clientesDoDemonstrativo));

            // Inicializar resultados base para todos os clientes dos demonstrativos
            const resultadosBase = clientesDoDemonstrativo.map((cliente: any) => ({
              clienteId: cliente.id,
              clienteNome: cliente.nome,
              relatorioGerado: false,
              emailEnviado: false,
              emailDestino: cliente.email,
              tipo_faturamento: cliente.tipo_faturamento || 'Não definido'
            }));
            setResultados(resultadosBase);
            salvarResultadosDB(resultadosBase);
            return;
          }
        } catch (error) {
          console.error('Erro ao processar demonstrativos do localStorage:', error);
        }
      }
      
      // Fallback: Buscar da volumetria se não há demonstrativos
      const { data: clientesVolumetria, error: errorVolumetria } = await supabase
        .from('volumetria_mobilemed')
        .select('"Cliente_Nome_Fantasia", "EMPRESA"')
        .eq('periodo_referencia', periodoSelecionado)
        .not('"EMPRESA"', 'is', null)
        .not('"EMPRESA"', 'eq', '')
        .limit(50000); // Aumentar limite explicitamente

      console.log(`🔍 Consulta volumetria retornou ${clientesVolumetria?.length || 0} registros para período ${periodoSelecionado}`);

      if (errorVolumetria) {
        console.error('❌ Erro na consulta volumetria:', errorVolumetria);
        throw errorVolumetria;
      }

      let clientesFinais: any[] = [];
      
      if (clientesVolumetria && clientesVolumetria.length > 0) {
        // ✅ USAR Cliente_Nome_Fantasia quando disponível, senão EMPRESA
        let nomesUnicos = [...new Set(clientesVolumetria.map(c => c.Cliente_Nome_Fantasia || c.EMPRESA).filter(Boolean))];
        console.log(`📊 Clientes únicos encontrados na volumetria (inicial): ${nomesUnicos.length}`, nomesUnicos.slice(0, 10).concat(nomesUnicos.length > 10 ? ['...'] : []));

        // 🔎 Remover clientes NC-NF (via parâmetros ou contrato) da lista
        try {
          // Buscar IDs com tipo NC-NF nos parâmetros ativos
          const { data: pfNC } = await supabase
            .from('parametros_faturamento')
            .select('cliente_id')
            .eq('status', 'A')
            .eq('tipo_faturamento', 'NC-NF');

          // Buscar IDs com tipo NC-NF em contratos ativos
          const { data: ccNC } = await supabase
            .from('contratos_clientes')
            .select('cliente_id')
            .eq('status', 'ativo')
            .eq('tipo_faturamento', 'NC-NF');

          const idsNC = Array.from(new Set([...(pfNC?.map(p => p.cliente_id) || []), ...(ccNC?.map(c => c.cliente_id) || [])].filter(Boolean)));
          console.log(`🔍 IDs de clientes NC-NF encontrados: ${idsNC.length}`, idsNC);

          let nomesNC = new Set<string>();
          if (idsNC.length > 0) {
            const { data: clientesNC } = await supabase
              .from('clientes')
              .select('nome, nome_fantasia, nome_mobilemed')
              .in('id', idsNC);
            
            console.log(`🔍 Clientes NC-NF para filtrar:`, clientesNC);
            
            const normalize = (s?: string) => (s || '').trim().toUpperCase();
            (clientesNC || []).forEach(c => {
              [c.nome, c.nome_fantasia, c.nome_mobilemed].forEach(n => {
                const k = normalize(n);
                if (k) {
                  nomesNC.add(k);
                  console.log(`🚫 Adicionando cliente NC-NF para filtrar: ${k}`);
                }
              });
            });
          }

          console.log(`🔍 Total de nomes NC-NF para filtrar: ${nomesNC.size}`, Array.from(nomesNC));
          const nomesAntesDoFiltro = nomesUnicos.length;
          
          const normalize = (s?: string) => (s || '').trim().toUpperCase();
          nomesUnicos = nomesUnicos.filter(n => {
            const normalizado = normalize(n);
            const deveFiltrar = nomesNC.has(normalizado);
            if (deveFiltrar) {
              console.log(`🚫 Filtrando cliente NC-NF: ${n} (${normalizado})`);
            }
            return !deveFiltrar;
          });
          
          console.log(`📊 Filtro NC-NF: ${nomesAntesDoFiltro} → ${nomesUnicos.length} clientes (removidos: ${nomesAntesDoFiltro - nomesUnicos.length})`);
        } catch (e) {
          console.warn('Falha ao filtrar NC-NF:', e);
        }

        console.log(`📊 Clientes únicos após filtrar NC-NF: ${nomesUnicos.length}`);

        // Preparar arrays auxiliares
        const clientesTemp: any[] = [];
        const clientesProcessadosSet = new Set<string>();
        
        for (const nomeCliente of nomesUnicos) {
          if (clientesProcessadosSet.has(nomeCliente.trim().toUpperCase())) {
            continue;
          }
          clientesProcessadosSet.add(nomeCliente.trim().toUpperCase());
          
          const { data: emailCliente } = await supabase
            .from('clientes')
            .select('id, nome, email, nome_fantasia, nome_mobilemed')
            .or(`nome.eq.${nomeCliente},nome_fantasia.eq.${nomeCliente},nome_mobilemed.eq.${nomeCliente}`)
            .limit(1);

          // Função para gerar UUID válido ou usar nome como string
          const gerarIdValido = (nomeCliente: string): string => {
            // Verificar se é um UUID válido
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            
            // Primeiro, tentar buscar o cliente no cadastro
            return `cliente-${nomeCliente.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 30)}`;
          };

          const clienteId = emailCliente?.[0]?.id || gerarIdValido(nomeCliente);
          
          clientesTemp.push({
            id: clienteId,
            nome: nomeCliente,
            email: emailCliente?.[0]?.email || `${nomeCliente.toLowerCase().replace(/[^a-z0-9]/g, '')}@cliente.com`
          });
        }
        
        // ✅ Deduplificar clientes por nome (não por ID que pode ser temporário)
        const clientesUnicos = new Map();
        clientesTemp.forEach(cliente => {
          const chaveUnica = cliente.nome.trim().toUpperCase();
          if (!clientesUnicos.has(chaveUnica)) {
            clientesUnicos.set(chaveUnica, cliente);
          }
        });
        clientesFinais = Array.from(clientesUnicos.values());
        console.log(`✅ Clientes finais após deduplicação: ${clientesFinais.length}`, clientesFinais.map(c => c.nome));
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
        emailDestino: cliente.email,
        tipo_faturamento: 'CO-FT' // Assumir CO-FT para clientes da volumetria que não foram filtrados
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
  }, [periodoSelecionado, toast, salvarResultadosDB]); // Dependências do useCallback

  // Carregar clientes automaticamente quando período mudar
  useEffect(() => {
    if (periodoSelecionado) {
      console.log('🔄 Período alterado para:', periodoSelecionado, '- carregando clientes automaticamente...');
      carregarClientes();
    }
  }, [periodoSelecionado, carregarClientes]);

  // Carregar dados salvos na inicialização
  useEffect(() => {
    carregarResultadosDB();
  }, [carregarResultadosDB]);

  // Carregar demonstrativos do período atual no mount
  useEffect(() => {
    const carregarDemonstrativosDoLocalStorage = () => {
      const saved = localStorage.getItem(`demonstrativosGerados_${periodoSelecionado}`);
      if (saved) {
        const clientesCarregados = JSON.parse(saved);
        setDemonstrativosGeradosPorCliente(new Set(clientesCarregados));
      }
    };
    
    carregarDemonstrativosDoLocalStorage();
  }, [periodoSelecionado]);

  // Preservar status ao sair da página
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (resultados.length > 0) {
        const dadosLeves = resultados.map(({ relatorioData, ...resto }) => resto);
        sessionStorage.setItem('resultadosFaturamento', JSON.stringify(dadosLeves));
        localStorage.setItem('ultimoEstadoResultados', JSON.stringify(dadosLeves));
        
        // Também salvar status de demonstrativos, relatórios, emails e NFs
        const clientesComDemonstrativo = Array.from(demonstrativosGeradosPorCliente);
        localStorage.setItem(`demonstrativosGerados_${periodoSelecionado}`, JSON.stringify(clientesComDemonstrativo));
        
        const relatoriosGerados = resultados.filter(r => r.relatorioGerado).length;
        const emailsEnviados = resultados.filter(r => r.emailEnviado).length;
        const nfsGeradas = resultados.filter(r => r.omieNFGerada).length;
        
        localStorage.setItem('relatoriosGerados', relatoriosGerados.toString());
        localStorage.setItem('emailsEnviados', emailsEnviados.toString());
        localStorage.setItem('nfsGeradas', nfsGeradas.toString());
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [resultados]);

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
        .select('"Cliente_Nome_Fantasia", "EMPRESA"')
        .eq('periodo_referencia', periodoSelecionado)
        .not('"EMPRESA"', 'is', null);

      if (errorVolumetria) {
        throw new Error('Erro ao consultar volumetria: ' + errorVolumetria.message);
      }

      const clientesUnicosVolumetria = [...new Set(clientesVolumetria?.map(c => c.Cliente_Nome_Fantasia || c.EMPRESA).filter(Boolean) || [])];
      console.log('📊 [VOLUMETRIA] Clientes únicos encontrados:', clientesUnicosVolumetria.length, clientesUnicosVolumetria);

      if (clientesUnicosVolumetria.length === 0) {
        throw new Error(`Nenhum cliente encontrado na volumetria para o período ${periodoSelecionado}`);
      }

      setStatusProcessamento({
        processando: true,
        mensagem: `Processando ${clientesUnicosVolumetria.length} clientes da volumetria...`,
        progresso: 30
      });

      console.log('📡 [EDGE_FUNCTION] Chamando gerar-demonstrativos-faturamento em lotes para período:', periodoSelecionado);

      // Processar em lotes para evitar timeout da Edge Function
      const chunkSize = 20;
      const chunks: string[][] = [];
      for (let i = 0; i < clientesUnicosVolumetria.length; i += chunkSize) {
        chunks.push(clientesUnicosVolumetria.slice(i, i + chunkSize));
      }

      const todosDemonstrativos: any[] = [];
      const todosAlertas: string[] = [];
      let clientesProcessados = 0;

      for (let i = 0; i < chunks.length; i++) {
        const lote = chunks[i];
        setStatusProcessamento({
          processando: true,
          mensagem: `Processando lote ${i + 1}/${chunks.length} (${lote.length} clientes)...`,
          progresso: 30 + Math.round(((i) / chunks.length) * 35)
        });

        const { data, error } = await supabase.functions.invoke('gerar-demonstrativos-faturamento', {
          body: {
            periodo: periodoSelecionado,
            clientes: lote
          }
        });

        console.log(`[LOTE ${i + 1}/${chunks.length}] Data:`, data);
        console.log(`[LOTE ${i + 1}/${chunks.length}] Error:`, error);

        if (error || !data?.success) {
          console.error('❌ [ERRO] Erro na edge function (lote):', error?.message || data?.error);
          throw new Error(error?.message || data?.error || 'Erro ao gerar demonstrativos');
        }

        clientesProcessados += data?.resumo?.clientes_processados || 0;
        todosDemonstrativos.push(...(data?.demonstrativos || []));
        if (Array.isArray(data?.alertas)) todosAlertas.push(...data.alertas);
      }

      // Montar resumo combinado e salvar no localStorage para manter fluxo atual
      const resumoCombinado = {
        total_clientes: clientesUnicosVolumetria.length,
        clientes_processados: clientesProcessados,
        total_exames_geral: todosDemonstrativos.reduce((s, d) => s + (d.total_exames || 0), 0),
        valor_bruto_geral: todosDemonstrativos.reduce((s, d) => s + (d.valor_bruto || 0), 0),
        valor_impostos_geral: todosDemonstrativos.reduce((s, d) => s + (d.valor_impostos || 0), 0),
        valor_total_geral: todosDemonstrativos.reduce((s, d) => s + (d.valor_total || 0), 0),
        valor_exames_geral: todosDemonstrativos.reduce((s, d) => s + (d.valor_exames || 0), 0),
        valor_franquias_geral: todosDemonstrativos.reduce((s, d) => s + (d.valor_franquia || 0), 0),
        valor_portal_geral: todosDemonstrativos.reduce((s, d) => s + (d.valor_portal_laudos || 0), 0),
        valor_integracao_geral: todosDemonstrativos.reduce((s, d) => s + (d.valor_integracao || 0), 0),
      };

      const dadosParaSalvar = {
        demonstrativos: todosDemonstrativos,
        resumo: resumoCombinado,
        periodo: periodoSelecionado,
        alertas: todosAlertas,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(`demonstrativos_completos_${periodoSelecionado}`, JSON.stringify(dadosParaSalvar));
      console.log(`💾 Dados combinados salvos no localStorage. Lotes: ${chunks.length}, Processados: ${clientesProcessados}`);

      setStatusProcessamento({
        processando: true,
        mensagem: 'Verificando se todos os clientes foram processados...',
        progresso: 70
      });

      // Aguardar e verificar se demonstrativos foram salvos no localStorage
      console.log('🔍 [VERIFICACAO] Aguardando geração dos demonstrativos...');
      
      let tentativas = 0;
      const maxTentativas = 20; // 20 tentativas = até 1 minuto
      let demonstrativosSalvos = false;
      
      while (tentativas < maxTentativas && !demonstrativosSalvos) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // Aguardar 3 segundos
        tentativas++;
        
        setStatusProcessamento({
          processando: true,
          mensagem: `Verificando demonstrativos gerados... (${tentativas}/${maxTentativas})`,
          progresso: 70 + ((tentativas / maxTentativas) * 20)
        });

        console.log(`🔍 [VERIFICACAO] Tentativa ${tentativas}/${maxTentativas} - Verificando localStorage...`);
        
        // Verificar se demonstrativos foram salvos no localStorage corretamente
        const demonstrativosLocalStorage = localStorage.getItem(`demonstrativos_completos_${periodoSelecionado}`);
        if (demonstrativosLocalStorage) {
          try {
            const dados = JSON.parse(demonstrativosLocalStorage);
            if (dados.demonstrativos && dados.demonstrativos.length > 0) {
              console.log(`✅ [SUCESSO] Demonstrativos encontrados no localStorage: ${dados.demonstrativos.length} clientes`);
              demonstrativosSalvos = true;
              break;
            }
          } catch (error) {
            console.warn('⚠️ [AVISO] Erro ao verificar localStorage:', error);
          }
        }
        
        console.log(`⏳ [AGUARDANDO] Tentativa ${tentativas}: ainda sem demonstrativos salvos, aguardando...`);
      }

      if (!demonstrativosSalvos) {
        console.warn('⚠️ [TIMEOUT] Geração de demonstrativos não concluída dentro do tempo limite');
        throw new Error('Timeout: A geração dos demonstrativos demorou mais que 1 minuto. Tente novamente.');
      }

      // Marcar demonstrativo como gerado
      setDemonstrativoGerado(true);
      localStorage.setItem('demonstrativoGerado', 'true');

      // ✅ Atualizar demonstrativosGeradosPorCliente com os clientes que tiveram demonstrativos gerados
      const clientesComDemonstrativo = todosDemonstrativos.map(d => d.cliente_nome).filter(Boolean);
      const novosClientes = new Set(clientesComDemonstrativo);
      setDemonstrativosGeradosPorCliente(novosClientes);
      // Persistir no localStorage
      localStorage.setItem(`demonstrativosGerados_${periodoSelecionado}`, JSON.stringify(Array.from(novosClientes)));

      setStatusProcessamento({
        processando: false,
        mensagem: 'Demonstrativo gerado com sucesso!',
        progresso: 100
      });

      toast({
        title: "Demonstrativo gerado!",
        description: `Demonstrativos completos gerados com sucesso para o período ${periodoSelecionado}`,
        variant: "default",
      });

      // ✅ Mostrar alertas se houver clientes inativos com volumetria
      if (todosAlertas && todosAlertas.length > 0) {
        setTimeout(() => {
          toast({
            title: "⚠️ Alertas de Segurança",
            description: `${todosAlertas.length} cliente(s) inativo(s)/cancelado(s) com volumetria detectado(s). Verifique os detalhes no demonstrativo.`,
            variant: "destructive",
          });
        }, 1000);
      }

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
    if (gerandoRelatorios) {
      toast({
        title: "Aguarde a geração dos relatórios",
        description: "Finalize a Etapa 2 antes de enviar os e-mails (Etapa 3)",
        variant: "destructive",
      });
      return;
    }
    const relatóriosParaEnviar = resultados.filter(r => r.relatorioGerado && !r.emailEnviado); 
    
    if (relatóriosParaEnviar.length === 0) {
      toast({
        title: "Nenhum relatório para enviar",
        description: "Todos os relatórios já foram enviados ou ainda não foram gerados",
        variant: "destructive",
      });
      return;
    }

    setEnviandoEmails(true);
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
      setEnviandoEmails(false);
    }
  };

  // Função para gerar NF no Omie (LIMITADA PARA TESTE)
  const gerarNFOmie = async () => {
    if (gerandoNFOmie) return;
    
    // Verificar se há clientes selecionados
    if (clientesSelecionadosNF.size === 0) {
      toast({
        title: "Nenhum cliente selecionado",
        description: "Selecione pelo menos um cliente para gerar a NF",
        variant: "destructive",
      });
      return;
    }

    // ✅ CLIENTES PERMITIDOS PARA TESTE DE EMISSÃO DE NF
    const clientesPermitidosParaTeste = ['COT', 'CORTREL', 'CORTEL', 'IMDBATATAIS', 'BROOKLIN'];
    
    // Filtrar apenas clientes selecionados que têm relatório gerado e não têm NF
    const clientesSelecionadosArray = Array.from(clientesSelecionadosNF);
    const clientesComRelatorio = resultados.filter(r => 
      clientesSelecionadosArray.includes(r.clienteNome) && 
      r.relatorioGerado && 
      !r.omieNFGerada
    );
    
    if (clientesComRelatorio.length === 0) {
      toast({
        title: "Nenhum cliente válido selecionado",
        description: "Os clientes selecionados não possuem relatório gerado ou já têm NF emitida",
        variant: "destructive",
      });
      return;
    }
    
    // ✅ FILTRAR APENAS OS CLIENTES PERMITIDOS PARA TESTE
    const clientesParaNF = clientesComRelatorio.filter(cliente => {
      const nomeClienteUpper = cliente.clienteNome.toUpperCase().trim();
      return clientesPermitidosParaTeste.some(permitido => 
        nomeClienteUpper.includes(permitido.toUpperCase())
      );
    });
    
    if (clientesParaNF.length === 0) {
      const clientesExcluidos = clientesComRelatorio.length;
      toast({
        title: "Clientes não autorizados para teste",
        description: `A emissão de NF está limitada para teste apenas aos clientes: ${clientesPermitidosParaTeste.join(', ')}. ${clientesExcluidos} cliente(s) selecionado(s) foram ignorados.`,
        variant: "destructive",
      });
      return;
    }
    
    if (clientesParaNF.length < clientesComRelatorio.length) {
      const totalExcluidos = clientesComRelatorio.length - clientesParaNF.length;
      toast({
        title: "Processamento Parcial - Modo de Teste",
        description: `Processando ${clientesParaNF.length} cliente(s) de teste. ${totalExcluidos} cliente(s) foram ignorados (limitação de teste).`,
        variant: "default",
      });
    }

    console.log(`🚀 Gerando NFs para ${clientesParaNF.length} clientes selecionados:`, clientesParaNF.map(c => c.clienteNome));

    setGerandoNFOmie(true);

    try {
      console.log('Gerando NFs no Omie para período:', periodoSelecionado);

      const response = await supabase.functions.invoke('gerar-nf-omie', {
        body: {
          periodo: periodoSelecionado,
          clientes: clientesParaNF.map(c => c.clienteNome) // ✅ Usar apenas clientes selecionados e permitidos
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro na chamada da função');
      }

      const { data } = response;
      
      if (!data.success) {
        throw new Error(data.error || 'Erro no processamento das NFs');
      }

      // Atualizar resultados locais com informações das NFs geradas
      setResultados(prev => {
        const novosResultados = prev.map(resultado => {
          const nfInfo = data.resultados.find((nf: any) => nf.cliente === resultado.clienteNome);
          if (nfInfo?.sucesso) {
            return {
              ...resultado,
              omieNFGerada: true,
              omieCodigoPedido: nfInfo.codigo_pedido_omie,
              omieNumeroPedido: nfInfo.numero_pedido_omie,
              dataGeracaoNFOmie: new Date().toLocaleString('pt-BR')
            };
          }
          return resultado;
        });
        
        // Salvar no banco de dados
        salvarResultadosDB(novosResultados);
        return novosResultados;
      });

      // Limpar seleção dos clientes processados com sucesso
      const clientesProcessados = data.resultados.filter((nf: any) => nf.sucesso).map((nf: any) => nf.cliente);
      setClientesSelecionadosNF(prev => {
        const novaSelecao = new Set(prev);
        clientesProcessados.forEach((cliente: string) => novaSelecao.delete(cliente));
        return novaSelecao;
      });

      setNfsGeradas(prev => prev + data.sucessos);
      localStorage.setItem('nfsGeradas', (nfsGeradas + data.sucessos).toString());

      toast({
        title: "NFs geradas no Omie!",
        description: `${data.sucessos} NFs geradas com sucesso${data.erros > 0 ? `, ${data.erros} com erro` : ''}`,
        variant: data.sucessos > 0 ? "default" : "destructive",
      });

      console.log('✅ Resultado geração NF Omie:', data);

    } catch (error) {
      console.error('❌ Erro ao gerar NF no Omie:', error);
      
      toast({
        title: "Erro na geração de NF",
        description: error instanceof Error ? error.message : "Ocorreu um erro durante a geração das NFs no Omie",
        variant: "destructive",
      });
    } finally {
      setGerandoNFOmie(false);
    }
  };

  // Função para selecionar/deselecionar cliente para NF
  const toggleClienteNF = (clienteNome: string) => {
    setClientesSelecionadosNF(prev => {
      const novaSelecao = new Set(prev);
      if (novaSelecao.has(clienteNome)) {
        novaSelecao.delete(clienteNome);
      } else {
        novaSelecao.add(clienteNome);
      }
      return novaSelecao;
    });
  };

  // Função para selecionar todos os clientes elegíveis para NF
  const selecionarTodosClientesNF = () => {
    const clientesElegiveis = resultados
      .filter(r => r.relatorioGerado && !r.omieNFGerada)
      .map(r => r.clienteNome);
    
    setClientesSelecionadosNF(new Set(clientesElegiveis));
  };

  // Função para limpar seleção de NF
  const limparSelecaoNF = () => {
    setClientesSelecionadosNF(new Set());
  };

  // Resetar status das NFs emitidas no período (para reprocessar)
  const resetarStatusNFOmie = async () => {
    if (resetandoNFOmie) return;

    const clientesEmitidas = resultados
      .filter(r => r.omieNFGerada)
      .map(r => r.clienteNome);

    if (clientesEmitidas.length === 0) {
      toast({
        title: "Nenhuma NF emitida",
        description: "Não há NFs emitidas para resetar neste período",
        variant: "destructive",
      });
      return;
    }

    setResetandoNFOmie(true);
    try {
      const { data, error } = await supabase.functions.invoke('resetar-status-nf-omie', {
        body: {
          periodo: periodoSelecionado,
          clientes: clientesEmitidas,
        },
      });

      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || 'Falha ao resetar status das NFs');
      }

      toast({
        title: "Status resetado",
        description: `${data.registros_atualizados || clientesEmitidas.length} registro(s) liberados para reemissão`,
      });

      // Recarregar status do DB e limpar seleção
      await carregarResultadosDB();
      setClientesSelecionadosNF(new Set());
    } catch (e) {
      console.error('Erro ao resetar status NF:', e);
      toast({
        title: "Erro ao resetar",
        description: e instanceof Error ? e.message : 'Não foi possível resetar as NFs',
        variant: "destructive",
      });
    } finally {
      setResetandoNFOmie(false);
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
    // ✅ USAR CLIENTES DOS DEMONSTRATIVOS SALVOS
    let clientesParaProcessar = clientesCarregados;
    
    // Tentar carregar clientes dos demonstrativos salvos primeiro
    const demonstrativosCompletos = localStorage.getItem(`demonstrativos_completos_${periodoSelecionado}`);
    if (demonstrativosCompletos) {
      try {
        const dados = JSON.parse(demonstrativosCompletos);
        if (dados.demonstrativos && Array.isArray(dados.demonstrativos) && dados.demonstrativos.length > 0) {
          clientesParaProcessar = dados.demonstrativos
            .filter((demo: any) => {
              const total = Number(demo.total_exames ?? demo.total_laudos ?? demo.volume_total ?? 0);
              return total > 0; // ✅ Somente clientes com volumetria
            })
            .map((demo: any) => ({
              id: demo.cliente_id || `temp-${demo.cliente_nome}`,
              nome: demo.cliente_nome || demo.nome_cliente,
              email: demo.cliente_email || demo.email_cliente || `${(demo.cliente_nome || '').toLowerCase().replace(/[^a-z0-9]/g, '')}@cliente.com`,
              demonstrativo: demo // ✅ Incluir dados do demonstrativo para usar no relatório
            }));
          console.log(`✅ Usando ${clientesParaProcessar.length} clientes dos demonstrativos para gerar relatórios`);
        }
      } catch (error) {
        console.error('Erro ao processar demonstrativos:', error);
      }
    }
    
    if (clientesParaProcessar.length === 0) {
      toast({
        title: "Nenhum cliente encontrado",
        description: "Certifique-se de que há clientes com demonstrativo gerado no período selecionado",
        variant: "destructive",
      });
      return;
    }

    setGerandoRelatorios(true);
    setStatusProcessamento({
      processando: true,
      mensagem: 'Iniciando geração de relatórios...',
      progresso: 0
    });

    try {
      const total = clientesParaProcessar.length;
      let gerados = 0;
      let errors = 0;

      for (let i = 0; i < clientesParaProcessar.length; i++) {
        const cliente = clientesParaProcessar[i];
        
        setStatusProcessamento({
          processando: true,
          mensagem: `Gerando relatório para ${cliente.nome} (${i + 1}/${total})...`,
          progresso: Math.round((i / total) * 100)
        });

        try {
          // ✅ GERAR RELATÓRIO COM DADOS DO DEMONSTRATIVO
          const clienteIdReal = await resolveClienteId(cliente.id, cliente.nome);
          if (!clienteIdReal) {
            throw new Error('Cliente não encontrado no cadastro (ID inválido).');
          }

          const bodyData: any = {
            cliente_id: clienteIdReal,
            periodo: periodoSelecionado
          };
          
          // Se temos dados do demonstrativo, incluir para gerar PDF completo
          if ((cliente as any).demonstrativo) {
            bodyData.demonstrativo_data = (cliente as any).demonstrativo;
          }
          
          let relatorioData: any = null;
          let relatorioError: any = null;
          for (let tentativa = 1; tentativa <= 3; tentativa++) {
            const { data, error } = await supabase.functions.invoke('gerar-relatorio-faturamento', {
              body: bodyData
            });
            relatorioData = data;
            relatorioError = error;
            const pdfTentar = relatorioData?.arquivos?.[0]?.url;
            if (!relatorioError && relatorioData?.success && pdfTentar) break;
            // Aguarda com backoff (1s, 2s)
            await new Promise(res => setTimeout(res, 1000 * tentativa));
          }

          if (relatorioError) {
            // Se é erro de timeout, mostrar mensagem específica
            if (relatorioError.message?.includes('timeout') || relatorioError.message?.includes('Timeout')) {
              throw new Error('Timeout: Geração do relatório demorou muito. Tente novamente.');
            }
            throw new Error(relatorioError.message || 'Erro na chamada da função');
          }

          if (!relatorioData?.success) {
            // Verificar se é erro de timeout no response
            if (relatorioData?.timeout) {
              throw new Error('Timeout: Geração do relatório demorou muito. Tente novamente.');
            }
            throw new Error(relatorioData?.error || 'Erro ao gerar relatório');
          }

          const pdfUrl = relatorioData.arquivos?.[0]?.url;
          if (!pdfUrl) {
            if (relatorioData?.dadosEncontrados === false || relatorioData?.totalRegistros === 0) {
              console.log('↪️ Sem volumetria para este cliente, relatório não gerado. Pulando.');
            } else {
              throw new Error('Relatório gerado sem PDF público.');
            }
          }

          // Atualizar resultado do cliente
          const hasPdf = !!pdfUrl;
          setResultados(prev => {
            const existe = prev.some(r => r.clienteId === cliente.id);
            const novosResultados = existe
              ? prev.map(resultado => 
                  resultado.clienteId === cliente.id 
                    ? {
                        ...resultado,
                        relatorioGerado: hasPdf,
                        linkRelatorio: relatorioData.arquivos?.[0]?.url,
                        arquivos: relatorioData.arquivos,
                        dataProcessamento: new Date().toLocaleString('pt-BR'),
                        relatorioData: relatorioData,
                        erro: hasPdf ? undefined : (relatorioData?.dadosEncontrados === false ? 'Sem volumetria no período' : 'Relatório sem PDF público')
                      }
                    : resultado
                )
              : [
                  ...prev,
                  {
                    clienteId: cliente.id,
                    clienteNome: cliente.nome,
                    relatorioGerado: hasPdf,
                    emailEnviado: false,
                    emailDestino: cliente.email,
                    linkRelatorio: relatorioData.arquivos?.[0]?.url,
                    arquivos: relatorioData.arquivos,
                    dataProcessamento: new Date().toLocaleString('pt-BR'),
                    relatorioData: relatorioData,
                    erro: hasPdf ? undefined : (relatorioData?.dadosEncontrados === false ? 'Sem volumetria no período' : 'Relatório sem PDF público')
                  }
                ];
            
            // Salvar no banco de dados
            salvarResultadosDB(novosResultados);
            return novosResultados;
          });

          if (hasPdf) {
            gerados++;
          }
          
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
      setGerandoRelatorios(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Gerar Faturamento</h1>
        <p className="text-gray-600 mt-1">Geração e envio automático de relatórios de faturamento para todos os clientes</p>
      </div>

      <Tabs value={activeTab} onValueChange={safeSetActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
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
          <TabsTrigger value="analise" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Análise
          </TabsTrigger>
          <TabsTrigger value="fechamento" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Fechamento de Período
          </TabsTrigger>
        </TabsList>

        <TabsContent value="demonstrativo" className="space-y-6">
          <div className="bg-muted/30 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">Demonstrativos de Faturamento</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Visualiza os demonstrativos gerados na aba "Gerar" ou cria demonstrativo simples sem franquias
            </p>
            <DemonstrativoFaturamento />
          </div>
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
                    <span className="text-sm font-medium">Clientes com Demonstrativo</span>
                    <span className="text-sm font-bold">
                      {(() => {
                        // ✅ UNIFICAR CONTAGEM: Usar dados dos demonstrativos salvos
                        const demonstrativosCompletos = localStorage.getItem(`demonstrativos_completos_${periodoSelecionado}`);
                        if (demonstrativosCompletos) {
                          try {
                            const dados = JSON.parse(demonstrativosCompletos);
                            return dados.demonstrativos?.length || 0;
                          } catch {
                            return clientesCarregados.length;
                          }
                        }
                        return clientesCarregados.length;
                      })()}
                    </span>
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
                      {relatoriosGerados} de {(() => {
                        const demonstrativosCompletos = localStorage.getItem(`demonstrativos_completos_${periodoSelecionado}`);
                        if (demonstrativosCompletos) {
                          try {
                            const dados = JSON.parse(demonstrativosCompletos);
                            return dados.demonstrativos?.length || 0;
                          } catch {
                            return 0;
                          }
                        }
                        return 0;
                      })()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-1000 ease-out"
                      style={{ 
                        width: (() => {
                          const demonstrativosCompletos = localStorage.getItem(`demonstrativos_completos_${periodoSelecionado}`);
                          if (demonstrativosCompletos) {
                            try {
                              const dados = JSON.parse(demonstrativosCompletos);
                              const totalClientes = dados.demonstrativos?.length || 0;
                              return totalClientes > 0 
                                ? `${Math.min(100, (relatoriosGerados / totalClientes) * 100)}%` 
                                : '0%';
                            } catch {
                              return '0%';
                            }
                          }
                          return '0%';
                        })()
                      }}
                    />
                  </div>
                </div>

                {/* E-mails Enviados */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">E-mails Enviados</span>
                    <span className="text-sm font-bold">
                      {emailsEnviados} de {(() => {
                        const demonstrativosCompletos = localStorage.getItem(`demonstrativos_completos_${periodoSelecionado}`);
                        if (demonstrativosCompletos) {
                          try {
                            const dados = JSON.parse(demonstrativosCompletos);
                            return dados.demonstrativos?.length || 0;
                          } catch {
                            return 0;
                          }
                        }
                        return 0;
                      })()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all duration-1000 ease-out"
                      style={{ 
                        width: (() => {
                          const demonstrativosCompletos = localStorage.getItem(`demonstrativos_completos_${periodoSelecionado}`);
                          if (demonstrativosCompletos) {
                            try {
                              const dados = JSON.parse(demonstrativosCompletos);
                              const totalClientes = dados.demonstrativos?.length || 0;
                              return totalClientes > 0 
                                ? `${Math.min(100, (emailsEnviados / totalClientes) * 100)}%` 
                                : '0%';
                            } catch {
                              return '0%';
                            }
                          }
                          return '0%';
                        })()
                      }}
                    />
                  </div>
                </div>

                {/* Erros */}
                {(() => {
                  const errosSet = new Set(resultados.filter(r => r.erro && r.erro.trim()).map(r => r.clienteId || r.clienteNome));
                  return errosSet.size > 0;
                })() && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-red-600">Erros</span>
                      <span className="text-sm font-bold text-red-600">
                        {(() => { const s = new Set(resultados.filter(r => r.erro && r.erro.trim()).map(r => r.clienteId || r.clienteNome)); return s.size; })()} de {(() => {
                          const demonstrativosCompletos = localStorage.getItem(`demonstrativos_completos_${periodoSelecionado}`);
                          if (demonstrativosCompletos) {
                            try {
                              const dados = JSON.parse(demonstrativosCompletos);
                              return dados.demonstrativos?.length || 0;
                            } catch {
                              return 0;
                            }
                          }
                          return 0;
                        })()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-red-400 to-red-600 transition-all duration-1000 ease-out"
                      style={{ 
                        width: (() => {
                          const demonstrativosCompletos = localStorage.getItem(`demonstrativos_completos_${periodoSelecionado}`);
                          if (demonstrativosCompletos) {
                            try {
                              const dados = JSON.parse(demonstrativosCompletos);
                              const totalClientes = dados.demonstrativos?.length || 0;
                              const totalErros = new Set(resultados.filter(r => r.erro && r.erro.trim()).map(r => r.clienteId || r.clienteNome)).size;
                              return totalClientes > 0 
                                ? `${Math.min(100, (totalErros / totalClientes) * 100)}%` 
                                : '0%';
                            } catch {
                              return '0%';
                            }
                          }
                          return '0%';
                        })()
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

              {/* Etapa 1: Gerar Demonstrativo Completo */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <FileBarChart2 className="h-4 w-4" />
                  Etapa 1: Gerar Demonstrativo de Faturamento Completo
                </h4>
                <div className="text-sm text-gray-600 mb-4">
                  {demonstrativoGerado ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      ✅ Demonstrativo gerado com sucesso! Você pode prosseguir para a Etapa 2.
                    </div>
                  ) : (
                    <div className="text-blue-700">
                      <FileBarChart2 className="h-4 w-4 inline mr-2" />
                      Generate o demonstrativo completo com franquias para todos os clientes do período selecionado.
                    </div>
                  )}
                </div>

                {/* Componente de geração de demonstrativos */}
                <DemonstrativoFaturamentoCompleto 
                  periodo={periodoSelecionado} 
                  onDemonstrativosGerados={(dados) => {
                    console.log('🔄 Callback onDemonstrativosGerados recebido:');
                    console.log('📊 Dados completos:', dados);
                    console.log('📋 Demonstrativos:', dados?.demonstrativos);
                    console.log('📏 Quantidade:', dados?.demonstrativos?.length);
                    
                    if (!dados?.demonstrativos || !Array.isArray(dados.demonstrativos)) {
                      console.error('❌ Demonstrativos não encontrados ou não é um array');
                      return;
                    }
                    
                    // Atualizar a lista de clientes para relatórios
                    const clientesParaRelatorio = dados.demonstrativos.map(d => ({
                      id: d.cliente_id,
                      nome: d.cliente_nome,
                      email: '' // Email será buscado conforme necessário
                    }));
                    
                    console.log('👥 Clientes para relatório:', clientesParaRelatorio);
                    setClientesCarregados(clientesParaRelatorio);
                    
                    // Atualizar conjunto de clientes que tiveram demonstrativos gerados
                    const clientesProcessados = new Set(dados.demonstrativos.map(d => d.cliente_nome));
                    console.log('✅ Clientes processados:', Array.from(clientesProcessados));
                    setDemonstrativosGeradosPorCliente(clientesProcessados);
                    // Persistir no localStorage
                    localStorage.setItem(`demonstrativosGerados_${periodoSelecionado}`, JSON.stringify(Array.from(clientesProcessados)));
                    
                    setDemonstrativoGerado(true);
                    localStorage.setItem('demonstrativoGerado', 'true');
                    
                    toast({
                      title: `${dados.resumo?.clientes_processados || 0} clientes únicos encontrados na volumetria do período ${periodoSelecionado}`,
                      description: "Agora você pode prosseguir para a Etapa 2 - Gerar Relatórios",
                      variant: "default",
                    });
                  }}
                />
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
                    disabled={gerandoRelatorios || clientesCarregados.length === 0 || !demonstrativoGerado}
                    size="lg"
                    className="min-w-[280px] bg-green-600 hover:bg-green-700"
                  >
                    {gerandoRelatorios ? (
                      <>
                        <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                        Gerando Relatórios...
                      </>
                    ) : (
                      <>
                        <FileText className="h-5 w-5 mr-2" />
                        📄 Gerar Relatórios
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
                    disabled={gerandoRelatorios || enviandoEmails || resultados.filter(r => r.relatorioGerado && !r.emailEnviado).length === 0}
                    size="lg"
                    className="min-w-[280px] bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
                  >
                    {enviandoEmails ? (
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

              {/* Etapa 4: Gerar NF no Omie - SELEÇÃO MÚLTIPLA */}
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                  <FileBarChart2 className="h-4 w-4" />
                  Etapa 4: Gerar NF no Omie
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center p-3 bg-white rounded-lg border border-purple-200">
                    <div className="text-xl font-bold text-purple-600">
                      {clientesSelecionadosNF.size}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Selecionados
                    </div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border border-blue-200">
                    <div className="text-xl font-bold text-blue-600">
                      {resultados.filter(r => r.relatorioGerado && !r.omieNFGerada).length}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Disponíveis
                    </div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border border-green-200">
                    <div className="text-xl font-bold text-green-600">
                      {resultados.filter(r => r.omieNFGerada).length}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      NFs Emitidas
                    </div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border border-orange-200">
                    <div className="text-xl font-bold text-orange-600">
                      {resultados.filter(r => !r.relatorioGerado).length}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Aguardando
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <Button 
                    onClick={gerarNFOmie}
                    disabled={gerandoNFOmie || clientesSelecionadosNF.size === 0}
                    size="lg"
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    {gerandoNFOmie ? (
                      <>
                        <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                        Gerando NFs...
                      </>
                    ) : (
                      <>
                        <FileBarChart2 className="h-5 w-5 mr-2" />
                        🧾 Gerar NFs Selecionadas ({clientesSelecionadosNF.size})
                      </>
                    )}
                  </Button>
                  
                  <div className="flex gap-2 items-center">
                    <Button
                      onClick={selecionarTodosClientesNF}
                      variant="outline"
                      size="sm"
                      disabled={resultados.filter(r => r.relatorioGerado && !r.omieNFGerada).length === 0}
                    >
                      Selecionar Todos
                    </Button>
                    <Button
                      onClick={limparSelecaoNF}
                      variant="outline"
                      size="sm"
                      disabled={clientesSelecionadosNF.size === 0}
                    >
                      Limpar Seleção
                    </Button>
                    <Button
                      onClick={resetarStatusNFOmie}
                      variant="destructive"
                      size="sm"
                      disabled={resetandoNFOmie || resultados.filter(r => r.omieNFGerada).length === 0}
                      className="sm:ml-2"
                    >
                      {resetandoNFOmie ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                          Resetando...
                        </>
                      ) : (
                        '↩︎ Resetar NFs emitidas'
                      )}
                    </Button>
                  </div>
                </div>
                
                <div className="bg-white p-4 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 text-purple-800 mb-2">
                    <Zap className="h-4 w-4" />
                    <span className="font-semibold text-sm">📋 Como usar:</span>
                  </div>
                  <div className="space-y-1 text-sm text-gray-700">
                    <p>1. <strong>Selecione</strong> os clientes usando os checkboxes na coluna "Status NF Omie"</p>
                    <p>2. <strong>Clique</strong> no botão "Gerar NFs Selecionadas" acima</p>
                    <p>3. Apenas clientes com relatório gerado podem ser selecionados</p>
                    <p>4. 🧪 <strong>MODO TESTE:</strong> Limitado aos clientes: COT, CORTREL, IMDBATATAIS, BROOKLIN</p>
                  </div>
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
                        <th className="text-left p-3">
                          <div className="flex items-center gap-2">
                            Cliente
                            {resultados.filter(r => r.relatorioGerado && !r.omieNFGerada).length > 0 && (
                              <Button
                                onClick={clientesSelecionadosNF.size === resultados.filter(r => r.relatorioGerado && !r.omieNFGerada).length ? limparSelecaoNF : selecionarTodosClientesNF}
                                variant="ghost"
                                size="sm"
                                className="text-xs p-1 h-6"
                              >
                                {clientesSelecionadosNF.size === resultados.filter(r => r.relatorioGerado && !r.omieNFGerada).length ? 'Desmarcar' : 'Marcar Todos'}
                              </Button>
                            )}
                          </div>
                        </th>
                        <th className="text-center p-3">Status Demonstrativo</th>
                        <th className="text-center p-3">Status Relatório</th>
                        <th className="text-center p-3">Status E-mail</th>
                        <th className="text-center p-3">Status NF Omie</th>
                        <th className="text-left p-3">Link PDF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultadosFiltradosStatus.map((resultado, index) => (
                        <tr key={`${resultado.clienteNome}-${index}`} className="border-b">
                          <td className="p-3 font-medium">{resultado.clienteNome}</td>
          <td className="p-3 text-center">
            {demonstrativosGeradosPorCliente.has(resultado.clienteNome) ? (
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
                          <td className="p-3 text-center">
                            {resultado.omieNFGerada ? (
                              <div className="flex flex-col items-center gap-1">
                                <Badge variant="default" className="bg-purple-600">
                                  ✅ Emitida
                                </Badge>
                                {resultado.dataGeracaoNFOmie && (
                                  <span className="text-xs text-muted-foreground">
                                    {resultado.dataGeracaoNFOmie}
                                  </span>
                                )}
                              </div>
                            ) : resultado.relatorioGerado ? (
                              <div className="flex flex-col items-center gap-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={clientesSelecionadosNF.has(resultado.clienteNome)}
                                    onChange={() => toggleClienteNF(resultado.clienteNome)}
                                    className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                                  />
                                  <Badge variant="outline" className="text-xs">
                                    Selecionar para NF
                                  </Badge>
                                </div>
                                {clientesSelecionadosNF.has(resultado.clienteNome) && (
                                  <Badge variant="default" className="bg-blue-100 text-blue-800 text-xs">
                                    ✓ Selecionado
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <Badge variant="secondary" className="bg-gray-100">
                                  Aguardando
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  Relatório pendente
                                </span>
                              </div>
                            )}
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

        </TabsContent>

        <TabsContent value="analise" className="space-y-6">
          {/* Verificação de Dados - Movido da aba Demonstrativo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                Verificação de Dados
              </CardTitle>
              <CardDescription>
                Análise de consistência entre volumetria e demonstrativos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="text-sm">
                  <div className="text-yellow-700">
                    <div>Total na Volumetria (excluindo NC-NF): <span className="font-medium">38.528 exames</span></div>
                    <div>Total nos Demonstrativos: <span className="font-medium">
                      {(() => {
                        const demonstrativosCompletos = localStorage.getItem(`demonstrativos_completos_${periodoSelecionado}`);
                        if (demonstrativosCompletos) {
                          try {
                            const dados = JSON.parse(demonstrativosCompletos);
                            const total = dados.resumo?.total_exames_geral || 0;
                            return total.toLocaleString('pt-BR');
                          } catch {
                            return '0';
                          }
                        }
                        return '0';
                      })()} exames
                    </span></div>
                    {(() => {
                      const demonstrativosCompletos = localStorage.getItem(`demonstrativos_completos_${periodoSelecionado}`);
                      if (demonstrativosCompletos) {
                        try {
                          const dados = JSON.parse(demonstrativosCompletos);
                          const totalDemonstrativos = dados.resumo?.total_exames_geral || 0;
                          if (totalDemonstrativos !== 38528) {
                            return (
                              <div className="text-red-600 font-medium mt-1">
                                ⚠️ Discrepância encontrada: {Math.abs(38528 - totalDemonstrativos).toLocaleString('pt-BR')} exames de diferença
                              </div>
                            );
                          }
                        } catch {}
                      }
                      return null;
                    })()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <ExamesValoresZerados />
        </TabsContent>

          </Tabs>
          
          {/* Seção de Diagnóstico */}
          <div className="mt-8">
            <DiagnosticoClientePrecos />
          </div>
        </div>
      );
}