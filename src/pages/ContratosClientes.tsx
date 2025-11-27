import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  FileText,
  Calendar,
  DollarSign,
  AlertTriangle,
  Plus,
  FileCheck,
  Download,
  Trash2,
  Upload,
  Pencil,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  History,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilterBar } from "@/components/FilterBar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SincronizarParametrosContratos } from '@/components/SincronizarParametrosContratos';

interface ContratoCliente {
  id: string;
  clienteId: string;
  cliente: string;
  dataInicio: string;
  dataFim: string;
  status: "Ativo" | "Vencido" | "A Vencer" | "Inativo" | "Cancelado";
  servicos: ServicoContratado[];
  valorTotal: number;
  diasParaVencer: number;
  indiceReajuste: "IPCA" | "IGP-M" | "INPC" | "CDI";
  // Dados do cliente - priorizando parâmetros
  cnpj?: string;
  endereco?: string;
  telefone?: string;
  emailFinanceiro?: string;
  emailOperacional?: string;
  site?: string;
  responsavel?: string;
  telefoneResponsavel?: string;
  emailResponsavel?: string;
  // Número do contrato dos parâmetros
  numeroContrato?: string;
  razaoSocial?: string;
  // Configurações de cobrança
  cobrancaIntegracao: boolean;
  valorIntegracao?: number;
  cobrancaSuporte: boolean;
  valorSuporte?: number;
  // Regras e condições de preço dos parâmetros
  consideraPlantao?: boolean;
  condVolume?: string;
  diaVencimento?: number;
  diaFechamento?: number;
  formaCobranca?: string;
  descontoPercentual?: number;
  acrescimoPercentual?: number;
  faixasVolume?: any[];
  configuracoesFranquia?: any;
  configuracoesIntegracao?: any;
  // Campos sincronizados dos parâmetros de faturamento
  aplicarFranquia?: boolean;
  valorFranquia?: number;
  volumeFranquia?: number;
  valorAcimaFranquia?: number;
  frequenciaContinua?: boolean;
  frequenciaPorVolume?: boolean;
  portalLaudos?: boolean;
  tipoFaturamento?: string;
  impostosAbMin?: number;
  simples?: boolean;
  parametrosStatus?: string;
  percentualISS?: number;
  // Histórico de alterações
  termosAditivos?: TermoAditivo[];
  documentos?: DocumentoCliente[];
}

interface DocumentoCliente {
  id: string;
  tipo_documento: 'contrato' | 'termo_aditivo' | 'termo_renovacao';
  nome_arquivo: string;
  url_arquivo?: string;
  status_documento: 'pendente' | 'anexado' | 'assinatura_pendente' | 'assinado';
  clicksign_document_key?: string;
  data_envio_assinatura?: string;
  data_assinatura?: string;
}

interface TermoAditivo {
  id: string;
  data: string;
  motivo: string;
  servicosAlterados: {
    servicoId: string;
    valorAnterior: number;
    valorNovo: number;
    modalidade: string;
    especialidade: string;
    categoria: string;
  }[];
  geradoPor: string;
}

interface ServicoContratado {
  id?: string;
  modalidade: "MR" | "CT" | "DO" | "MG" | "RX";
  especialidade: "CA" | "NE" | "ME" | "MI" | "MA" | "OB";
  categoria: "Angio" | "Contrastado" | "Mastoide" | "OIT" | "Pescoço" | "Prostata" | "Score" | "Normal" | "Especial";
  prioridade: "Plantão" | "Rotina" | "Urgente";
  valor: number;
}

interface NovoCliente {
  cnpj: string;
  nome: string;
  endereco: string;
  telefone: string;
  emailFinanceiro: string;
  emailOperacional: string;
  site: string;
  responsavel: string;
  telefoneResponsavel: string;
  emailResponsavel: string;
  dataInicio: string;
  dataFim: string;
  indiceReajuste: "IPCA" | "IGP-M" | "INPC" | "CDI";
  servicos: ServicoContratado[];
  cobrancaIntegracao: boolean;
  valorIntegracao: number;
  cobrancaSuporte: boolean;
  valorSuporte: number;
}

