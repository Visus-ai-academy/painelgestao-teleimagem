import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useVolumetria } from "@/contexts/VolumetriaContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import type { UploadedExamRow } from "@/components/volumetria/VolumetriaExamesComparison";

// Tipos para linhas
interface VolumetriaRow {
  EMPRESA?: string;
  NOME_PACIENTE?: string;
  CODIGO_PACIENTE?: string | number;
  ESTUDO_DESCRICAO?: string;
  ACCESSION_NUMBER?: string;
  MODALIDADE?: string;
  PRIORIDADE?: string;
  VALORES?: number;
  ESPECIALIDADE?: string;
  MEDICO?: string;
  DUPLICADO?: string | boolean;
  DATA_REALIZACAO?: string;
  HORA_REALIZACAO?: string;
  DATA_TRANSFERENCIA?: string;
  HORA_TRANSFERENCIA?: string;
  DATA_LAUDO?: string;
  HORA_LAUDO?: string;
  DATA_PRAZO?: string;
  HORA_PRAZO?: string;
  STATUS?: string;
  UNIDADE_ORIGEM?: string;
}

type DivergenciaTipo = 'arquivo_nao_no_sistema' | 'sistema_nao_no_arquivo' | 'quantidade_diferente' | 'categoria' | 'especialidade' | 'modalidade' | 'prioridade' | 'categoria+especialidade' | 'categoria+especialidade+modalidade' | 'categoria+especialidade+modalidade+prioridade';

interface LinhaDivergencia {
  tipo: DivergenciaTipo;
  chave: string;
  // Colunas pedidas (preenchidas do lado disponível)
  EMPRESA: string;
  NOME_PACIENTE: string;
  CODIGO_PACIENTE: string;
  ESTUDO_DESCRICAO: string;
  ACCESSION_NUMBER: string;
  MODALIDADE: string;
  PRIORIDADE: string;
  VALORES: number | string;
  ESPECIALIDADE: string;
  MEDICO: string;
  DUPLICADO: string;
  DATA_REALIZACAO: string;
  HORA_REALIZACAO: string;
  DATA_TRANSFERENCIA: string;
  HORA_TRANSFERENCIA: string;
  DATA_LAUDO: string;
  HORA_LAUDO: string;
  DATA_PRAZO: string;
  HORA_PRAZO: string;
  STATUS: string;
  UNIDADE_ORIGEM: string;
  CLIENTE: string;
  // extras - informações de divergência
  total_arquivo?: number;
  total_sistema?: number;
  categoria_arquivo?: string;
  categoria_sistema?: string;
  especialidade_arquivo?: string;
  especialidade_sistema?: string;
  modalidade_arquivo?: string;
  modalidade_sistema?: string;
  prioridade_arquivo?: string;
  prioridade_sistema?: string;
}

