import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useVolumetria } from "@/contexts/VolumetriaContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type UploadedExamRow = {
  cliente: string;
  modalidade?: string;
  especialidade?: string;
  categoria?: string;
  prioridade?: string;
  data_exame?: string;
  data_laudo?: string;
  medico?: string;
  quant?: number;
  exame?: string;
};

export default function VolumetriaExamesComparison({ uploadedExams }: { uploadedExams?: UploadedExamRow[] }) {
  const { data: context } = useVolumetria();

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
      const data_exame = String(item.DATA_EXAME || item.DATA || '').trim();
      const data_laudo = String(item.DATA_LAUDO || item.DATA_LAUDO_EXAME || '').trim();
      const medico = String(item.MEDICO || '').trim();
      const exame = String(item.ESTUDO_DESCRICAO || item.NOME_EXAME || item.EXAME || item.ESTUDO || '').trim();
      const quant = Number(item.VALORES ?? item.VALOR ?? item.QUANTIDADE ?? item.QTD ?? item.QTDE ?? 1) || 1;
      return { fonte: 'Sistema', cliente, modalidade, especialidade, categoria, prioridade, data_exame, data_laudo, medico, quant, exame } as SystemExamRow;
    }).filter(r => r.cliente);
  }, [context]);

  const arquivoRows = useMemo<FileExamRow[]>(() => {
    return (uploadedExams || []).map((r) => ({ ...r, fonte: 'Arquivo' }));
  }, [uploadedExams]);

  const allRows = useMemo(() => {
    // Intercalar por fonte pode ajudar a comparar visualmente; aqui apenas concatenamos
    return [...sistemaRows, ...arquivoRows];
  }, [sistemaRows, arquivoRows]);

  // Paginação simples para performance
  const pageSize = 100;
  const [page, setPage] = React.useState(1);
  const totalPages = Math.max(1, Math.ceil(allRows.length / pageSize));
  const pageRows = useMemo(() => allRows.slice((page - 1) * pageSize, page * pageSize), [allRows, page]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exames (Sistema x Arquivo)</CardTitle>
        <CardDescription>
          Listagem por exame com Cliente, Modalidade, Especialidade, Categoria, Prioridade, Datas, Médico e Quant.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-3 text-sm">
          <div className="text-muted-foreground">
            Registros: {allRows.length.toLocaleString()} — Página {page} de {totalPages}
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
                  <TableCell>{r.data_exame || '—'}</TableCell>
                  <TableCell>{r.data_laudo || '—'}</TableCell>
                  <TableCell>{r.medico || '—'}</TableCell>
                  <TableCell className="text-right">{(r.quant ?? 0).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {pageRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground">
                    Nenhum registro para exibir.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
