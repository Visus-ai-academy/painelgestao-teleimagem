import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { VolumetriaClientesComparison, Divergencia, UploadedRow } from "@/components/volumetria/VolumetriaClientesComparison";
import VolumetriaExamesComparison, { UploadedExamRow } from "@/components/volumetria/VolumetriaExamesComparison";
import VolumetriaDivergencias from "@/components/volumetria/VolumetriaDivergencias";
import { SimpleFileUpload } from "@/components/SimpleFileUpload";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVolumetria } from "@/contexts/VolumetriaContext";
import { Badge } from "@/components/ui/badge";
import { ComparativoPeriodoSelector } from "@/components/volumetria/ComparativoPeriodoSelector";

export default function Comparativo() {
  const [uploaded, setUploaded] = useState<UploadedRow[] | null>(null);
  const [uploadedExams, setUploadedExams] = useState<UploadedExamRow[] | null>(null);
  const [divergencias, setDivergencias] = useState<Divergencia[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [lastFileName, setLastFileName] = useState<string | null>(null);
  const [periodoComparativo, setPeriodoComparativo] = useState<string | null>(null);
  const { toast } = useToast();
  const { data: volumetriaData, refreshData, getDataByPeriod } = useVolumetria();

  // Persistência simples para manter o comparativo ao sair/voltar da tela
  const STORAGE_KEYS = {
    uploaded: 'comparativo_uploaded',
    uploadedExams: 'comparativo_uploadedExams',
    lastFileName: 'comparativo_lastFileName',
    divergencias: 'comparativo_divergencias',
  } as const;

  // Restaurar ao montar e inicializar período ativo
  useEffect(() => {
    try {
      const u = localStorage.getItem(STORAGE_KEYS.uploaded);
      const ue = localStorage.getItem(STORAGE_KEYS.uploadedExams);
      const lf = localStorage.getItem(STORAGE_KEYS.lastFileName);
      const dv = localStorage.getItem(STORAGE_KEYS.divergencias);
      if (u) setUploaded(JSON.parse(u));
      if (ue) setUploadedExams(JSON.parse(ue));
      if (lf) setLastFileName(JSON.parse(lf));
      if (dv) setDivergencias(JSON.parse(dv));
      
      // Inicializar com período ativo se não tiver selecionado
      if (!periodoComparativo && volumetriaData.dashboardStats?.periodo_ativo) {
        setPeriodoComparativo(volumetriaData.dashboardStats.periodo_ativo);
      }
    } catch (e) {
      console.warn('Falha ao restaurar comparativo do storage', e);
    }
  }, [volumetriaData.dashboardStats?.periodo_ativo]);

  // Salvar alterações
  useEffect(() => {
    try {
      // Verifica tamanho dos dados antes de salvar para evitar QuotaExceededError
      if (uploaded) {
        const uploadedString = JSON.stringify(uploaded);
        if (uploadedString.length > 5000000) { // Limite de 5MB
          console.warn('Dados uploaded muito grandes para localStorage');
        } else {
          localStorage.setItem(STORAGE_KEYS.uploaded, uploadedString);
        }
      } else {
        localStorage.removeItem(STORAGE_KEYS.uploaded);
      }

      if (uploadedExams) {
        const examsString = JSON.stringify(uploadedExams);
        if (examsString.length > 5000000) { // Limite de 5MB
          console.warn('Dados uploadedExams muito grandes para localStorage');
        } else {
          localStorage.setItem(STORAGE_KEYS.uploadedExams, examsString);
        }
      } else {
        localStorage.removeItem(STORAGE_KEYS.uploadedExams);
      }

      if (lastFileName) localStorage.setItem(STORAGE_KEYS.lastFileName, JSON.stringify(lastFileName));
      else localStorage.removeItem(STORAGE_KEYS.lastFileName);

      const divergenciasString = JSON.stringify(divergencias || []);
      if (divergenciasString.length > 1000000) { // Limite de 1MB para divergências
        console.warn('Dados divergencias muito grandes para localStorage');
      } else {
        localStorage.setItem(STORAGE_KEYS.divergencias, divergenciasString);
      }
    } catch (e) {
      console.warn('Falha ao salvar comparativo no storage - limpando dados antigos', e);
      // Em caso de erro de quota, limpa dados antigos
      try {
        Object.values(STORAGE_KEYS).forEach(key => {
          localStorage.removeItem(key);
        });
      } catch (cleanupError) {
        console.error('Erro ao limpar localStorage:', cleanupError);
      }
    }
  }, [uploaded, uploadedExams, lastFileName, divergencias]);

  const parseXlsx = useCallback(async (file: File) => {
    setIsUploading(true);
    // Resetar estado para evitar qualquer percepção de sobreposição
    setUploaded(null);
    setUploadedExams(null);
    setDivergencias([]);
    setLastFileName(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

      const nameKeys = ['cliente','empresa','nome_cliente','cliente_nome'];
      const totalKeys = ['total_exames','exames','qtd_exames','total','quant','quantidade','qtd','qtdade','qte','laudos','total_laudos','qtd_laudos','qtde_laudos','laudos_exames','laudos_exame','qtd_laudos_exames','qtd_laudos_exame','total_laudos_exames','quantidade_laudos','quantidade_exames','qtd_exame','qtd_exames_total','num_laudos','num_exames'];
      const modalidadeKeys = ['modalidade'];
      const especialidadeKeys = ['especialidade'];
      const prioridadeKeys = ['prioridade'];
      const categoriaKeys = ['categoria','cat','categoria_exame'];
      const exameKeys = ['exame','nome_exame','estudo','estudo_descricao','descricao_exame','procedimento','codigo_exame','cod_exame','descricao','nm_exame','nome_est'];
      const dataExameKeys = ['data_exame','dt_exame'];
      const dataLaudoKeys = ['data_laudo','dt_laudo','data_laudo_exame'];
      const medicoKeys = ['medico','nome_medico','medico_nome'];
      const pacienteKeys = ['paciente','nome_paciente','nm_paciente','paciente_nome','nome_do_paciente'];
      const accessionKeys = ['accession_number','acession_number','accession'];
      const codigoPacienteKeys = ['codigo_paciente','cod_paciente','paciente_codigo','codigo_interno'];

      const parseCount = (v: any): number | undefined => {
        if (v === null || v === undefined) return undefined;
        if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
        const s = String(v).trim();
        if (!s) return undefined;
        // remove qualquer texto, mantendo dígitos, vírgula e ponto
        const cleaned = s.replace(/[^0-9.,-]/g, '');
        // se tem vírgula como decimal, troque por ponto; remova separadores de milhar
        const normalized = cleaned.includes(',') && cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
          ? cleaned.replace(/\./g, '').replace(',', '.')
          : cleaned.replace(/,/g, '');
        const n = Number(normalized);
        return Number.isFinite(n) ? n : undefined;
      };

// removido: parsing intermediário substituído por parsedRows e parsedDetailed
      const parsedRows: UploadedRow[] = rows.map((r) => {
        const keys = Object.keys(r);
        const normalizeHeader = (s: string) =>
          s?.toString().trim().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
        const normMap: Record<string,string> = Object.fromEntries(keys.map(k => [normalizeHeader(k), k]));
        const findKey = (candidates: string[]) => candidates.find(n => normMap[n]);
        const nameKey = findKey(nameKeys);
        const totalKey = findKey(totalKeys);
        const modalidadeKey = findKey(modalidadeKeys);
        const especialidadeKey = findKey(especialidadeKeys);
        const prioridadeKey = findKey(prioridadeKeys);
        const categoriaKey = findKey(categoriaKeys);
        const exameKey = findKey(exameKeys);
        const clienteRaw = nameKey ? r[normMap[nameKey]] : (r['cliente'] ?? r['Cliente'] ?? r[keys[0]]);
        const totalRaw = totalKey ? r[normMap[totalKey]] : undefined;
        const num = parseCount(totalRaw);
        const modVal = modalidadeKey ? String(r[normMap[modalidadeKey]] ?? '').trim() : '';
        const espVal = especialidadeKey ? String(r[normMap[especialidadeKey]] ?? '').trim() : '';
        const priVal = prioridadeKey ? String(r[normMap[prioridadeKey]] ?? '').trim() : '';
        const catVal = categoriaKey ? String(r[normMap[categoriaKey]] ?? '').trim() : '';
        const exameVal = exameKey ? String(r[normMap[exameKey]] ?? '').trim() : '';
        const hasDim = !!(modVal || espVal || priVal || catVal || exameVal);
        const totalExames = num !== undefined ? num : (hasDim ? 1 : undefined);
        return {
          cliente: String(clienteRaw || '').trim(),
          totalExames: typeof totalExames === 'number' && !Number.isNaN(totalExames) ? totalExames : undefined,
          modalidade: modVal || undefined,
          especialidade: espVal || undefined,
          prioridade: priVal || undefined,
          categoria: catVal || undefined,
          exame: exameVal || undefined,
        } as UploadedRow;
      }).filter(item => item.cliente);

      const parsedDetailed: UploadedExamRow[] = rows.map((r) => {
        const keys = Object.keys(r);
        const normalizeHeader = (s: string) =>
          s?.toString().trim().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
        const normMap: Record<string,string> = Object.fromEntries(keys.map(k => [normalizeHeader(k), k]));
        const findKey = (candidates: string[]) => candidates.find(n => normMap[n]);
        const nameKey = findKey(nameKeys);
        const totalKey = findKey(totalKeys);
        const modalidadeKey = findKey(modalidadeKeys);
        const especialidadeKey = findKey(especialidadeKeys);
        const prioridadeKey = findKey(prioridadeKeys);
        const categoriaKey = findKey(categoriaKeys);
        const exameKey = findKey(exameKeys);
        const dataExKey = findKey(dataExameKeys);
        const dataLaudoKey = findKey(dataLaudoKeys);
        const medicoKey = findKey(medicoKeys);
        const pacienteKey = findKey(pacienteKeys);
        const accessionKey = findKey(accessionKeys);
        const codigoPacKey = findKey(codigoPacienteKeys);
        const cliente = String(nameKey ? r[normMap[nameKey]] : (r['cliente'] ?? r['Cliente'] ?? r[keys[0]])).trim();
        const totalRaw = totalKey ? r[normMap[totalKey]] : undefined;
        const num = parseCount(totalRaw);
        const modalidade = modalidadeKey ? String(r[normMap[modalidadeKey]] ?? '').trim() : undefined;
        const especialidade = especialidadeKey ? String(r[normMap[especialidadeKey]] ?? '').trim() : undefined;
        const prioridade = prioridadeKey ? String(r[normMap[prioridadeKey]] ?? '').trim() : undefined;
        const categoria = categoriaKey ? String(r[normMap[categoriaKey]] ?? '').trim() : undefined;
        const exame = exameKey ? String(r[normMap[exameKey]] ?? '').trim() : undefined;
        const data_exame = dataExKey ? r[normMap[dataExKey]] : undefined;
        const data_laudo = dataLaudoKey ? r[normMap[dataLaudoKey]] : undefined;
        const medico = medicoKey ? String(r[normMap[medicoKey]] ?? '').trim() : undefined;
        const paciente = pacienteKey ? String(r[normMap[pacienteKey]] ?? '').trim() : undefined;
        const accessionNumber = accessionKey ? String(r[normMap[accessionKey]] ?? '').trim() : undefined;
        const codigoPaciente = codigoPacKey ? r[normMap[codigoPacKey]] : undefined;
        const hasDim = !!(modalidade || especialidade || prioridade || categoria || exame);
        const quant = num !== undefined ? num : (hasDim ? 1 : undefined);
        return { cliente, modalidade, especialidade, categoria, prioridade, exame, data_exame, data_laudo, medico, paciente, quant, accessionNumber, codigoPaciente } as UploadedExamRow;
      }).filter(item => item.cliente);

      setUploaded(parsedRows);
      setUploadedExams(parsedDetailed);
      setLastFileName(file.name);
      toast({ title: 'Arquivo carregado', description: `${rows.length} linhas processadas para comparação.` });
    } catch (e) {
      console.error('Erro ao ler XLSX:', e);
      toast({ title: 'Falha ao ler arquivo', description: 'Verifique o formato do XLSX.', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  }, [toast]);

  const handleClear = useCallback(() => {
    setUploaded(null);
    setUploadedExams(null);
    setDivergencias([]);
    setLastFileName(null);
    try {
      localStorage.removeItem(STORAGE_KEYS.uploaded);
      localStorage.removeItem(STORAGE_KEYS.uploadedExams);
      localStorage.removeItem(STORAGE_KEYS.lastFileName);
      localStorage.removeItem(STORAGE_KEYS.divergencias);
    } catch {}
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
        
        {/* Indicador de dados atualizados */}
        <div className="flex items-center gap-4 mt-3">
          <Badge variant="outline" className="text-xs">
            Período Ativo: {volumetriaData.dashboardStats?.periodo_ativo || 'N/A'}
          </Badge>
          {volumetriaData.dashboardStats?.ultima_atualizacao && (
            <Badge variant="secondary" className="text-xs">
              Atualizado: {new Date(volumetriaData.dashboardStats.ultima_atualizacao).toLocaleString('pt-BR')}
            </Badge>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => refreshData()} 
            disabled={volumetriaData.loading}
            className="text-xs"
          >
            {volumetriaData.loading ? '🔄 Atualizando...' : '🔄 Forçar Atualização'}
          </Button>
        </div>
      </div>

      {/* Seletor de período para comparativo */}
      <ComparativoPeriodoSelector
        periodoSelecionado={periodoComparativo}
        onPeriodoChange={setPeriodoComparativo}
      />

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

      <Tabs defaultValue="resumo" className="mt-2">
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="exames">Por Exame</TabsTrigger>
          <TabsTrigger value="divergencias">Divergências</TabsTrigger>
        </TabsList>
        <TabsContent value="resumo">
          <Card>
            <CardHeader>
              <CardTitle>Comparativo</CardTitle>
              <CardDescription>Compare clientes por período, modalidade e outros filtros.</CardDescription>
            </CardHeader>
            <CardContent>
              <VolumetriaClientesComparison
                uploaded={uploaded || undefined}
                uploadedExams={uploadedExams || undefined}
                onDivergencesComputed={setDivergencias}
                periodoSelecionado={periodoComparativo}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="exames">
          <VolumetriaExamesComparison uploadedExams={uploadedExams || undefined} />
        </TabsContent>
        <TabsContent value="divergencias">
          <VolumetriaDivergencias 
            uploadedExams={uploadedExams || undefined} 
            periodoSelecionado={periodoComparativo}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