function canonical(val?: string) {
  const s = (val || '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  return s;
}
function normalizeModalidade(m?: string) {
  const u = canonical(m);
  if (u === 'CT') return 'TC';
  if (u === 'MR') return 'RM';
  return u;
}
function normalizeCliente(name?: string) {
  let s = canonical(name);
  if (["INTERCOR2","INTERCOR 2"].includes(s)) s = 'INTERCOR';
  if (s === 'P HADVENTISTA') s = 'HADVENTISTA';
  if (s === 'P UNIMED CARUARU') s = 'UNIMED CARUARU';
  if (s === 'PRN MEDIMAGEM CAMBORIU') s = 'MEDIMAGEM CAMBORIU';
  if (s === 'UNIMAGEM CENTRO') s = 'UNIMAGEM ATIBAIA';
  if (["CEDI RJ","CEDI RO","CEDI UNIMED"].includes(s)) s = 'CEDIDIAG';
  s = s.replace(/ - TELE$/, '').replace(/ - CT$/, '').replace(/ - MR$/, '').replace(/_PLANT(AO|AO)$/,'').replace(/_RMX$/, '');
  return s;
}

function cleanExamName(name?: string) {
  const raw = (name || '').toString();
  return raw.replace(/\s+X[1-9]\b/gi, '').replace(/\s+XE\b/gi, '').replace(/\s+/g, ' ').trim();
}

function formatDateBR(val?: string | number) {
  if (!val && val !== 0) return '-';
  let s = String(val).trim();
  if (!s) return '-';
  
  // Excel serial number (handle numeric dates from Excel)
  const num = Number(s);
  if (!isNaN(num) && num > 25000 && num < 60000) {
    // Excel date serial conversion
    const baseDate = new Date(1899, 11, 30); // Excel's base date
    const convertedDate = new Date(baseDate.getTime() + num * 24 * 60 * 60 * 1000);
    const dd = String(convertedDate.getDate()).padStart(2,'0');
    const mm = String(convertedDate.getMonth() + 1).padStart(2,'0');
    const yyyy = String(convertedDate.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  }
  
  // ISO format yyyy-mm-dd
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  
  // dd/mm/yyyy format (keep)
  const br = s.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{2,4})$/);
  if (br) {
    const day = br[1].padStart(2,'0');
    const month = br[2].padStart(2,'0');
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${day}/${month}/${year}`;
  }
  
  // Try Date parse fallback
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yyyy = String(d.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  }
  
  return '-'; // Return '-' for invalid dates instead of raw value
}

function toYMD(val?: any) {
  if (val === null || val === undefined) return '';
  let s = String(val).trim();
  if (!s) return '';
  
  // Excel serial number (handle numeric dates from Excel first)
  const num = Number(s);
  if (!isNaN(num) && num > 25000 && num < 60000) {
    const baseDate = new Date(1899, 11, 30); // Excel's epoch
    const convertedDate = new Date(baseDate.getTime() + num * 24 * 60 * 60 * 1000);
    const y = convertedDate.getFullYear();
    const m = String(convertedDate.getMonth() + 1).padStart(2,'0');
    const day = String(convertedDate.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  
  // ISO yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  
  // dd/mm/yyyy or dd-mm-yyyy (DATA_LAUDO now only contains date)
  const br = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    const month = br[2].padStart(2,'0');
    const day = br[1].padStart(2,'0');
    return `${year}-${month}-${day}`;
  }
  
  // Try Date parse fallback
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  
  return '';
}

export default function VolumetriaDivergencias({ uploadedExams }: { uploadedExams?: UploadedExamRow[] }) {
  const { data: ctx } = useVolumetria();
  const [clientesMap, setClientesMap] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);

  // Filtros básicos
  const [referencia, setReferencia] = useState<string>('2025-06');
  const [cliente, setCliente] = useState<string>('todos');

  useEffect(() => {
    // Carregar mapa de clientes (id -> nome)
    (async () => {
      const { data } = await supabase.from('clientes').select('id,nome').eq('ativo', true);
      const map: Record<string, string> = {};
      (data || []).forEach((c) => { map[c.id] = c.nome; });
      setClientesMap(map);
    })();
  }, []);

  // Carregar período mais recente disponível na inicialização
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('volumetria_mobilemed')
          .select('periodo_referencia')
          .not('periodo_referencia', 'is', null)
          .order('periodo_referencia', { ascending: false })
          .limit(1);
        
        if (data && data.length > 0) {
          const ultimoPeriodo = data[0].periodo_referencia as string;
          console.log('🔍 Último período encontrado:', ultimoPeriodo);
          
          // Converter de formato "jun/25" para "2025-06"
          if (ultimoPeriodo && ultimoPeriodo.includes('/')) {
            const [mes, ano] = ultimoPeriodo.split('/');
            const mesesMap: Record<string, string> = {
              'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04', 'mai': '05', 'jun': '06',
              'jul': '07', 'ago': '08', 'set': '09', 'out': '10', 'nov': '11', 'dez': '12'
            };
            const mesNum = mesesMap[mes];
            if (mesNum && ano) {
              const anoCompleto = ano.length === 2 ? `20${ano}` : ano;
              const refFormatada = `${anoCompleto}-${mesNum}`;
              console.log('🔄 Convertendo período:', ultimoPeriodo, '->', refFormatada);
              setReferencia(refFormatada);
            }
          }
        }
      } catch (error) {
        console.error('Erro ao buscar último período:', error);
        // Manter valor padrão em caso de erro
      }
    })();
  }, []);

  const clienteOptions = useMemo(() => ctx.clientes || [], [ctx.clientes]);

  const gerarExcelDivergencias = async () => {
    console.log('🚀 INÍCIO DO PROCESSO DE DIVERGÊNCIAS');
    try {
      setExporting(true);
      
      const periodoReferenciaBanco = referencia;
      console.log('🔍 Processando divergências para período:', referencia);
      
      // Usar dados do contexto
      const systemData = ctx?.detailedData || [];
      console.log('🏥 Total de registros detalhados:', systemData.length);
      
      if (!systemData || systemData.length === 0) {
        throw new Error('Nenhum dado encontrado no contexto. Atualize a tela.');
      }

      // Funções auxiliares para normalização
      const normalizeModalidade = (mod: string) => canonical(mod || '');
      const normalizeCliente = (cli: string) => canonical(cli || '');
      const cleanExamName = (name: string) => canonical(name || '');
      
      // Normalizar prioridade para resolver divergências incorretas
      const normalizePrioridade = (prio: string) => {
        const prioNorm = canonical(prio || '');
        if (prioNorm === 'URGENCIA' || prioNorm === 'URGENTE') return 'URGENTE';
        if (prioNorm === 'ROTINA') return 'ROTINA';
        if (prioNorm === 'EMERGENCIA' || prioNorm === 'EMERGENCIAL') return 'EMERGENCIA';
        if (prioNorm === 'PLANTAO') return 'PLANTAO';
        return prioNorm;
      };

      // Normalizar nome do médico com lógica inteligente para matching
      const normalizeMedico = (medico: string) => {
        let norm = canonical(medico || '');
        // Remover códigos entre parênteses como (E1), (E2), (E3), etc
        norm = norm.replace(/\s*\([^)]*\)\s*/g, '');
        // Remover DR/DRA no início se presente
        norm = norm.replace(/^DR[A]?\s+/, '');
        // Remover pontos finais
        norm = norm.replace(/\.$/, '');
        
        return norm.trim();
      };

      // Função para criar uma "assinatura" do médico baseada em iniciais + sobrenome principal
      const criarAssinaturaMedico = (medico: string) => {
        const norm = normalizeMedico(medico);
        if (!norm) return '';
        
        const parts = norm.split(/\s+/).filter(p => p.length > 0);
        if (parts.length === 0) return '';
        
        // Se tiver apenas um nome, retornar ele
        if (parts.length === 1) return parts[0];
        
        // Expandir abreviações comuns
        const expandirAbreviacoes = (part: string) => {
          const abreviacoes: Record<string, string> = {
            'S': 'SILVA', 'A': 'ALVES', 'C': 'COSTA', 'F': 'FERREIRA',
            'M': 'MARTINS', 'R': 'RIBEIRO', 'L': 'LIMA', 'P': 'PEREIRA'
          };
          const clean = part.replace(/\.$/, '');
          return abreviacoes[clean] || clean;
        };
        
        // Processar cada parte expandindo abreviações
        const processedParts = parts.map(part => {
          // Pular preposições comuns
          if (['DA', 'DE', 'DO', 'DOS', 'DAS'].includes(part)) return part;
          // Expandir se for abreviação de 1 char + ponto opcional
          if (part.length <= 2 && part.match(/^[A-Z]\.?$/)) {
            return expandirAbreviacoes(part);
          }
          return part;
        });
        
        // Primeiro nome
        const firstName = processedParts[0];
        
        // Encontrar o sobrenome principal (último nome significativo, ignorando preposições)
        let mainLastName = processedParts[processedParts.length - 1];
        
        // Se o último é muito curto, tentar o penúltimo
        if (mainLastName.length <= 2 && processedParts.length > 2) {
          mainLastName = processedParts[processedParts.length - 2];
        }
        
        // Pegar iniciais dos nomes do meio, incluindo preposições importantes
        const middleParts = processedParts.slice(1, -1);
        const middleSignature = middleParts.map(part => {
          if (['DA', 'DE', 'DO', 'DOS', 'DAS'].includes(part)) return part.charAt(0); // D para "da", "de", etc
          return part.charAt(0); // Primeira letra do nome
        }).join('');
        
        // Criar assinatura: PRIMEIRO + INICIAIS_MEIO + SOBRENOME_PRINCIPAL
        return `${firstName}${middleSignature}${mainLastName}`;
      };

      // OTIMIZAÇÃO: Filtrar dados antes do processamento pesado
      const inMonth = (val: any) => {
        if (!val) return true;
        const s = String(val);
        let ym = '';
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) ym = s.slice(0,7);
        else {
          const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
          if (m) ym = `${m[3].length===2?`20${m[3]}`:m[3]}-${m[2].padStart(2,'0')}`;
        }
        return ym ? ym === referencia : true;
      };

      // Filtrar dados do sistema primeiro
      const systemDataFiltered = systemData.filter((r: any) => {
        const empresaRaw = r.EMPRESA || r.empresa || r.Empresa || '';
        const empresaNormalizada = normalizeCliente(empresaRaw);
        
        if (cliente !== 'todos') {
          const clienteNormalizado = normalizeCliente(cliente);
          if (empresaNormalizada !== clienteNormalizado) return false;
        }
        
        const dataRef = r.data_referencia || r.DATA_REFERENCIA;
        return !dataRef || inMonth(dataRef);
      });

      // Filtrar dados do arquivo primeiro
      const fileDataFiltered = (uploadedExams || []).filter((r) => {
        const clienteNormalizado = normalizeCliente(r.cliente);
        if (cliente !== 'todos' && clienteNormalizado !== normalizeCliente(cliente)) return false;
        return inMonth((r as any).data_exame || (r as any).data_laudo);
      });

      console.log('📊 Dados filtrados - Sistema:', systemDataFiltered.length, 'Arquivo:', fileDataFiltered.length);

      // OTIMIZAÇÃO: Processar em batches assíncronos
      const BATCH_SIZE = 1000;
      
      // Processar sistema em batches
      type AggSys = { total: number; amostra?: any };
      const mapSistema = new Map<string, AggSys>();
      
      for (let i = 0; i < systemDataFiltered.length; i += BATCH_SIZE) {
        const batch = systemDataFiltered.slice(i, i + BATCH_SIZE);
        
        batch.forEach((r: any) => {
          const empresaNormalizada = normalizeCliente(r.EMPRESA || r.empresa || r.Empresa || '');
          const pacienteNome = r.NOME_PACIENTE || r.paciente || r.PACIENTE || '';
          const exameDescricao = r.ESTUDO_DESCRICAO || r.NOME_EXAME || r.exame || r.EXAME || '';
          const modalidade = r.MODALIDADE || r.modalidade || '';
          const especialidade = r.ESPECIALIDADE || r.especialidade || '';
          const dataLaudo = r.DATA_LAUDO || r.data_laudo;
          const dataExame = r.DATA_EXAME || r.data_exame || r.DATA_REALIZACAO;
          
          // Criar chave base usando assinatura do médico para matching inteligente
          const chaveBase = [
            canonical(pacienteNome),
            canonical(cleanExamName(exameDescricao)),
            toYMD(dataExame || ''),
            toYMD(dataLaudo || ''),
            criarAssinaturaMedico(r.MEDICO || r.medico || '')
          ].join('|');
          
          const valores = Number(r.VALORES || r.valores || 1);
          
          // Debug para casos específicos de médicos
          if ((r.NOME_PACIENTE === 'Zely Correa Prestes Nunes' && r.ESTUDO_DESCRICAO?.includes('TC CRANIO')) ||
              (r.MEDICO || r.medico || '').includes('Guilherme') ||
              (r.MEDICO || r.medico || '').includes('Efraim')) {
            console.log('🔍 DEBUG Sistema - Médico:', {
              chaveBase,
              medicoOriginal: r.MEDICO || r.medico || '',
              assinaturaMedico: criarAssinaturaMedico(r.MEDICO || r.medico || ''),
              prioridadeOriginal: r.PRIORIDADE || r.prioridade || '',
              prioridadeNormalizada: normalizePrioridade(r.PRIORIDADE || r.prioridade || ''),
              especialidade,
              categoria: (r as any).CATEGORIA,
              valores,
              dataOriginal: dataExame || dataLaudo,
              dataFormatada: toYMD(dataExame || dataLaudo)
            });
          }
          
          if (mapSistema.has(chaveBase)) {
            const existing = mapSistema.get(chaveBase)!;
            existing.total += valores;
            // Manter a primeira amostra ou atualizar se esta tem mais informações
            if (!existing.amostra?.CATEGORIA && (r as any).CATEGORIA) {
              existing.amostra = r;
            }
          } else {
            mapSistema.set(chaveBase, {
              total: valores,
              amostra: r
            });
          }
        });
        
        // Aguardar próximo frame para não travar a UI
        if (i + BATCH_SIZE < systemDataFiltered.length) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      console.log('🏥 Sistema processado - chaves únicas:', mapSistema.size);
      
      // Processar arquivo em batches
      type AggFile = { total: number; amostra?: UploadedExamRow };
      const mapArquivo = new Map<string, AggFile>();
      
      for (let i = 0; i < fileDataFiltered.length; i += BATCH_SIZE) {
        const batch = fileDataFiltered.slice(i, i + BATCH_SIZE);
        
        batch.forEach((r) => {
          const clienteNormalizado = normalizeCliente(r.cliente);
          const pacienteNome = (r as any).paciente || (r as any).nome_paciente || (r as any).NOME_PACIENTE;
          const exameDescricao = r.exame || (r as any).estudo_descricao || (r as any).ESTUDO_DESCRICAO;
          const dataExame = (r as any).data_exame || (r as any).data_realizacao || (r as any).DATA_REALIZACAO;
          const dataLaudo = (r as any).data_laudo || (r as any).DATA_LAUDO;
          
          // Usar a mesma assinatura do médico para matching inteligente
          const keyBase = [
            canonical(pacienteNome),
            canonical(cleanExamName(exameDescricao)),
            toYMD(dataExame || ''),
            toYMD(dataLaudo || ''),
            criarAssinaturaMedico((r as any).medico || (r as any).MEDICO || '')
          ].join('|');
          
          
          // Debug para casos específicos de médicos
          if ((pacienteNome === 'Zely Correa Prestes Nunes' && exameDescricao?.includes('TC CRANIO')) ||
              ((r as any).medico || (r as any).MEDICO || '').includes('Guilherme') ||
              ((r as any).medico || (r as any).MEDICO || '').includes('Efraim')) {
            console.log('🔍 DEBUG Arquivo - Médico:', {
              keyBase,
              medicoOriginal: (r as any).medico || (r as any).MEDICO || '',
              assinaturaMedico: criarAssinaturaMedico((r as any).medico || (r as any).MEDICO || ''),
              prioridadeOriginal: (r as any).prioridade || (r as any).PRIORIDADE || '',
              prioridadeNormalizada: normalizePrioridade((r as any).prioridade || (r as any).PRIORIDADE || ''),
              especialidade: r.especialidade,
              categoria: (r as any).categoria,
              quantidade: Number(r.quant || (r as any).quantidade || (r as any).valores || 1),
              dataOriginal: dataExame || dataLaudo,
              dataFormatada: toYMD(dataExame || dataLaudo)
            });
          }
          
          const cur = mapArquivo.get(keyBase) || { total: 0, amostra: r };
          cur.total += Number(r.quant || (r as any).quantidade || (r as any).valores || 1);
          // Manter a primeira amostra ou atualizar se esta tem mais informações
          if (!cur.amostra || !((cur.amostra as any).categoria) && (r as any).categoria) {
            cur.amostra = r;
          }
          mapArquivo.set(keyBase, cur);
        });
        
        // Aguardar próximo frame para não travar a UI
        if (i + BATCH_SIZE < fileDataFiltered.length) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      console.log('📁 Arquivo processado - chaves únicas:', mapArquivo.size);

      // OTIMIZAÇÃO: Construir divergências identificando tipos específicos
      const divergencias: LinhaDivergencia[] = [];
      const allKeys = new Set<string>([...mapArquivo.keys(), ...mapSistema.keys()]);

      // Função para identificar tipo de divergência entre registros
      const identificarTipoDivergencia = (sistema: any, arquivo: any): string => {
        const categoriaDiv = canonical(sistema.CATEGORIA || '') !== canonical((arquivo as any).categoria || '');
        const especialidadeDiv = canonical(sistema.ESPECIALIDADE || '') !== canonical(arquivo.especialidade || '');
        const modalidadeDiv = normalizeModalidade(sistema.MODALIDADE || '') !== normalizeModalidade(arquivo.modalidade || '');
        const prioridadeDiv = normalizePrioridade(sistema.PRIORIDADE || '') !== normalizePrioridade((arquivo as any).prioridade || '');
        
        const divergencias = [];
        if (categoriaDiv) divergencias.push('categoria');
        if (especialidadeDiv) divergencias.push('especialidade');
        if (modalidadeDiv) divergencias.push('modalidade');
        if (prioridadeDiv) divergencias.push('prioridade');
        
        return divergencias.length > 0 ? divergencias.join('+') : '';
      };

      const toLinhaFromArquivo = (key: string, a: AggFile, tipo: DivergenciaTipo = 'arquivo_nao_no_sistema'): LinhaDivergencia => {
        const r = a.amostra as any as UploadedExamRow;
        return {
          tipo,
          chave: key,
          EMPRESA: r.cliente || '-',
          NOME_PACIENTE: (r as any).paciente || '-',
          CODIGO_PACIENTE: String((r as any).codigoPaciente ?? '-'),
          ESTUDO_DESCRICAO: (r as any).exame || '-',
          ACCESSION_NUMBER: (r as any).accessionNumber || '-',
          MODALIDADE: r.modalidade || '-',
          PRIORIDADE: (r as any).prioridade || '-',
          VALORES: Number(a.total || 0),
          ESPECIALIDADE: r.especialidade || '-',
          MEDICO: (r as any).medico || '-',
          DUPLICADO: '-',
          DATA_REALIZACAO: formatDateBR((r as any).data_exame),
          HORA_REALIZACAO: '-',
          DATA_TRANSFERENCIA: '-',
          HORA_TRANSFERENCIA: '-',
          DATA_LAUDO: formatDateBR((r as any).data_laudo),
          HORA_LAUDO: '-',
          DATA_PRAZO: '-',
          HORA_PRAZO: '-',
          STATUS: '-',
          UNIDADE_ORIGEM: '-',
          CLIENTE: r.cliente || '-',
          total_arquivo: a.total,
          total_sistema: 0,
          categoria_arquivo: (r as any).categoria || undefined,
        };
      };
      
      const toLinhaFromSistema = (key: string, s: AggSys): LinhaDivergencia => {
        const r = s.amostra as any as VolumetriaRow;
        return {
          tipo: 'sistema_nao_no_arquivo',
          chave: key,
          EMPRESA: r.EMPRESA || '-',
          NOME_PACIENTE: r.NOME_PACIENTE || '-',
          CODIGO_PACIENTE: String(r.CODIGO_PACIENTE ?? '-'),
          ESTUDO_DESCRICAO: r.ESTUDO_DESCRICAO || '-',
          ACCESSION_NUMBER: r.ACCESSION_NUMBER || '-',
          MODALIDADE: r.MODALIDADE || '-',
          PRIORIDADE: r.PRIORIDADE || '-',
          VALORES: Number(s.total || 0),
          ESPECIALIDADE: r.ESPECIALIDADE || '-',
          MEDICO: r.MEDICO || '-',
          DUPLICADO: String(r.DUPLICADO ?? '-'),
          DATA_REALIZACAO: formatDateBR(r.DATA_REALIZACAO),
          HORA_REALIZACAO: r.HORA_REALIZACAO || '-',
          DATA_TRANSFERENCIA: formatDateBR(r.DATA_TRANSFERENCIA),
          HORA_TRANSFERENCIA: r.HORA_TRANSFERENCIA || '-',
          DATA_LAUDO: formatDateBR(r.DATA_LAUDO),
          HORA_LAUDO: r.HORA_LAUDO || '-',
          DATA_PRAZO: r.DATA_PRAZO || '-',
          HORA_PRAZO: r.HORA_PRAZO || '-',
          STATUS: r.STATUS || '-',
          UNIDADE_ORIGEM: (r as any).UNIDADE_ORIGEM || r.EMPRESA || '-',
          CLIENTE: r.EMPRESA || '-',
          total_arquivo: 0,
          total_sistema: s.total,
          categoria_sistema: (r as any).CATEGORIA || undefined,
        };
      };

      // OTIMIZAÇÃO: Processar divergências em batches para evitar travamento
      const allKeysArray = Array.from(allKeys);
      const DIVERGENCE_BATCH_SIZE = 500;
      
      console.log('🔍 Processando', allKeysArray.length, 'chaves para divergências');
      
      for (let i = 0; i < allKeysArray.length; i += DIVERGENCE_BATCH_SIZE) {
        const keyBatch = allKeysArray.slice(i, i + DIVERGENCE_BATCH_SIZE);
        
        keyBatch.forEach((k) => {
          const a = mapArquivo.get(k);
          const s = mapSistema.get(k);
          
          if (a && s) {
            // PRIMEIRO: Quando o exame existe em ambos, verificar diferenças específicas
            // Quando o exame existe em ambos, verificar diferenças específicas
            const arquivoData = a.amostra as any;
            const sistemaData = s.amostra as any;
            
            const catA = canonical(arquivoData.categoria || '');
            const catS = canonical(sistemaData.CATEGORIA || '');
            const espA = canonical(arquivoData.especialidade || '');
            const espS = canonical(sistemaData.ESPECIALIDADE || '');
            const modA = normalizeModalidade(arquivoData.modalidade || '');
            const modS = normalizeModalidade(sistemaData.MODALIDADE || '');
            const prioA = normalizePrioridade(arquivoData.prioridade || '');
            const prioS = normalizePrioridade(sistemaData.PRIORIDADE || '');
            
            // Identificar diferenças específicas
            const categoriaDiferente = catA && catS && catA !== catS;
            const especialidadeDiferente = espA && espS && espA !== espS;
            const modalidadeDiferente = modA && modS && modA !== modS;
            const prioridadeDiferente = prioA && prioS && prioA !== prioS;
            const quantidadeDiferente = a.total !== s.total;
            
            // Se há diferenças de campo, criar divergência específica
            if (categoriaDiferente || especialidadeDiferente || modalidadeDiferente || prioridadeDiferente) {
              const tiposDivergencia = [];
              if (categoriaDiferente) tiposDivergencia.push('categoria');
              if (especialidadeDiferente) tiposDivergencia.push('especialidade');
              if (modalidadeDiferente) tiposDivergencia.push('modalidade');
              if (prioridadeDiferente) tiposDivergencia.push('prioridade');
              
              let tipoDivergencia: DivergenciaTipo;
              const combinacao = tiposDivergencia.join('+');
              
              // Mapear combinações específicas solicitadas
              if (combinacao === 'categoria+especialidade+modalidade+prioridade') {
                tipoDivergencia = 'categoria+especialidade+modalidade+prioridade';
              } else if (combinacao.includes('categoria') && combinacao.includes('especialidade') && combinacao.includes('modalidade') && !combinacao.includes('prioridade')) {
                // Para categoria+especialidade+modalidade, vamos usar um tipo válido
                tipoDivergencia = 'categoria+especialidade';
              } else if (combinacao === 'categoria+especialidade') {
                tipoDivergencia = 'categoria+especialidade';
              } else if (tiposDivergencia.includes('categoria')) {
                tipoDivergencia = 'categoria';
              } else if (tiposDivergencia.includes('especialidade')) {
                tipoDivergencia = 'especialidade';
              } else if (tiposDivergencia.includes('modalidade')) {
                tipoDivergencia = 'modalidade';
              } else if (tiposDivergencia.includes('prioridade')) {
                tipoDivergencia = 'prioridade';
              } else {
                tipoDivergencia = 'quantidade_diferente';
              }
              
              const base = toLinhaFromArquivo(k, a, tipoDivergencia);
              base.total_sistema = s.total;
              
              // Preencher todas as colunas de divergência
              base.categoria_arquivo = catA;
              base.categoria_sistema = catS;
              base.especialidade_arquivo = espA;
              base.especialidade_sistema = espS;
              base.modalidade_arquivo = modA;
              base.modalidade_sistema = modS;
              base.prioridade_arquivo = prioA;
              base.prioridade_sistema = prioS;
              
              divergencias.push(base);
            } else if (quantidadeDiferente) {
              // Apenas diferença de quantidade
              const base = toLinhaFromArquivo(k, a, 'quantidade_diferente');
              base.total_sistema = s.total;
              base.categoria_arquivo = catA;
              base.categoria_sistema = catS;
              divergencias.push(base);
            }
          } else if (a && !s) {
            // Só no arquivo
            divergencias.push(toLinhaFromArquivo(k, a, 'arquivo_nao_no_sistema'));
          } else if (!a && s) {
            // Só no sistema
            divergencias.push(toLinhaFromSistema(k, s));
          }
        });
        
        // Aguardar próximo frame se não é o último batch
        if (i + DIVERGENCE_BATCH_SIZE < allKeysArray.length) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      // Gerar Excel com as divergências
      if (divergencias.length === 0) {
        alert('Nenhuma divergência encontrada para o período e cliente selecionados.');
        return;
      }

      // Preparar dados para Excel
      const dadosExcel = divergencias.map(linha => ({
        'Tipo Divergência': linha.tipo === 'arquivo_nao_no_sistema' ? 'Somente no Arquivo' :
                           linha.tipo === 'sistema_nao_no_arquivo' ? 'Somente no Sistema' :
                           linha.tipo === 'quantidade_diferente' ? 'Quantidade Diferente' :
                           linha.tipo,
        'Cliente': linha.EMPRESA,
        'Paciente': linha.NOME_PACIENTE,
        'Código Paciente': linha.CODIGO_PACIENTE,
        'Exame': linha.ESTUDO_DESCRICAO,
        'Accession Number': linha.ACCESSION_NUMBER,
        'Modalidade': linha.MODALIDADE,
        'Especialidade': linha.ESPECIALIDADE,
        'Prioridade': linha.PRIORIDADE,
        'Médico': linha.MEDICO,
        'Data Realização': formatDateBR(linha.DATA_REALIZACAO),
        'Data Laudo': formatDateBR(linha.DATA_LAUDO),
        'Status': linha.STATUS,
        'Valores Arquivo': linha.total_arquivo || 0,
        'Valores Sistema': linha.total_sistema || 0,
        'Categoria Arquivo': linha.categoria_arquivo || '-',
        'Categoria Sistema': linha.categoria_sistema || '-',
        'Especialidade Arquivo': linha.especialidade_arquivo || '-',
        'Especialidade Sistema': linha.especialidade_sistema || '-',
        'Modalidade Arquivo': linha.modalidade_arquivo || '-',
        'Modalidade Sistema': linha.modalidade_sistema || '-',
        'Prioridade Arquivo': linha.prioridade_arquivo || '-',
        'Prioridade Sistema': linha.prioridade_sistema || '-',
      }));

      // Criar planilha
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dadosExcel);
      
      // Ajustar largura das colunas
      const columnWidths = [
        { wch: 20 }, // Tipo Divergência
        { wch: 25 }, // Cliente
        { wch: 30 }, // Paciente
        { wch: 15 }, // Código Paciente
        { wch: 40 }, // Exame
        { wch: 15 }, // Accession Number
        { wch: 12 }, // Modalidade
        { wch: 20 }, // Especialidade
        { wch: 12 }, // Prioridade
        { wch: 30 }, // Médico
        { wch: 15 }, // Data Realização
        { wch: 15 }, // Data Laudo
        { wch: 12 }, // Status
        { wch: 12 }, // Valores Arquivo
        { wch: 12 }, // Valores Sistema
        { wch: 15 }, // Categoria Arquivo
        { wch: 15 }, // Categoria Sistema
      ];
      ws['!cols'] = columnWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Divergências');
      
      // Nome do arquivo
      const nomeArquivo = `divergencias_${referencia}_${cliente !== 'todos' ? cliente : 'todos'}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
      
      // Download
      XLSX.writeFile(wb, nomeArquivo);
      
      console.log(`✅ Excel gerado com ${divergencias.length} divergências`);
      
    } catch (e) {
      console.error('Erro ao gerar excel de divergências:', e);
      alert('Erro ao gerar relatório de divergências. Verifique o console para mais detalhes.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Divergências de Exames</span>
        </CardTitle>
        <CardDescription>
          Gerar relatório Excel com divergências entre arquivo enviado e dados do sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Período de Referência</label>
            <Select value={referencia} onValueChange={setReferencia}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025-06">Junho/2025</SelectItem>
                <SelectItem value="2025-05">Maio/2025</SelectItem>
                <SelectItem value="2025-04">Abril/2025</SelectItem>
                <SelectItem value="2025-03">Março/2025</SelectItem>
                <SelectItem value="2025-02">Fevereiro/2025</SelectItem>
                <SelectItem value="2025-01">Janeiro/2025</SelectItem>
                <SelectItem value="2024-12">Dezembro/2024</SelectItem>
                <SelectItem value="2024-11">Novembro/2024</SelectItem>
                <SelectItem value="2024-10">Outubro/2024</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Cliente</label>
            <Select value={cliente} onValueChange={setCliente}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Clientes</SelectItem>
                {clienteOptions.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <Button 
            onClick={gerarExcelDivergencias}
            disabled={exporting || !uploadedExams || uploadedExams.length === 0}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Gerando Excel...' : 'Gerar Relatório Excel'}
          </Button>
        </div>

        {!uploadedExams || uploadedExams.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Faça upload de um arquivo na aba "Por Exame" para gerar o relatório de divergências.</p>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            <p>✅ Arquivo carregado com {uploadedExams.length} registros</p>
            <p>📊 Clique em "Gerar Relatório Excel" para processar e baixar as divergências</p>
            <p>⚠️ O processamento pode levar alguns minutos dependendo do volume de dados</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
