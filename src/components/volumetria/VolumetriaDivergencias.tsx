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

function formatDateBR(val?: string) {
  if (!val) return '-';
  const s = String(val).trim();
  if (!s) return '-';
  // ISO or yyyy-mm-dd
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  // dd/mm/yyyy keep
  const br = s.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{2,4})$/);
  if (br) return `${br[1].padStart(2,'0')}/${br[2].padStart(2,'0')}/${br[3].length===2?`20${br[3]}`:br[3]}`;
  // try Date parse fallback
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yy = String(d.getFullYear());
    return `${dd}/${mm}/${yy}`;
  }
  return s;
}

function toYMD(val?: any) {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
  if (!s) return '';
  // ISO yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // dd/mm/yyyy or dd-mm-yyyy
  const br = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (br) return `${br[3].length===2?`20${br[3]}`:br[3]}-${br[2].padStart(2,'0')}-${br[1].padStart(2,'0')}`;
  // Excel serial number (approx range)
  const num = Number(s);
  if (!isNaN(num) && num > 25000 && num < 60000) {
    const base = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(base.getTime() + Math.round(num) * 86400000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2,'0');
    const day = String(d.getUTCDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
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
    try {
      setExporting(true);
      
      // Converter de formato "2025-06" para "jun/25" para consultar o banco
      const [ano, mes] = referencia.split('-');
      const mesesAbrev = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
      const mesAbrev = mesesAbrev[parseInt(mes) - 1];
      const anoAbrev = ano.slice(2);
      const periodoReferenciaBanco = `${mesAbrev}/${anoAbrev}`;
      
      console.log('🔍 Processando divergências para período:', {
        referenciaSelecionada: referencia,
        periodoReferenciaBanco,
        cliente: cliente !== 'todos' ? cliente : 'todos'
      });
      
      // 1) Ler dados do SISTEMA (volumetria processada no banco) por período/cliente
      let sysQuery = supabase.from('volumetria_mobilemed').select(`
        "EMPRESA", "MODALIDADE", "ESPECIALIDADE", "ESTUDO_DESCRICAO", 
        "NOME_PACIENTE", "DATA_REALIZACAO", "DATA_LAUDO", "VALORES",
        "PRIORIDADE", "MEDICO", "DUPLICADO", "CODIGO_PACIENTE",
        "ACCESSION_NUMBER", "HORA_REALIZACAO", "DATA_TRANSFERENCIA",
        "HORA_TRANSFERENCIA", "HORA_LAUDO", "DATA_PRAZO", "HORA_PRAZO",
        "STATUS", "CATEGORIA"
      `);
      
      sysQuery = sysQuery.eq('periodo_referencia', periodoReferenciaBanco);
      if (cliente !== 'todos') sysQuery = sysQuery.eq('EMPRESA', cliente);
      
      // Sem limite para processar todos os dados para o Excel
      const { data: systemRows, error: sysErr } = await sysQuery.order('created_at', { ascending: false });
      if (sysErr) throw sysErr;

      // Mapear por chave agregada
      type AggSys = { total: number; amostra?: VolumetriaRow };
      const mapSistema = new Map<string, AggSys>();
      (systemRows || []).forEach((r: any) => {
        const key = [
          normalizeCliente(r.EMPRESA),
          normalizeModalidade(r.MODALIDADE),
          canonical(r.ESPECIALIDADE),
          canonical(cleanExamName(r.ESTUDO_DESCRICAO)),
          canonical(r.NOME_PACIENTE),
          toYMD(r.DATA_REALIZACAO || r.DATA_LAUDO)
        ].join('|');
        const cur = mapSistema.get(key) || { total: 0, amostra: r };
        cur.total += Number(r.VALORES || 0);
        if (!cur.amostra) cur.amostra = r;
        mapSistema.set(key, cur);
      });

      // 2) Ler dados do ARQUIVO (enviado na tela)
      type AggFile = { total: number; amostra?: UploadedExamRow };
      const mapArquivo = new Map<string, AggFile>();
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
      (uploadedExams || []).forEach((r) => {
        if (cliente !== 'todos' && normalizeCliente(r.cliente) !== normalizeCliente(cliente)) return;
        if (!inMonth((r as any).data_exame || (r as any).data_laudo)) return;
        const key = [
          normalizeCliente(r.cliente),
          normalizeModalidade(r.modalidade),
          canonical(r.especialidade),
          canonical(cleanExamName(r.exame)),
          canonical((r as any).paciente),
          toYMD((r as any).data_exame || (r as any).data_laudo)
        ].join('|');
        const cur = mapArquivo.get(key) || { total: 0, amostra: r };
        cur.total += Number(r.quant || 0);
        if (!cur.amostra) cur.amostra = r;
        mapArquivo.set(key, cur);
      });

      // Construir divergências
      const allKeys = new Set<string>([...mapArquivo.keys(), ...mapSistema.keys()]);
      const divergencias: LinhaDivergencia[] = [];

      const splitKey = (k: string) => k.split('|');
      const findSistemaCandidato = (k: string) => {
        const [cli, mod, esp, exame, pac, data] = splitKey(k);
        for (const ks of mapSistema.keys()) {
          const [cliS, modS, espS, exameS, pacS] = splitKey(ks);
          if (cli===cliS && mod===modS && esp===espS && exame===exameS && pac===pacS) return {ks, motivo:'data_diferente'};
        }
        for (const ks of mapSistema.keys()) {
          const [cliS, modS, _espS, exameS, pacS, dataS] = splitKey(ks);
          if (cli===cliS && mod===modS && exame===exameS && pac===pacS && data===dataS) return {ks, motivo:'especialidade_diferente'};
        }
        for (const ks of mapSistema.keys()) {
          const [cliS, modS, espS, _exameS, pacS, dataS] = splitKey(ks);
          if (cli===cliS && mod===modS && esp===espS && pac===pacS && data===dataS) return {ks, motivo:'descricao_exame_variavel'};
        }
        return null;
      };

      const toLinhaFromArquivo = (key: string, a: AggFile): LinhaDivergencia => {
        const r = a.amostra as any as UploadedExamRow;
        return {
          tipo: 'arquivo_nao_no_sistema',
          chave: key,
          EMPRESA: r.cliente || '-',
          NOME_PACIENTE: (r as any).paciente || '-',
          CODIGO_PACIENTE: String((r as any).codigoPaciente ?? '-') ,
          ESTUDO_DESCRICAO: (r as any).exame || '-',
          ACCESSION_NUMBER: (r as any).accessionNumber || '-',
          MODALIDADE: r.modalidade || '-',
          PRIORIDADE: (r as any).prioridade || '-',
          VALORES: Number(a.total || 0),
          ESPECIALIDADE: r.especialidade || '-',
          MEDICO: (r as any).medico || '-',
          DUPLICADO: '-',
          DATA_REALIZACAO: ((r as any).data_exame || '-') as string,
          HORA_REALIZACAO: '-',
          DATA_TRANSFERENCIA: '-',
          HORA_TRANSFERENCIA: '-',
          DATA_LAUDO: ((r as any).data_laudo || '-') as string,
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
          CODIGO_PACIENTE: String(r.CODIGO_PACIENTE ?? '-') ,
          ESTUDO_DESCRICAO: r.ESTUDO_DESCRICAO || '-',
          ACCESSION_NUMBER: r.ACCESSION_NUMBER || '-',
          MODALIDADE: r.MODALIDADE || '-',
          PRIORIDADE: r.PRIORIDADE || '-',
          VALORES: Number(s.total || 0),
          ESPECIALIDADE: r.ESPECIALIDADE || '-',
          MEDICO: r.MEDICO || '-',
          DUPLICADO: String(r.DUPLICADO ?? '-') ,
          DATA_REALIZACAO: r.DATA_REALIZACAO || '-',
          HORA_REALIZACAO: r.HORA_REALIZACAO || '-',
          DATA_TRANSFERENCIA: r.DATA_TRANSFERENCIA || '-',
          HORA_TRANSFERENCIA: r.HORA_TRANSFERENCIA || '-',
          DATA_LAUDO: r.DATA_LAUDO || '-',
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

      allKeys.forEach((k) => {
        const a = mapArquivo.get(k);
        const s = mapSistema.get(k);
        if (a && !s) {
          const cand = findSistemaCandidato(k);
          if (cand) {
            console.warn('[Divergência: Só no Arquivo] possível causa:', cand.motivo, { arquivo: a.amostra, sistema_exemplo: mapSistema.get(cand.ks)?.amostra });
          }
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
