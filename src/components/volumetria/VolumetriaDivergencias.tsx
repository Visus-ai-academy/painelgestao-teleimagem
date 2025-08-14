import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useVolumetria } from "@/contexts/VolumetriaContext";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";
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

interface SistemaRow {
  cliente_id?: string;
  cliente?: string;
  modalidade?: string;
  especialidade?: string;
  categoria?: string;
  prioridade?: string;
  nome_exame?: string;
  paciente_nome?: string;
  quantidade?: number;
  data_exame?: string;
  medico_id?: string;
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
  const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
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
  const [loading, setLoading] = useState(false);
  const [linhas, setLinhas] = useState<LinhaDivergencia[]>([]);

  // Filtros básicos para evitar sobrecarga
  // Inicializar com o último período disponível, não o atual
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

  const carregar = async () => {
    try {
      setLoading(true);
      
      // Converter de formato "2025-06" para "jun/25" para consultar o banco
      const [ano, mes] = referencia.split('-');
      const mesesAbrev = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
      const mesAbrev = mesesAbrev[parseInt(mes) - 1];
      const anoAbrev = ano.slice(2);
      const periodoReferenciaBanco = `${mesAbrev}/${anoAbrev}`;
      
      console.log('🔍 Buscando dados para período:', {
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
      
      // Limitar a 10.000 registros para evitar timeout
      const { data: systemRows, error: sysErr } = await sysQuery
        .order('created_at', { ascending: false })
        .limit(10000);
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
        if (!val) return true; // caso não tenha data no arquivo, não filtra
        const s = String(val);
        // formatos: yyyy-mm-dd ou dd/mm/yyyy
        let ym = '';
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) ym = s.slice(0,7);
        else {
          const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
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
        // 1) Igual sem data
        for (const ks of mapSistema.keys()) {
          const [cliS, modS, espS, exameS, pacS] = splitKey(ks);
          if (cli===cliS && mod===modS && esp===espS && exame===exameS && pac===pacS) return {ks, motivo:'data_diferente'};
        }
        // 2) Igual sem especialidade
        for (const ks of mapSistema.keys()) {
          const [cliS, modS, _espS, exameS, pacS, dataS] = splitKey(ks);
          if (cli===cliS && mod===modS && exame===exameS && pac===pacS && data===dataS) return {ks, motivo:'especialidade_diferente'};
        }
        // 3) Igual sem exame (títulos variantes)
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
          MODALIDADE: r.MODALIDADE || '-'
          ,PRIORIDADE: r.PRIORIDADE || '-',
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
          } else {
            console.warn('[Divergência: Só no Arquivo] sem correspondência próxima', { arquivo: a.amostra });
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

      setLinhas(divergencias);
    } catch (e) {
      console.error('Erro ao carregar divergências:', e);
      setLinhas([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente, referencia, Object.keys(clientesMap).length, uploadedExams]);

  const counts = useMemo(() => ({
    arquivo: linhas.filter(l => l.tipo === 'arquivo_nao_no_sistema').length,
    sistema: linhas.filter(l => l.tipo === 'sistema_nao_no_arquivo').length,
    qtd: linhas.filter(l => l.tipo === 'quantidade_diferente').length,
    cat: linhas.filter(l => l.tipo === 'categoria_diferente').length,
  }), [linhas]);

  const [only, setOnly] = useState<'todos'|'arquivo'|'sistema'|'qtd'|'cat'>('todos');
  const linhasFiltradas = useMemo(() => {
    return linhas.filter((l) => {
      if (only === 'todos') return true;
      if (only === 'arquivo') return l.tipo === 'arquivo_nao_no_sistema';
      if (only === 'sistema') return l.tipo === 'sistema_nao_no_arquivo';
      if (only === 'qtd') return l.tipo === 'quantidade_diferente';
      if (only === 'cat') return l.tipo === 'categoria_diferente';
      return true;
    });
  }, [linhas, only]);

  // Função para exportar divergências para Excel
  const handleExportExcel = () => {
    if (linhasFiltradas.length === 0) return;
    
    const exportData = linhasFiltradas.map(linha => ({
      'Tipo': linha.tipo === 'arquivo_nao_no_sistema' ? 'Só no Arquivo' :
              linha.tipo === 'sistema_nao_no_arquivo' ? 'Só no Sistema' :
              linha.tipo === 'quantidade_diferente' ? 'Quantidade diferente' :
              linha.tipo === 'categoria_diferente' ? 'Categoria diferente' : linha.tipo,
      'Empresa': linha.EMPRESA,
      'Unidade Origem': linha.UNIDADE_ORIGEM,
      'Cliente': linha.CLIENTE,
      'Nome Paciente': linha.NOME_PACIENTE,
      'Código Paciente': linha.CODIGO_PACIENTE,
      'Estudo Descrição': linha.ESTUDO_DESCRICAO,
      'Accession Number': linha.ACCESSION_NUMBER,
      'Modalidade': linha.MODALIDADE,
      'Prioridade': linha.PRIORIDADE,
      'Valores': linha.VALORES,
      'Especialidade': linha.ESPECIALIDADE,
      'Médico': linha.MEDICO,
      'Duplicado': linha.DUPLICADO,
      'Data Realização': linha.DATA_REALIZACAO,
      'Hora Realização': linha.HORA_REALIZACAO,
      'Data Transferência': linha.DATA_TRANSFERENCIA,
      'Hora Transferência': linha.HORA_TRANSFERENCIA,
      'Data Laudo': linha.DATA_LAUDO,
      'Hora Laudo': linha.HORA_LAUDO,
      'Data Prazo': linha.DATA_PRAZO,
      'Hora Prazo': linha.HORA_PRAZO,
      'Status': linha.STATUS,
      'Total Arquivo': linha.total_arquivo ?? 0,
      'Total Sistema': linha.total_sistema ?? 0,
      'Categoria Arquivo': linha.categoria_arquivo || '',
      'Categoria Sistema': linha.categoria_sistema || ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Ajustar largura das colunas
    const colWidths = exportData[0] ? Object.keys(exportData[0]).map(key => ({
      wch: Math.max(key.length, 12)
    })) : [];
    ws['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, ws, 'Divergencias_Exames');
    
    const fileName = `divergencias_exames_${referencia}_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Divergências de Exames (Sistema x Arquivo)</CardTitle>
        <CardDescription>
          Liste exames com: faltando no sistema, faltando no arquivo, quantidade diferente e categoria diferente. Período atual por padrão.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3 mb-4 items-end">
          <div className="w-64">
            <label className="text-xs text-muted-foreground">Cliente</label>
            <Select value={cliente} onValueChange={setCliente}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {clienteOptions.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Mês de referência</label>
            <Input type="month" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
          </div>

          <Button onClick={carregar} disabled={loading}>{loading ? 'Carregando...' : 'Atualizar'}</Button>
          
          <Button 
            variant="outline" 
            onClick={handleExportExcel} 
            disabled={linhasFiltradas.length === 0}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Exportar Excel ({linhasFiltradas.length})
          </Button>
          
          <div className="flex gap-2 text-sm">
            <Badge variant="secondary">Arquivo≠Sistema: {counts.qtd}</Badge>
            <Badge variant="outline">Categoria≠: {counts.cat}</Badge>
            <Badge variant="outline">Só no Arquivo: {counts.arquivo}</Badge>
            <Badge variant="outline">Só no Sistema: {counts.sistema}</Badge>
          </div>

          <div className="ml-auto flex gap-2">
            <Button variant={only==='todos'? 'default':'outline'} size="sm" onClick={() => setOnly('todos')}>Todos</Button>
            <Button variant={only==='arquivo'? 'default':'outline'} size="sm" onClick={() => setOnly('arquivo')}>Só no Arquivo</Button>
            <Button variant={only==='sistema'? 'default':'outline'} size="sm" onClick={() => setOnly('sistema')}>Só no Sistema</Button>
            <Button variant={only==='qtd'? 'default':'outline'} size="sm" onClick={() => setOnly('qtd')}>Qtd diferente</Button>
            <Button variant={only==='cat'? 'default':'outline'} size="sm" onClick={() => setOnly('cat')}>Categoria diferente</Button>
          </div>
        </div>

        <div className="max-h-[65vh] overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>EMPRESA</TableHead>
                <TableHead>UNIDADE ORIGEM</TableHead>
                <TableHead>CLIENTE</TableHead>
                <TableHead>NOME_PACIENTE</TableHead>
                <TableHead>CODIGO_PACIENTE</TableHead>
                <TableHead>ESTUDO_DESCRICAO</TableHead>
                <TableHead>ACCESSION_NUMBER</TableHead>
                <TableHead>MODALIDADE</TableHead>
                <TableHead>PRIORIDADE</TableHead>
                <TableHead>VALORES</TableHead>
                <TableHead>ESPECIALIDADE</TableHead>
                <TableHead>MEDICO</TableHead>
                <TableHead>DUPLICADO</TableHead>
                <TableHead>DATA_REALIZACAO</TableHead>
                <TableHead>HORA_REALIZACAO</TableHead>
                <TableHead>DATA_TRANSFERENCIA</TableHead>
                <TableHead>HORA_TRANSFERENCIA</TableHead>
                <TableHead>DATA_LAUDO</TableHead>
                <TableHead>HORA_LAUDO</TableHead>
                <TableHead>DATA_PRAZO</TableHead>
                <TableHead>HORA_PRAZO</TableHead>
                <TableHead>STATUS</TableHead>
                <TableHead className="text-right">Tot. Arquivo</TableHead>
                <TableHead className="text-right">Tot. Sistema</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhasFiltradas.map((l, idx) => (
                <TableRow key={`${l.chave}-${idx}`}>
                  <TableCell>
                    <Badge variant={l.tipo==='quantidade_diferente' || l.tipo==='categoria_diferente' ? 'default' : 'outline'}>
                      {l.tipo === 'arquivo_nao_no_sistema' && 'Só no Arquivo'}
                      {l.tipo === 'sistema_nao_no_arquivo' && 'Só no Sistema'}
                      {l.tipo === 'quantidade_diferente' && 'Qtd diferente'}
                      {l.tipo === 'categoria_diferente' && 'Categoria diferente'}
                    </Badge>
                  </TableCell>
                  <TableCell>{l.EMPRESA}</TableCell>
                  <TableCell>{l.UNIDADE_ORIGEM}</TableCell>
                  <TableCell>{l.CLIENTE}</TableCell>
                  <TableCell>{l.NOME_PACIENTE}</TableCell>
                  <TableCell>{l.CODIGO_PACIENTE}</TableCell>
                  <TableCell>{l.ESTUDO_DESCRICAO}</TableCell>
                  <TableCell>{l.ACCESSION_NUMBER}</TableCell>
                  <TableCell>{l.MODALIDADE}</TableCell>
                  <TableCell>{l.PRIORIDADE}</TableCell>
                  <TableCell>{l.VALORES}</TableCell>
                  <TableCell>{l.ESPECIALIDADE}</TableCell>
                  <TableCell>{l.MEDICO}</TableCell>
                  <TableCell>{l.DUPLICADO}</TableCell>
                  <TableCell>{formatDateBR(l.DATA_REALIZACAO)}</TableCell>
                  <TableCell>{l.HORA_REALIZACAO}</TableCell>
                  <TableCell>{formatDateBR(l.DATA_TRANSFERENCIA)}</TableCell>
                  <TableCell>{l.HORA_TRANSFERENCIA}</TableCell>
                  <TableCell>{formatDateBR(l.DATA_LAUDO)}</TableCell>
                  <TableCell>{l.HORA_LAUDO}</TableCell>
                  <TableCell>{formatDateBR(l.DATA_PRAZO)}</TableCell>
                  <TableCell>{l.HORA_PRAZO}</TableCell>
                  <TableCell>{l.STATUS}</TableCell>
                  <TableCell className="text-right">{(l.total_arquivo ?? 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{(l.total_sistema ?? 0).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {linhasFiltradas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={26} className="text-center text-muted-foreground">Sem divergências para os filtros selecionados.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
