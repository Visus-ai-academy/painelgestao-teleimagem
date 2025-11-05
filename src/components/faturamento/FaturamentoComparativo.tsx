import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, Upload, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';

interface FaturamentoUploadRow {
  dataEstudo: string; // Data do laudo
  paciente: string;
  nomeExame: string;
  laudadoPor: string; // nome do médico
  prioridade: string;
  modalidade: string;
  especialidade: string;
  categoria: string;
  laudos: number; // quantidade
  valor: number; // valor total
}

interface Diferenca {
  tipo: 'arquivo_apenas' | 'sistema_apenas' | 'valores_diferentes';
  chave: string; // identificador único do exame
  dataEstudo?: string;
  paciente?: string;
  exame?: string;
  medico?: string;
  prioridade?: string;
  modalidade?: string;
  especialidade?: string;
  categoria?: string;
  quantidadeArquivo?: number;
  quantidadeSistema?: number;
  valorArquivo?: number;
  valorSistema?: number;
  detalhes: string;
}

export default function FaturamentoComparativo() {
  const { toast } = useToast();
  const [clienteSelecionado, setClienteSelecionado] = useState<string>("");
  const [periodoSelecionado, setPeriodoSelecionado] = useState<string>("");
  const [uploadedData, setUploadedData] = useState<FaturamentoUploadRow[]>([]);
  const [diferencas, setDiferencas] = useState<Diferenca[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastFileName, setLastFileName] = useState<string>("");

  // Normalizar string para comparação
  const normalizar = (str: string): string => {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
  };

  // Parse de valor numérico
  const parseValor = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const cleaned = val.replace(/[^\d,.-]/g, '').replace(',', '.');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  // Parse de quantidade
  const parseQuantidade = (val: any): number => {
    const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^\d.-]/g, ''));
    return isNaN(num) ? 0 : num;
  };

  // Processar arquivo Excel
  const handleFileUpload = useCallback(async (file: File) => {
    setIsProcessing(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (jsonData.length < 2) {
        throw new Error("Arquivo vazio ou sem dados");
      }

      // Identificar colunas pelo cabeçalho
      const header = jsonData[0].map((h: any) => normalizar(String(h || '')));
      
      const colIndexes = {
        dataEstudo: header.findIndex(h => h.includes('DATA') && h.includes('ESTUDO')),
        paciente: header.findIndex(h => h.includes('PACIENTE')),
        nomeExame: header.findIndex(h => h.includes('NOME') && h.includes('EXAME')),
        laudadoPor: header.findIndex(h => h.includes('LAUDADO') && h.includes('POR')),
        prioridade: header.findIndex(h => h.includes('PRIOR')),
        modalidade: header.findIndex(h => h.includes('MODAL')),
        especialidade: header.findIndex(h => h.includes('ESPECIALIDADE')),
        categoria: header.findIndex(h => h.includes('CATEGORIA')),
        laudos: header.findIndex(h => h.includes('LAUDOS')),
        valor: header.findIndex(h => h.includes('VALOR'))
      };

      // Validar se todas as colunas foram encontradas
      const missing = Object.entries(colIndexes).filter(([_, idx]) => idx === -1).map(([key]) => key);
      if (missing.length > 0) {
        throw new Error(`Colunas não encontradas: ${missing.join(', ')}`);
      }

      // Processar linhas
      const rows: FaturamentoUploadRow[] = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        const paciente = String(row[colIndexes.paciente] || '').trim();
        if (!paciente) continue;

        rows.push({
          dataEstudo: String(row[colIndexes.dataEstudo] || '').trim(),
          paciente,
          nomeExame: String(row[colIndexes.nomeExame] || '').trim(),
          laudadoPor: String(row[colIndexes.laudadoPor] || '').trim(),
          prioridade: String(row[colIndexes.prioridade] || '').trim(),
          modalidade: String(row[colIndexes.modalidade] || '').trim(),
          especialidade: String(row[colIndexes.especialidade] || '').trim(),
          categoria: String(row[colIndexes.categoria] || '').trim(),
          laudos: parseQuantidade(row[colIndexes.laudos]),
          valor: parseValor(row[colIndexes.valor])
        });
      }

      setUploadedData(rows);
      setLastFileName(file.name);
      
      toast({
        title: "Arquivo carregado",
        description: `${rows.length} registros processados de ${file.name}`,
      });

    } catch (error: any) {
      toast({
        title: "Erro ao processar arquivo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  // Comparar dados
  const compararDados = useCallback(async () => {
    if (!clienteSelecionado || !periodoSelecionado || uploadedData.length === 0) {
      toast({
        title: "Dados incompletos",
        description: "Selecione o cliente, período e faça upload do arquivo",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Buscar dados do sistema (simulação - você deve implementar a busca real)
      // TODO: Implementar busca real dos dados do sistema via Supabase
      
      const diferencasEncontradas: Diferenca[] = [];
      
      // Exemplo de lógica de comparação
      // Você deve implementar a lógica real baseada nos seus dados
      
      setDiferencas(diferencasEncontradas);
      
      toast({
        title: "Comparação concluída",
        description: `${diferencasEncontradas.length} diferenças encontradas`,
      });

    } catch (error: any) {
      toast({
        title: "Erro na comparação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [clienteSelecionado, periodoSelecionado, uploadedData, toast]);

  // Limpar dados
  const handleLimpar = () => {
    setUploadedData([]);
    setDiferencas([]);
    setLastFileName("");
    setClienteSelecionado("");
  };

  // Exportar diferenças
  const handleExportarDiferencas = () => {
    if (diferencas.length === 0) {
      toast({
        title: "Nenhuma diferença",
        description: "Não há diferenças para exportar",
        variant: "destructive",
      });
      return;
    }

    const ws = XLSX.utils.json_to_sheet(
      diferencas.map(d => ({
        'Tipo': d.tipo === 'arquivo_apenas' ? 'Apenas no Arquivo' : 
                d.tipo === 'sistema_apenas' ? 'Apenas no Sistema' : 
                'Valores Diferentes',
        'Data Estudo': d.dataEstudo || '',
        'Paciente': d.paciente || '',
        'Exame': d.exame || '',
        'Médico': d.medico || '',
        'Prioridade': d.prioridade || '',
        'Modalidade': d.modalidade || '',
        'Especialidade': d.especialidade || '',
        'Categoria': d.categoria || '',
        'Qtd Arquivo': d.quantidadeArquivo || '',
        'Qtd Sistema': d.quantidadeSistema || '',
        'Valor Arquivo': d.valorArquivo ? d.valorArquivo.toFixed(2) : '',
        'Valor Sistema': d.valorSistema ? d.valorSistema.toFixed(2) : '',
        'Detalhes': d.detalhes
      }))
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Diferenças');
    XLSX.writeFile(wb, `Comparativo_Faturamento_${clienteSelecionado}_${periodoSelecionado}_${new Date().toISOString().split('T')[0]}.xlsx`);

    toast({
      title: "Exportação concluída",
      description: "Arquivo Excel gerado com sucesso",
    });
  };

  return (
    <div className="space-y-6">
      {/* Seleção de Cliente e Período */}
      <Card>
        <CardHeader>
          <CardTitle>Comparativo de Faturamento</CardTitle>
          <CardDescription>
            Compare os dados do sistema com um arquivo externo para identificar diferenças
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Cliente</label>
              <Select value={clienteSelecionado} onValueChange={setClienteSelecionado}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {/* TODO: Carregar clientes do sistema */}
                  <SelectItem value="cliente1">Cliente 1</SelectItem>
                  <SelectItem value="cliente2">Cliente 2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Período</label>
              <Select value={periodoSelecionado} onValueChange={setPeriodoSelecionado}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  {/* TODO: Carregar períodos disponíveis */}
                  <SelectItem value="2025-06">Junho/2025</SelectItem>
                  <SelectItem value="2025-07">Julho/2025</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload de Arquivo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload do Arquivo
          </CardTitle>
          <CardDescription>
            Faça upload do arquivo Excel/CSV com as colunas: Data Estudo, Paciente, Nome Exame, Laudado por, Prior, Modal, Especialidade, Categoria, Laudos, Valor
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center cursor-pointer"
            >
              <Upload className="h-12 w-12 text-gray-400 mb-2" />
              <span className="text-sm text-gray-600">
                Clique para selecionar ou arraste o arquivo aqui
              </span>
              <span className="text-xs text-gray-400 mt-1">
                Formatos aceitos: .xlsx, .xls, .csv
              </span>
            </label>
          </div>

          {lastFileName && (
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700">
                  Arquivo carregado: {lastFileName} ({uploadedData.length} registros)
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLimpar}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={compararDados}
              disabled={!clienteSelecionado || !periodoSelecionado || uploadedData.length === 0 || isProcessing}
              className="flex-1"
            >
              {isProcessing ? "Comparando..." : "Comparar Dados"}
            </Button>
            {diferencas.length > 0 && (
              <Button
                onClick={handleExportarDiferencas}
                variant="outline"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Exportar Diferenças
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resumo das Diferenças */}
      {diferencas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              Diferenças Encontradas ({diferencas.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Tipo</th>
                    <th className="text-left p-2">Data</th>
                    <th className="text-left p-2">Paciente</th>
                    <th className="text-left p-2">Exame</th>
                    <th className="text-left p-2">Médico</th>
                    <th className="text-left p-2">Qtd Arquivo</th>
                    <th className="text-left p-2">Qtd Sistema</th>
                    <th className="text-left p-2">Valor Arquivo</th>
                    <th className="text-left p-2">Valor Sistema</th>
                    <th className="text-left p-2">Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {diferencas.map((diff, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="p-2">
                        <span className={`px-2 py-1 text-xs rounded ${
                          diff.tipo === 'arquivo_apenas' ? 'bg-blue-100 text-blue-800' :
                          diff.tipo === 'sistema_apenas' ? 'bg-purple-100 text-purple-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {diff.tipo === 'arquivo_apenas' ? 'Só Arquivo' :
                           diff.tipo === 'sistema_apenas' ? 'Só Sistema' :
                           'Valores Diferentes'}
                        </span>
                      </td>
                      <td className="p-2 text-sm">{diff.dataEstudo || '-'}</td>
                      <td className="p-2 text-sm">{diff.paciente || '-'}</td>
                      <td className="p-2 text-sm">{diff.exame || '-'}</td>
                      <td className="p-2 text-sm">{diff.medico || '-'}</td>
                      <td className="p-2 text-sm">{diff.quantidadeArquivo || '-'}</td>
                      <td className="p-2 text-sm">{diff.quantidadeSistema || '-'}</td>
                      <td className="p-2 text-sm">
                        {diff.valorArquivo ? `R$ ${diff.valorArquivo.toFixed(2)}` : '-'}
                      </td>
                      <td className="p-2 text-sm">
                        {diff.valorSistema ? `R$ ${diff.valorSistema.toFixed(2)}` : '-'}
                      </td>
                      <td className="p-2 text-sm text-gray-600">{diff.detalhes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mensagem quando não há diferenças */}
      {uploadedData.length > 0 && diferencas.length === 0 && !isProcessing && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-gray-500">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-600" />
              <p>Nenhuma diferença encontrada</p>
              <p className="text-sm">Os dados do arquivo estão de acordo com o sistema</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
