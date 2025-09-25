import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  FileSpreadsheet, 
  Download, 
  Search, 
  Filter,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Calendar,
  FileText,
  AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
interface ClienteFaturamento {
  id: string;
  nome: string;
  email: string;
  total_exames: number;
  valor_bruto: number;
  valor_liquido: number;
  periodo: string;
  status_pagamento: 'pendente' | 'pago' | 'vencido';
  data_vencimento: string;
  observacoes?: string;
  tipo_faturamento?: string; // ✅ ADICIONAR tipo_faturamento
  alertas?: string[]; // ✅ ADICIONAR alertas
  detalhes_exames?: Array<{
    modalidade: string;
    especialidade: string;
    categoria: string;
    prioridade: string;
    quantidade: number;
    valor_unitario: number;
    valor_total: number;
    status: string;
  }>;
}

// Função auxiliar para formatar período YYYY-MM para formato abreviado
const formatarPeriodoAbreviado = (periodo: string): string => {
  try {
    const [ano, mes] = periodo.split('-');
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const mesAbrev = meses[parseInt(mes) - 1] || mes;
    return `${mesAbrev}/${ano.slice(2)}`;
  } catch {
    return periodo;
  }
};

export default function DemonstrativoFaturamento() {
  const { toast } = useToast();
  const [clientes, setClientes] = useState<ClienteFaturamento[]>([]);
  const [clientesFiltrados, setClientesFiltrados] = useState<ClienteFaturamento[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [periodo, setPeriodo] = useState("2025-06"); // Período com dados carregados
  const [ordemAlfabetica, setOrdemAlfabetica] = useState(true);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const hasShownInitialToast = useRef(false);
  // Evita correções em loop: registra tentativas por período e status de execução
  const tcCorrectionTried = useRef<Set<string>>(new Set());
  const tcCorrectionRunning = useRef(false);

  // Discrepâncias Volumetria x Demonstrativos
  type DiscrepanciasResumo = {
    volumetriaSemNCNF: number;
    volumetriaNCNF: number;
    demonstrativos: number;
    diferencaReal: number;
    porCliente: Array<{
      cliente: string;
      volumetriaSemNCNF: number;
      demonstrativos: number;
      diff: number;
      combosFaltantes?: Array<{
        modalidade: string;
        especialidade: string;
        categoria: string;
        prioridade: string;
        quantidade: number;
      }>;
    }>
  };
  const [discrepancias, setDiscrepancias] = useState<DiscrepanciasResumo | null>(null);

  const verificarDiscrepancias = async () => {
    try {
      // Carregar volumetria do período (para análise, não para UI)
      const { data: vmData, error: vmErr } = await supabase
        .from('volumetria_mobilemed')
        .select('\"Cliente_Nome_Fantasia\", tipo_faturamento, \"VALORES\", \"MODALIDADE\", \"ESPECIALIDADE\", \"CATEGORIA\", \"PRIORIDADE\"')
        .eq('periodo_referencia', periodo)
        .limit(50000);
      if (vmErr) console.warn('Erro volumetria para discrepâncias:', vmErr);

      // Carregar demonstrativos (faturamento) do período
      const { data: fatData, error: fatErr } = await supabase
        .from('faturamento')
        .select('cliente_nome, quantidade, modalidade, especialidade, categoria, prioridade, periodo_referencia, tipo_faturamento')
        .eq('periodo_referencia', periodo)
        .limit(50000);
      if (fatErr) console.warn('Erro faturamento para discrepâncias:', fatErr);

      const norm = (s?: string | null) => (s || '').toString().trim().toUpperCase();

      // Mapas agregados
      const vmPorCliente: Record<string, number> = {};
      const vmPorClienteCombos: Record<string, Record<string, number>> = {};
      let totalSemNCNF = 0;
      let totalNCNF = 0;

      (vmData || []).forEach((r: any) => {
        const cliente = norm(r.Cliente_Nome_Fantasia || r.EMPRESA);
        const qtd = Number(r.VALORES || 0);
        const tipo = norm(r.tipo_faturamento);
        if (tipo === 'NC-NF') {
          totalNCNF += qtd;
          return; // ignora no cálculo de diferença real
        }
        totalSemNCNF += qtd;
        vmPorCliente[cliente] = (vmPorCliente[cliente] || 0) + qtd;
        const chaveCombo = `${norm(r.MODALIDADE)}|${norm(r.ESPECIALIDADE)}|${norm(r.CATEGORIA)}|${norm(r.PRIORIDADE)}`;
        vmPorClienteCombos[cliente] = vmPorClienteCombos[cliente] || {};
        vmPorClienteCombos[cliente][chaveCombo] = (vmPorClienteCombos[cliente][chaveCombo] || 0) + qtd;
      });

      const fatPorCliente: Record<string, number> = {};
      const fatPorClienteCombos: Record<string, Record<string, number>> = {};
      let totalFat = 0;
      (fatData || []).forEach((r: any) => {
        const cliente = norm(r.cliente_nome);
        const qtd = Number(r.quantidade || 0);
        totalFat += qtd;
        fatPorCliente[cliente] = (fatPorCliente[cliente] || 0) + qtd;
        const chaveCombo = `${norm(r.modalidade)}|${norm(r.especialidade)}|${norm(r.categoria)}|${norm(r.prioridade)}`;
        fatPorClienteCombos[cliente] = fatPorClienteCombos[cliente] || {};
        fatPorClienteCombos[cliente][chaveCombo] = (fatPorClienteCombos[cliente][chaveCombo] || 0) + qtd;
      });

      // Construir diferenças por cliente (somente não-NC-NF)
      const clientesSet = new Set([...Object.keys(vmPorCliente), ...Object.keys(fatPorCliente)]);
      const porCliente = Array.from(clientesSet).map((cliente) => {
        const vm = vmPorCliente[cliente] || 0;
        const ft = fatPorCliente[cliente] || 0;
        let combosFaltantes: any[] | undefined;
        if (vm > ft) {
          const faltantes: any[] = [];
          const vmCombos = vmPorClienteCombos[cliente] || {};
          const ftCombos = fatPorClienteCombos[cliente] || {};
          Object.entries(vmCombos).forEach(([combo, qtdVm]) => {
            const qtdFt = ftCombos[combo] || 0;
            const diff = (qtdVm as number) - qtdFt;
            if (diff > 0) {
              const [modalidade, especialidade, categoria, prioridade] = combo.split('|');
              faltantes.push({ modalidade, especialidade, categoria, prioridade, quantidade: diff });
            }
          });
          combosFaltantes = faltantes.sort((a, b) => b.quantidade - a.quantidade).slice(0, 5);
        }
        return {
          cliente,
          volumetriaSemNCNF: vm,
          demonstrativos: ft,
          diff: vm - ft,
          combosFaltantes,
        };
      }).filter(c => c.volumetriaSemNCNF > 0);

      setDiscrepancias({
        volumetriaSemNCNF: totalSemNCNF,
        volumetriaNCNF: totalNCNF,
        demonstrativos: totalFat,
        diferencaReal: totalSemNCNF - totalFat,
        porCliente: porCliente
          .filter(c => c.diff !== 0)
          .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
          .slice(0, 20),
      });
    } catch (e) {
      console.error('Erro ao verificar discrepâncias:', e);
    }
  };

  const corrigirCategoriasTC = async () => {
    try {
      const response = await supabase.functions.invoke('corrigir-categoria-tc', {
        body: { periodo_referencia: periodo }
      });

      if (response.error) {
        toast({
          title: "Erro ao corrigir categorias TC",
          description: response.error.message,
          variant: "destructive",
        });
        return;
      }

      const resultado = response.data;
      if (resultado.sucesso) {
        // Recarregar dados para refletir correções (sem toast para evitar loop)
        carregarDados();
        verificarDiscrepancias();
      }
    } catch (error) {
      console.error('Erro ao corrigir categorias TC:', error);
      toast({
        title: "Erro",
        description: "Falha ao corrigir categorias TC",
        variant: "destructive",
      });
    }
  };

  // Verificar e corrigir automaticamente categorias TC ao carregar (apenas 1x por período)
  useEffect(() => {
    if (clientes.length === 0) return;
    const hasTC = clientes.some((cliente) =>
      cliente.detalhes_exames?.some((detalhe: any) => detalhe.categoria === 'TC')
    );
    if (!hasTC) return;

    if (tcCorrectionTried.current.has(periodo) || tcCorrectionRunning.current) return;

    tcCorrectionRunning.current = true;
    console.log('Detectada categoria TC inválida - corrigindo automaticamente (uma vez) para período:', periodo);
    corrigirCategoriasTC()
      .catch((e) => console.warn('Correção TC falhou:', e))
      .finally(() => {
        tcCorrectionTried.current.add(periodo);
        tcCorrectionRunning.current = false;
      });
  }, [clientes, periodo]);

  useEffect(() => {
    verificarDiscrepancias();
  }, [periodo]);

  // Carregar dados de faturamento
  const buscarTipoFaturamento = async (clienteNome: string): Promise<string> => {
    try {
      // 1. Primeiro buscar nos parâmetros ativos (mais confiável)
      const { data: parametros } = await supabase
        .from('clientes')
        .select(`
          nome, nome_fantasia, nome_mobilemed,
          parametros_faturamento!inner(tipo_faturamento, status)
        `)
        .eq('parametros_faturamento.status', 'A')
        .or(`nome.eq.${clienteNome},nome_fantasia.eq.${clienteNome},nome_mobilemed.eq.${clienteNome}`)
        .limit(1);

      if (parametros?.[0]?.parametros_faturamento?.[0]?.tipo_faturamento) {
        return parametros[0].parametros_faturamento[0].tipo_faturamento;
      }

      // 2. Fallback: buscar nos contratos ativos
      const { data: clienteContrato } = await supabase
        .from('clientes')
        .select(`
          nome, nome_fantasia, nome_mobilemed,
          contratos_clientes!inner(tipo_faturamento, status)
        `)
        .eq('contratos_clientes.status', 'ativo')
        .or(`nome.eq.${clienteNome},nome_fantasia.eq.${clienteNome},nome_mobilemed.eq.${clienteNome}`)
        .limit(1);

      if (clienteContrato?.[0]?.contratos_clientes?.[0]?.tipo_faturamento) {
        return clienteContrato[0].contratos_clientes[0].tipo_faturamento;
      }

      return 'Não definido';
    } catch (error) {
      console.error('Erro ao buscar tipo de faturamento:', error);
      return 'Não definido';
    }
  };

  const carregarDados = async () => {
    setCarregando(true);
    try {
      console.log('🔍 Carregando demonstrativo de faturamento para período:', periodo);
      
      // ✅ CARREGAR SOMENTE de demonstrativos_completos (unificação)
      const demonstrativosCompletos = localStorage.getItem(`demonstrativos_completos_${periodo}`);
      if (demonstrativosCompletos) {
        try {
          const dados = JSON.parse(demonstrativosCompletos);
          console.log('📋 Dados encontrados no localStorage:', dados);
          
          // Verificar se temos demonstrativos válidos
          if (dados.demonstrativos && Array.isArray(dados.demonstrativos) && dados.demonstrativos.length > 0) {
            console.log('📋 Demonstrativos completos encontrados no localStorage:', dados.demonstrativos.length);
            
            // ✅ Converter formato dos demonstrativos completos para o formato esperado
            const clientesRaw: ClienteFaturamento[] = dados.demonstrativos
              .filter((demo: any) => demo && (demo.cliente_nome || demo.nome_cliente) && demo.valor_total > 0) // Filtrar valor_total > 0
              .map((demo: any) => {
                const nomeCliente = demo.cliente_nome || demo.nome_cliente || 'Cliente sem nome';
                const emailCliente = demo.cliente_email || demo.email_cliente || 
                  `${nomeCliente.toLowerCase().replace(/[^a-z0-9]/g, '')}@cliente.com`;
                
                 return {
                   id: demo.cliente_id || `temp-${nomeCliente}`,
                   nome: nomeCliente,
                   email: emailCliente,
                   total_exames: demo.total_exames || 0,
                   valor_bruto: Number(demo.valor_bruto ?? demo.valor_exames ?? 0),
                   valor_liquido: Number((demo.valor_total ?? demo.valor_liquido ?? ((demo.valor_bruto ?? demo.valor_exames ?? 0) - (demo.valor_impostos ?? 0)))),
                   periodo: periodo,
                   status_pagamento: 'pendente' as const,
                   data_vencimento: new Date().toISOString().split('T')[0],
                   // Não assumir CO-FT por padrão; vamos enriquecer com dados do banco abaixo
                   tipo_faturamento: demo.tipo_faturamento || undefined,
                   alertas: demo.alertas || [],
                   observacoes: `Exames: ${demo.total_exames || 0} | Franquia: R$ ${(demo.valor_franquia || 0).toFixed(2)} | Portal: R$ ${(demo.valor_portal_laudos || 0).toFixed(2)} | Integração: R$ ${(demo.valor_integracao || 0).toFixed(2)} | Impostos: R$ ${(demo.valor_impostos || 0).toFixed(2)}`,
                   detalhes_exames: demo.detalhes_exames || []
                 };
               });

            // ✅ DEDUPLICAR CLIENTES POR NOME (corrige problema de duplicação)
            const clientesMap = new Map<string, ClienteFaturamento>();
            clientesRaw.forEach(cliente => {
              const existing = clientesMap.get(cliente.nome);
              if (!existing || cliente.valor_liquido > existing.valor_liquido) {
                // Manter o cliente com maior valor ou o primeiro se valores iguais
                clientesMap.set(cliente.nome, cliente);
              }
            });
            
            const clientesConvertidos = Array.from(clientesMap.values());
            console.log(`✅ Deduplicação: ${clientesRaw.length} registros → ${clientesConvertidos.length} clientes únicos`);
            
            if (clientesConvertidos.length > 0) {
               // Enriquecer tipo_faturamento a partir dos PARÂMETROS PRIMEIRO (mais confiável), depois contratos
               try {
                 const nomes = [...new Set(clientesConvertidos.map((c) => c.nome))];
                 
                 // 1. Buscar tipo_faturamento dos PARÂMETROS (prioritário)
                 const { data: tiposParam } = await supabase
                   .from('clientes')
                   .select(`
                     nome, nome_fantasia, nome_mobilemed,
                     parametros_faturamento!inner(tipo_faturamento, status)
                   `)
                   .eq('parametros_faturamento.status', 'A')
                   .limit(50000);
                 
                 const mapTiposParam = new Map<string, string>();
                 (tiposParam || []).forEach((cli: any) => {
                   const tipo = cli.parametros_faturamento?.[0]?.tipo_faturamento;
                   if (!tipo) return;
                   [cli.nome, cli.nome_fantasia, cli.nome_mobilemed].forEach((nm: string) => {
                     if (nm) mapTiposParam.set(nm, tipo);
                   });
                 });
                 
                 // 2. Fallback: buscar da tabela faturamento apenas se não encontrou nos parâmetros
                 const { data: tiposFat } = await supabase
                   .from('faturamento')
                   .select('cliente_nome, tipo_faturamento')
                   .eq('periodo_referencia', periodo)
                   .in('cliente_nome', nomes)
                   .not('tipo_faturamento', 'is', null)
                   .limit(50000);
                 const mapTiposFat = new Map<string, string>();
                 (tiposFat || []).forEach((r: any) => {
                   if (r.cliente_nome && r.tipo_faturamento) mapTiposFat.set(r.cliente_nome, r.tipo_faturamento);
                 });
                 
                 let enriquecidos = clientesConvertidos.map((c) => ({
                   ...c,
                   tipo_faturamento: c.tipo_faturamento || mapTiposParam.get(c.nome) || mapTiposFat.get(c.nome)
                 }));
                 
                 // 3. Fallback final: buscar contratos ativos para clientes ainda sem tipo
                 const faltantes = enriquecidos.filter((c) => !c.tipo_faturamento).map((c) => c.nome);
                 if (faltantes.length > 0) {
                   const { data: contratos } = await supabase
                     .from('clientes')
                     .select('nome, nome_fantasia, nome_mobilemed, status, contratos_clientes!inner(tipo_faturamento, status)')
                     .eq('contratos_clientes.status', 'ativo');
                   const mapContratoTipos = new Map<string, string>();
                   (contratos || []).forEach((cli: any) => {
                     const tipo = cli.contratos_clientes?.[0]?.tipo_faturamento;
                     if (!tipo) return;
                     [cli.nome, cli.nome_fantasia, cli.nome_mobilemed].forEach((nm: string) => {
                       if (nm) mapContratoTipos.set(nm, tipo);
                     });
                   });
                   enriquecidos = enriquecidos.map((c) => ({
                     ...c,
                     tipo_faturamento: c.tipo_faturamento || mapContratoTipos.get(c.nome)
                   }));
                 }
                 setClientes(enriquecidos);
                setClientesFiltrados(enriquecidos);
              } catch (e) {
                console.warn('Não foi possível enriquecer tipo_faturamento dos demonstrativos locais:', e);
                setClientes(clientesConvertidos);
                setClientesFiltrados(clientesConvertidos);
              }
              setCarregando(false);
              
              if (!hasShownInitialToast.current) {
                toast({
                  title: "Demonstrativos carregados",
                  description: `${clientesConvertidos.length} demonstrativos completos encontrados para ${periodo}`,
                  variant: "default",
                });
                hasShownInitialToast.current = true;
              }
              
              return;
            }
          }
        } catch (error) {
          console.error('Erro ao processar demonstrativos do localStorage:', error);
        }
      }
      
      // Primeiro, verificar se há dados na tabela de faturamento
      const { data: todosFaturamento, error: erroTotal } = await supabase
        .from('faturamento')
        .select('periodo_referencia', { count: 'exact' });

      console.log('📊 Total de registros na tabela faturamento:', todosFaturamento?.length || 0);
      
      if (todosFaturamento && todosFaturamento.length > 0) {
        const periodosDisponiveis = [...new Set(todosFaturamento.map(f => f.periodo_referencia))];
        console.log('📅 Períodos disponíveis:', periodosDisponiveis);
      }
      
      // Converter período selecionado (YYYY-MM) para formato mon/YY (ex.: jun/25)
      const formatPeriodo = (yyyyMM: string) => {
        const [y, m] = yyyyMM.split('-');
        const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
        const mon = meses[Math.max(0, Math.min(11, Number(m) - 1))];
        return `${mon}/${y.slice(2)}`;
      };
      const periodoRef = formatPeriodo(periodo);
      
      console.log('🔍 Buscando dados para período de referência:', periodoRef);
      console.log('💡 Período original selecionado:', periodo);
      
      // BUSCAR TODOS os clientes únicos da volumetria do período usando EMPRESA  
      const { data: clientesVolumetria, error: errorVolumetria } = await supabase
        .from('volumetria_mobilemed')
        .select('"EMPRESA"')
        .eq('periodo_referencia', periodo) // Usar formato YYYY-MM direto
        .not('"EMPRESA"', 'is', null)
        .limit(50000); // Aumentar limite explicitamente
      
      console.log('📊 Clientes encontrados na volumetria (formato YYYY-MM):', clientesVolumetria?.length || 0);
      
      if (clientesVolumetria && clientesVolumetria.length > 0) {
        const clientesUnicos = [...new Set(clientesVolumetria.map(c => c.EMPRESA))];
        console.log('👥 Clientes únicos na volumetria:', clientesUnicos.length, clientesUnicos.slice(0, 5));
      }
      
      // Buscar dados de faturamento do período - AGRUPADOS POR NOME FANTASIA
      console.log('🔍 Iniciando busca na tabela faturamento com agrupamento por nome fantasia...');
      console.log('🔍 Período de busca:', periodo);
      
      // Primeiro buscar clientes ativos para mapear nome -> nome_fantasia
      const { data: clientesAtivos } = await supabase
        .from('clientes')
        .select('nome, nome_fantasia, nome_mobilemed')
        .eq('ativo', true);
        
      const mapeamentoNomes = new Map();
      clientesAtivos?.forEach(c => {
        const fantasia = c.nome_fantasia || c.nome;
        // Mapear todos os nomes possíveis para o nome fantasia
        if (c.nome) mapeamentoNomes.set(c.nome, fantasia);
        if (c.nome_fantasia) mapeamentoNomes.set(c.nome_fantasia, fantasia);
        if (c.nome_mobilemed) mapeamentoNomes.set(c.nome_mobilemed, fantasia);
      });
      
      let { data: dadosFaturamento, error } = await supabase
        .from('faturamento')
        .select(`
          cliente_id,
          cliente_nome,
          cliente_email,
          valor,
          valor_bruto,
          quantidade,
          data_emissao,
          data_vencimento,
          periodo_referencia,
          tipo_faturamento
        `)
        .eq('periodo_referencia', periodo) // Usar formato YYYY-MM direto
        .not('periodo_referencia', 'is', null) // Excluir registros sem período
        .not('cliente_nome', 'is', null) // Garantir que cliente_nome não seja nulo
        .order('cliente_nome')
        .limit(50000); // Aumentar limite explicitamente para garantir todos os dados

      console.log('📊 Dados de faturamento encontrados:', dadosFaturamento?.length || 0);
      console.log('🔍 Período usado na busca (direto YYYY-MM):', periodo);
      console.log('🔍 Amostra dos primeiros registros:', dadosFaturamento?.slice(0, 3).map(d => ({
        cliente: d.cliente_nome,
        valor: d.valor_bruto,
        quantidade: d.quantidade
      })));
      
      if (dadosFaturamento && dadosFaturamento.length > 0) {
        // Agrupar por nome fantasia primeiro
        const dadosFaturamentoAgrupados = new Map();
        
        dadosFaturamento.forEach(item => {
          const nomeFantasia = mapeamentoNomes.get(item.cliente_nome) || item.cliente_nome;
          
          if (!dadosFaturamentoAgrupados.has(nomeFantasia)) {
            dadosFaturamentoAgrupados.set(nomeFantasia, []);
          }
          dadosFaturamentoAgrupados.get(nomeFantasia).push({
            ...item,
            cliente_nome: nomeFantasia // Usar nome fantasia
          });
        });
        
        // Converter map de volta para array
        const dadosAgrupados = [];
        for (const [nomeFantasia, itens] of dadosFaturamentoAgrupados) {
          dadosAgrupados.push(...itens);
        }
        
        const clientesUnicos = [...new Set(dadosAgrupados.map(d => d.cliente_nome))];
        console.log('👥 Clientes únicos encontrados (agrupados por nome fantasia):', clientesUnicos.length, clientesUnicos);
        console.log('📋 Lista completa de clientes únicos:', clientesUnicos);
        
        // Log detalhado de cada cliente agrupado
        clientesUnicos.forEach(clienteNome => {
          const registrosCliente = dadosAgrupados.filter(d => d.cliente_nome === clienteNome);
          const totalExames = registrosCliente.reduce((sum, r) => sum + (r.quantidade || 1), 0);
          const totalValor = registrosCliente.reduce((sum, r) => sum + (Number(r.valor_bruto) || 0), 0);
          console.log(`📊 ${clienteNome}: ${registrosCliente.length} registros, ${totalExames} exames, R$ ${totalValor.toFixed(2)}`);
        });
        
        // Usar dados agrupados
        dadosFaturamento = dadosAgrupados;
      } else {
        console.warn('⚠️ Nenhum dado de faturamento retornado pela consulta');
        console.log('🔍 Detalhes do erro:', error);
      }

      if (error) {
        console.error('❌ Erro ao carregar faturamento:', error);
        throw error;
      }

        if (!dadosFaturamento || dadosFaturamento.length === 0) {
          console.warn(`⚠️ Nenhum dado de faturamento encontrado para o período ${periodo}`);
          console.log('💡 Buscando dados da volumetria para criar demonstrativo...');
          
          // Se não há dados de faturamento, usar dados da volumetria para criar demonstrativo
          const { data: dadosVolumetria, error: errorVolumetria } = await supabase
            .from('volumetria_mobilemed')
            .select(`
              "EMPRESA",
              "Cliente_Nome_Fantasia",
              "VALORES",
              "DATA_REALIZACAO",
              "MODALIDADE",
              "ESPECIALIDADE",
              "CATEGORIA",
              "PRIORIDADE",
              "ESTUDO_DESCRICAO",
              "NOME_PACIENTE"
            `)
            .eq('periodo_referencia', periodo)
            .not('Cliente_Nome_Fantasia', 'is', null)
            .not('VALORES', 'is', null)
            .limit(50000); // Aumentar limite explicitamente
            
          if (errorVolumetria) {
            console.error('❌ Erro ao carregar volumetria:', errorVolumetria);
            throw errorVolumetria;
          }
            
          if (dadosVolumetria && dadosVolumetria.length > 0) {
            console.log('📊 Dados de volumetria encontrados:', dadosVolumetria.length);
            
            // Processar dados da volumetria para criar demonstrativo usando NOME FANTASIA e cálculo correto
            const clientesMap = new Map<string, ClienteFaturamento>();
            
            // Buscar TODOS os clientes com contratos que precisam de demonstrativo (excluir NC-NF)
            const { data: clientesCadastrados } = await supabase
              .from('clientes')
              .select(`
                id, 
                nome, 
                nome_fantasia, 
                nome_mobilemed, 
                email,
                ativo,
                status,
                contratos_clientes!inner (
                  tipo_faturamento,
                  status
                )
              `)
              .eq('contratos_clientes.status', 'ativo'); // INCLUIR TODOS OS TIPOS (CO-FT, NC-FT, NC-NF)
            
            console.log('🏢 Clientes encontrados com tipo de faturamento CO-FT/NC-FT:', clientesCadastrados?.length || 0);
            
            // Criar mapa de clientes por nome fantasia
            const clientesMapPorNome = new Map();
            clientesCadastrados?.forEach(cliente => {
              // Adicionar tipo_faturamento do contrato ao cliente
              const clienteComTipo = {
                ...cliente,
                tipo_faturamento: cliente.contratos_clientes?.[0]?.tipo_faturamento
              };
              if (cliente.nome_fantasia) clientesMapPorNome.set(cliente.nome_fantasia, clienteComTipo);
              if (cliente.nome) clientesMapPorNome.set(cliente.nome, clienteComTipo);
              if (cliente.nome_mobilemed) clientesMapPorNome.set(cliente.nome_mobilemed, clienteComTipo);
            });
            
            console.log('🔍 Processando volumetria com NOME FANTASIA e cálculo de preços...');
            
            // OTIMIZAÇÃO: Agrupar dados primeiro para evitar múltiplas chamadas RPC
            const dadosAgrupados = new Map<string, {
              cliente: any,
              total_exames: number,
              combinacoes: Map<string, { quantidade: number, config: any }>
            }>();
            
            // Primeira passada: agrupar por cliente
            dadosVolumetria.forEach(item => {
              const clienteNome = item.Cliente_Nome_Fantasia || item.EMPRESA;
              const clienteCadastrado = clientesMapPorNome.get(clienteNome);
              const quantidade = Number(item.VALORES || 1);
              
              if (!dadosAgrupados.has(clienteNome)) {
                dadosAgrupados.set(clienteNome, {
                  cliente: clienteCadastrado,
                  total_exames: 0,
                  combinacoes: new Map()
                });
              }
              
              const clienteData = dadosAgrupados.get(clienteNome)!;
              clienteData.total_exames += quantidade;
              
              // Agrupar por combinação de modalidade/especialidade/categoria/prioridade
              const chave = `${item.MODALIDADE || ''}-${item.ESPECIALIDADE || ''}-${item.CATEGORIA || 'SC'}-${item.PRIORIDADE || ''}`;
              
              if (clienteData.combinacoes.has(chave)) {
                clienteData.combinacoes.get(chave)!.quantidade += quantidade;
              } else {
                clienteData.combinacoes.set(chave, {
                  quantidade: quantidade,
                  config: {
                    modalidade: item.MODALIDADE || '',
                    especialidade: item.ESPECIALIDADE || '',
                    categoria: item.CATEGORIA || 'SC',
                    prioridade: item.PRIORIDADE || '',
                    is_plantao: (item.PRIORIDADE || '').toUpperCase().includes('PLANT')
                  }
                });
              }
            });
            
            console.log(`📊 Processamento otimizado: ${dadosAgrupados.size} clientes únicos`);
            
            // Segunda passada: calcular preços por cliente (muito menos chamadas RPC)
            for (const [clienteNome, dadosCliente] of dadosAgrupados) {
              if (!dadosCliente.cliente?.id) {
                console.warn(`Cliente ${clienteNome} não encontrado no cadastro - pulando`);
                continue;
              }
              
              let valorTotalCliente = 0;
              let temPrecoConfigurado = false;

              // Obter como o volume deve ser considerado para este cliente
              let condVolume: string | null = null;
              try {
                const { data: contratoCfg } = await supabase
                  .from('contratos_clientes')
                  .select('cond_volume')
                  .eq('cliente_id', dadosCliente.cliente.id)
                  .eq('status', 'ativo')
                  .maybeSingle();
                condVolume = (contratoCfg?.cond_volume || 'MOD/ESP/CAT') as string;
              } catch (e) {
                condVolume = 'MOD/ESP/CAT';
              }

              // Pré-calcular volumes por nível
              const totalPorModalidade = new Map<string, number>();
              const totalPorModEsp = new Map<string, number>();
              const totalPorModEspCat = new Map<string, number>();
              for (const [, comb] of dadosCliente.combinacoes) {
                const mod = (comb.config.modalidade || '').toString();
                const esp = (comb.config.especialidade || '').toString();
                const cat = (comb.config.categoria || '').toString();
                totalPorModalidade.set(mod, (totalPorModalidade.get(mod) || 0) + comb.quantidade);
                const kME = `${mod}|${esp}`;
                totalPorModEsp.set(kME, (totalPorModEsp.get(kME) || 0) + comb.quantidade);
                const kMEC = `${mod}|${esp}|${cat}`;
                totalPorModEspCat.set(kMEC, (totalPorModEspCat.get(kMEC) || 0) + comb.quantidade);
              }
              
              // Processar cada combinação única do cliente
              for (const [chave, combinacao] of dadosCliente.combinacoes) {
                try {
                  // Definir volume de referência conforme a regra do contrato
                  const mod = (combinacao.config.modalidade || '').toString();
                  const esp = (combinacao.config.especialidade || '').toString();
                  const cat = (combinacao.config.categoria || '').toString();
                  let volumeRef = dadosCliente.total_exames; // fallback
                  switch ((condVolume || '').toUpperCase()) {
                    case 'MOD':
                      volumeRef = totalPorModalidade.get(mod) || combinacao.quantidade;
                      break;
                    case 'MOD/ESP':
                      volumeRef = totalPorModEsp.get(`${mod}|${esp}`) || combinacao.quantidade;
                      break;
                    case 'MOD/ESP/CAT':
                      volumeRef = totalPorModEspCat.get(`${mod}|${esp}|${cat}`) || combinacao.quantidade;
                      break;
                    case 'GERAL':
                    default:
                      volumeRef = dadosCliente.total_exames;
                  }

                  const { data: precoCalculado } = await supabase.rpc('calcular_preco_exame', {
                    p_cliente_id: dadosCliente.cliente.id,
                    p_modalidade: combinacao.config.modalidade,
                    p_especialidade: combinacao.config.especialidade,
                    p_prioridade: combinacao.config.prioridade,
                    p_categoria: combinacao.config.categoria,
                    p_volume_total: volumeRef,
                    p_is_plantao: combinacao.config.is_plantao
                  });
                  
                  if (precoCalculado && precoCalculado > 0) {
                    const valorCombinacao = Number(precoCalculado) * combinacao.quantidade;
                    valorTotalCliente += valorCombinacao;
                    temPrecoConfigurado = true;
                    
                    console.log(`💰 ${clienteNome} - ${chave}: ${combinacao.quantidade} exames x R$ ${precoCalculado} = R$ ${valorCombinacao.toFixed(2)}`);
                  }
                } catch (error) {
                  console.log(`Erro ao calcular preço para ${clienteNome} (${chave}):`, error);
                }
              }
              
              // Só incluir cliente se tem preço configurado
              if (temPrecoConfigurado && valorTotalCliente > 0) {
                clientesMap.set(clienteNome, {
                  id: dadosCliente.cliente.id,
                  nome: clienteNome,
                  email: dadosCliente.cliente.email || '',
                  total_exames: dadosCliente.total_exames,
                  valor_bruto: Number(valorTotalCliente.toFixed(2)),
                  valor_liquido: Number(valorTotalCliente.toFixed(2)),
                  periodo: periodo,
                  status_pagamento: 'pendente' as const,
                  data_vencimento: new Date().toISOString().split('T')[0],
                  tipo_faturamento: dadosCliente.cliente.tipo_faturamento || 'Não definido',
                  observacoes: `Dados baseados na volumetria com preços calculados`
                });
              } else {
                console.warn(`Cliente ${clienteNome} sem preço configurado - pulando`);
              }
            }

            const clientesArray = Array.from(clientesMap.values());
            console.log('📊 Clientes processados da volumetria:', clientesArray.length);
            console.log('📋 Primeiros 5 clientes:', clientesArray.slice(0, 5).map(c => ({ nome: c.nome, exames: c.total_exames, valor: c.valor_bruto })));
            
            setClientes(clientesArray);
            setClientesFiltrados(clientesArray);
            
            // Mostrar toast apenas na primeira carga para evitar loop
            if (!hasShownInitialToast.current) {
              toast({
                title: "Demonstrativo carregado da volumetria",
                description: `${clientesArray.length} clientes carregados diretamente dos dados de volumetria para ${periodo}.`,
                variant: "default",
              });
              hasShownInitialToast.current = true;
            }
            
            return;
          } else {
            console.log('💡 Não há dados de volumetria nem faturamento para este período');
            toast({
              title: "Dados não encontrados", 
              description: `Nenhum dado encontrado para ${periodo}. Verifique se há dados de volumetria carregados para este período.`,
              variant: "destructive",
            });
          }
          
          setClientes([]);
          setClientesFiltrados([]);
          return;
        }

      console.log(`Dados encontrados: ${dadosFaturamento.length} registros para o período ${periodo}`);

      // Buscar contratos dos clientes para filtrar por tipo de faturamento
      const clientesNomes = [...new Set(dadosFaturamento.map(d => d.cliente_nome))];
      console.log('🏢 Buscando contratos para clientes:', clientesNomes);
      
      const { data: clientesComContratos, error: errorContratos } = await supabase
        .from('clientes')
        .select(`
          id,
          nome,
          nome_fantasia,
          nome_mobilemed,
          email,
          contratos_clientes!inner (
            tipo_faturamento
          )
        `)
        .eq('ativo', true)
        .in('contratos_clientes.tipo_faturamento', ['CO-FT', 'NC-FT']);
      
      if (errorContratos) {
        console.error('❌ Erro ao buscar contratos:', errorContratos);
      }
      
      // Criar mapa de clientes que precisam de demonstrativo
      const clientesQueNecessitamDemonstrativo = new Set();
      clientesComContratos?.forEach(cliente => {
        if (cliente.nome_fantasia) clientesQueNecessitamDemonstrativo.add(cliente.nome_fantasia);
        if (cliente.nome) clientesQueNecessitamDemonstrativo.add(cliente.nome);
        if (cliente.nome_mobilemed) clientesQueNecessitamDemonstrativo.add(cliente.nome_mobilemed);
      });
      
      console.log('📋 Clientes que precisam de demonstrativo:', Array.from(clientesQueNecessitamDemonstrativo));
      
      // Filtrar dados de faturamento apenas para clientes que precisam de demonstrativo
      const dadosFaturamentoFiltrados = dadosFaturamento.filter(item => 
        clientesQueNecessitamDemonstrativo.has(item.cliente_nome)
      );
      
      console.log(`🔍 Dados filtrados: ${dadosFaturamentoFiltrados.length} registros (eram ${dadosFaturamento.length})`);
      console.log('👥 Clientes filtrados únicos:', [...new Set(dadosFaturamentoFiltrados.map(d => d.cliente_nome))]);

      // Agrupar por cliente - CORRIGIDO para usar dados filtrados
      const clientesMap = new Map<string, ClienteFaturamento>();
      
      console.log('🔄 Processando', dadosFaturamentoFiltrados?.length || 0, 'registros de faturamento filtrados...');
      
      dadosFaturamentoFiltrados?.forEach(async (item, index) => {
        const clienteNome = item.cliente_nome;
        
        if (index < 5) { // Log dos primeiros 5 registros para debug
          console.log(`📋 Registro ${index + 1}:`, {
            cliente: clienteNome,
            valor_bruto: item.valor_bruto,
            quantidade: item.quantidade
          });
        }
        
        if (clientesMap.has(clienteNome)) {
          const cliente = clientesMap.get(clienteNome)!;
          // Somar QUANTIDADE real dos exames (não o número de registros)
          cliente.total_exames += item.quantidade || 1; 
          cliente.valor_bruto += Number(item.valor_bruto || 0);
          cliente.valor_liquido += Number(item.valor || 0);
          // Usar tipo de faturamento disponível nos dados
          if (!cliente.tipo_faturamento && item.tipo_faturamento) {
            (cliente as any).tipo_faturamento = item.tipo_faturamento;
          }
        } else {
          console.log(`🆕 Novo cliente encontrado: ${clienteNome}`);
          
          // Determinar status de pagamento baseado na data de vencimento
          const dataVencimento = new Date(item.data_vencimento);
          const hoje = new Date();
          let status: 'pendente' | 'pago' | 'vencido' = 'pendente';
          
          if (dataVencimento < hoje) {
            status = 'vencido';
          }
          
          clientesMap.set(clienteNome, {
            id: clienteNome,
            nome: item.cliente_nome || 'Cliente não identificado',
            email: item.cliente_email || '',
            total_exames: item.quantidade || 1, // Usar quantidade real do faturamento
            valor_bruto: Number(item.valor_bruto || 0),
            valor_liquido: Number(item.valor || 0),
            periodo: item.periodo_referencia || periodo,
            status_pagamento: status,
            data_vencimento: item.data_vencimento,
            tipo_faturamento: item.tipo_faturamento || 'Não definido', // Não assumir CO-FT
          });
        }
      });

      const clientesArray = Array.from(clientesMap.values());
      
      // Buscar tipos de faturamento para clientes que não possuem
      for (const cliente of clientesArray) {
        if (!cliente.tipo_faturamento) {
          try {
            cliente.tipo_faturamento = await buscarTipoFaturamento(cliente.nome);
          } catch (error) {
            console.warn(`Erro ao buscar tipo faturamento para ${cliente.nome}:`, error);
            cliente.tipo_faturamento = 'Não definido'; // fallback
          }
        }
      }
      
      console.log('📊 Clientes processados finais:', clientesArray.length);
      console.log('📋 Nomes dos clientes processados:', clientesArray.map(c => c.nome));
      
      setClientes(clientesArray);
      setClientesFiltrados(clientesArray);

      // Calcular totais para o log
      const totaisCalculados = clientesArray.reduce((acc, cliente) => ({
        exames: acc.exames + cliente.total_exames,
        valorBruto: acc.valorBruto + cliente.valor_bruto,
      }), { exames: 0, valorBruto: 0 });

      console.log(`Demonstrativo atualizado: ${clientesArray.length} clientes, ${totaisCalculados.exames} exames, R$ ${totaisCalculados.valorBruto.toFixed(2)} valor bruto`);

    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro ao carregar dados",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setCarregando(false);
    }
  };

  // Aplicar filtros e ordenação
  useEffect(() => {
    let filtrados = [...clientes];

    if (filtroNome) {
      filtrados = filtrados.filter(cliente => 
        cliente.nome.toLowerCase().includes(filtroNome.toLowerCase())
      );
    }

    if (filtroStatus !== "todos") {
      filtrados = filtrados.filter(cliente => 
        cliente.status_pagamento === filtroStatus
      );
    }

    // Aplicar ordenação alfabética
    filtrados.sort((a, b) => {
      const comparison = a.nome.localeCompare(b.nome, 'pt-BR');
      return ordemAlfabetica ? comparison : -comparison;
    });

    setClientesFiltrados(filtrados);
  }, [clientes, filtroNome, filtroStatus, ordemAlfabetica]);

  // Carregar dados ao montar o componente
  useEffect(() => {
    hasShownInitialToast.current = false; // Reset flag when period changes
    carregarDados();
  }, [periodo]);

  // Escutar mudanças na tabela de faturamento para atualizar automaticamente
  useEffect(() => {
    const canal = supabase
      .channel('faturamento_updates')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'faturamento' 
        }, 
        (payload) => {
          console.log('Mudança detectada na tabela faturamento:', payload);
          // Recarregar dados automaticamente quando houver mudanças (sem toast para evitar spam)
          carregarDados();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [periodo]);

  // Calcular totais
  const totais = clientesFiltrados.reduce((acc, cliente) => ({
    exames: acc.exames + cliente.total_exames,
    valorBruto: acc.valorBruto + cliente.valor_bruto,
    valorLiquido: acc.valorLiquido + cliente.valor_liquido,
  }), { exames: 0, valorBruto: 0, valorLiquido: 0 });

  const statusCounts = {
    pendente: clientesFiltrados.filter(c => c.status_pagamento === 'pendente').length,
    pago: clientesFiltrados.filter(c => c.status_pagamento === 'pago').length,
    vencido: clientesFiltrados.filter(c => c.status_pagamento === 'vencido').length,
  };

  const exportarExcel = () => {
    if (clientesFiltrados.length === 0) {
      toast({ title: "Sem dados", description: "Nenhum cliente para exportar.", variant: "destructive" });
      return;
    }

    const dados = clientesFiltrados.map((c) => ({
      Cliente: c.nome,
      "Total Exames": c.total_exames,
      "Valor Bruto": Number(c.valor_bruto || 0),
      "Valor Líquido": Number(c.valor_liquido || 0),
      Status: c.status_pagamento,
      Período: c.periodo,
    }));

    const ws = XLSX.utils.json_to_sheet(dados);
    // Formatar cabeçalhos e números
    const colWidths = [
      { wch: 40 }, // Cliente
      { wch: 14 }, // Total Exames
      { wch: 16 }, // Valor Bruto
      { wch: 16 }, // Valor Líquido
      { wch: 12 }, // Status
      { wch: 10 }, // Período
    ];
    (ws as any)["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Demonstrativo");

    const fileName = `demonstrativo_faturamento_${periodo}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast({ title: "Exportado", description: "Arquivo Excel gerado com sucesso." });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Demonstrativo de Faturamento</h2>
        <p className="text-gray-600 mt-1">Visualize e analise o faturamento por cliente</p>
      </div>

      {/* ✅ RESUMO GERAL - Agora na aba correta */}
      {clientes.length > 0 && (() => {
        // ✅ EXTRAIR VALORES REAIS DOS DEMONSTRATIVOS SALVOS
        const demonstrativosCompletos = localStorage.getItem(`demonstrativos_${periodo}`);
        let resumoReal = null;
        
        if (demonstrativosCompletos) {
          try {
            const demonstrativos = JSON.parse(demonstrativosCompletos);
            console.log('✅ Demonstrativos carregados:', demonstrativos);
            
            // Calcular resumo dos demonstrativos salvos
            resumoReal = {
              clientes_processados: demonstrativos.length,
              total_exames_geral: demonstrativos.reduce((sum, dem) => sum + (dem.total_exames || 0), 0),
              valor_exames_geral: demonstrativos.reduce((sum, dem) => sum + (dem.valor_exames || 0), 0),
              valor_franquias_geral: demonstrativos.reduce((sum, dem) => sum + (dem.valor_franquia || 0), 0),
              valor_portal_geral: demonstrativos.reduce((sum, dem) => sum + (dem.valor_portal_laudos || 0), 0),
              valor_integracao_geral: demonstrativos.reduce((sum, dem) => sum + (dem.valor_integracao || 0), 0),
              valor_bruto_geral: demonstrativos.reduce((sum, dem) => sum + (dem.valor_bruto || 0), 0),
              valor_impostos_geral: demonstrativos.reduce((sum, dem) => sum + (dem.valor_impostos || 0), 0),
              valor_total_geral: demonstrativos.reduce((sum, dem) => sum + (dem.valor_total || 0), 0),
              clientes_simples_nacional: demonstrativos.filter(dem => dem.detalhes_tributacao?.simples_nacional).length,
              clientes_regime_normal: demonstrativos.filter(dem => !dem.detalhes_tributacao?.simples_nacional).length
            };
            
            console.log('✅ Resumo calculado dos demonstrativos:', resumoReal);
          } catch (error) {
            console.error('❌ Erro ao processar demonstrativos do localStorage:', error);
          }
        } else {
          console.warn('⚠️ Não há demonstrativos no localStorage para período:', periodo);
        }
        
        const resumoCalculado = resumoReal || (() => {
          // 🔧 CALCULAR VALORES COMPLETOS a partir das observações dos clientes
          console.log('⚠️ FALLBACK: Calculando resumo a partir dos dados dos clientes');
          
          let valorFranquiasTotal = 0;
          let valorPortalTotal = 0;
          let valorIntegracaoTotal = 0;
          let valorImpostosTotal = 0;
          let totalExamesGeral = 0;
          
          // Extrair valores das observações de cada cliente
          clientes.forEach(cliente => {
            // Somar exames
            totalExamesGeral += cliente.total_exames || 0;
            
            if (cliente.observacoes) {
              const franquiaMatch = cliente.observacoes.match(/Franquia: R\$ ([\d.,]+)/);
              const portalMatch = cliente.observacoes.match(/Portal: R\$ ([\d.,]+)/);
              const integracaoMatch = cliente.observacoes.match(/Integração: R\$ ([\d.,]+)/);
              const impostosMatch = cliente.observacoes.match(/Impostos: R\$ ([\d.,]+)/);
              
              if (franquiaMatch) valorFranquiasTotal += parseFloat(franquiaMatch[1].replace(',', '.')) || 0;
              if (portalMatch) valorPortalTotal += parseFloat(portalMatch[1].replace(',', '.')) || 0;
              if (integracaoMatch) valorIntegracaoTotal += parseFloat(integracaoMatch[1].replace(',', '.')) || 0;
              if (impostosMatch) valorImpostosTotal += parseFloat(impostosMatch[1].replace(',', '.')) || 0;
            }
          });
          
          const valorExamesGeral = clientes.reduce((sum, c) => sum + (c.valor_bruto || 0), 0);
          const valorTotalGeral = valorExamesGeral + valorFranquiasTotal + valorPortalTotal + valorIntegracaoTotal;
          
          console.log('🧮 Resumo calculado via fallback:', {
            totalExamesGeral,
            valorExamesGeral,
            valorFranquiasTotal,
            valorPortalTotal, 
            valorIntegracaoTotal,
            valorImpostosTotal,
            valorTotalGeral
          });
          
          return {
            clientes_processados: clientes.length,
            total_exames_geral: totalExamesGeral,
            valor_exames_geral: valorExamesGeral,
            valor_franquias_geral: valorFranquiasTotal,
            valor_portal_geral: valorPortalTotal,     
            valor_integracao_geral: valorIntegracaoTotal, 
            valor_impostos_geral: valorImpostosTotal,   
            valor_total_geral: valorTotalGeral,
            clientes_simples_nacional: 0,
            clientes_regime_normal: clientes.length
          };
        })();
        
        return (
          <Card>
            <CardHeader>
              <CardTitle>Resumo Geral - {periodo}</CardTitle>
            </CardHeader>
            <CardContent>
               <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {resumoCalculado.clientes_processados}
                  </div>
                  <div className="text-sm text-muted-foreground">Clientes</div>
                </div>
                 <div className="text-center">
                   <div className="text-2xl font-bold text-gray-800">
                     {(resumoCalculado.total_exames_geral || 0).toLocaleString()}
                   </div>
                   <div className="text-sm text-muted-foreground">Total Exames</div>
                 </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(resumoCalculado.valor_exames_geral)}
                  </div>
                  <div className="text-sm text-muted-foreground">Exames</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((resumoCalculado.valor_franquias_geral || 0) + (resumoCalculado.valor_portal_geral || 0) + (resumoCalculado.valor_integracao_geral || 0))}
                  </div>
                  <div className="text-sm text-muted-foreground">Adicionais</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(resumoCalculado.valor_exames_geral + ((resumoCalculado.valor_franquias_geral || 0) + (resumoCalculado.valor_portal_geral || 0) + (resumoCalculado.valor_integracao_geral || 0)))}
                  </div>
                  <div className="text-sm text-muted-foreground">Valor Bruto</div>
                </div>
              </div>

              <Separator className="my-6" />

              {/* Resumo Consolidado */}
              {(() => {
                const resumoConsolidado = clientes.reduce((acc, cliente) => {
                  if (cliente.detalhes_exames && Array.isArray(cliente.detalhes_exames)) {
                    cliente.detalhes_exames.forEach((detalhe: any) => {
                      const chave = `${detalhe.modalidade}-${detalhe.especialidade}-${detalhe.categoria}-${detalhe.prioridade}`;
                      if (!acc[chave]) {
                        acc[chave] = {
                          modalidade: detalhe.modalidade,
                          especialidade: detalhe.especialidade,
                          categoria: detalhe.categoria,
                          prioridade: detalhe.prioridade,
                          quantidade: 0,
                          valor_total: 0
                        };
                      }
                      acc[chave].quantidade += detalhe.quantidade || 0;
                      acc[chave].valor_total += detalhe.valor_total || 0;
                    });
                  }
                  return acc;
                }, {});

                const detalhesOrdenados = Object.values(resumoConsolidado)
                  .sort((a: any, b: any) => b.quantidade - a.quantidade);

                return (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold mb-4">Resumo Consolidado</h3>
                    
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left py-2 px-3 border-b">Modalidade</th>
                            <th className="text-left py-2 px-3 border-b">Especialidade</th>
                            <th className="text-left py-2 px-3 border-b">Categoria</th>
                            <th className="text-left py-2 px-3 border-b">Prioridade</th>
                            <th className="text-right py-2 px-3 border-b">Qtd</th>
                            <th className="text-right py-2 px-3 border-b">Valor Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detalhesOrdenados.map((detalhe: any, idx: number) => (
                            <tr key={idx} className={`${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'} ${detalhe.categoria === 'TC' ? 'bg-red-100' : ''}`}>
                              <td className="py-1 px-3 border-b">{detalhe.modalidade}</td>
                              <td className="py-1 px-3 border-b">{detalhe.especialidade}</td>
                              <td className="py-1 px-3 border-b">
                                {detalhe.categoria}
                                {detalhe.categoria === 'TC' && <span className="text-red-600 ml-1">⚠️</span>}
                              </td>
                              <td className="py-1 px-3 border-b">{detalhe.prioridade}</td>
                               <td className="py-1 px-3 text-right border-b">
                                 {(detalhe.quantidade || 0).toLocaleString('pt-BR')}
                               </td>
                              <td className="py-1 px-3 text-right font-medium border-b">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(detalhe.valor_total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>


                  </div>
                );
              })()}
            </CardContent>
          </Card>
        );
      })()}

      {/* Tabela de Clientes */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center justify-between">
                <span>Faturamento por Cliente</span>
                <span className="text-sm font-normal text-gray-500 ml-4">
                  Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </CardTitle>
              <CardDescription>
                {clientesFiltrados.length} de {clientes.length} clientes
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const novaOrdem = [...clientesFiltrados].sort((a, b) => {
                    const comparison = a.nome.localeCompare(b.nome, 'pt-BR');
                    return ordemAlfabetica ? -comparison : comparison;
                  });
                  setClientesFiltrados(novaOrdem);
                  setOrdemAlfabetica(!ordemAlfabetica);
                }}
              >
                {ordemAlfabetica ? 'Z-A' : 'A-Z'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {carregando ? (
            <div className="text-center py-8">
              <p className="text-gray-600">Carregando dados...</p>
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">Nenhum cliente encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Cliente</th>
                    <th className="text-center py-3 px-4">Tipo Faturamento</th>
                    <th className="text-right py-3 px-4">Exames</th>
                    <th className="text-right py-3 px-4">Valor Bruto</th>
                    <th className="text-right py-3 px-4">Valor Líquido</th>
                    <th className="text-center py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesFiltrados.map((cliente, index) => (
                    <>
                      <tr 
                        key={`${cliente.nome}-${index}`} 
                        className={`${index % 2 === 0 ? "bg-gray-50" : "bg-white"} cursor-pointer hover:bg-blue-50 transition-colors`}
                        onClick={() => {
                          const newExpanded = new Set(expandedClients);
                          if (newExpanded.has(cliente.id)) {
                            newExpanded.delete(cliente.id);
                          } else {
                            newExpanded.add(cliente.id);
                          }
                          setExpandedClients(newExpanded);
                        }}
                      >
                        <td className="py-3 px-4 font-medium">
                          <div className="flex items-center gap-2">
                            {expandedClients.has(cliente.id) ? '▼' : '▶'}
                            {cliente.nome}
                            {cliente.alertas && cliente.alertas.length > 0 && (
                              <Badge variant="destructive" className="ml-2">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Alerta
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant="outline">
                            {cliente.tipo_faturamento || 'Não definido'}
                          </Badge>
                        </td>
                         <td className="py-3 px-4 text-right">{(cliente.total_exames || 0).toLocaleString()}</td>
                         <td className="py-3 px-4 text-right">R$ {(cliente.valor_bruto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                         <td className="py-3 px-4 text-right font-medium">R$ {(cliente.valor_liquido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge 
                            variant={
                              cliente.status_pagamento === 'pago' ? 'default' :
                              cliente.status_pagamento === 'vencido' ? 'destructive' : 'secondary'
                            }
                          >
                            {cliente.status_pagamento}
                          </Badge>
                        </td>
                      </tr>
                      {/* ✅ LINHA DE DETALHAMENTO EXPANDIDO */}
                      {expandedClients.has(cliente.id) && cliente.detalhes_exames && (
                        <tr key={`${cliente.nome}-details-${index}`} className="bg-blue-50">
                          <td colSpan={6} className="px-8 py-4">
                            <div className="space-y-3">
                              {/* ✅ MOSTRAR ALERTAS SE HOUVER */}
                              {cliente.alertas && cliente.alertas.length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                                  <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    Alertas de Segurança
                                  </div>
                                  {cliente.alertas.map((alerta, idx) => (
                                    <p key={idx} className="text-red-700 text-sm">• {alerta}</p>
                                  ))}
                                </div>
                              )}
                              <h4 className="font-semibold text-sm text-gray-700">Detalhamento por Modalidade/Especialidade</h4>
                              <div className="max-h-40 overflow-y-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-gray-300">
                                      <th className="text-left py-1">Modalidade</th>
                                      <th className="text-left py-1">Especialidade</th>
                                      <th className="text-left py-1">Categoria</th>
                                      <th className="text-left py-1">Prioridade</th>
                                      <th className="text-right py-1">Qtd</th>
                                      <th className="text-right py-1">Valor Unit.</th>
                                      <th className="text-right py-1">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {cliente.detalhes_exames.map((detalhe, idx) => (
                                      <tr key={idx} className="border-b border-gray-200">
                                        <td className="py-1">{detalhe.modalidade}</td>
                                        <td className="py-1">{detalhe.especialidade}</td>
                                        <td className="py-1">{detalhe.categoria}</td>
                                        <td className="py-1">{detalhe.prioridade}</td>
                                        <td className="py-1 text-right">{detalhe.quantidade}</td>
                                        <td className="py-1 text-right">R$ {detalhe.valor_unitario.toFixed(2)}</td>
                                        <td className="py-1 text-right font-medium">R$ {detalhe.valor_total.toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}