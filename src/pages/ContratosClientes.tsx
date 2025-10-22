import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CorrigirContratosDuplicados } from "@/components/CorrigirContratosDuplicados";
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
  diaFechamento?: number;
  formaCobranca?: string;
  parametrosStatus?: string;
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
      let parametrosPorCliente: Record<string, any> = {};
      
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

      // Transformar dados do Supabase para o formato da interface
      const contratosFormatados: ContratoCliente[] = (contratosData || []).map(contrato => {
        const cliente = contrato.clientes;
        const parametros = parametrosPorCliente[contrato.cliente_id] || null;
        
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
          portal_laudos: parametros.portal_laudos
        } : (typeof contrato.configuracoes_integracao === 'object' && contrato.configuracoes_integracao) ? contrato.configuracoes_integracao as any : {};

        return {
          id: contrato.id,
          clienteId: cliente?.id || '',
          cliente: cliente?.nome_fantasia || cliente?.nome || 'Cliente não encontrado',
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
          descontoPercentual: Number(contrato.desconto_percentual || 0),
          acrescimoPercentual: Number(contrato.acrescimo_percentual || 0),
          faixasVolume: Array.isArray(contrato.faixas_volume) ? contrato.faixas_volume : [],
          configuracoesFranquia: configuracoesFranquia,
          configuracoesIntegracao: configuracoesIntegracao,
          termosAditivos: [],
          documentos: [],
          // Usar dados dos parâmetros de faturamento para sincronização
          numeroContrato: parametros?.numero_contrato || contrato.numero_contrato || `CT-${contrato.id.slice(-8)}`,
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
          // Campos adicionais dos parâmetros
          diaFechamento: parametros?.dia_fechamento ?? contrato.dia_fechamento ?? 7,
          formaCobranca: parametros?.forma_cobranca ?? 'mensal',
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
        const { data, error } = await supabase
          .from('precos_servicos')
          .select('modalidade, especialidade, categoria, prioridade, volume_inicial, volume_final, valor_base, valor_urgencia, considera_prioridade_plantao')
          .eq('cliente_id', clienteId)
          .order('modalidade', { ascending: true });
        if (error) throw error;
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
      
      // Definir data de vigência padrão como hoje
      const hoje = new Date().toISOString().slice(0, 10);
      setEditDataVigencia(hoje);
      setEditDescricaoAlteracao("");
    }
  }, [contratoEditando]);

  // Função para gerar contratos automaticamente
  const gerarContratosAutomaticos = async () => {
    try {
      setIsCreatingContracts(true);
      
      // 1. Buscar todos os clientes ativos primeiro
      const { data: todosClientes, error: clientesError } = await supabase
        .from('clientes')
        .select('*')
        .eq('ativo', true);
      
      if (clientesError) throw clientesError;
      
      // 2. Filtrar clientes que já têm contrato
      const clienteIdsComContrato = contratos.map(c => c.clienteId);
      const clientesSemContrato = todosClientes?.filter(cliente => 
        !clienteIdsComContrato.includes(cliente.id)
      ) || [];
      
      if (clientesSemContrato.length === 0) {
        toast({
          title: "Nenhum cliente encontrado",
          description: "Todos os clientes ativos já possuem contratos.",
          variant: "default",
        });
        return;
      }

      console.log(`🔍 Encontrados ${clientesSemContrato.length} clientes sem contrato`);

      let contratosGerados = 0;
      
      for (const cliente of clientesSemContrato) {
        // 2. Buscar preços configurados para o cliente
        const { data: precosCliente, error: precosError } = await supabase
          .from('precos_servicos')
          .select('*')
          .eq('cliente_id', cliente.id);
        
        if (precosError) {
          console.error(`Erro ao buscar preços para cliente ${cliente.nome}:`, precosError);
          continue;
        }

        // 3. Buscar parâmetros de faturamento para o cliente
        const { data: parametrosCliente, error: parametrosError } = await supabase
          .from('parametros_faturamento')
          .select('*')
          .eq('cliente_id', cliente.id)
          .eq('status', 'A')
          .maybeSingle();

        if (parametrosError) {
          console.error(`Erro ao buscar parâmetros para cliente ${cliente.nome}:`, parametrosError);
        }
        
        // 4. Calcular data de início e fim do contrato
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
            valor_urgencia: preco.valor_urgencia,
            volume_inicial: preco.volume_inicial,
            volume_final: preco.volume_final
          })) : [];

        // Preparar configurações baseadas nos parâmetros de faturamento
        const configuracoesFranquia = parametrosCliente ? {
            tem_franquia: parametrosCliente.aplicar_franquia,
            valor_franquia: parametrosCliente.valor_franquia,
            volume_franquia: parametrosCliente.volume_franquia,
            valor_acima_franquia: parametrosCliente.valor_acima_franquia,
            frequencia_continua: parametrosCliente.frequencia_continua,
            frequencia_por_volume: parametrosCliente.frequencia_por_volume
          } : {};

        const configuracoesIntegracao = parametrosCliente ? {
          cobra_integracao: parametrosCliente.cobrar_integracao,
          valor_integracao: parametrosCliente.valor_integracao,
          portal_laudos: parametrosCliente.portal_laudos,
          incluir_medico_solicitante: parametrosCliente.incluir_medico_solicitante,
          incluir_access_number: parametrosCliente.incluir_access_number,
          incluir_empresa_origem: parametrosCliente.incluir_empresa_origem
        } : {};
        
        // 5. Criar contrato no banco
        // Usar número de contrato dos parâmetros se disponível, senão gerar automaticamente
        const numeroContrato = parametrosCliente?.numero_contrato || `CT-${Date.now()}-${cliente.id.slice(-8)}`;
        
        const { error: contratoError } = await supabase
          .from('contratos_clientes')
          .insert({
            cliente_id: cliente.id,
            numero_contrato: numeroContrato,
            data_inicio: dataInicio,
            data_fim: dataFim.toISOString().split('T')[0],
            status: 'ativo',
            servicos_contratados: servicosContratados,
            modalidades: precosCliente && precosCliente.length > 0 ? [...new Set(precosCliente.map(p => p.modalidade))] : [],
            especialidades: precosCliente && precosCliente.length > 0 ? [...new Set(precosCliente.map(p => p.especialidade))] : [],
            tem_precos_configurados: precosCliente && precosCliente.length > 0,
            tem_parametros_configurados: parametrosCliente ? true : false,
            considera_plantao: false,
            cond_volume: 'MOD/ESP/CAT',
            dia_vencimento: parametrosCliente?.forma_cobranca === 'Mensal' ? 10 : 30,
            desconto_percentual: 0,
            acrescimo_percentual: 0,
            faixas_volume: [],
            configuracoes_franquia: configuracoesFranquia,
            configuracoes_integracao: configuracoesIntegracao,
            // Campos adicionais dos parâmetros
            tipo_faturamento: parametrosCliente?.tipo_faturamento || 'CO-FT',
            forma_pagamento: parametrosCliente?.forma_cobranca || 'Mensal',
            observacoes_contratuais: (precosCliente && precosCliente.length > 0) 
              ? (parametrosCliente ? `Parâmetros: ${parametrosCliente.tipo_faturamento || 'CO-FT'}` : 'Aguardando configuração de parâmetros')
              : 'Aguardando configuração de preços e parâmetros'
          });
        
        if (contratoError) {
          console.error(`Erro ao criar contrato para cliente ${cliente.nome}:`, contratoError);
          continue;
        }
        
        contratosGerados++;
      }
      
      toast({
        title: "Contratos gerados com sucesso!",
        description: `${contratosGerados} contratos foram criados automaticamente com seus respectivos parâmetros.`,
      });
      
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
            valor_franquia: Number(editFranqValor || 0),
          },
          configuracoes_integracao: {
            valor_integracao: Number(editIntegraValor || 0),
            valor_portal_laudos: Number(editPortalValor || 0),
          },
        })
        .eq('id', contratoEditando.id);

      if (error) throw error;

      toast({
        title: "Contrato atualizado",
        description: "As alterações foram salvas com sucesso.",
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
  const sincronizarCodigosOmie = async () => {
    try {
      setSincronizandoOmie(true);
      
      toast({
        title: "Iniciando sincronização",
        description: "Buscando códigos reais dos clientes no Omie...",
      });

      const { data, error } = await supabase.functions.invoke('sincronizar-codigo-cliente-omie', {
        body: {
          apenas_sem_codigo: true, // sincronizar apenas clientes sem código Omie
          limite: 1000
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      const resultado = data;
      
      if (resultado.success) {
        toast({
          title: "Sincronização concluída",
          description: `${resultado.atualizados} códigos Omie sincronizados com sucesso. ${resultado.nao_encontrados} não encontrados no Omie.`,
        });

        // Recarregar contratos para exibir os códigos atualizados
        await carregarContratos();
      } else {
        throw new Error(resultado.error || 'Erro desconhecido na sincronização');
      }

    } catch (error: any) {
      console.error('Erro ao sincronizar códigos Omie:', error);
      toast({
        title: "Erro na sincronização",
        description: error.message || 'Erro desconhecido',
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
      
      {/* Seção de Correção de Contratos Duplicados */}
      <CorrigirContratosDuplicados />
      
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
          onClick={sincronizarCodigosOmie}
          disabled={sincronizandoOmie}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {sincronizandoOmie ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Sincronizando...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Sincronizar Códigos Omie
            </>
          )}
        </Button>

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
                      {contrato.cobrancaIntegracao ? (
                        <div className="flex flex-col">
                          <Badge variant="default" className="mb-1">Sim</Badge>
                          <span className="text-xs">
                            R$ {Number(contrato.valorIntegracao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ) : (
                        <Badge variant="secondary">Não</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={contrato.portalLaudos ? 'default' : 'secondary'}>
                        {contrato.portalLaudos ? 'Sim' : 'Não'}
                      </Badge>
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
                      <Label className="text-sm font-medium">CNPJ</Label>
                      <p className="text-sm">{(contratoVisualizando || contratoEditando)?.cnpj || 'Não informado'}</p>
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
                              <TableHead className="min-w-[100px]">Vol. Inicial</TableHead>
                              <TableHead className="min-w-[100px]">Vol. Final</TableHead>
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
                                <TableCell>{preco.volume_inicial}</TableCell>
                                <TableCell>{preco.volume_final}</TableCell>
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