export default function ContratosClientes() {
  const [contratos, setContratos] = useState<ContratoCliente[]>([]);
  const [contratosOriginal, setContratosOriginal] = useState<ContratoCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNovoContrato, setShowNovoContrato] = useState(false);
  const [showEditarContrato, setShowEditarContrato] = useState(false);
  const [contratoEditando, setContratoEditando] = useState<ContratoCliente | null>(null);
  const [isCreatingContracts, setIsCreatingContracts] = useState(false);
  const [showVisualizarContrato, setShowVisualizarContrato] = useState(false);
  const [contratoVisualizando, setContratoVisualizando] = useState<ContratoCliente | null>(null);
  
  // Estados para edição
  const [editDataInicio, setEditDataInicio] = useState("");
  const [editDataFim, setEditDataFim] = useState("");
  const [editDiaVencimento, setEditDiaVencimento] = useState<number | "">(10);
  const [editDesconto, setEditDesconto] = useState<number | "">(0);
  const [editAcrescimo, setEditAcrescimo] = useState<number | "">(0);
  const [editFranqValor, setEditFranqValor] = useState<number | "">(0);
  const [editIntegraValor, setEditIntegraValor] = useState<number | "">(0);
  const [editPortalValor, setEditPortalValor] = useState<number | "">(0);
  const [editDataVigencia, setEditDataVigencia] = useState("");
  const [editDescricaoAlteracao, setEditDescricaoAlteracao] = useState("");
  
  // Estados para parâmetros fiscais/tributários
  const [editSimples, setEditSimples] = useState(false);
  const [editPercentualISS, setEditPercentualISS] = useState<number | "">(0);
  const [editImpostosAbMin, setEditImpostosAbMin] = useState<number | "">(0);
  const [editVolumeFranquia, setEditVolumeFranquia] = useState<number | "">(0);
  const [editFrequenciaContinua, setEditFrequenciaContinua] = useState(false);
  const [editFrequenciaPorVolume, setEditFrequenciaPorVolume] = useState<"sim" | "nao" | "vazio">("vazio");
  const [editValorAcimaFranquia, setEditValorAcimaFranquia] = useState<number | "">(0);
  const [editAplicarFranquia, setEditAplicarFranquia] = useState(false);
  const [editPortalLaudos, setEditPortalLaudos] = useState(false);
  
  // Estados para condições de preço
  const [precosCliente, setPrecosCliente] = useState<any[]>([]);
  const [loadingPrecos, setLoadingPrecos] = useState(false);
  const [historicoContrato, setHistoricoContrato] = useState<any[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [activeTab, setActiveTab] = useState<"atual" | "historico">("atual");

  // Estados para busca, filtro e ordenação
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [sortField, setSortField] = useState<string>("cliente");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
  // Estado para sincronização Omie
  const [sincronizandoOmie, setSincronizandoOmie] = useState(false);
  
  const { toast } = useToast();

  // useEffect para inicializar campos de edição quando abre o formulário
  useEffect(() => {
    if (contratoEditando && showEditarContrato) {
      setEditDataInicio(contratoEditando.dataInicio || "");
      setEditDataFim(contratoEditando.dataFim || "");
      setEditDiaVencimento(contratoEditando.diaVencimento || 10);
      setEditDesconto(contratoEditando.descontoPercentual || 0);
      setEditAcrescimo(contratoEditando.acrescimoPercentual || 0);
      setEditFranqValor(contratoEditando.valorFranquia || 0);
      setEditIntegraValor(contratoEditando.valorIntegracao || 0);
      setEditPortalValor((contratoEditando as any).configuracoesIntegracao?.valor_portal_laudos || 0);
      setEditSimples(contratoEditando.simples || false);
      setEditPercentualISS(contratoEditando.percentualISS || 0);
      setEditImpostosAbMin(contratoEditando.impostosAbMin || 0);
      setEditVolumeFranquia(contratoEditando.volumeFranquia || 0);
      setEditFrequenciaContinua(contratoEditando.frequenciaContinua || false);
      setEditValorAcimaFranquia(contratoEditando.valorAcimaFranquia || 0);
      setEditAplicarFranquia(contratoEditando.aplicarFranquia || false);
      setEditPortalLaudos(contratoEditando.portalLaudos || false);
      
      // Converter frequenciaPorVolume para o formato do select
      const freqPorVol = contratoEditando.frequenciaPorVolume;
      if (freqPorVol === true) {
        setEditFrequenciaPorVolume("sim");
      } else if (freqPorVol === false) {
        setEditFrequenciaPorVolume("nao");
      } else {
        setEditFrequenciaPorVolume("vazio");
      }
    }
  }, [contratoEditando, showEditarContrato]);

  // Carregar dados dos contratos do Supabase
  const carregarContratos = async () => {
    try {
      setLoading(true);
      
      // Buscar contratos com dados dos clientes
      const { data: contratosData, error } = await supabase
        .from('contratos_clientes')
        .select(`
          *,
          clientes!inner (
            id,
            nome,
            nome_fantasia,
            razao_social,
            cnpj,
            endereco,
            telefone,
            email,
            contato,
            status,
            ativo
          )
        `)
        .eq('clientes.ativo', true)
        .in('status', ['ativo', 'vencido']);

      if (error) {
        console.error('Erro ao carregar contratos:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os dados dos contratos.",
          variant: "destructive",
        });
        return;
      }

      // Buscar parâmetros de faturamento separadamente para evitar duplicatas
      const clienteIds = contratosData?.map(c => c.cliente_id) || [];
      const nomesFantasia = (contratosData || [])
        .map(c => c.clientes?.nome_fantasia)
        .filter((n: any) => Boolean(n)) as string[];

      let parametrosPorCliente: Record<string, any> = {};
      let parametrosPorNome: Record<string, any> = {};
      
      if (clienteIds.length > 0) {
        const { data: parametrosData } = await supabase
          .from('parametros_faturamento')
          .select('*')
          .in('cliente_id', clienteIds);
        
        // Organizar parâmetros por cliente_id (pegar o mais recente para cada cliente)
        parametrosData?.forEach(param => {
          if (!parametrosPorCliente[param.cliente_id] || 
              parametrosPorCliente[param.cliente_id].updated_at < param.updated_at) {
            parametrosPorCliente[param.cliente_id] = param;
          }
        });
      }

      if (nomesFantasia.length > 0) {
        const uniqueNomes = Array.from(new Set(nomesFantasia));
        const { data: paramsByNome } = await supabase
          .from('parametros_faturamento')
          .select('*')
          .in('nome_fantasia', uniqueNomes);

        paramsByNome?.forEach((p: any) => {
          const key = (p.nome_fantasia || '').toString();
          if (!parametrosPorNome[key] || parametrosPorNome[key].updated_at < p.updated_at) {
            parametrosPorNome[key] = p;
          }
        });
      }

      // Transformar dados do Supabase para o formato da interface
      const contratosFormatados: ContratoCliente[] = (contratosData || []).map(contrato => {
        const cliente = contrato.clientes;
        const parametros = parametrosPorCliente[contrato.cliente_id] || (cliente?.nome_fantasia ? parametrosPorNome[cliente.nome_fantasia] : null) || null;
        
        // Extrair nome_fantasia das observações_contratuais se disponível
        const nomeFantasiaGerado = contrato.observacoes_contratuais?.match(/Gerado: ([A-Z_]+)/)?.[1];
        
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0); // Normalizar para início do dia
        const dataFim = new Date(parametros?.data_termino_contrato || contrato.data_fim || contrato.data_inicio);
        dataFim.setHours(0, 0, 0, 0); // Normalizar para início do dia
        const diasParaVencer = Math.ceil((dataFim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

        // Status calculado SEMPRE por data primeiro (prioridade)
        let statusCalculado: "Ativo" | "Vencido" | "A Vencer" = "Ativo";
        if (diasParaVencer < 0) {
          statusCalculado = "Vencido";
        } else if (diasParaVencer <= 60) {
          statusCalculado = "A Vencer";
        }

        // Status dos parâmetros sobrescreve APENAS se for Inativo ou Cancelado
        const statusFromParams = (() => {
          const s = parametros?.status;
          if (!s) return null;
          if (s === 'I' || s?.toLowerCase() === 'inativo') return 'Inativo';
          if (s === 'C' || s?.toLowerCase() === 'cancelado') return 'Cancelado';
          return null; // Não sobrescrever status de data para "Ativo"
        })();

        // Usar status dos parâmetros apenas para Inativo/Cancelado, senão usar calculado por data
        const status: "Ativo" | "Vencido" | "A Vencer" | "Inativo" | "Cancelado" = (statusFromParams as any) || statusCalculado;

        // Usar parâmetros de faturamento da consulta separada ou fallback para JSONB
        const configuracoesFranquia = parametros ? {
          tem_franquia: parametros.aplicar_franquia,
          valor_franquia: parametros.valor_franquia,
          volume_franquia: parametros.volume_franquia,
          frequencia_continua: parametros.frequencia_continua,
          frequencia_por_volume: parametros.frequencia_por_volume,
          valor_acima_franquia: parametros.valor_acima_franquia
        } : (typeof contrato.configuracoes_franquia === 'object' && contrato.configuracoes_franquia) ? contrato.configuracoes_franquia as any : {};
        
        const configuracoesIntegracao = parametros ? {
          cobra_integracao: parametros.cobrar_integracao,
          valor_integracao: parametros.valor_integracao,
          valor_portal_laudos: parametros.valor_portal_laudos
        } : (typeof contrato.configuracoes_integracao === 'object' && contrato.configuracoes_integracao) ? contrato.configuracoes_integracao as any : {};

        return {
          id: contrato.id,
          clienteId: cliente?.id || '',
          cliente: nomeFantasiaGerado || parametros?.nome_fantasia || cliente?.nome_fantasia || cliente?.nome || 'Cliente não encontrado',
          cnpj: parametros?.cnpj || cliente?.cnpj || '',
          // Priorizar dados dos parâmetros de faturamento para sincronização
          dataInicio: parametros?.data_inicio_contrato ? new Date(parametros.data_inicio_contrato).toISOString().split('T')[0] : contrato.data_inicio || '',
          dataFim: parametros?.data_termino_contrato ? new Date(parametros.data_termino_contrato).toISOString().split('T')[0] : contrato.data_fim || contrato.data_inicio || '',
          status,
          servicos: [],
          valorTotal: 0,
          diasParaVencer,
          indiceReajuste: "IPCA" as const,
          endereco: cliente?.endereco || '',
          telefone: cliente?.telefone || '',
          emailFinanceiro: cliente?.email || '',
          emailOperacional: cliente?.email || '',
          responsavel: cliente?.contato || '',
          cobrancaIntegracao: Boolean(configuracoesIntegracao.cobra_integracao),
          valorIntegracao: Number(configuracoesIntegracao.valor_integracao ?? 0),
          cobrancaSuporte: false,
          consideraPlantao: Boolean(contrato.considera_plantao),
          condVolume: contrato.cond_volume || 'MOD/ESP/CAT',
          diaVencimento: Number(contrato.dia_vencimento || 10),
          diaFechamento: Number(parametros?.dia_fechamento || contrato.dia_fechamento || 7),
          formaCobranca: parametros?.forma_cobranca || contrato.forma_pagamento || 'Não informado',
          descontoPercentual: Number(contrato.desconto_percentual || 0),
          acrescimoPercentual: Number(contrato.acrescimo_percentual || 0),
          faixasVolume: Array.isArray(contrato.faixas_volume) ? contrato.faixas_volume : [],
          configuracoesFranquia: configuracoesFranquia,
          configuracoesIntegracao: configuracoesIntegracao,
          termosAditivos: [],
          documentos: [],
          // Usar dados dos parâmetros de faturamento para sincronização
          // Usar número dos parâmetros; se ausente, exibir vazio (ignorar CT- gerado)
          numeroContrato: (() => {
            const p = parametros?.numero_contrato?.toString().trim();
            if (p) return p;
            return '';
          })(),
          razaoSocial: parametros?.razao_social || cliente?.razao_social || cliente?.nome || 'Não informado',
          aplicarFranquia: parametros?.aplicar_franquia ?? configuracoesFranquia.tem_franquia ?? false,
          valorFranquia: Number(parametros?.valor_franquia ?? configuracoesFranquia.valor_franquia ?? 0),
          volumeFranquia: Number(parametros?.volume_franquia ?? configuracoesFranquia.volume_franquia ?? 0),
          valorAcimaFranquia: Number(parametros?.valor_acima_franquia ?? configuracoesFranquia.valor_acima_franquia ?? 0),
          frequenciaContinua: Boolean(parametros?.frequencia_continua ?? configuracoesFranquia.frequencia_continua ?? false),
          frequenciaPorVolume: Boolean(parametros?.frequencia_por_volume ?? configuracoesFranquia.frequencia_por_volume ?? false),
          portalLaudos: Boolean(parametros?.portal_laudos ?? configuracoesIntegracao.portal_laudos ?? false),
          tipoFaturamento: parametros?.tipo_faturamento ?? contrato.tipo_faturamento ?? 'CO-FT',
          impostosAbMin: Number(parametros?.impostos_ab_min ?? contrato.impostos_ab_min ?? 0),
          simples: Boolean(parametros?.simples ?? contrato.simples ?? false),
          percentualISS: Number(parametros?.percentual_iss ?? 0),
          parametrosStatus: parametros ? 'Configurado' : 'Não configurado'
        };
      });

      // Remover duplicatas por chave de negócio (cliente + contrato + vigência)
      const uniqueMap = new Map<string, ContratoCliente>();
      for (const c of contratosFormatados) {
        const key = `${c.clienteId}|${c.numeroContrato || ''}|${c.dataInicio}|${c.dataFim}|${c.tipoFaturamento || ''}`;
        if (!uniqueMap.has(key)) uniqueMap.set(key, c);
      }
      const uniqueContratos = Array.from(uniqueMap.values());

      setContratos(uniqueContratos);
      setContratosOriginal(uniqueContratos);
    } catch (error) {
      console.error('Erro ao carregar contratos:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro inesperado ao carregar os contratos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarContratos();
  }, []);

  // Carregar condições de preço
  useEffect(() => {
    const fetchPrecos = async () => {
      const clienteId = contratoVisualizando?.clienteId || contratoEditando?.clienteId;
      const shouldLoad = (showVisualizarContrato && contratoVisualizando?.clienteId) || 
                        (showEditarContrato && contratoEditando?.clienteId);
      
      if (!shouldLoad || !clienteId) {
        setPrecosCliente([]);
        return;
      }
      try {
        setLoadingPrecos(true);
        console.log('🔍 Buscando preços para cliente_id:', clienteId);
        const { data, error } = await supabase
          .from('precos_servicos')
          .select('id, modalidade, especialidade, categoria, prioridade, volume_inicial, volume_final, valor_base, valor_urgencia, considera_prioridade_plantao, ativo, cond_volume')
          .eq('cliente_id', clienteId)
          .eq('ativo', true)
          .order('modalidade', { ascending: true });
        if (error) throw error;
        console.log('✅ Preços encontrados:', data?.length || 0, 'registros');
        setPrecosCliente(data || []);
      } catch (e) {
        console.error('Erro ao carregar condições de preço:', e);
        setPrecosCliente([]);
      } finally {
        setLoadingPrecos(false);
      }
    };
    fetchPrecos();
  }, [showVisualizarContrato, contratoVisualizando?.clienteId, showEditarContrato, contratoEditando?.clienteId]);

  // Inicializar dados de edição quando contrato é selecionado
  useEffect(() => {
    if (contratoEditando) {
      setEditDataInicio(contratoEditando.dataInicio ? contratoEditando.dataInicio.slice(0, 10) : "");
      setEditDataFim(contratoEditando.dataFim ? contratoEditando.dataFim.slice(0, 10) : "");
      setEditDiaVencimento(contratoEditando.diaVencimento ?? 10);
      setEditDesconto(contratoEditando.descontoPercentual ?? 0);
      setEditAcrescimo(contratoEditando.acrescimoPercentual ?? 0);
      
      const franq = contratoEditando.configuracoesFranquia || {};
      setEditFranqValor(franq.valor_franquia ?? 0);
      
      const integ = contratoEditando.configuracoesIntegracao || {};
      setEditIntegraValor(integ.valor_integracao ?? 0);
      setEditPortalValor(integ.valor_portal_laudos ?? 0);
      
      // Parâmetros fiscais/tributários
      setEditSimples(contratoEditando.simples ?? false);
      setEditPercentualISS(contratoEditando.percentualISS ?? 0);
      setEditImpostosAbMin(contratoEditando.impostosAbMin ?? 0);
      setEditVolumeFranquia(contratoEditando.volumeFranquia ?? 0);
      setEditFrequenciaContinua(contratoEditando.frequenciaContinua ?? false);
      setEditValorAcimaFranquia(contratoEditando.valorAcimaFranquia ?? 0);
      setEditAplicarFranquia(contratoEditando.aplicarFranquia ?? false);
      setEditPortalLaudos(contratoEditando.portalLaudos ?? false);
      
      // Converter frequenciaPorVolume para o formato do select
      const freqPorVol = contratoEditando.frequenciaPorVolume;
      if (freqPorVol === true) {
        setEditFrequenciaPorVolume("sim");
      } else if (freqPorVol === false) {
        setEditFrequenciaPorVolume("nao");
      } else {
        setEditFrequenciaPorVolume("vazio");
      }
      
      // Definir data de vigência padrão como hoje
      const hoje = new Date().toISOString().slice(0, 10);
      setEditDataVigencia(hoje);
      setEditDescricaoAlteracao("");
    }
  }, [contratoEditando]);

  // Função para limpar todos os contratos
  const limparContratos = async () => {
    if (!confirm('⚠️ ATENÇÃO: Isso irá deletar TODOS os contratos da base. Deseja continuar?')) {
      return;
    }

    try {
      setIsCreatingContracts(true);
      
      const { data, error } = await supabase.functions.invoke('limpar-contratos');
      
      if (error) throw error;
      
      toast({
        title: "Contratos limpos!",
        description: data.message,
      });
      
      await carregarContratos();
      
    } catch (error: any) {
      console.error('Erro ao limpar contratos:', error);
      toast({
        title: "Erro ao limpar contratos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCreatingContracts(false);
    }
  };

  // Função para gerar contratos automaticamente baseado nos parâmetros
  const gerarContratosAutomaticos = async () => {
    try {
      setIsCreatingContracts(true);
      
      // 1. Buscar TODOS os parâmetros ativos COM dados do cliente (incluindo nome_fantasia)
      const { data: todosParametros, error: parametrosError } = await supabase
        .from('parametros_faturamento')
        .select(`
          *,
          clientes:cliente_id (
            id,
            nome,
            nome_fantasia,
            cnpj,
            razao_social,
            endereco,
            telefone,
            email
          )
        `)
        .eq('status', 'A');
      
      if (parametrosError) throw parametrosError;
      
      if (!todosParametros || todosParametros.length === 0) {
        toast({
          title: "Nenhum parâmetro encontrado",
          description: "Não há parâmetros ativos para gerar contratos.",
          variant: "default",
        });
        return;
      }

      console.log(`🔍 Encontrados ${todosParametros.length} parâmetros ativos`);

      // 2. Agrupar parâmetros por (nome_fantasia + numero_contrato)
      // Chave: "nome_fantasia|numeroContrato" onde numeroContrato pode ser null
      const parametrosAgrupados = new Map<string, typeof todosParametros>();
      
      todosParametros.forEach(parametro => {
        const cliente = parametro.clientes as any;
        if (!cliente) {
          console.warn('⚠️ Parâmetro sem cliente:', parametro.id);
          return;
        }
        
        // USAR NOME_FANTASIA DO PARÂMETRO, não do cliente
        const nomeFantasia = parametro.nome_fantasia?.trim() || cliente.nome_fantasia?.trim() || cliente.nome?.trim() || 'SEM_NOME';
        const numeroContratoNormalizado = parametro.numero_contrato?.trim() || null;
        const chave = `${nomeFantasia}|${numeroContratoNormalizado}`;
        
        console.log(`📝 Parâmetro: ${nomeFantasia} - Contrato: ${numeroContratoNormalizado} - Cliente ID: ${cliente.id}`);
        
        if (!parametrosAgrupados.has(chave)) {
          parametrosAgrupados.set(chave, []);
        }
        parametrosAgrupados.get(chave)!.push(parametro);
      });

      console.log(`📦 ${parametrosAgrupados.size} contratos únicos a serem criados (agrupados por Nome Fantasia + Número)`);
      
      // Log dos grupos
      for (const [chave, params] of parametrosAgrupados) {
        console.log(`  🔑 ${chave}: ${params.length} parâmetro(s)`);
      }

      // 3. Buscar todos os clientes para mapear nome_fantasia -> IDs de clientes
      const { data: todosClientes, error: clientesError } = await supabase
        .from('clientes')
        .select('id, nome, nome_fantasia');
      
      if (clientesError) throw clientesError;

      // 4. Buscar todos os contratos existentes COM seus parâmetros para comparação correta
      const { data: contratosExistentes, error: contratosError } = await supabase
        .from('contratos_clientes')
        .select(`
          id, 
          cliente_id, 
          numero_contrato
        `);
      
      if (contratosError) throw contratosError;

      // 5. Buscar os parâmetros dos contratos existentes para obter nome_fantasia correto
      const clienteIdsExistentes = contratosExistentes?.map(c => c.cliente_id) || [];
      const { data: parametrosExistentes } = await supabase
        .from('parametros_faturamento')
        .select('cliente_id, nome_fantasia, numero_contrato')
        .in('cliente_id', clienteIdsExistentes);

      // Criar mapa de cliente_id -> nome_fantasia do parâmetro
      const mapaParametrosExistentes = new Map();
      parametrosExistentes?.forEach(p => {
        const chave = `${p.cliente_id}|${p.numero_contrato?.trim() || null}`;
        if (!mapaParametrosExistentes.has(chave)) {
          mapaParametrosExistentes.set(chave, p.nome_fantasia?.trim() || '');
        }
      });

      let contratosGerados = 0;
      let contratosPulados = 0;
      const erros: string[] = [];
      
      // 6. Para cada grupo (nome_fantasia + numero_contrato), criar 1 contrato se não existir
      console.log(`\n🔍 === INICIANDO GERAÇÃO DE ${parametrosAgrupados.size} GRUPOS DE CONTRATOS ===\n`);
      
      for (const [chave, parametrosGrupo] of parametrosAgrupados.entries()) {
        // Pegar o primeiro parâmetro do grupo como representante
        const parametroRepresentante = parametrosGrupo[0];
        const cliente = parametroRepresentante.clientes as any;
        
        if (!cliente) {
          console.warn('⚠️ Cliente não encontrado para parâmetro:', parametroRepresentante.id);
          continue;
        }
        
        // USAR NOME_FANTASIA DO PARÂMETRO, não do cliente
        const nomeFantasia = parametroRepresentante.nome_fantasia?.trim() || cliente.nome_fantasia?.trim() || cliente.nome?.trim() || 'SEM_NOME';
        const numeroContratoParam = parametroRepresentante.numero_contrato?.trim() || null;
        
        console.log(`\n📋 PROCESSANDO: "${nomeFantasia}" + "${numeroContratoParam || 'SEM NÚMERO'}"`);
        console.log(`   Parâmetros agrupados: ${parametrosGrupo.length}`);
        console.log(`   Cliente ID: ${cliente.id}`);
        console.log(`   Cliente.nome: ${cliente.nome}`);
        console.log(`   Cliente.nome_fantasia: ${cliente.nome_fantasia}`);
        console.log(`   Parâmetro.nome_fantasia: ${parametroRepresentante.nome_fantasia}`);
        
        // Verificar duplicata: buscar contratos existentes usando nome_fantasia do parâmetro
        const contratoJaExiste = contratosExistentes?.some(contrato => {
          const chaveExistente = `${contrato.cliente_id}|${contrato.numero_contrato?.trim() || null}`;
          const nomeFantasiaExistente = mapaParametrosExistentes.get(chaveExistente);
          const numeroContratoExistente = contrato.numero_contrato?.trim() || null;
          
          const match = nomeFantasiaExistente === nomeFantasia && numeroContratoExistente === numeroContratoParam;
          
          if (match) {
            console.log(`   ⚠️ DUPLICATA! Contrato já existe:`);
            console.log(`      ID: ${contrato.id}`);
            console.log(`      Cliente ID: ${contrato.cliente_id}`);
            console.log(`      Nome fantasia: ${nomeFantasiaExistente}`);
            console.log(`      Número: ${numeroContratoExistente || 'SEM NÚMERO'}`);
          }
          
          return match;
        });

        if (contratoJaExiste) {
          console.log(`   ⏭️ PULADO\n`);
          contratosPulados++;
          continue;
        }
        
        console.log(`   ✨ CRIANDO novo contrato...`);


        // 6. Buscar preços configurados para o cliente
        const { data: precosCliente, error: precosError } = await supabase
          .from('precos_servicos')
          .select('*')
          .eq('cliente_id', cliente.id);
        
        if (precosError) {
          console.error(`Erro ao buscar preços para cliente ${cliente.nome}:`, precosError);
        }
        
        // 7. Calcular data de início e fim do contrato
        const dataInicio = new Date().toISOString().split('T')[0];
        const dataFim = new Date();
        dataFim.setFullYear(dataFim.getFullYear() + 1); // 1 ano de contrato
        
        // Preparar serviços contratados baseados nos preços (se houver)
        const servicosContratados = (precosCliente && precosCliente.length > 0) ? precosCliente.map(preco => ({
            modalidade: preco.modalidade,
            especialidade: preco.especialidade,
            categoria: preco.categoria,
            prioridade: preco.prioridade || 'Rotina',
            valor_base: preco.valor_base,
            volume_inicial: preco.volume_inicial,
            volume_final: preco.volume_final
          })) : [];

        // Preparar configurações baseadas nos parâmetros (usar primeiro do grupo)
        const configuracoesFranquia = {
          tem_franquia: parametroRepresentante.aplicar_franquia,
          valor_franquia: parametroRepresentante.valor_franquia,
          volume_franquia: parametroRepresentante.volume_franquia,
          valor_acima_franquia: parametroRepresentante.valor_acima_franquia,
          frequencia_continua: parametroRepresentante.frequencia_continua,
          frequencia_por_volume: parametroRepresentante.frequencia_por_volume
        };

        const configuracoesIntegracao = {
          cobra_integracao: parametroRepresentante.cobrar_integracao,
          valor_integracao: parametroRepresentante.valor_integracao,
          portal_laudos: parametroRepresentante.portal_laudos,
          incluir_medico_solicitante: parametroRepresentante.incluir_medico_solicitante,
          incluir_access_number: parametroRepresentante.incluir_access_number,
          incluir_empresa_origem: parametroRepresentante.incluir_empresa_origem
        };
        
        // 8. Criar contrato no banco
        
        const { error: contratoError } = await supabase
          .from('contratos_clientes')
          .insert({
            cliente_id: cliente.id,
            numero_contrato: numeroContratoParam,
            data_inicio: dataInicio,
            data_fim: dataFim.toISOString().split('T')[0],
            status: 'ativo',
            servicos_contratados: servicosContratados,
            modalidades: precosCliente && precosCliente.length > 0 ? [...new Set(precosCliente.map(p => p.modalidade))] : [],
            especialidades: precosCliente && precosCliente.length > 0 ? [...new Set(precosCliente.map(p => p.especialidade))] : [],
            tem_precos_configurados: precosCliente && precosCliente.length > 0,
            tem_parametros_configurados: true,
            considera_plantao: false,
            cond_volume: 'MOD/ESP/CAT',
            dia_vencimento: parametroRepresentante.forma_cobranca === 'Mensal' ? 10 : 30,
            desconto_percentual: 0,
            acrescimo_percentual: 0,
            faixas_volume: [],
            configuracoes_franquia: configuracoesFranquia,
            configuracoes_integracao: configuracoesIntegracao,
            tipo_faturamento: parametroRepresentante.tipo_faturamento || 'CO-FT',
            tipo_cliente: parametroRepresentante.tipo_cliente || 'CO',
            forma_pagamento: parametroRepresentante.forma_cobranca || 'Mensal',
            dia_fechamento: parametroRepresentante.dia_fechamento || 7,
            observacoes_contratuais: `Gerado: ${nomeFantasia} | ${parametrosGrupo.length} parâmetro(s) | ${parametroRepresentante.tipo_faturamento || 'CO-FT'}`
          });
        
         if (contratoError) {
          const erro = `❌ Cliente ${cliente.nome} (${numeroContratoParam || 'sem número'}): ${contratoError.message}`;
          console.error(erro);
          erros.push(erro);
          continue;
        }
        
        console.log(`   ✅ CONTRATO CRIADO!`);
        console.log(`      Cliente: ${nomeFantasia}`);
        console.log(`      Número: ${numeroContratoParam || 'SEM NÚMERO'}`);
        console.log(`      Parâmetros: ${parametrosGrupo.length}\n`);
        contratosGerados++;
      }
      
      console.log(`\n📊 === RESUMO FINAL ===`);
      console.log(`   ✅ Criados: ${contratosGerados}`);
      console.log(`   ⏭️ Já existiam: ${contratosPulados}`);
      if (erros.length > 0) {
        console.log(`   ❌ Erros: ${erros.length}`);
        erros.forEach(erro => console.log(`      ${erro}`));
      }
      console.log(`\n=====================\n`);
      
      // Mensagem final com resumo
      const descricao = [
        `✅ ${contratosGerados} novos contratos criados`,
        contratosPulados > 0 ? `⏭️ ${contratosPulados} contratos já existiam` : null,
        erros.length > 0 ? `❌ ${erros.length} erros` : null
      ].filter(Boolean).join('. ');

      toast({
        title: "Processo concluído!",
        description: descricao,
        variant: erros.length > 0 ? "destructive" : "default",
      });

      if (erros.length > 0) {
        console.error('Erros encontrados:', erros);
      }
      
      // Recarregar lista de contratos
      await carregarContratos();
      
    } catch (error: any) {
      console.error('Erro ao gerar contratos:', error);
      toast({
        title: "Erro ao gerar contratos",
        description: error.message || 'Erro desconhecido',
        variant: "destructive",
      });
    } finally {
      setIsCreatingContracts(false);
    }
  };

  // Função para salvar contrato
  const salvarContrato = async () => {
    if (!contratoEditando) return;
    
    if (!editDataVigencia) {
      toast({ 
        title: 'Data de vigência obrigatória', 
        description: 'Informe a partir de quando a alteração será aplicada', 
        variant: 'destructive' 
      });
      return;
    }
    
    try {
      // Buscar dados atuais do contrato para fazer merge correto
      const { data: contratoAtual, error: fetchError } = await supabase
        .from('contratos_clientes')
        .select('configuracoes_franquia, configuracoes_integracao')
        .eq('id', contratoEditando.id)
        .single();

      if (fetchError) throw fetchError;

      // Fazer merge mantendo campos existentes
      const configFranquiaAtual = (contratoAtual?.configuracoes_franquia as Record<string, any>) || {};
      const configIntegracaoAtual = (contratoAtual?.configuracoes_integracao as Record<string, any>) || {};

      const aplicarFranquiaCalc = Number(editFranqValor || 0) > 0;

      // Atualizar contrato no banco
      const { error } = await supabase
        .from('contratos_clientes')
        .update({
          data_inicio: editDataInicio || null,
          data_fim: editDataFim || null,
          dia_vencimento: editDiaVencimento || null,
          desconto_percentual: Number(editDesconto || 0),
          acrescimo_percentual: Number(editAcrescimo || 0),
          configuracoes_franquia: {
            ...configFranquiaAtual,
            tem_franquia: aplicarFranquiaCalc,
            valor_franquia: Number(editFranqValor || 0),
          },
          configuracoes_integracao: {
            ...configIntegracaoAtual,
            valor_integracao: Number(editIntegraValor || 0),
            valor_portal_laudos: Number(editPortalValor || 0),
          },
        })
        .eq('id', contratoEditando.id);

      if (error) throw error;

      // Sincronizar parâmetros de faturamento (bidirecional completa)
      try {
        const { data: paramAtual } = await supabase
          .from('parametros_faturamento')
          .select('id')
          .eq('cliente_id', contratoEditando.clienteId)
          .maybeSingle();

        // Converter editFrequenciaPorVolume para boolean ou null
        let frequenciaPorVolumeValue: boolean | null = null;
        if (editFrequenciaPorVolume === "sim") {
          frequenciaPorVolumeValue = true;
        } else if (editFrequenciaPorVolume === "nao") {
          frequenciaPorVolumeValue = false;
        }

        const parametrosUpdate = {
          aplicar_franquia: editAplicarFranquia,
          valor_franquia: Number(editFranqValor || 0),
          volume_franquia: Number(editVolumeFranquia || 0),
          valor_acima_franquia: Number(editValorAcimaFranquia || 0),
          frequencia_continua: editFrequenciaContinua,
          frequencia_por_volume: frequenciaPorVolumeValue,
          valor_integracao: Number(editIntegraValor || 0),
          valor_portal_laudos: Number(editPortalValor || 0),
          simples: editSimples,
          percentual_iss: Number(editPercentualISS || 0),
          impostos_ab_min: Number(editImpostosAbMin || 0),
        };

        if (paramAtual?.id) {
          await supabase
            .from('parametros_faturamento')
            .update(parametrosUpdate)
            .eq('id', paramAtual.id);
        } else {
          await supabase
            .from('parametros_faturamento')
            .insert({
              cliente_id: contratoEditando.clienteId,
              ...parametrosUpdate,
              ativo: true,
            });
        }
      } catch (syncErr) {
        console.warn('Aviso: não foi possível sincronizar parâmetros de faturamento:', syncErr);
      }

      // ✅ SINCRONIZAR PREÇOS: Atualizar precos_servicos com os valores editados no contrato
      try {
        if (precosCliente.length > 0) {
          console.log('🔄 Sincronizando preços do contrato para precos_servicos...');
          
          for (const preco of precosCliente) {
            // Buscar o preço existente em precos_servicos
            const { data: precoExistente, error: searchError } = await supabase
              .from('precos_servicos')
              .select('id')
              .eq('cliente_id', contratoEditando.clienteId)
              .eq('modalidade', preco.modalidade)
              .eq('especialidade', preco.especialidade)
              .eq('categoria', preco.categoria)
              .eq('prioridade', preco.prioridade)
              .eq('volume_inicial', preco.volume_inicial || 0)
              .eq('volume_final', preco.volume_final || 999999)
              .maybeSingle();

            if (searchError) {
              console.warn('Erro ao buscar preço:', searchError);
              continue;
            }

            // Atualizar o preço em precos_servicos
            if (precoExistente?.id) {
              await supabase
                .from('precos_servicos')
                .update({
                  valor_base: Number(preco.valor_base || 0),
                  valor_urgencia: Number(preco.valor_urgencia || 0),
                  considera_prioridade_plantao: preco.considera_prioridade_plantao || false,
                  ativo: preco.ativo !== false,
                  updated_at: new Date().toISOString()
                })
                .eq('id', precoExistente.id);
              
              console.log(`✅ Preço atualizado: ${preco.modalidade}/${preco.especialidade}/${preco.categoria}/${preco.prioridade}`);
            }
          }
          
          console.log('✅ Sincronização de preços concluída!');
        }
      } catch (syncPrecosErr) {
        console.error('❌ Erro ao sincronizar preços:', syncPrecosErr);
        toast({
          title: "Aviso",
          description: "Contrato atualizado, mas alguns preços podem não ter sido sincronizados.",
          variant: "default",
        });
      }

      toast({
        title: "Contrato atualizado",
        description: "As alterações foram salvas e os preços sincronizados com sucesso.",
      });

      setShowEditarContrato(false);
      setContratoEditando(null);
      await carregarContratos();
    } catch (error: any) {
      console.error('Erro ao salvar contrato:', error);
      toast({
        title: "Erro ao salvar",
        description: error.message || 'Erro desconhecido',
        variant: "destructive",
      });
    }
  };

  // Função para sincronizar códigos Omie
  const [progressoSync, setProgressoSync] = useState({ total: 0, processados: 0, erros: 0, naoEncontrados: 0 });
  const [testingCredentials, setTestingCredentials] = useState(false);
  const [credentialsValid, setCredentialsValid] = useState<boolean | null>(null);

  // Testar credenciais OMIE
  const testarCredenciaisOmie = async () => {
    try {
      setTestingCredentials(true);
      setCredentialsValid(null);

      const { data, error } = await supabase.functions.invoke('sincronizar-codigo-cliente-omie', {
        body: { test_credentials: true }
      });

      if (error) {
        toast({
          title: "❌ Erro ao testar credenciais",
          description: error.message,
          variant: "destructive",
        });
        setCredentialsValid(false);
        return;
      }

      setCredentialsValid(data.valid);
      
      toast({
        title: data.valid ? "✅ Credenciais Válidas" : "❌ Credenciais Inválidas",
        description: data.message,
        variant: data.valid ? "default" : "destructive",
      });

    } catch (error: any) {
      console.error('Erro ao testar credenciais:', error);
      toast({
        title: "❌ Erro ao testar",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
      setCredentialsValid(false);
    } finally {
      setTestingCredentials(false);
    }
  };

  const sincronizarCodigosOmie = async () => {
    try {
      setSincronizandoOmie(true);
      setProgressoSync({ total: 0, processados: 0, erros: 0, naoEncontrados: 0 });

      // Buscar todos os clientes únicos com contratos ativos
      const clientesIds = Array.from(new Set(contratos.map(c => c.clienteId).filter(Boolean)));
      const { data: clientesParaSincronizar, error: clientesError } = await supabase
        .from('clientes')
        .select('id, nome')
        .in('id', clientesIds);

      if (clientesError || !clientesParaSincronizar || clientesParaSincronizar.length === 0) {
        toast({
          title: "Nenhum cliente encontrado",
          description: "Não há clientes para sincronizar",
        });
        setSincronizandoOmie(false);
        return;
      }

      setProgressoSync(prev => ({ ...prev, total: clientesParaSincronizar.length }));

      toast({
        title: "Sincronização iniciada",
        description: `Processando ${clientesParaSincronizar.length} clientes...`,
      });

      let processados = 0;
      let erros = 0;
      let naoEncontrados = 0;

      // Processar 1 cliente por vez com delay
      for (const cliente of clientesParaSincronizar) {
        try {
          const { data, error } = await supabase.functions.invoke('sincronizar-codigo-cliente-omie', {
            body: { cliente_id: cliente.id }
          });

          if (error) {
            console.error(`Erro ao sincronizar ${cliente.nome}:`, error);
            
            // Detectar erro 500 da API OMIE (credenciais inválidas)
            if (error.message?.includes('500') || error.message?.includes('Internal Server Error')) {
              toast({
                title: "⚠️ Erro de Credenciais OMIE",
                description: "A API OMIE retornou erro 500. Verifique se OMIE_APP_KEY e OMIE_APP_SECRET estão corretos.",
                variant: "destructive",
              });
              setSincronizandoOmie(false);
              return; // Para a sincronização
            }
            
            erros++;
          } else if (!data?.success) {
            console.log(`Cliente não encontrado: ${cliente.nome}`);
            naoEncontrados++;
          } else {
            processados++;
          }

          setProgressoSync({ 
            total: clientesParaSincronizar.length, 
            processados: processados + erros + naoEncontrados,
            erros, 
            naoEncontrados 
          });

          // Delay de 10 segundos entre cada cliente
          if (processados + erros + naoEncontrados < clientesParaSincronizar.length) {
            await new Promise(resolve => setTimeout(resolve, 10000));
          }

        } catch (e: any) {
          console.error(`Erro ao processar ${cliente.nome}:`, e);
          
          // Detectar erro de conexão com API OMIE
          if (e.message?.includes('Failed to send a request to the Edge Function')) {
            toast({
              title: "❌ Erro de Conexão",
              description: "Não foi possível conectar à API OMIE. Verifique as credenciais OMIE_APP_KEY e OMIE_APP_SECRET.",
              variant: "destructive",
            });
            setSincronizandoOmie(false);
            return; // Para a sincronização
          }
          
          erros++;
          setProgressoSync({ 
            total: clientesParaSincronizar.length, 
            processados: processados + erros + naoEncontrados,
            erros, 
            naoEncontrados 
          });
        }
      }

      // Recarregar dados
      await carregarContratos();

      toast({
        title: "Sincronização concluída",
        description: `✓ ${processados} sincronizados | ⚠ ${naoEncontrados} não encontrados | ✗ ${erros} erros`,
      });

    } catch (error: any) {
      console.error('Erro ao sincronizar códigos Omie:', error);
      toast({
        title: "Erro na sincronização",
        description: error.message || "Erro ao conectar com o servidor",
        variant: "destructive",
      });
    } finally {
      setSincronizandoOmie(false);
    }
  };

  // Filtros e ordenação
  useEffect(() => {
    let contratosFiltrados = [...contratosOriginal];

    // Aplicar busca
    if (searchTerm) {
      contratosFiltrados = contratosFiltrados.filter(contrato =>
        contrato.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contrato.cnpj?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contrato.responsavel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contrato.tipoFaturamento?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contrato.numeroContrato?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contrato.razaoSocial?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Aplicar filtro de status
    if (statusFilter !== "todos") {
      contratosFiltrados = contratosFiltrados.filter(contrato =>
        contrato.status.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    // Aplicar ordenação
    contratosFiltrados.sort((a, b) => {
      let aValue: any = a[sortField as keyof ContratoCliente];
      let bValue: any = b[sortField as keyof ContratoCliente];

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setContratos(contratosFiltrados);
  }, [contratosOriginal, searchTerm, statusFilter, sortField, sortDirection]);

  // Dados derivados
  const contratosAtivos = contratos.filter(c => c.status === "Ativo");
  const contratosVencidos = contratos.filter(c => c.status === "Vencido");
  const contratosAVencer = contratos.filter(c => c.status === "A Vencer");
  const contratosInativos = contratos.filter(c => c.status === "Inativo");
  const contratosCancelados = contratos.filter(c => c.status === "Cancelado");
  const valorTotalAtivos = contratosAtivos.reduce((sum, c) => sum + c.valorTotal, 0);

  return (
    <div className="space-y-6">
      {/* Seção de Sincronização de Parâmetros */}
      <SincronizarParametrosContratos />
      
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Contratos Clientes</h1>
        <p className="text-gray-600 mt-1">Gestão de contratos com clientes, serviços e faturamento</p>
      </div>

      <FilterBar />

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contratos Ativos</CardTitle>
            <FileCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{contratosAtivos.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Vencer (60 dias)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{contratosAVencer.length}</div>
            <p className="text-xs text-muted-foreground">
              Requerem atenção para renovação
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencidos</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{contratosVencidos.length}</div>
            <p className="text-xs text-muted-foreground">
              Necessitam renovação urgente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inativos</CardTitle>
            <Clock className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{contratosInativos.length}</div>
            <p className="text-xs text-muted-foreground">
              Contratos em status inativo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancelados</CardTitle>
            <X className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{contratosCancelados.length}</div>
            <p className="text-xs text-muted-foreground">
              Contratos cancelados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Contratos</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{contratos.length}</div>
            <p className="text-xs text-muted-foreground">
              {contratosOriginal.length} cadastrados no sistema
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ações Principais */}
      <div className="flex gap-4 flex-wrap">
        <Button 
          onClick={limparContratos}
          disabled={isCreatingContracts}
          variant="destructive"
        >
          {isCreatingContracts ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Limpando...
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar Contratos
            </>
          )}
        </Button>

        <Button 
          onClick={gerarContratosAutomaticos}
          disabled={isCreatingContracts}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {isCreatingContracts ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Gerando...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Gerar Contratos
            </>
          )}
        </Button>

        <Button
          onClick={testarCredenciaisOmie}
          disabled={testingCredentials}
          variant="outline"
          className="border-blue-600 text-blue-600 hover:bg-blue-50"
        >
          {testingCredentials ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              Testando...
            </>
          ) : (
            <>
              {credentialsValid === true && <CheckCircle className="h-4 w-4 mr-2 text-green-600" />}
              {credentialsValid === false && <AlertCircle className="h-4 w-4 mr-2 text-red-600" />}
              {credentialsValid === null && <AlertCircle className="h-4 w-4 mr-2" />}
              Testar Credenciais OMIE
            </>
          )}
        </Button>

        <Button
          onClick={sincronizarCodigosOmie}
          disabled={sincronizandoOmie || credentialsValid !== true}
          className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
        >
          {sincronizandoOmie ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Sincronizando... {progressoSync.processados}/{progressoSync.total}
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Sincronizar Códigos Omie
            </>
          )}
        </Button>
        
        {/* Status das Credenciais */}
        {credentialsValid !== null && (
          <Card className={`mt-4 ${credentialsValid ? 'border-green-500' : 'border-red-500'}`}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                {credentialsValid ? (
                  <>
                    <CheckCircle className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="font-semibold text-green-600">✅ Credenciais OMIE Válidas</p>
                      <p className="text-sm text-muted-foreground">
                        API OMIE está respondendo corretamente. Você pode sincronizar agora.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-8 w-8 text-red-600" />
                    <div>
                      <p className="font-semibold text-red-600">❌ Credenciais OMIE Inválidas</p>
                      <p className="text-sm text-muted-foreground">
                        A API OMIE retornou erro. Verifique OMIE_APP_KEY e OMIE_APP_SECRET.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Card de Progresso da Sincronização */}
        {sincronizandoOmie && progressoSync.total > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg">Progresso da Sincronização OMIE</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Processados:</span>
                  <span className="font-semibold">{progressoSync.processados} / {progressoSync.total}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(progressoSync.processados / progressoSync.total) * 100}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm mt-4">
                  <div className="text-center">
                    <div className="text-green-600 font-semibold">{progressoSync.processados - progressoSync.erros - progressoSync.naoEncontrados}</div>
                    <div className="text-muted-foreground">Sucesso</div>
                  </div>
                  <div className="text-center">
                    <div className="text-yellow-600 font-semibold">{progressoSync.naoEncontrados}</div>
                    <div className="text-muted-foreground">Não encontrados</div>
                  </div>
                  <div className="text-center">
                    <div className="text-red-600 font-semibold">{progressoSync.erros}</div>
                    <div className="text-muted-foreground">Erros</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exportar Contratos
        </Button>

        <Button variant="outline">
          <FileCheck className="h-4 w-4 mr-2" />
          Gerar Relatório
        </Button>
      </div>

      {/* Tabela de Contratos */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>Lista de Contratos</CardTitle>
            
            {/* Controles de busca, filtro e ordenação */}
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              {/* Campo de busca */}
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por cliente, CNPJ ou responsável..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full sm:w-80"
                />
              </div>

              {/* Filtro por status */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="a vencer">A Vencer</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>

              {/* Ordenação */}
              <Select value={`${sortField}-${sortDirection}`} onValueChange={(value) => {
                const [field, direction] = value.split('-');
                setSortField(field);
                setSortDirection(direction as "asc" | "desc");
              }}>
                <SelectTrigger className="w-full sm:w-52">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="cliente-asc">Cliente (A-Z)</SelectItem>
                  <SelectItem value="cliente-desc">Cliente (Z-A)</SelectItem>
                  <SelectItem value="status-asc">Status (A-Z)</SelectItem>
                  <SelectItem value="status-desc">Status (Z-A)</SelectItem>
                  <SelectItem value="dataInicio-asc">Data Início (Antiga)</SelectItem>
                  <SelectItem value="dataInicio-desc">Data Início (Recente)</SelectItem>
                  <SelectItem value="dataFim-asc">Data Fim (Antiga)</SelectItem>
                  <SelectItem value="dataFim-desc">Data Fim (Recente)</SelectItem>
                  <SelectItem value="diasParaVencer-asc">Menos dias p/ vencer</SelectItem>
                  <SelectItem value="diasParaVencer-desc">Mais dias p/ vencer</SelectItem>
                  <SelectItem value="tipoFaturamento-asc">Tipo Faturamento (A-Z)</SelectItem>
                  <SelectItem value="tipoFaturamento-desc">Tipo Faturamento (Z-A)</SelectItem>
                  <SelectItem value="valorFranquia-asc">Valor Franquia (Menor)</SelectItem>
                  <SelectItem value="valorFranquia-desc">Valor Franquia (Maior)</SelectItem>
                  <SelectItem value="volumeFranquia-asc">Volume Franquia (Menor)</SelectItem>
                  <SelectItem value="volumeFranquia-desc">Volume Franquia (Maior)</SelectItem>
                  <SelectItem value="valorIntegracao-asc">Valor Integração (Menor)</SelectItem>
                  <SelectItem value="valorIntegracao-desc">Valor Integração (Maior)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contador de resultados */}
          <div className="text-sm text-muted-foreground mt-2">
            Mostrando {contratos.length} de {contratosOriginal.length} contratos
            {searchTerm && ` • Filtrado por: "${searchTerm}"`}
            {statusFilter !== "todos" && ` • Status: ${statusFilter}`}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Carregando contratos...</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Razão Social</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data Início</TableHead>
                  <TableHead>Data Fim</TableHead>
                  <TableHead>Tipo Faturamento</TableHead>
                  <TableHead>Franquia</TableHead>
                  <TableHead>Volume Franquia</TableHead>
                  <TableHead>Integração</TableHead>
                  <TableHead>Portal Laudos</TableHead>
                  <TableHead>Dias p/ Vencer</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratos.map((contrato) => (
                  <TableRow 
                    key={contrato.id}
                    className={
                      contrato.status === 'Vencido' ? 'bg-red-50 border-l-4 border-red-500 hover:bg-red-100' :
                      contrato.status === 'A Vencer' ? 'bg-yellow-50 border-l-4 border-yellow-500 hover:bg-yellow-100' :
                      'hover:bg-muted/50'
                    }
                  >
                    <TableCell className="font-medium">{contrato.cliente}</TableCell>
                    <TableCell>{contrato.numeroContrato || 'Não informado'}</TableCell>
                    <TableCell>{contrato.razaoSocial}</TableCell>
                    <TableCell>
                      <Badge variant={
                        contrato.status === 'Ativo' ? 'default' : 
                        contrato.status === 'A Vencer' ? 'secondary' : 
                        contrato.status === 'Vencido' ? 'destructive' :
                        contrato.status === 'Inativo' ? 'outline' :
                        contrato.status === 'Cancelado' ? 'destructive' :
                        'destructive'
                      }
                      className={
                        contrato.status === 'Vencido' ? 'bg-red-600 text-white hover:bg-red-700' :
                        contrato.status === 'A Vencer' ? 'bg-yellow-600 text-white hover:bg-yellow-700' :
                        ''
                      }
                      >
                        {contrato.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(contrato.dataInicio).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>{new Date(contrato.dataFim).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {contrato.tipoFaturamento || 'CO-FT'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {contrato.aplicarFranquia ? (
                        <div className="flex flex-col">
                          <Badge variant="default" className="mb-1">Sim</Badge>
                          <span className="text-xs">
                            R$ {Number(contrato.valorFranquia || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ) : (
                        <Badge variant="secondary">Não</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {contrato.aplicarFranquia ? (
                        <div className="flex flex-col">
                          <span className="font-medium">{contrato.volumeFranquia || 0}</span>
                          <span className="text-xs text-muted-foreground">exames</span>
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        R$ {Number(contrato.valorIntegracao ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        R$ {Number((contrato as any).configuracoesIntegracao?.valor_portal_laudos ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={
                        contrato.diasParaVencer < 0 ? 'text-red-600 font-semibold bg-red-100 px-2 py-1 rounded' : 
                        contrato.diasParaVencer <= 60 ? 'text-yellow-700 font-semibold bg-yellow-100 px-2 py-1 rounded' : 
                        'text-green-600 font-medium'
                      }>
                        {contrato.diasParaVencer} dias
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setContratoVisualizando(contrato);
                            setShowVisualizarContrato(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setContratoEditando(contrato);
                            setShowEditarContrato(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog unificado para visualizar/editar contrato */}
      <Dialog open={showVisualizarContrato || showEditarContrato} onOpenChange={(open) => {
        if (!open) {
          setShowVisualizarContrato(false);
          setShowEditarContrato(false);
          setContratoVisualizando(null);
          setContratoEditando(null);
        }
      }}>
        <DialogContent className="w-[98vw] max-w-[98vw] max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-600" />
                {showEditarContrato ? 'Editar' : 'Visualizar'} Contrato — {(contratoVisualizando || contratoEditando)?.cliente}
              </DialogTitle>
              {!showEditarContrato && (
                <Button 
                  onClick={() => {
                    setContratoEditando(contratoVisualizando);
                    setShowEditarContrato(true);
                    setShowVisualizarContrato(false);
                  }}
                  variant="outline"
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}
            </div>
          </DialogHeader>

          {(contratoVisualizando || contratoEditando) && (
            <div className="w-full space-y-6">
              {/* Tabs para alternar entre visualização atual e histórico */}
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "atual" | "historico")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="atual">Contrato Atual</TabsTrigger>
                  <TabsTrigger value="historico" className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Histórico
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="atual" className="w-full space-y-6">
                  {showEditarContrato && (
                    <div className="border rounded-lg p-4 bg-blue-50 space-y-4">
                      <h4 className="font-medium text-blue-900">Controle de Vigência</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label className="text-blue-800">Data de Vigência das Alterações *</Label>
                          <Input 
                            type="date" 
                            value={editDataVigencia} 
                            onChange={(e) => setEditDataVigencia(e.target.value)}
                            className="border-blue-300"
                          />
                          <p className="text-sm text-blue-600">A partir de quando as alterações serão aplicadas</p>
                        </div>
                        <div className="grid gap-2">
                          <Label className="text-blue-800">Descrição da Alteração</Label>
                          <Input 
                            placeholder="Ex: Reajuste anual, alteração de preços..."
                            value={editDescricaoAlteracao} 
                            onChange={(e) => setEditDescricaoAlteracao(e.target.value)}
                            className="border-blue-300"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Dados do Cliente */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Cliente</Label>
                      <p className="text-sm">{(contratoVisualizando || contratoEditando)?.cliente}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Número do Contrato</Label>
                      <p className="text-sm">{(contratoVisualizando || contratoEditando)?.numeroContrato || 'Não informado'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Razão Social</Label>
                      <p className="text-sm">{(contratoVisualizando || contratoEditando)?.razaoSocial || 'Não informado'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">CNPJ</Label>
                      <p className="text-sm">{(contratoVisualizando || contratoEditando)?.cnpj || 'Não informado'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Endereço</Label>
                      <p className="text-sm">{(contratoVisualizando || contratoEditando)?.endereco || 'Não informado'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Telefone</Label>
                      <p className="text-sm">{(contratoVisualizando || contratoEditando)?.telefone || 'Não informado'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Email Financeiro</Label>
                      <p className="text-sm">{(contratoVisualizando || contratoEditando)?.emailFinanceiro || 'Não informado'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Email Operacional</Label>
                      <p className="text-sm">{(contratoVisualizando || contratoEditando)?.emailOperacional || 'Não informado'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Responsável</Label>
                      <p className="text-sm">{(contratoVisualizando || contratoEditando)?.responsavel || 'Não informado'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Tipo Faturamento</Label>
                      <Badge variant="outline">
                        {(contratoVisualizando || contratoEditando)?.tipoFaturamento || 'CO-FT'}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Data de Início</Label>
                      {showEditarContrato ? (
                        <Input 
                          type="date" 
                          value={editDataInicio} 
                          onChange={(e) => setEditDataInicio(e.target.value)} 
                        />
                      ) : (
                        <p className="text-sm">{new Date((contratoVisualizando || contratoEditando)!.dataInicio).toLocaleDateString('pt-BR')}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Data de Fim</Label>
                      {showEditarContrato ? (
                        <Input 
                          type="date" 
                          value={editDataFim} 
                          onChange={(e) => setEditDataFim(e.target.value)} 
                        />
                      ) : (
                        <p className="text-sm">{new Date((contratoVisualizando || contratoEditando)!.dataFim).toLocaleDateString('pt-BR')}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Dia de Vencimento</Label>
                      {showEditarContrato ? (
                        <Input 
                          type="number" 
                          min="1"
                          max="31"
                          value={editDiaVencimento} 
                          onChange={(e) => setEditDiaVencimento(Number(e.target.value) || "")} 
                        />
                      ) : (
                        <p className="text-sm">{(contratoVisualizando || contratoEditando)?.diaVencimento || 'Não informado'}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Dia de Fechamento</Label>
                      <p className="text-sm">{(contratoVisualizando || contratoEditando)?.diaFechamento || 'Não informado'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Forma de Cobrança</Label>
                      <p className="text-sm">{(contratoVisualizando || contratoEditando)?.formaCobranca || 'Não informado'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Status</Label>
                      <Badge variant={
                        (contratoVisualizando || contratoEditando)?.status === 'Ativo' ? 'default' : 
                        (contratoVisualizando || contratoEditando)?.status === 'A Vencer' ? 'secondary' : 
                        (contratoVisualizando || contratoEditando)?.status === 'Vencido' ? 'destructive' :
                        (contratoVisualizando || contratoEditando)?.status === 'Inativo' ? 'outline' :
                        (contratoVisualizando || contratoEditando)?.status === 'Cancelado' ? 'destructive' :
                        'destructive'
                      }
                      className={
                        (contratoVisualizando || contratoEditando)?.status === 'Vencido' ? 'bg-red-600 text-white hover:bg-red-700' :
                        (contratoVisualizando || contratoEditando)?.status === 'A Vencer' ? 'bg-yellow-600 text-white hover:bg-yellow-700' :
                        ''
                      }
                      >
                        {(contratoVisualizando || contratoEditando)?.status}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Dias para Vencer</Label>
                      <p className="text-sm">{(contratoVisualizando || contratoEditando)?.diasParaVencer} dias</p>
                    </div>
                  </div>

                  {/* Ajustes de Faturamento */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Desconto (R$) - Ajuste de Faturamento</Label>
                      {showEditarContrato ? (
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={editDesconto} 
                          onChange={(e) => setEditDesconto(Number(e.target.value) || "")} 
                          placeholder="Ex: 150.00 (valor em reais para ajustes no período)"
                        />
                      ) : (
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={(contratoVisualizando || contratoEditando)?.descontoPercentual || ""} 
                          readOnly
                        />
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label>Acréscimo (R$) - Ajuste de Faturamento</Label>
                      {showEditarContrato ? (
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={editAcrescimo} 
                          onChange={(e) => setEditAcrescimo(Number(e.target.value) || "")} 
                          placeholder="Ex: 200.00 (valor em reais para ajustes no período)"
                        />
                      ) : (
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={(contratoVisualizando || contratoEditando)?.acrescimoPercentual || ""} 
                          readOnly
                        />
                      )}
                    </div>
                  </div>

                  {/* Configurações de Cobrança */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label>Valor Franquia</Label>
                      {showEditarContrato ? (
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={editFranqValor} 
                          onChange={(e) => setEditFranqValor(Number(e.target.value) || "")} 
                        />
                      ) : (
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={(contratoVisualizando || contratoEditando)?.configuracoesFranquia?.valor_franquia || ""} 
                          readOnly
                        />
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label>Valor Integração</Label>
                      {showEditarContrato ? (
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={editIntegraValor} 
                          onChange={(e) => setEditIntegraValor(Number(e.target.value) || "")} 
                        />
                      ) : (
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={(contratoVisualizando || contratoEditando)?.valorIntegracao || ""} 
                          readOnly
                        />
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label>Valor Portal Laudo</Label>
                      {showEditarContrato ? (
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={editPortalValor} 
                          onChange={(e) => setEditPortalValor(Number(e.target.value) || "")} 
                        />
                      ) : (
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={(contratoVisualizando || contratoEditando)?.configuracoesIntegracao?.valor_portal_laudos || ""} 
                          readOnly
                        />
                      )}
                    </div>
                  </div>

                  {/* Parâmetros Fiscais e Tributários */}
                  <div className="w-full border rounded-lg p-4 space-y-4 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <Label className="text-lg font-semibold">Parâmetros Fiscais e Tributários</Label>
                      <p className="text-sm text-muted-foreground">
                        {showEditarContrato ? 'Edite os parâmetros de tributação' : 'Visualização dos parâmetros'}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="grid gap-2">
                        <Label>Simples Nacional</Label>
                        {showEditarContrato ? (
                          <div className="flex items-center space-x-2 h-10">
                            <Checkbox 
                              checked={editSimples}
                              onCheckedChange={(checked) => setEditSimples(!!checked)}
                            />
                            <span className="text-sm">{editSimples ? 'Sim - Sem retenção de impostos' : 'Não - Regime normal'}</span>
                          </div>
                        ) : (
                          <Badge variant={(contratoVisualizando || contratoEditando)?.simples ? 'default' : 'secondary'}>
                            {(contratoVisualizando || contratoEditando)?.simples ? 'Sim' : 'Não'}
                          </Badge>
                        )}
                      </div>
                      <div className="grid gap-2">
                        <Label>Percentual ISS (%)</Label>
                        {showEditarContrato ? (
                          <Input 
                            type="number" 
                            step="0.01" 
                            value={editPercentualISS} 
                            onChange={(e) => setEditPercentualISS(Number(e.target.value) || "")} 
                            placeholder="Ex: 5.00"
                          />
                        ) : (
                          <Input 
                            type="number" 
                            step="0.01" 
                            value={(contratoVisualizando || contratoEditando)?.percentualISS || ""} 
                            readOnly
                          />
                        )}
                      </div>
                      <div className="grid gap-2">
                        <Label>Impostos Mínimo (R$)</Label>
                        {showEditarContrato ? (
                          <Input 
                            type="number" 
                            step="0.01" 
                            value={editImpostosAbMin} 
                            onChange={(e) => setEditImpostosAbMin(Number(e.target.value) || "")} 
                            placeholder="Ex: 50.00"
                          />
                        ) : (
                          <Input 
                            type="number" 
                            step="0.01" 
                            value={(contratoVisualizando || contratoEditando)?.impostosAbMin || ""} 
                            readOnly
                          />
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Aplicar Franquia</Label>
                        {showEditarContrato ? (
                          <div className="flex items-center space-x-2 h-10">
                            <Checkbox 
                              checked={editAplicarFranquia}
                              onCheckedChange={(checked) => setEditAplicarFranquia(!!checked)}
                            />
                            <span className="text-sm">{editAplicarFranquia ? 'Sim - Cliente possui franquia' : 'Não'}</span>
                          </div>
                        ) : (
                          <Badge variant={(contratoVisualizando || contratoEditando)?.aplicarFranquia ? 'default' : 'secondary'}>
                            {(contratoVisualizando || contratoEditando)?.aplicarFranquia ? 'Sim' : 'Não'}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="grid gap-2">
                        <Label>Volume Franquia</Label>
                        {showEditarContrato ? (
                          <Input 
                            type="number" 
                            value={editVolumeFranquia} 
                            onChange={(e) => setEditVolumeFranquia(Number(e.target.value) || "")} 
                            placeholder="Ex: 500"
                          />
                        ) : (
                          <Input 
                            type="number" 
                            value={(contratoVisualizando || contratoEditando)?.volumeFranquia || ""} 
                            readOnly
                          />
                        )}
                      </div>
                      <div className="grid gap-2">
                        <Label>Frequência Contínua</Label>
                        {showEditarContrato ? (
                          <div className="flex items-center space-x-2 h-10">
                            <Checkbox 
                              checked={editFrequenciaContinua}
                              onCheckedChange={(checked) => setEditFrequenciaContinua(!!checked)}
                            />
                            <span className="text-sm">{editFrequenciaContinua ? 'Sim - Cobra sempre' : 'Não - Só com volume'}</span>
                          </div>
                        ) : (
                          <Badge variant={(contratoVisualizando || contratoEditando)?.frequenciaContinua ? 'default' : 'secondary'}>
                            {(contratoVisualizando || contratoEditando)?.frequenciaContinua ? 'Sim' : 'Não'}
                          </Badge>
                        )}
                      </div>
                      <div className="grid gap-2">
                        <Label>Frequência por Volume</Label>
                        {showEditarContrato ? (
                          <Select value={editFrequenciaPorVolume} onValueChange={(value: "sim" | "nao" | "vazio") => setEditFrequenciaPorVolume(value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="vazio">(Vazio) - Só cobra se volume abaixo</SelectItem>
                              <SelectItem value="sim">Sim - Considera volume</SelectItem>
                              <SelectItem value="nao">Não - Volume não interfere</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={
                            (contratoVisualizando || contratoEditando)?.frequenciaPorVolume === true ? 'default' :
                            (contratoVisualizando || contratoEditando)?.frequenciaPorVolume === false ? 'secondary' :
                            'outline'
                          }>
                            {(contratoVisualizando || contratoEditando)?.frequenciaPorVolume === true ? 'Sim' :
                             (contratoVisualizando || contratoEditando)?.frequenciaPorVolume === false ? 'Não' :
                             '(Vazio)'}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Valor Acima Franquia (R$)</Label>
                        {showEditarContrato ? (
                          <Input 
                            type="number" 
                            step="0.01" 
                            value={editValorAcimaFranquia} 
                            onChange={(e) => setEditValorAcimaFranquia(Number(e.target.value) || "")} 
                            placeholder="Ex: 600.00 (cobrado quando volume > Volume Franquia)"
                          />
                        ) : (
                          <Input 
                            type="number" 
                            step="0.01" 
                            value={(contratoVisualizando || contratoEditando)?.valorAcimaFranquia || ""} 
                            readOnly
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Condições de Preço (Faixas por Serviço) */}
                  <div className="w-full border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-lg font-semibold">Condições de Preço (Faixas por Serviço)</Label>
                      <p className="text-sm text-muted-foreground">
                        {showEditarContrato ? 'Edite os valores e ative/inative serviços' : 'Visualização das condições de preço'}
                      </p>
                    </div>
                    
                    {loadingPrecos ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : precosCliente.length > 0 ? (
                      <div className="w-full overflow-x-auto">
                          <Table className="min-w-full">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-[100px]">Modalidade</TableHead>
                              <TableHead className="min-w-[120px]">Especialidade</TableHead>
                              <TableHead className="min-w-[100px]">Categoria</TableHead>
                              <TableHead className="min-w-[100px]">Prioridade</TableHead>
                              <TableHead className="min-w-[80px]">Vol. Inicial</TableHead>
                              <TableHead className="min-w-[80px]">Vol. Final</TableHead>
                              <TableHead className="min-w-[100px]">Cond. Volume</TableHead>
                              <TableHead className="min-w-[120px]">Valor Base</TableHead>
                              <TableHead className="min-w-[120px]">Valor Urgência</TableHead>
                              <TableHead className="min-w-[80px]">Plantão</TableHead>
                              {showEditarContrato && <TableHead className="min-w-[100px]">Ativo</TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {precosCliente.map((preco, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{preco.modalidade}</TableCell>
                                <TableCell>{preco.especialidade}</TableCell>
                                <TableCell>{preco.categoria}</TableCell>
                                <TableCell>{preco.prioridade}</TableCell>
                                <TableCell>{preco.volume_inicial || 0}</TableCell>
                                <TableCell>{preco.volume_final || 999999}</TableCell>
                                <TableCell>{preco.cond_volume || 'MOD/ESP/CAT'}</TableCell>
                                <TableCell>
                                  {showEditarContrato ? (
                                    <Input 
                                      type="number" 
                                      step="0.01" 
                                      value={preco.valor_base || ""} 
                                      onChange={(e) => {
                                        const novosPrecos = [...precosCliente];
                                        novosPrecos[idx] = { ...preco, valor_base: Number(e.target.value) || 0 };
                                        setPrecosCliente(novosPrecos);
                                      }}
                                      className="w-24"
                                    />
                                  ) : (
                                    `R$ ${Number(preco.valor_base || 0).toFixed(2)}`
                                  )}
                                </TableCell>
                                <TableCell>
                                  {showEditarContrato ? (
                                    <Input 
                                      type="number" 
                                      step="0.01" 
                                      value={preco.valor_urgencia || ""} 
                                      onChange={(e) => {
                                        const novosPrecos = [...precosCliente];
                                        novosPrecos[idx] = { ...preco, valor_urgencia: Number(e.target.value) || 0 };
                                        setPrecosCliente(novosPrecos);
                                      }}
                                      className="w-24"
                                    />
                                  ) : (
                                    `R$ ${Number(preco.valor_urgencia || 0).toFixed(2)}`
                                  )}
                                </TableCell>
                                <TableCell>
                                  {showEditarContrato ? (
                                    <Checkbox 
                                      checked={preco.considera_prioridade_plantao || false} 
                                      onCheckedChange={(checked) => {
                                        const novosPrecos = [...precosCliente];
                                        novosPrecos[idx] = { ...preco, considera_prioridade_plantao: checked === true };
                                        setPrecosCliente(novosPrecos);
                                      }}
                                    />
                                  ) : (
                                    preco.considera_prioridade_plantao ? 'Sim' : 'Não'
                                  )}
                                </TableCell>
                                {showEditarContrato && (
                                  <TableCell>
                                    <Checkbox 
                                      checked={preco.ativo !== false} 
                                      onCheckedChange={(checked) => {
                                        const novosPrecos = [...precosCliente];
                                        novosPrecos[idx] = { ...preco, ativo: checked === true };
                                        setPrecosCliente(novosPrecos);
                                      }}
                                    />
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Nenhuma condição de preço cadastrada para este cliente.</p>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="historico">
                  <Card>
                    <CardHeader>
                      <CardTitle>Histórico de Alterações</CardTitle>
                      <CardDescription>
                        Histórico de modificações realizadas no contrato
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loadingHistorico ? (
                        <div className="flex justify-center py-4">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                      ) : historicoContrato.length > 0 ? (
                        <div className="space-y-4">
                          {historicoContrato.map((item, idx) => (
                            <div key={idx} className="border rounded-lg p-4">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <p className="font-medium">{item.tipo_alteracao}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {item.descricao_alteracao}
                                  </p>
                                </div>
                                <div className="text-right text-sm text-muted-foreground">
                                  <p>{new Date(item.created_at).toLocaleDateString('pt-BR')}</p>
                                  <p>Vigência: {new Date(item.data_vigencia_inicio).toLocaleDateString('pt-BR')}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">Nenhuma alteração registrada para este contrato.</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {showEditarContrato && (
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowEditarContrato(false);
                setContratoEditando(null);
              }}>
                Cancelar
              </Button>
              <Button onClick={salvarContrato}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Salvar Alterações
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}