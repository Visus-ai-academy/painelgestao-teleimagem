import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, ArrowLeftRight, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useVolumetria } from "@/contexts/VolumetriaContext";
import * as XLSX from "xlsx";

export type Divergencia = {
  tipo: 'missing_in_system' | 'missing_in_file' | 'total_mismatch';
  cliente: string;
  totalSistema?: number;
  totalArquivo?: number;
};

export type UploadedRow = {
  cliente: string;
  totalExames?: number;
  modalidade?: string;
  especialidade?: string;
  prioridade?: string;
  categoria?: string;
  exame?: string;
};

type Breakdown = Record<string, number>;

type ClienteAggregated = {
  cliente: string;
  total_exames: number;
  modalidades: Breakdown;
  especialidades: Breakdown;
  prioridades: Breakdown;
  categorias: Breakdown;
  exames: Breakdown;
};

const stripAccents = (s: string) => s?.toString().normalize('NFD').replace(/\p{Diacritic}/gu, '') || '';
const canonical = (s?: string) => {
  const raw = (s || '').toString().trim();
  if (!raw) return '';
  const noAcc = stripAccents(raw);
  const cleaned = noAcc.replace(/[^a-zA-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
  return cleaned;
};
const canonicalModalidade = (m?: string) => {
  const up = canonical(m);
  if (up === 'CT') return 'TC';
  if (up === 'MR') return 'RM';
  return up;
};
const canonicalPrioridade = (p?: string) => {
  const up = canonical(p);
  if (up === 'URGENCIA' || up === 'URGENTE') return 'URGENTE';
  if (up.startsWith('PLANTAO')) return 'PLANTAO';
  if (up === 'ROTINA') return 'ROTINA';
  return up;
};

// Normaliza o nome do cliente para combinar com a limpeza do banco
const normalizeClientName = (name?: string) => {
  const raw = (name || '').toString().trim();
  if (!raw) return '';
  let s = stripAccents(raw).toUpperCase().replace(/\s+/g, ' ').trim();
  if (['INTERCOR2', 'INTERCOR_2', 'INTERCOR-2'].includes(s)) s = 'INTERCOR';
  if (s === 'P-HADVENTISTA') s = 'HADVENTISTA';
  if (s === 'P-UNIMED_CARUARU') s = 'UNIMED_CARUARU';
  if (s === 'PRN - MEDIMAGEM CAMBORIU') s = 'MEDIMAGEM_CAMBORIU';
  if (s === 'UNIMAGEM_CENTRO') s = 'UNIMAGEM_ATIBAIA';
  if (s === 'VIVERCLIN 2') s = 'VIVERCLIN';
  if (['CEDI-RJ','CEDI_RJ','CEDI-RO','CEDI_RO','CEDI-UNIMED','CEDI_UNIMED'].includes(s)) s = 'CEDIDIAG';
  s = s.replace(/\s*-\s*TELE$/, '');
  s = s.replace(/\s*-\s*CT$/, '');
  s = s.replace(/\s*-\s*MR$/, '');
  s = s.replace(/_PLANT(ÃO|AO)$/,'');
  s = s.replace(/_RMX$/, '');
  return s.trim();
};

function formatBreakdown(map: Breakdown, maxItems = 4) {
  const entries = Object.entries(map)
    .filter(([k]) => !!k)
    .sort((a, b) => b[1] - a[1]);
  const top = entries.slice(0, maxItems);
  const rest = entries.slice(maxItems).reduce((s, [, v]) => s + v, 0);
  const parts = top.map(([k, v]) => `${k}: ${v.toLocaleString()}`);
  if (rest > 0) parts.push(`+${rest.toLocaleString()} outros`);
  return parts.join(" • ");
}

export function VolumetriaClientesComparison({
  uploaded,
  uploadedExams, // ✅ NOVO PARÂMETRO
  onDivergencesComputed,
  periodoSelecionado,
}: {
  uploaded?: UploadedRow[];
  uploadedExams?: any[]; // ✅ NOVO PARÂMETRO
  onDivergencesComputed?: (divs: Divergencia[]) => void;
  periodoSelecionado?: string | null;
}) {
  const { data: context, getDataByPeriod } = useVolumetria();
  const { toast } = useToast();
  const [filtro, setFiltro] = useState<'todos' | 'divergencias'>('todos');

  // CORREÇÃO CRÍTICA: Usar sempre dados do período selecionado ou dados detalhados atuais
  const dadosPeriodo = useMemo(() => {
    if (periodoSelecionado && getDataByPeriod) {
      const dados = getDataByPeriod(periodoSelecionado);
      console.log('🔍 [COMPARATIVO] Dados do período selecionado:', periodoSelecionado, 'total:', dados?.length);
      return dados;
    }
    console.log('🔍 [COMPARATIVO] Usando dados detalhados do contexto:', context.detailedData?.length);
    return context.detailedData;
  }, [periodoSelecionado, getDataByPeriod, context.detailedData]);

  // Agregar dados do sistema (definitivos) a partir do contexto
  const sistemaClientes = useMemo<ClienteAggregated[]>(() => {
    try {
      console.log('🔍 [COMPARATIVO DEBUG] Context completo:', context);
      console.log('🔍 [COMPARATIVO DEBUG] Período selecionado:', periodoSelecionado);
      console.log('🔍 [COMPARATIVO DEBUG] dadosPeriodo length:', dadosPeriodo?.length);
      console.log('🔍 [COMPARATIVO DEBUG] context.detailedData length:', context.detailedData?.length);
      console.log('🔍 [COMPARATIVO DEBUG] context.clientesStats length:', context.clientesStats?.length);
      
      // Se há período selecionado, usar dados filtrados
      if (periodoSelecionado && dadosPeriodo && dadosPeriodo.length > 0) {
        console.log('🔍 [COMPARATIVO DEBUG] Processando dados do período:', dadosPeriodo.length, 'registros');
        console.log('🔍 [COMPARATIVO DEBUG] Primeiros 5 registros do período:', dadosPeriodo.slice(0, 5));
        
        const map = new Map<string, ClienteAggregated>();
        
        (dadosPeriodo as any[]).forEach((item, index) => {
          const clienteRaw = (item as any).EMPRESA ?? (item as any).empresa ?? '';
          const cliente = String(clienteRaw).trim();
          
          if (index < 10) {
            console.log(`🔍 [DEBUG ${index}] Cliente:`, cliente, 'VALORES:', (item as any).VALORES, 'Item completo:', item);
          }
          
          if (!cliente) return;
          
          const key = normalizeClientName(cliente).toLowerCase();
          if (!map.has(key)) {
            map.set(key, {
              cliente,
              total_exames: 0,
              modalidades: {},
              especialidades: {},
              prioridades: {},
              categorias: {},
              exames: {},
            });
          }
          
          const ref = map.get(key)!;
          const rawVal = (item as any).VALORES ?? 1;
          const inc = Number.isFinite(Number(rawVal)) ? Number(rawVal) : 1;
          ref.total_exames += inc;
          
          // Debug para os primeiros registros
          if (map.size <= 3) {
            console.log('🔍 [AGREGAÇÃO DEBUG]', {
              cliente,
              key,
              rawVal,
              inc,
              total_acumulado: ref.total_exames,
              MODALIDADE: (item as any).MODALIDADE,
              ESPECIALIDADE: (item as any).ESPECIALIDADE
            });
          }
          
          // Adicionar detalhes
          const mod = canonicalModalidade((item as any).MODALIDADE);
          const esp = canonical((item as any).ESPECIALIDADE);
          const pri = canonicalPrioridade((item as any).PRIORIDADE);
          const cat = canonical((item as any).CATEGORIA);
          const exame = canonical((item as any).ESTUDO_DESCRICAO);
          
          if (mod) ref.modalidades[mod] = (ref.modalidades[mod] || 0) + inc;
          if (esp) ref.especialidades[esp] = (ref.especialidades[esp] || 0) + inc;
          if (pri) ref.prioridades[pri] = (ref.prioridades[pri] || 0) + inc;
          if (cat) ref.categorias[cat] = (ref.categorias[cat] || 0) + inc;
          if (exame) ref.exames[exame] = (ref.exames[exame] || 0) + inc;
        });
        
        const resultado = Array.from(map.values()).sort((a, b) => a.cliente.localeCompare(b.cliente));
        console.log('🔍 [COMPARATIVO DEBUG] Resultado período específico:', resultado.length, 'clientes');
        console.log('🔍 [COMPARATIVO DEBUG] TODOS os clientes do período:', resultado.map(c => ({ nome: c.cliente, total: c.total_exames, modalidades: Object.keys(c.modalidades).length })));
        console.log('🔍 [COMPARATIVO DEBUG] Map final size:', map.size);
        return resultado;
      }
      
      // Usar estatísticas definitivas por cliente (100% do banco) para período ativo
      const stats = (context as any)?.clientesStats || [];
      console.log('🔍 [COMPARATIVO DEBUG] Context clientesStats:', stats?.length, stats?.slice(0, 3));
      
      if (!stats || stats.length === 0) {
        console.warn('⚠️ [COMPARATIVO] ClientesStats vazio, tentando carregar dados detalhados...');
        // Fallback direto para dados detalhados se stats estiver vazio
        if (context.detailedData && context.detailedData.length > 0) {
          const map = new Map<string, ClienteAggregated>();
          console.log('🔍 [COMPARATIVO DEBUG] Usando dados detalhados:', context.detailedData.length, 'registros');
          
          (context.detailedData as any[]).forEach((item) => {
            const clienteRaw = (item as any).EMPRESA ?? (item as any).empresa ?? '';
            const cliente = String(clienteRaw).trim();
            if (!cliente) return;
            
            const key = normalizeClientName(cliente).toLowerCase();
            if (!map.has(key)) {
              map.set(key, {
                cliente,
                total_exames: 0,
                modalidades: {},
                especialidades: {},
                prioridades: {},
                categorias: {},
                exames: {},
              });
            }
            
            const ref = map.get(key)!;
            const rawVal = (item as any).VALORES ?? (item as any).VALOR ?? (item as any).QUANTIDADE ?? (item as any).QTD ?? (item as any).QTDE ?? 1;
            const inc = Number.isFinite(Number(rawVal)) ? Number(rawVal) : 1;
            ref.total_exames += inc;
            
            // Adicionar detalhes
            const mod = canonicalModalidade((item as any).MODALIDADE ?? (item as any).modalidade ?? (item as any).Modalidade);
            const esp = canonical((item as any).ESPECIALIDADE ?? (item as any).especialidade ?? (item as any).Especialidade);
            const pri = canonicalPrioridade((item as any).PRIORIDADE ?? (item as any).prioridade ?? (item as any).Prioridade);
            const cat = canonical((item as any).CATEGORIA ?? (item as any).categoria ?? (item as any).Categoria);
            const exame = canonical((item as any).ESTUDO_DESCRICAO ?? (item as any).NOME_EXAME ?? (item as any).EXAME ?? (item as any).ESTUDO ?? (item as any).nome_exame ?? (item as any).Nome_Est ?? (item as any).nome_est);
            
            if (mod) ref.modalidades[mod] = (ref.modalidades[mod] || 0) + inc;
            if (esp) ref.especialidades[esp] = (ref.especialidades[esp] || 0) + inc;
            if (pri) ref.prioridades[pri] = (ref.prioridades[pri] || 0) + inc;
            if (cat) ref.categorias[cat] = (ref.categorias[cat] || 0) + inc;
            if (exame) ref.exames[exame] = (ref.exames[exame] || 0) + inc;
          });
          
          const resultado = Array.from(map.values()).sort((a, b) => a.cliente.localeCompare(b.cliente));
          console.log('🔍 [COMPARATIVO DEBUG] Fallback concluído:', resultado.length, 'clientes');
          console.log('🔍 [COMPARATIVO DEBUG] Primeiros 3 clientes fallback:', resultado.slice(0, 3).map(c => ({ nome: c.cliente, total: c.total_exames })));
          return resultado;
        }
        
        console.error('❌ [COMPARATIVO] Nenhuma fonte de dados disponível!');
        return [];
      }
      
      const map = new Map<string, ClienteAggregated>();

      // 1) Criar base com totais por cliente vindos do RPC completo
      (stats as any[]).forEach((s) => {
        const cliente = String(s.empresa || s.cliente || '').trim();
        if (!cliente) return;
        console.log('🔍 [COMPARATIVO DEBUG] Processando cliente stats:', cliente, 'laudos:', s.total_laudos);
        map.set(normalizeClientName(cliente).toLowerCase(), {
          cliente,
          total_exames: Number(s.total_laudos) || 0,
          modalidades: {},
          especialidades: {},
          prioridades: {},
          categorias: {},
          exames: {},
        });
      });
      
      console.log('🔍 [COMPARATIVO DEBUG] Total clientes processados:', map.size);

      // 2) Se houver dados detalhados, preencher detalhamentos e criar fallback de totais
      if (context.detailedData && context.detailedData.length > 0) {
        console.log('🔍 [COMPARATIVO DEBUG] Preenchendo detalhamentos com dados detalhados:', context.detailedData.length);
        console.log('🔍 [COMPARATIVO DEBUG] Primeiros 5 registros detalhados:', context.detailedData.slice(0, 5));
        
        const detailsTotals = new Map<string, number>();
        (context.detailedData as any[]).forEach((item, index) => {
          const clienteRaw = (item as any).EMPRESA ?? (item as any).empresa ?? (item as any).Empresa ?? (item as any).CLIENTE ?? (item as any).cliente ?? (item as any).Cliente ?? '';
          const cliente = String(clienteRaw).trim();
          
          if (index < 10) {
            console.log(`🔍 [DETALHADO ${index}] Cliente:`, cliente, 'VALORES:', (item as any).VALORES, 'MODALIDADE:', (item as any).MODALIDADE);
          }
          
          if (!cliente) return;
          const key = normalizeClientName(cliente).toLowerCase();
          
          // CRÍTICO: Se cliente não existe no map de stats, criar entrada
          if (!map.has(key)) {
            console.log('🆕 [NOVO CLIENTE] Criando entrada para cliente não encontrado nas stats:', cliente);
            map.set(key, {
              cliente,
              total_exames: 0,
              modalidades: {},
              especialidades: {},
              prioridades: {},
              categorias: {},
              exames: {},
            });
          }
          
          const ref = map.get(key)!;
          const anyItem: any = item;
          // Usar valor numérico real do registro detalhado quando disponível
          const rawVal = (anyItem.VALORES ?? anyItem.VALOR ?? anyItem.QUANTIDADE ?? anyItem.QTD ?? anyItem.QTDE ?? 1);
          const incNum = Number(rawVal);
          const inc = Number.isFinite(incNum) ? incNum : 1;
          
          // Acumular totais de fallback a partir do detalhado
          detailsTotals.set(key, (detailsTotals.get(key) || 0) + inc);
          
          const mod = canonicalModalidade(anyItem.MODALIDADE ?? anyItem.modalidade ?? anyItem.Modalidade);
          const esp = canonical(anyItem.ESPECIALIDADE ?? anyItem.especialidade ?? anyItem.Especialidade);
          const pri = canonicalPrioridade(anyItem.PRIORIDADE ?? anyItem.prioridade ?? anyItem.Prioridade);
          const cat = canonical(anyItem.CATEGORIA ?? anyItem.categoria ?? anyItem.Categoria);
          const exame = canonical(anyItem.ESTUDO_DESCRICAO ?? anyItem.NOME_EXAME ?? anyItem.EXAME ?? anyItem.ESTUDO ?? anyItem.nome_exame ?? anyItem.Nome_Est ?? anyItem.nome_est);
          
          // Debug para AKCPALMAS
          if (cliente.includes('AKCPALMAS') && index < 5) {
            console.log('🔍 [AKCPALMAS DEBUG]', {
              mod, esp, pri, cat, exame, inc,
              modalidade_antes: ref.modalidades[mod] || 0,
              especialidade_antes: ref.especialidades[esp] || 0
            });
          }
          
          if (mod) ref.modalidades[mod] = (ref.modalidades[mod] || 0) + inc;
          if (esp) ref.especialidades[esp] = (ref.especialidades[esp] || 0) + inc;
          if (pri) ref.prioridades[pri] = (ref.prioridades[pri] || 0) + inc;
          if (cat) ref.categorias[cat] = (ref.categorias[cat] || 0) + inc;
          if (exame) ref.exames[exame] = (ref.exames[exame] || 0) + inc;
        });
        
        // Fallback: quando stats não trouxe o total do cliente, usar a soma dos detalhados
        for (const [key, ref] of map.entries()) {
          if (!ref.total_exames || ref.total_exames === 0) {
            ref.total_exames = detailsTotals.get(key) || 0;
            console.log('🔄 [FALLBACK] Cliente', ref.cliente, 'total stats era 0, usando detalhado:', ref.total_exames);
          }
        }
      }

      const resultado = Array.from(map.values()).sort((a, b) => a.cliente.localeCompare(b.cliente));
      console.log('🔍 [COMPARATIVO DEBUG] Resultado final sistema:', resultado.length, 'clientes');
      console.log('🔍 [COMPARATIVO DEBUG] Primeiros 5 clientes sistema:', resultado.slice(0, 5).map(c => ({ nome: c.cliente, total: c.total_exames })));
      return resultado;
    } catch (e) {
      console.error('Erro ao agregar dados do sistema para comparativo:', e);
      toast({ title: 'Erro', description: 'Falha ao preparar dados do sistema.', variant: 'destructive' });
      return [];
    }
  }, [context.clientesStats, context.detailedData, dadosPeriodo, periodoSelecionado, toast]);

  // Agregar dados do arquivo - PRIORIZAR uploadedExams se disponível
  const arquivoClientes = useMemo<ClienteAggregated[] | null>(() => {
    // Usar primeiro uploadedExams (mais detalhado) se disponível
    const sourceData = uploadedExams && uploadedExams.length > 0 ? uploadedExams : uploaded;
    
    if (!sourceData || sourceData.length === 0) return null;
    
    console.log('🔍 [COMPARATIVO] Processando dados do arquivo:', sourceData.length, 'registros');
    console.log('🔍 [COMPARATIVO] Fonte:', uploadedExams && uploadedExams.length > 0 ? 'uploadedExams' : 'uploaded');
    
    const agg = new Map<string, ClienteAggregated>();
    
    sourceData.forEach((row: any) => {
      const cliente = String(row.cliente || '').trim();
      if (!cliente) return;
      
      // Calcular valor: usar quant (de uploadedExams) ou totalExames (de uploaded)
      const val = Number(row.quant || row.totalExames || 1) || 1;
      
      if (!agg.has(cliente)) {
        agg.set(cliente, {
          cliente,
          total_exames: 0,
          modalidades: {},
          especialidades: {},
          prioridades: {},
          categorias: {},
          exames: {},
        });
      }
      
      const ref = agg.get(cliente)!;
      ref.total_exames += val;
      
      // Adicionar detalhes (normalizando campos)
      let mod = canonicalModalidade(row.modalidade);
      const esp = canonical(row.especialidade);
      const pri = canonicalPrioridade(row.prioridade);
      const cat = canonical(row.categoria);
      const exame = canonical(row.exame);
      
      if (mod) ref.modalidades[mod] = (ref.modalidades[mod] || 0) + val;
      if (esp) ref.especialidades[esp] = (ref.especialidades[esp] || 0) + val;
      if (pri) ref.prioridades[pri] = (ref.prioridades[pri] || 0) + val;
      if (cat) ref.categorias[cat] = (ref.categorias[cat] || 0) + val;
      if (exame) ref.exames[exame] = (ref.exames[exame] || 0) + val;
    });
    
    const resultado = Array.from(agg.values()).sort((a, b) => a.cliente.localeCompare(b.cliente));
    console.log('🔍 [COMPARATIVO] Resultado arquivo:', resultado.length, 'clientes');
    console.log('🔍 [COMPARATIVO] Primeiros 3 clientes arquivo:', resultado.slice(0, 3).map(c => ({ nome: c.cliente, total: c.total_exames })));
    return resultado;
  }, [uploaded, uploadedExams]);

  const normalize = (s: string) => normalizeClientName(s).toLowerCase();

  const uploadedMap = useMemo(() => {
    if (!arquivoClientes) return null;
    const map = new Map<string, ClienteAggregated>();
    arquivoClientes.forEach(u => map.set(normalize(u.cliente), u));
    return map;
  }, [arquivoClientes]);

  const sistemaMap = useMemo(() => {
    const map = new Map<string, ClienteAggregated>();
    sistemaClientes.forEach(c => map.set(normalize(c.cliente), c));
    return map;
  }, [sistemaClientes]);

  const divergencias = useMemo(() => {
    const list: Divergencia[] = [];
    if (!uploadedMap) return list;

    // faltando no arquivo e total mismatch
    sistemaClientes.forEach(c => {
      const key = normalize(c.cliente);
      const u = uploadedMap.get(key);
      if (!u) {
        list.push({ tipo: 'missing_in_file', cliente: c.cliente });
      } else if (typeof u.total_exames === 'number' && u.total_exames !== c.total_exames) {
        list.push({ tipo: 'total_mismatch', cliente: c.cliente, totalSistema: c.total_exames, totalArquivo: u.total_exames });
      }
    });

    // faltando no sistema
    if (uploadedMap) {
      uploadedMap.forEach((u, key) => {
        if (!sistemaMap.has(key)) {
          list.push({ tipo: 'missing_in_system', cliente: u.cliente, totalArquivo: u.total_exames });
        }
      });
    }

    return list;
  }, [uploadedMap, sistemaMap, sistemaClientes]);

  useEffect(() => {
    onDivergencesComputed?.(divergencias);
  }, [divergencias, onDivergencesComputed]);

  const divCounts = useMemo(() => {
    return {
      missingInFile: divergencias.filter(d => d.tipo === 'missing_in_file').length,
      missingInSystem: divergencias.filter(d => d.tipo === 'missing_in_system').length,
      totalMismatch: divergencias.filter(d => d.tipo === 'total_mismatch').length,
    };
  }, [divergencias]);

  const clientesExibidos = useMemo(() => {
    // Unir clientes do sistema e do arquivo (para exibir também os que existem só no upload)
    const map = new Map<string, ClienteAggregated>();
    sistemaClientes.forEach((c) => map.set(normalize(c.cliente), c));

    if (arquivoClientes) {
      arquivoClientes.forEach((u) => {
        const key = normalize(u.cliente);
        if (!map.has(key)) {
          map.set(key, {
            cliente: u.cliente,
            total_exames: 0,
            modalidades: {},
            especialidades: {},
            prioridades: {},
            categorias: {},
            exames: {},
          });
        }
      });
    }

    const union = Array.from(map.values()).sort((a, b) => a.cliente.localeCompare(b.cliente));

    if (filtro === 'divergencias' && divergencias.length > 0) {
      const setDiv = new Set(divergencias.map((d) => normalize(d.cliente)));
      return union.filter((c) => setDiv.has(normalize(c.cliente)));
    }

    return union;
  }, [filtro, divergencias, sistemaClientes, arquivoClientes]);

  const handleExportList = () => {
    try {
      console.log('🔍 [EXCEL DEBUG] Iniciando exportação...');
      console.log('🔍 [EXCEL DEBUG] Clientes exibidos:', clientesExibidos.length);
      console.log('🔍 [EXCEL DEBUG] Upload map exists:', !!uploadedMap);
      console.log('🔍 [EXCEL DEBUG] Sistema clientes:', sistemaClientes.length);
      console.log('🔍 [EXCEL DEBUG] Filtro atual:', filtro);
      console.log('🔍 [EXCEL DEBUG] Divergências count:', divergencias.length);
      console.log('🔍 [EXCEL DEBUG] Sistema clientes sample:', sistemaClientes.slice(0, 3).map(c => ({ nome: c.cliente, total: c.total_exames })));
      
      // VALIDAÇÃO CRÍTICA: Verificar se há dados do sistema carregados
      if (sistemaClientes.length === 0) {
        toast({ 
          title: 'Erro', 
          description: 'Nenhum dado do sistema está carregado. Aguarde o carregamento dos dados ou verifique se o período está selecionado corretamente.',
          variant: 'destructive'
        });
        return;
      }

      // VALIDAÇÃO: Verificar se há arquivo carregado
      if (!uploadedMap || uploadedMap.size === 0) {
        toast({ 
          title: 'Erro', 
          description: 'Nenhum arquivo foi carregado para comparação. Faça o upload de um arquivo primeiro.',
          variant: 'destructive'
        });
        return;
      }
      
      // CRÍTICO: Para divergências, usar SEMPRE todos os dados do sistema que tenham divergências
      // E incluir também clientes que só existem no arquivo
      let clientesParaExport: ClienteAggregated[] = [];
      
      if (filtro === 'divergencias') {
        // 1. Clientes do sistema que têm divergências (exceto missing_in_system)
        const clientesSistemaComDivergencia = sistemaClientes.filter(c => 
          divergencias.some(d => normalize(d.cliente) === normalize(c.cliente) && d.tipo !== 'missing_in_system')
        );
        
        // 2. Clientes que só existem no arquivo (criar entradas fake do sistema com 0)
        const clientesSoNoArquivo = divergencias
          .filter(d => d.tipo === 'missing_in_system')
          .map(d => ({
            cliente: d.cliente,
            total_exames: 0,
            modalidades: {},
            especialidades: {},
            prioridades: {},
            categorias: {},
            exames: {},
          }));
        
        clientesParaExport = [...clientesSistemaComDivergencia, ...clientesSoNoArquivo];
        console.log('🔍 [EXCEL DEBUG] Clientes sistema com divergência:', clientesSistemaComDivergencia.length);
        console.log('🔍 [EXCEL DEBUG] Clientes só no arquivo:', clientesSoNoArquivo.length);
        
        // VALIDAÇÃO: Se não há divergências, avisar o usuário
        if (clientesParaExport.length === 0) {
          toast({ 
            title: 'Aviso', 
            description: 'Não foram encontradas divergências para exportar. O sistema e arquivo estão em sincronia.',
            variant: 'default'
          });
          return;
        }
      } else {
        // Para filtro 'todos', usar a união completa (clientesExibidos)
        clientesParaExport = clientesExibidos;
      }
      
      console.log('🔍 [EXCEL DEBUG] Clientes para export:', clientesParaExport.length);
      
      // Resumo dos totais por cliente
      const resumoRows: any[] = [];
      clientesParaExport.forEach((c) => {
        const up = uploadedMap?.get(normalize(c.cliente));
        const totalSistema = c.total_exames;
        const totalArquivo = up?.total_exames ?? 0;
        const divergencia = totalSistema !== totalArquivo;
        
        console.log(`🔍 [EXCEL DEBUG] Cliente: ${c.cliente}, Sistema: ${totalSistema}, Arquivo: ${totalArquivo}`);
        
        resumoRows.push({
          Cliente: c.cliente,
          'Total Sistema': totalSistema,
          'Total Arquivo': totalArquivo,
          'Diferença': totalArquivo - totalSistema,
          'Status': divergencia ? 'DIVERGENTE' : 'OK',
          'Percentual Arquivo/Sistema': totalSistema > 0 ? `${((totalArquivo / totalSistema) * 100).toFixed(1)}%` : 'N/A'
        });
      });
      
      // Adicionar clientes que só existem no arquivo (missing_in_system)
      if (filtro === 'divergencias') {
        const clientesMissingInSystem = divergencias.filter(d => d.tipo === 'missing_in_system');
        clientesMissingInSystem.forEach((d) => {
          const up = uploadedMap?.get(normalize(d.cliente));
          resumoRows.push({
            Cliente: d.cliente,
            'Total Sistema': 0,
            'Total Arquivo': up?.total_exames ?? 0,
            'Diferença': up?.total_exames ?? 0,
            'Status': 'DIVERGENTE (SÓ NO ARQUIVO)',
            'Percentual Arquivo/Sistema': 'N/A'
          });
        });
      }

      console.log('🔍 [EXCEL DEBUG] Resumo rows:', resumoRows.length);

      // Detalhamento completo por modalidade
      const modalidadeRows: any[] = [];
      clientesParaExport.forEach((c) => {
        const up = uploadedMap?.get(normalize(c.cliente));
        const keys = Array.from(new Set([
          ...Object.keys(c.modalidades || {}),
          ...(up?.modalidades ? Object.keys(up.modalidades) : []),
        ])).sort();
        
        keys.forEach((modalidade) => {
          const sistemaVal = c.modalidades[modalidade] || 0;
          const arquivoVal = up?.modalidades?.[modalidade] || 0;
          modalidadeRows.push({
            Cliente: c.cliente,
            Modalidade: modalidade,
            'Qtd Sistema': sistemaVal,
            'Qtd Arquivo': arquivoVal,
            'Diferença': arquivoVal - sistemaVal,
            'Status': sistemaVal !== arquivoVal ? 'DIVERGENTE' : 'OK'
          });
        });
      });

      console.log('🔍 [EXCEL DEBUG] Modalidade rows:', modalidadeRows.length);

      // Detalhamento completo por especialidade
      const especialidadeRows: any[] = [];
      clientesParaExport.forEach((c) => {
        const up = uploadedMap?.get(normalize(c.cliente));
        const keys = Array.from(new Set([
          ...Object.keys(c.especialidades || {}),
          ...(up?.especialidades ? Object.keys(up.especialidades) : []),
        ])).sort();
        
        keys.forEach((especialidade) => {
          const sistemaVal = c.especialidades[especialidade] || 0;
          const arquivoVal = up?.especialidades?.[especialidade] || 0;
          especialidadeRows.push({
            Cliente: c.cliente,
            Especialidade: especialidade,
            'Qtd Sistema': sistemaVal,
            'Qtd Arquivo': arquivoVal,
            'Diferença': arquivoVal - sistemaVal,
            'Status': sistemaVal !== arquivoVal ? 'DIVERGENTE' : 'OK'
          });
        });
      });

      // Detalhamento completo por exames
      const exameRows: any[] = [];
      clientesParaExport.forEach((c) => {
        const up = uploadedMap?.get(normalize(c.cliente));
        const keys = Array.from(new Set([
          ...Object.keys(c.exames || {}),
          ...(up?.exames ? Object.keys(up.exames) : []),
        ])).sort();
        
        keys.forEach((exame) => {
          const sistemaVal = c.exames[exame] || 0;
          const arquivoVal = up?.exames?.[exame] || 0;
          exameRows.push({
            Cliente: c.cliente,
            Exame: exame,
            'Qtd Sistema': sistemaVal,
            'Qtd Arquivo': arquivoVal,
            'Diferença': arquivoVal - sistemaVal,
            'Status': sistemaVal !== arquivoVal ? 'DIVERGENTE' : 'OK'
          });
        });
      });

      // Detalhamento por categorias
      const categoriaRows: any[] = [];
      clientesParaExport.forEach((c) => {
        const up = uploadedMap?.get(normalize(c.cliente));
        const keys = Array.from(new Set([
          ...Object.keys(c.categorias || {}),
          ...(up?.categorias ? Object.keys(up.categorias) : []),
        ])).sort();
        
        keys.forEach((categoria) => {
          const sistemaVal = c.categorias[categoria] || 0;
          const arquivoVal = up?.categorias?.[categoria] || 0;
          categoriaRows.push({
            Cliente: c.cliente,
            Categoria: categoria,
            'Qtd Sistema': sistemaVal,
            'Qtd Arquivo': arquivoVal,
            'Diferença': arquivoVal - sistemaVal,
            'Status': sistemaVal !== arquivoVal ? 'DIVERGENTE' : 'OK'
          });
        });
      });

      // Detalhamento por prioridades
      const prioridadeRows: any[] = [];
      clientesParaExport.forEach((c) => {
        const up = uploadedMap?.get(normalize(c.cliente));
        const keys = Array.from(new Set([
          ...Object.keys(c.prioridades || {}),
          ...(up?.prioridades ? Object.keys(up.prioridades) : []),
        ])).sort();
        
        keys.forEach((prioridade) => {
          const sistemaVal = c.prioridades[prioridade] || 0;
          const arquivoVal = up?.prioridades?.[prioridade] || 0;
          prioridadeRows.push({
            Cliente: c.cliente,
            Prioridade: prioridade,
            'Qtd Sistema': sistemaVal,
            'Qtd Arquivo': arquivoVal,
            'Diferença': arquivoVal - sistemaVal,
            'Status': sistemaVal !== arquivoVal ? 'DIVERGENTE' : 'OK'
          });
        });
      });

      // Log final para debug
      console.log('🔍 [EXCEL DEBUG] Total rows por aba:', {
        resumo: resumoRows.length,
        modalidades: modalidadeRows.length,
        especialidades: especialidadeRows.length,
        exames: exameRows.length,
        categorias: categoriaRows.length,
        prioridades: prioridadeRows.length
      });

      // Verificar se há dados do sistema
      const temDadosSistema = resumoRows.some(r => r['Total Sistema'] > 0);
      console.log('🔍 [EXCEL DEBUG] Tem dados do sistema:', temDadosSistema);

      if (!temDadosSistema) {
        toast({ 
          title: 'Aviso', 
          description: 'Nenhum dado do sistema foi encontrado para comparação. Verifique se o período está carregado.',
          variant: 'destructive'
        });
        return;
      }

      // Criar workbook com múltiplas abas
      const wb = XLSX.utils.book_new();
      
      // Aba 1: Resumo
      const wsResumo = XLSX.utils.json_to_sheet(resumoRows);
      XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Clientes');
      
      // Aba 2: Modalidades
      const wsModalidades = XLSX.utils.json_to_sheet(modalidadeRows);
      XLSX.utils.book_append_sheet(wb, wsModalidades, 'Modalidades');
      
      // Aba 3: Especialidades
      const wsEspecialidades = XLSX.utils.json_to_sheet(especialidadeRows);
      XLSX.utils.book_append_sheet(wb, wsEspecialidades, 'Especialidades');
      
      // Aba 4: Exames
      const wsExames = XLSX.utils.json_to_sheet(exameRows);
      XLSX.utils.book_append_sheet(wb, wsExames, 'Exames');
      
      // Aba 5: Categorias
      const wsCategorias = XLSX.utils.json_to_sheet(categoriaRows);
      XLSX.utils.book_append_sheet(wb, wsCategorias, 'Categorias');
      
      // Aba 6: Prioridades
      const wsPrioridades = XLSX.utils.json_to_sheet(prioridadeRows);
      XLSX.utils.book_append_sheet(wb, wsPrioridades, 'Prioridades');

      const fileName = `comparativo_detalhado_${periodoSelecionado || 'ativo'}_${new Date().toISOString().slice(0,10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast({ 
        title: 'Relatório Exportado', 
        description: `Arquivo ${fileName} gerado com 6 abas de comparação detalhada.`,
        variant: 'default'
      });
    } catch (e) {
      console.error('Erro ao exportar lista:', e);
      toast({ title: 'Erro', description: 'Falha ao exportar a lista.', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Comparação Integral (Sistema x Arquivo)
        </CardTitle>
        {uploadedMap && (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            <span>
              Divergências: no arquivo {divCounts.missingInFile}, no sistema {divCounts.missingInSystem}, total diferente {divCounts.totalMismatch}
            </span>
          </div>
        )}
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={handleExportList}>
            Exportar lista (Excel)
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Button
            variant={filtro === 'todos' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltro('todos')}
          >
            Todos ({clientesExibidos.length})
          </Button>
          <Button
            variant={filtro === 'divergencias' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltro('divergencias')}
          >
            <ArrowLeftRight className="h-4 w-4 mr-1" />
            Divergências ({divergencias.length})
          </Button>
        </div>

        <div className="space-y-2 max-h-[70vh] overflow-auto">
          {clientesExibidos.map((c) => {
            const up = uploadedMap?.get(normalize(c.cliente));
            const mismatch = up && up.total_exames !== undefined && up.total_exames !== c.total_exames;
            return (
              <div key={c.cliente} className="p-3 border rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                  <div className="font-medium">{c.cliente}</div>
                  <div className="text-sm">
                    <Badge variant={mismatch ? 'destructive' : 'outline'}>Sistema: {c.total_exames.toLocaleString()}</Badge>
                  </div>
                  <div className="text-sm">
                    {uploadedMap ? (
                      <Badge variant={mismatch ? 'destructive' : 'secondary'}>
                        Arquivo: {up ? up.total_exames?.toLocaleString() : '—'}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Arquivo: —</Badge>
                    )}
                  </div>
                </div>

                {/* Modalidades */}
                <div className="mt-3">
                  <div className="font-medium text-foreground">Modalidades</div>
                  {(() => {
                    const modKeys = Array.from(
                      new Set([
                        ...Object.keys(c.modalidades || {}),
                        ...(up?.modalidades ? Object.keys(up.modalidades) : []),
                      ])
                    ).sort();
                    return modKeys.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {modKeys.map((k) => (
                          <li key={k} className="flex items-center justify-between text-sm">
                            <span className="text-foreground">{k}</span>
                            <span className="text-muted-foreground">
                              Sist: {(c.modalidades[k] || 0).toLocaleString()} • Arq: {(up?.modalidades?.[k] || 0).toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-muted-foreground">—</div>
                    );
                  })()}
                </div>

                {/* Especialidades */}
                <div className="mt-3">
                  <div className="font-medium text-foreground">Especialidades</div>
                  {(() => {
                    const keys = Array.from(
                      new Set([
                        ...Object.keys(c.especialidades || {}),
                        ...(up?.especialidades ? Object.keys(up.especialidades) : []),
                      ])
                    ).sort();
                    return keys.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {keys.map((k) => (
                          <li key={k} className="flex items-center justify-between text-sm">
                            <span className="text-foreground">{k}</span>
                            <span className="text-muted-foreground">
                              Sist: {(c.especialidades[k] || 0).toLocaleString()} • Arq: {(up?.especialidades?.[k] || 0).toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-muted-foreground">—</div>
                    );
                  })()}
                </div>

                {/* Categorias */}
                <div className="mt-3">
                  <div className="font-medium text-foreground">Categorias</div>
                  {(() => {
                    const keys = Array.from(
                      new Set([
                        ...Object.keys(c.categorias || {}),
                        ...(up?.categorias ? Object.keys(up.categorias) : []),
                      ])
                    ).sort();
                    return keys.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {keys.map((k) => (
                          <li key={k} className="flex items-center justify-between text-sm">
                            <span className="text-foreground">{k}</span>
                            <span className="text-muted-foreground">
                              Sist: {(c.categorias[k] || 0).toLocaleString()} • Arq: {(up?.categorias?.[k] || 0).toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-muted-foreground">—</div>
                    );
                  })()}
                </div>

                {/* Prioridades */}
                <div className="mt-3">
                  <div className="font-medium text-foreground">Prioridades</div>
                  {(() => {
                    const keys = Array.from(
                      new Set([
                        ...Object.keys(c.prioridades || {}),
                        ...(up?.prioridades ? Object.keys(up.prioridades) : []),
                      ])
                    ).sort();
                    return keys.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {keys.map((k) => (
                          <li key={k} className="flex items-center justify-between text-sm">
                            <span className="text-foreground">{k}</span>
                            <span className="text-muted-foreground">
                              Sist: {(c.prioridades[k] || 0).toLocaleString()} • Arq: {(up?.prioridades?.[k] || 0).toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-muted-foreground">—</div>
                    );
                  })()}
                </div>

                {/* Exames */}
                <div className="mt-3">
                  <div className="font-medium text-foreground">Exames</div>
                  {(() => {
                    const exameKeys = Array.from(
                      new Set([
                        ...Object.keys(c.exames || {}),
                        ...(up?.exames ? Object.keys(up.exames) : []),
                      ])
                    ).sort();
                    return exameKeys.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {exameKeys.map((k) => {
                          const s = c.exames[k] || 0;
                          const a = (up?.exames?.[k] || 0);
                          const delta = a - s;
                          return (
                            <li key={k} className="flex items-center justify-between text-sm">
                              <span className="text-foreground">{k}</span>
                              <span className="text-muted-foreground flex items-center gap-2">
                                <span>
                                  Sist: {s.toLocaleString()} • Arq: {a.toLocaleString()}
                                </span>
                                {delta !== 0 && (
                                  <Badge variant={delta > 0 ? 'destructive' : 'outline'}>
                                    Δ {delta > 0 ? '+' : ''}{delta}
                                  </Badge>
                                )}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="text-sm text-muted-foreground">—</div>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>

        {clientesExibidos.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum cliente encontrado.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
