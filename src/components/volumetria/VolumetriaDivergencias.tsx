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

type DivergenciaTipo = 'arquivo_nao_no_sistema' | 'sistema_nao_no_arquivo' | 'quantidade_diferente' | 'categoria_diferente';

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
  // extras
  total_arquivo?: number;
  total_sistema?: number;
  categoria_arquivo?: string;
  categoria_sistema?: string;
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
          
          const chave = [
            canonical(pacienteNome),
            canonical(cleanExamName(exameDescricao)),
            toYMD(dataExame || ''),
            toYMD(dataLaudo || ''),
            canonical(r.MEDICO || r.medico || ''),
            normalizeModalidade(modalidade),
            canonical(especialidade),
            normalizePrioridade(r.PRIORIDADE || r.prioridade || '')
          ].join('|');
          
          const valores = Number(r.VALORES || r.valores || 1);
          
          if (r.NOME_PACIENTE === 'Daniel Soares' && r.ESTUDO_DESCRICAO?.includes('TC COLUNA CERVICAL')) {
            console.log('🔍 DEBUG Sistema - Daniel Soares TC COLUNA CERVICAL:', {
              chave,
              valores,
              dataOriginal: dataExame || dataLaudo,
              dataFormatada: toYMD(dataExame || dataLaudo)
            });
          }
          
          if (mapSistema.has(chave)) {
            mapSistema.get(chave)!.total += valores;
          } else {
            mapSistema.set(chave, {
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
          
          const key = [
            canonical(pacienteNome),
            canonical(cleanExamName(exameDescricao)),
            toYMD(dataExame || ''),
            toYMD(dataLaudo || ''),
            canonical((r as any).medico || (r as any).MEDICO || ''),
            normalizeModalidade(r.modalidade),
            canonical(r.especialidade),
            normalizePrioridade((r as any).prioridade || (r as any).PRIORIDADE || '')
          ].join('|');
          
          if (pacienteNome === 'Daniel Soares' && exameDescricao?.includes('TC COLUNA CERVICAL')) {
            console.log('🔍 DEBUG Arquivo - Daniel Soares TC COLUNA CERVICAL:', {
              key,
              quantidade: Number(r.quant || (r as any).quantidade || (r as any).valores || 1),
              dataOriginal: dataExame || dataLaudo,
              dataFormatada: toYMD(dataExame || dataLaudo)
            });
          }
          
          const cur = mapArquivo.get(key) || { total: 0, amostra: r };
          cur.total += Number(r.quant || (r as any).quantidade || (r as any).valores || 1);
          if (!cur.amostra) cur.amostra = r;
          mapArquivo.set(key, cur);
        });
        
        // Aguardar próximo frame para não travar a UI
        if (i + BATCH_SIZE < fileDataFiltered.length) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      console.log('📁 Arquivo processado - chaves únicas:', mapArquivo.size);

      // OTIMIZAÇÃO: Construir divergências de forma mais eficiente
      const divergencias: LinhaDivergencia[] = [];
      const allKeys = new Set<string>([...mapArquivo.keys(), ...mapSistema.keys()]);

      const toLinhaFromArquivo = (key: string, a: AggFile): LinhaDivergencia => {
        const r = a.amostra as any as UploadedExamRow;
        return {
          tipo: 'arquivo_nao_no_sistema',
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
          
          if (a && !s) {
            divergencias.push(toLinhaFromArquivo(k, a));
          } else if (!a && s) {
            divergencias.push(toLinhaFromSistema(k, s));
          } else if (a && s) {
            const catA = canonical(((a.amostra as any) || {}).categoria || '');
            const catS = canonical(((s.amostra as any) || {}).CATEGORIA || '');
            if (catA && catS && catA !== catS) {
              const base = toLinhaFromArquivo(k, a);
              base.tipo = 'categoria_diferente';
              base.total_sistema = s.total;
              base.categoria_arquivo = (a.amostra as any).categoria || '';
              base.categoria_sistema = (s.amostra as any).CATEGORIA || '';
              divergencias.push(base);
            } else if (a.total !== s.total) {
              const base = toLinhaFromArquivo(k, a);
              base.tipo = 'quantidade_diferente';
              base.total_sistema = s.total;
              divergencias.push(base);
            }
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
                           linha.tipo === 'categoria_diferente' ? 'Categoria Diferente' : linha.tipo,
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
