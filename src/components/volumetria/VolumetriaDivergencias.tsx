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

export default function VolumetriaDivergencias({ uploadedExams }: { uploadedExams?: UploadedExamRow[] }) {
  const { data: ctx } = useVolumetria();
  const [clientesMap, setClientesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [linhas, setLinhas] = useState<LinhaDivergencia[]>([]);

  // Filtros básicos para evitar sobrecarga
  const today = new Date();
  const defaultRef = format(today, 'yyyy-MM');
  const [referencia, setReferencia] = useState<string>(defaultRef);
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

  // Ajuste inicial: usar o último período disponível da fonte (se existir)
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('volumetria_mobilemed')
          .select('periodo_referencia')
          .not('periodo_referencia', 'is', null)
          .order('periodo_referencia', { ascending: false })
          .limit(1);
        const ref = data?.[0]?.periodo_referencia as string | undefined;
        if (ref && ref !== referencia) setReferencia(ref);
      } catch {}
    })();
  }, []);

  const clienteOptions = useMemo(() => ctx.clientes || [], [ctx.clientes]);

  const carregar = async () => {
    try {
      setLoading(true);
      // Calcular início e fim do mês de referência selecionado
      const refDate = new Date(referencia + "-01");
      const start = format(startOfMonth(refDate), 'yyyy-MM-dd');
      const end = format(endOfMonth(refDate), 'yyyy-MM-dd');
      // 1) Ler dados do SISTEMA (volumetria processada no banco) por período/cliente
      let sysQuery = supabase.from('volumetria_mobilemed').select('*');
      sysQuery = sysQuery.eq('periodo_referencia', referencia);
      if (cliente !== 'todos') sysQuery = sysQuery.eq('EMPRESA', cliente);
      const { data: systemRows, error: sysErr } = await sysQuery.limit(5000);
      if (sysErr) throw sysErr;

      // Mapear por chave agregada
      type AggSys = { total: number; amostra?: VolumetriaRow };
      const mapSistema = new Map<string, AggSys>();
      (systemRows || []).forEach((r: any) => {
        const key = [
          normalizeCliente(r.EMPRESA),
          normalizeModalidade(r.MODALIDADE),
          canonical(r.ESPECIALIDADE),
          canonical(cleanExamName(r.ESTUDO_DESCRICAO))
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
          canonical(cleanExamName(r.exame))
        ].join('|');
        const cur = mapArquivo.get(key) || { total: 0, amostra: r };
        cur.total += Number(r.quant || 0);
        if (!cur.amostra) cur.amostra = r;
        mapArquivo.set(key, cur);
      });

      // Construir divergências
      const allKeys = new Set<string>([...mapArquivo.keys(), ...mapSistema.keys()]);
      const divergencias: LinhaDivergencia[] = [];

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
                  <TableCell>{l.DATA_REALIZACAO}</TableCell>
                  <TableCell>{l.HORA_REALIZACAO}</TableCell>
                  <TableCell>{l.DATA_TRANSFERENCIA}</TableCell>
                  <TableCell>{l.HORA_TRANSFERENCIA}</TableCell>
                  <TableCell>{l.DATA_LAUDO}</TableCell>
                  <TableCell>{l.HORA_LAUDO}</TableCell>
                  <TableCell>{l.DATA_PRAZO}</TableCell>
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
