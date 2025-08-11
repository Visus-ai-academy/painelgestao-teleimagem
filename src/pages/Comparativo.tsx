import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { VolumetriaClientesComparison, Divergencia, UploadedRow } from "@/components/volumetria/VolumetriaClientesComparison";
import { SimpleFileUpload } from "@/components/SimpleFileUpload";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";

export default function Comparativo() {
  const [uploaded, setUploaded] = useState<UploadedRow[] | null>(null);
  const [divergencias, setDivergencias] = useState<Divergencia[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [lastFileName, setLastFileName] = useState<string | null>(null);
  const { toast } = useToast();

  const parseXlsx = useCallback(async (file: File) => {
    setIsUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

      const nameKeys = ['cliente','empresa','nome_cliente','cliente_nome'];
      const totalKeys = ['total_exames','exames','qtd_exames','total','quantidade','qtd'];
      const modalidadeKeys = ['modalidade'];
      const especialidadeKeys = ['especialidade'];
      const prioridadeKeys = ['prioridade'];
      const categoriaKeys = ['categoria','cat','categoria_exame'];
      const exameKeys = ['exame','nome_exame','estudo','estudo_descricao','descricao_exame'];

      const parsed: UploadedRow[] = rows.map((r) => {
        const keys = Object.keys(r);
        const lowerMap: Record<string,string> = Object.fromEntries(keys.map(k => [k.toString().trim().toLowerCase(), k]));
        const nameKey = nameKeys.find(n => lowerMap[n]);
        const totalKey = totalKeys.find(n => lowerMap[n]);
        const modalidadeKey = modalidadeKeys.find(n => lowerMap[n]);
        const especialidadeKey = especialidadeKeys.find(n => lowerMap[n]);
        const prioridadeKey = prioridadeKeys.find(n => lowerMap[n]);
        const categoriaKey = categoriaKeys.find(n => lowerMap[n]);
        const exameKey = exameKeys.find(n => lowerMap[n]);
        const clienteRaw = nameKey ? r[lowerMap[nameKey]] : (r['cliente'] ?? r['Cliente'] ?? r[keys[0]]);
        const totalRaw = totalKey ? r[lowerMap[totalKey]] : undefined;
        const totalExames = totalRaw !== undefined && totalRaw !== null ? Number(totalRaw) : undefined;
        return {
          cliente: String(clienteRaw || '').trim(),
          totalExames: typeof totalExames === 'number' && !Number.isNaN(totalExames) ? totalExames : undefined,
          modalidade: modalidadeKey ? String(r[lowerMap[modalidadeKey]] ?? '').trim() : undefined,
          especialidade: especialidadeKey ? String(r[lowerMap[especialidadeKey]] ?? '').trim() : undefined,
          prioridade: prioridadeKey ? String(r[lowerMap[prioridadeKey]] ?? '').trim() : undefined,
          categoria: categoriaKey ? String(r[lowerMap[categoriaKey]] ?? '').trim() : undefined,
        } as UploadedRow;
      }).filter(item => item.cliente);

      setUploaded(parsed);
      setLastFileName(file.name);
      toast({ title: 'Arquivo carregado', description: `${parsed.length} linhas processadas para comparação.` });
    } catch (e) {
      console.error('Erro ao ler XLSX:', e);
      toast({ title: 'Falha ao ler arquivo', description: 'Verifique o formato do XLSX.', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  }, [toast]);

  const handleClear = useCallback(() => {
    setUploaded(null);
    setDivergencias([]);
    setLastFileName(null);
  }, []);

  const handleExport = useCallback(() => {
    if (!divergencias.length) return;
    const rows = divergencias.map(d => ({
      cliente: d.cliente,
      tipo: d.tipo === 'missing_in_file' ? 'Faltando no arquivo' : d.tipo === 'missing_in_system' ? 'Faltando no sistema' : 'Total diferente',
      total_sistema: d.totalSistema ?? '',
      total_arquivo: d.totalArquivo ?? '',
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'divergencias');
    XLSX.writeFile(wb, `divergencias_${new Date().toISOString().slice(0,10)}.xlsx`);
  }, [divergencias]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Comparativo de Clientes</h1>
        <p className="text-muted-foreground mt-1">Analise comparativa de volumetria por cliente.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload para Comparação (XLSX)</CardTitle>
          <CardDescription>Processamento em memória, sem gravar no banco.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="sm:w-72">
              <SimpleFileUpload
                onUpload={parseXlsx}
                acceptedTypes={[".xlsx", ".xls"]}
                title="Selecionar arquivo XLSX"
                isUploading={isUploading}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClear} disabled={!uploaded && divergencias.length === 0}>
                <X className="h-4 w-4 mr-1" />
                Limpar comparação
              </Button>
              <Button variant="outline" onClick={handleExport} disabled={divergencias.length === 0}>
                <Download className="h-4 w-4 mr-1" />
                Exportar divergências
              </Button>
            </div>
          </div>
          {lastFileName && (
            <div className="text-xs text-muted-foreground mt-2">Arquivo: {lastFileName}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comparativo</CardTitle>
          <CardDescription>Compare clientes por período, modalidade e outros filtros.</CardDescription>
        </CardHeader>
        <CardContent>
          <VolumetriaClientesComparison
            uploaded={uploaded || undefined}
            onDivergencesComputed={setDivergencias}
          />
        </CardContent>
      </Card>
    </div>
  );
}
