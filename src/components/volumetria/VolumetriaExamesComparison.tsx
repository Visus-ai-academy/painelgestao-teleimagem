import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useVolumetria } from "@/contexts/VolumetriaContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";

export type UploadedExamRow = {
  cliente: string;
  modalidade?: string;
  especialidade?: string;
  categoria?: string;
  prioridade?: string;
  data_exame?: any;
  data_laudo?: any;
  medico?: string;
  paciente?: string;
  quant?: number;
  exame?: string;
};

export default function VolumetriaExamesComparison({ uploadedExams }: { uploadedExams?: UploadedExamRow[] }) {
  const { data: context } = useVolumetria();

  const toDisplayDate = (val: any): string => {
    if (val === null || val === undefined) return '—';
    const tryNumber = Number(val);
    if (!Number.isNaN(tryNumber) && String(val).trim() !== '') {
      const epoch = Date.UTC(1899, 11, 30);
      const d = new Date(epoch + Math.round(tryNumber) * 86400000);
      return d.toISOString().slice(0, 10);
    }
    const s = String(val).trim();
    if (!s) return '—';
    // dd/mm/yyyy
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      const dd = m[1].padStart(2, '0');
      const mm = m[2].padStart(2, '0');
      const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3];
      return `${yyyy}-${mm}-${dd}`;
    }
    // yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return s;
  };

  type SystemExamRow = UploadedExamRow & { fonte: 'Sistema' };
  type FileExamRow = UploadedExamRow & { fonte: 'Arquivo' };

  const sistemaRows = useMemo<SystemExamRow[]>(() => {
    const det = (context as any)?.detailedData || [];
    return (det as any[]).map((item) => {
      const cliente = String(item.EMPRESA || item.CLIENTE || '').trim();
      const modalidade = String(item.MODALIDADE || '').trim();
      const especialidade = String(item.ESPECIALIDADE || '').trim();
      const categoria = String(item.CATEGORIA || '').trim();
      const prioridade = String(item.PRIORIDADE || '').trim();
      const data_exame = item.DATA_REALIZACAO || item.DATA_EXAME || item.DATA || '';
      const data_laudo = item.DATA_LAUDO || item.DATA_LAUDO_EXAME || '';
      const medico = String(item.MEDICO || '').trim();
      const paciente = String(item.PACIENTE || item.NOME_PACIENTE || item.NOME_PAC || item.PACIENTE_NOME || '').trim();
      const exame = String(item.ESTUDO_DESCRICAO || item.NOME_EXAME || item.EXAME || item.ESTUDO || item.nome_exame || item.Nome_Est || item.nome_est || '').trim();
      const quant = Number(item.VALORES ?? item.VALOR ?? item.QUANTIDADE ?? item.QTD ?? item.QTDE ?? 1) || 1;
      return { fonte: 'Sistema', cliente, modalidade, especialidade, categoria, prioridade, data_exame, data_laudo, medico, paciente, quant, exame } as SystemExamRow;
    }).filter(r => r.cliente);
  }, [context]);

  const arquivoRows = useMemo<FileExamRow[]>(() => {
    return (uploadedExams || []).map((r) => ({ ...r, fonte: 'Arquivo' }));
  }, [uploadedExams]);

  const allRows = useMemo(() => {
    // Intercalar por fonte pode ajudar a comparar visualmente; aqui apenas concatenamos
    return [...sistemaRows, ...arquivoRows];
  }, [sistemaRows, arquivoRows]);

  // Filtros
  const [clienteFilter, setClienteFilter] = useState<string>('todos');
  const [modalidadeFilter, setModalidadeFilter] = useState<string>('todos');
  const stripAccents = (s: string) => s?.toString().normalize('NFD').replace(/\p{Diacritic}/gu, '') || '';
  const canonical = (s?: string) => {
    const raw = (s || '').toString().trim();
    if (!raw) return '';
    const noAcc = stripAccents(raw);
    const cleaned = noAcc.replace(/[^a-zA-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
    return cleaned;
  };
  const normStr = (s?: string) => canonical(s);
  const normModal = (m?: string) => {
    const u = canonical(m);
    if (u === 'CT') return 'TC';
    if (u === 'MR') return 'RM';
    return u;
  };
  const clienteOptions = useMemo(() => Array.from(new Set([...sistemaRows.map(r => r.cliente), ...arquivoRows.map(r => r.cliente)])).filter(Boolean).sort(), [sistemaRows, arquivoRows]);
  const modalidadeOptions = useMemo(() => Array.from(new Set([...sistemaRows.map(r => normModal(r.modalidade)), ...arquivoRows.map(r => normModal(r.modalidade))])).filter(Boolean).sort(), [sistemaRows, arquivoRows]);
  const matchesFilters = useMemo(() => {
    const c = normStr(clienteFilter);
    const m = normModal(modalidadeFilter);
    return (r: UploadedExamRow) => {
      const okCliente = clienteFilter === 'todos' || normStr(r.cliente) === c;
      const okModalidade = modalidadeFilter === 'todos' || normModal(r.modalidade) === m;
      return okCliente && okModalidade;
    };
  }, [clienteFilter, modalidadeFilter]);
  const filteredRows = useMemo(() => allRows.filter(r => matchesFilters(r)), [allRows, matchesFilters]);
  // Paginação simples para performance
  const pageSize = 100;
  const [page, setPage] = React.useState(1);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageRows = useMemo(() => filteredRows.slice((page - 1) * pageSize, page * pageSize), [filteredRows, page]);

  // Divergências agregadas por combinação de dimensões (ignora datas e médico para comparação mais justa)
  const normalize = (s?: string) => canonical(s);
  const normalizeModalidade = (m?: string) => {
    const u = canonical(m);
    if (u === 'CT') return 'TC';
    if (u === 'MR') return 'RM';
    return u;
  };
  type AggKey = string;
  type AggDims = {
    cliente: string;
    modalidade?: string;
    especialidade?: string;
    categoria?: string;
    prioridade?: string;
    exame?: string;
  };
  const makeKey = (r: UploadedExamRow): { key: AggKey; dims: AggDims } => {
    const modalFix = normalizeModalidade(r.modalidade);
    const key = [
      normalize(r.cliente),
      normalize(modalFix),
      normalize(r.especialidade || ''),
      normalize(r.categoria || ''),
      normalize(r.prioridade || ''),
      normalize(r.exame || '')
    ].join('|');
    return {
      key,
      dims: {
          cliente: canonical(r.cliente),
          modalidade: normalizeModalidade(r.modalidade),
          especialidade: canonical(r.especialidade),
          categoria: canonical(r.categoria),
          prioridade: canonical(r.prioridade),
          exame: canonical(r.exame),
      }
    };
  };
  const groupSum = (rows: UploadedExamRow[]) => {
    const map = new Map<AggKey, { dims: AggDims; total: number }>();
    rows.forEach((r) => {
      const { key, dims } = makeKey(r);
      const q = Number(r.quant || 0);
      const cur = map.get(key) || { dims, total: 0 };
      cur.total += q;
      // Preserve first non-empty dims for display
      if (!map.has(key)) map.set(key, cur);
      else map.set(key, cur);
    });
    return map;
  };
  const sistemaFilteredAgg = useMemo(() => sistemaRows.filter(r => matchesFilters(r)), [sistemaRows, matchesFilters]);
  const arquivoFilteredAgg = useMemo(() => arquivoRows.filter(r => matchesFilters(r)), [arquivoRows, matchesFilters]);
  const sysAgg = useMemo(() => groupSum(sistemaFilteredAgg), [sistemaFilteredAgg]);
  const fileAgg = useMemo(() => groupSum(arquivoFilteredAgg), [arquivoFilteredAgg]);
  const [onlyDiffs, setOnlyDiffs] = useState(false);
  const diffs = useMemo(() => {
    const keys = new Set<AggKey>([...Array.from(sysAgg.keys()), ...Array.from(fileAgg.keys())]);
    const arr = Array.from(keys).map((k) => {
      const s = sysAgg.get(k);
      const a = fileAgg.get(k);
      const dims = s?.dims || a?.dims || { cliente: '' };
      const sist = s?.total || 0;
      const arq = a?.total || 0;
      return { ...dims, sistema: sist, arquivo: arq, delta: arq - sist };
    });
    return arr.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  }, [sysAgg, fileAgg]);
  const diffsFiltered = useMemo(() => (onlyDiffs ? diffs.filter(d => d.delta !== 0) : diffs), [diffs, onlyDiffs]);

  const handleExportDiffs = () => {
    const rows = diffsFiltered.map((d) => ({
      cliente: d.cliente,
      modalidade: d.modalidade || '',
      especialidade: d.especialidade || '',
      categoria: d.categoria || '',
      prioridade: d.prioridade || '',
      exame: d.exame || '',
      total_sistema: d.sistema,
      total_arquivo: d.arquivo,
      delta: d.delta,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'divergencias_exame');
    XLSX.writeFile(wb, `divergencias_por_exame_${new Date().toISOString().slice(0,10)}.xlsx`);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Exames (Sistema x Arquivo)</CardTitle>
        <CardDescription>
          Listagem por exame com Cliente, Modalidade, Especialidade, Categoria, Prioridade, Datas, Médico e Quant.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="w-64">
            <Select value={clienteFilter} onValueChange={(v) => { setClienteFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os clientes</SelectItem>
                {clienteOptions.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Select value={modalidadeFilter} onValueChange={(v) => { setModalidadeFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Modalidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as modalidades</SelectItem>
                {modalidadeOptions.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setClienteFilter('todos'); setModalidadeFilter('todos'); setPage(1); }}>
            Limpar filtros
          </Button>
        </div>
        <div className="flex items-center justify-between mb-3 text-sm">
          <div className="text-muted-foreground">
            Registros: {filteredRows.length.toLocaleString()} — Página {page} de {totalPages}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Próxima</Button>
          </div>
        </div>
        <div className="max-h-[65vh] overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fonte</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Modalidade</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Exame</TableHead>
                <TableHead>Data Exame</TableHead>
                <TableHead>Data Laudo</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Médico</TableHead>
                <TableHead className="text-right">Quant.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((r, idx) => (
                <TableRow key={`${r.fonte}-${idx}`}>
                  <TableCell>
                    <Badge variant={r.fonte === 'Sistema' ? 'secondary' : 'outline'}>{r.fonte}</Badge>
                  </TableCell>
                  <TableCell>{r.cliente}</TableCell>
                  <TableCell>{r.modalidade || '—'}</TableCell>
                  <TableCell>{r.especialidade || '—'}</TableCell>
                  <TableCell>{r.categoria || '—'}</TableCell>
                  <TableCell>{r.prioridade || '—'}</TableCell>
                  <TableCell>{r.exame || '—'}</TableCell>
                  <TableCell>{toDisplayDate(r.data_exame)}</TableCell>
                  <TableCell>{toDisplayDate(r.data_laudo)}</TableCell>
                  <TableCell>{r.paciente || '—'}</TableCell>
                  <TableCell>{r.medico || '—'}</TableCell>
                  <TableCell className="text-right">{(r.quant ?? 0).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {pageRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground">
                    Nenhum registro para exibir.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Divergências agregadas por exame */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-foreground">
              Divergências por exame: {diffsFiltered.length.toLocaleString()} itens
            </div>
            <div className="flex gap-2">
              <Button
                variant={onlyDiffs ? 'default' : 'outline'}
                size="sm"
                onClick={() => setOnlyDiffs((v) => !v)}
              >
                {onlyDiffs ? 'Mostrar todos' : 'Somente divergências'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportDiffs}>
                Exportar divergências (Excel)
              </Button>
            </div>
          </div>
          <div className="max-h-[50vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Modalidade</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Exame</TableHead>
                  <TableHead className="text-right">Sist.</TableHead>
                  <TableHead className="text-right">Arq.</TableHead>
                  <TableHead className="text-right">Δ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diffsFiltered.map((d, idx) => (
                  <TableRow key={`diff-${idx}`}>
                    <TableCell>{d.cliente}</TableCell>
                    <TableCell>{d.modalidade || '—'}</TableCell>
                    <TableCell>{d.especialidade || '—'}</TableCell>
                    <TableCell>{d.categoria || '—'}</TableCell>
                    <TableCell>{d.prioridade || '—'}</TableCell>
                    <TableCell>{d.exame || '—'}</TableCell>
                    <TableCell className="text-right">{d.sistema.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{d.arquivo.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      {d.delta !== 0 ? (
                        <Badge variant={d.delta > 0 ? 'destructive' : 'outline'}>
                          {d.delta > 0 ? '+' : ''}{d.delta}
                        </Badge>
                      ) : '0'}
                    </TableCell>
                  </TableRow>
                ))}
                {diffsFiltered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      Nenhuma divergência encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}