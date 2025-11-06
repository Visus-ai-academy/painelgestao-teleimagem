import { useState, useCallback, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, Upload, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
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
  const [clientes, setClientes] = useState<Array<{ id: string; nome: string }>>([]);
  const [periodos, setPeriodos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Carregar clientes e períodos
  useEffect(() => {
    const carregarDados = async () => {
      try {
        // Buscar clientes
        const { data: clientesData, error: clientesError } = await supabase
          .from('clientes')
          .select('id, nome')
          .eq('ativo', true)
          .order('nome');

        if (clientesError) throw clientesError;
        setClientes(clientesData || []);

        // Buscar períodos únicos da tabela de faturamento (dados processados)
        const { data: periodosData, error: periodosError } = await supabase
          .from('faturamento')
          .select('periodo_referencia');

        if (periodosError) {
          console.error('Erro ao buscar períodos:', periodosError);
        }
        
        const periodosUnicos = Array.from(
          new Set(periodosData?.map(p => p.periodo_referencia).filter(Boolean) || [])
        ).sort((a, b) => b.localeCompare(a)); // Ordenar descendente
        
        console.log('Períodos encontrados:', periodosUnicos);
        setPeriodos(periodosUnicos);

      } catch (error: any) {
        console.error('Erro ao carregar dados:', error);
        toast({
          title: "Erro ao carregar dados",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    carregarDados();
  }, [toast]);

  // Normalizar string para comparação
  const normalizar = (str: string): string => {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
  };

  // Parse de data do Excel (pode vir como número serial do Excel)
  const parseDataExcel = (val: any): string => {
    if (!val) return '';
    
    // Se for número (serial date do Excel)
    if (typeof val === 'number') {
      const date = new Date((val - 25569) * 86400 * 1000);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
    
    // Se for string, retornar como está
    return String(val).trim();
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
          dataEstudo: parseDataExcel(row[colIndexes.dataEstudo]),
          paciente: normalizar(paciente),
          nomeExame: String(row[colIndexes.nomeExame] || '').trim(),
          laudadoPor: String(row[colIndexes.laudadoPor] || '').trim(),
          prioridade: String(row[colIndexes.prioridade] || '').trim(),
          modalidade: String(row[colIndexes.modalidade] || '').trim(),
          especialidade: String(row[colIndexes.especialidade] || '').trim(),
          categoria: String(row[colIndexes.categoria] || '').trim() || 'SC',
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
      const clienteNome = clientes.find(c => c.id === clienteSelecionado)?.nome || '';
      
      // Buscar dados do demonstrativo calculado (dados processados para faturamento)
      // Obter também o nome_fantasia do cliente selecionado para alinhar com o que é salvo pela função
      const { data: clienteInfo } = await supabase
        .from('clientes')
        .select('nome, nome_fantasia')
        .eq('id', clienteSelecionado)
        .maybeSingle();

      const nomesCandidatos = Array.from(
        new Set([
          clienteNome,
          clienteInfo?.nome_fantasia || undefined,
        ].filter(Boolean) as string[])
      );
      
      // 1) Tenta por cliente_id (mais confiável)
      let { data: demonstrativo, error: demoError } = await supabase
        .from('demonstrativos_faturamento_calculados')
        .select('detalhes_exames, cliente_nome, cliente_id, updated_at')
        .eq('cliente_id', clienteSelecionado)
        .eq('periodo_referencia', periodoSelecionado)
        .maybeSingle();

      // 2) Se não encontrou, tenta por cliente_nome considerando nome e nome_fantasia (igualdade exata)
      if ((!demonstrativo || !demonstrativo.detalhes_exames) && !demoError && nomesCandidatos.length > 0) {
        const alt = await supabase
          .from('demonstrativos_faturamento_calculados')
          .select('detalhes_exames, cliente_nome, cliente_id, updated_at')
          .eq('periodo_referencia', periodoSelecionado)
          .in('cliente_nome', nomesCandidatos)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        demonstrativo = alt.data as any;
        demoError = alt.error as any;
      }

      // 2.1) Se ainda não encontrou: busca parcial por nome com ILIKE no mesmo período
      if ((!demonstrativo || !demonstrativo.detalhes_exames) && !demoError) {
        const patterns = Array.from(new Set([
          `%${clienteNome}%`,
          ...(clienteInfo?.nome_fantasia ? [`%${clienteInfo.nome_fantasia}%`] : []),
        ]));

        for (const p of patterns) {
          const alt2 = await supabase
            .from('demonstrativos_faturamento_calculados')
            .select('detalhes_exames, cliente_nome, cliente_id, updated_at')
            .eq('periodo_referencia', periodoSelecionado)
            .ilike('cliente_nome', p)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (alt2.data?.detalhes_exames) {
            demonstrativo = alt2.data as any;
            demoError = alt2.error as any;
            break;
          }
        }
      }

      // 2.2) Última tentativa: período flexível (ex.: 2025-09-01) + ILIKE no nome
      if ((!demonstrativo || !demonstrativo.detalhes_exames) && !demoError) {
        const patterns = Array.from(new Set([
          `%${clienteNome}%`,
          ...(clienteInfo?.nome_fantasia ? [`%${clienteInfo.nome_fantasia}%`] : []),
        ]));

        for (const p of patterns) {
          const alt3 = await supabase
            .from('demonstrativos_faturamento_calculados')
            .select('detalhes_exames, cliente_nome, cliente_id, updated_at')
            .ilike('periodo_referencia', `${periodoSelecionado}%`)
            .ilike('cliente_nome', p)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (alt3.data?.detalhes_exames) {
            demonstrativo = alt3.data as any;
            demoError = alt3.error as any;
            break;
          }
        }
      }

      // 3) Se ainda não existir, gera o demonstrativo on-demand via Edge Function e salva no banco
      if ((!demonstrativo || !demonstrativo.detalhes_exames) && !demoError) {
        const { data: genData, error: genError } = await supabase.functions.invoke('gerar-demonstrativos-faturamento', {
          body: { periodo: periodoSelecionado, clientes: [clienteSelecionado] }
        });

        if (genError) {
          throw genError;
        }

        // Reconsulta após geração
        const recheck = await supabase
          .from('demonstrativos_faturamento_calculados')
          .select('detalhes_exames')
          .eq('cliente_id', clienteSelecionado)
          .eq('periodo_referencia', periodoSelecionado)
          .maybeSingle();
        demonstrativo = recheck.data as any;
        demoError = recheck.error as any;
      }

      if (demoError && (demoError as any).code !== 'PGRST116') {
        throw demoError;
      }

      if (!demonstrativo || !demonstrativo.detalhes_exames) {
        // Checagem adicional: existe faturamento para este cliente/período?
        let totalFat = 0;
        try {
          const { count: fatCountById } = await supabase
            .from('faturamento')
            .select('id', { count: 'exact', head: true })
            .eq('periodo_referencia', periodoSelecionado)
            .eq('cliente_id', clienteSelecionado);

          const { count: fatCountByNome } = await supabase
            .from('faturamento')
            .select('id', { count: 'exact', head: true })
            .eq('periodo_referencia', periodoSelecionado)
            .in('cliente_nome', nomesCandidatos);

          totalFat = (fatCountById || 0) + (fatCountByNome || 0);
        } catch (e) {
          // ignora contagem se der erro
        }

        toast({
          title: 'Demonstrativo não encontrado',
          description: totalFat > 0
            ? `Há dados de faturamento (${totalFat} exames) para ${clienteNome} em ${periodoSelecionado}, mas o demonstrativo não foi gravado. Gere novamente o demonstrativo na aba "Gerar" e tente o comparativo depois.`
            : `Não encontramos dados de faturamento para ${clienteNome} em ${periodoSelecionado}. Gere o demonstrativo desse período antes de comparar.`,
          variant: 'destructive',
        });
        setIsProcessing(false);
        return;
      }

      const dadosSistema = demonstrativo.detalhes_exames as any[];
      console.log(`Dados do demonstrativo encontrados: ${dadosSistema?.length || 0} exames processados para ${clienteNome} em ${periodoSelecionado}`);

      const diferencasEncontradas: Diferenca[] = [];

      // Criar mapa dos dados do sistema usando MODALIDADE + ESPECIALIDADE + CATEGORIA + PRIORIDADE
      const sistemaMap = new Map<string, any>();
      (dadosSistema || []).forEach((item: any) => {
        const chave = `${normalizar(item.modalidade || '')}|${normalizar(item.especialidade || '')}|${normalizar(item.categoria || '')}|${normalizar(item.prioridade || '')}`;
        sistemaMap.set(chave, item);
      });

      // Criar mapa dos dados do arquivo agrupando por MODALIDADE + ESPECIALIDADE + CATEGORIA + PRIORIDADE
      const arquivoMap = new Map<string, {
        modalidade: string;
        especialidade: string;
        categoria: string;
        prioridade: string;
        quantidade: number;
        valor: number;
      }>();
      
      uploadedData.forEach((item) => {
        const chave = `${normalizar(item.modalidade)}|${normalizar(item.especialidade)}|${normalizar(item.categoria)}|${normalizar(item.prioridade)}`;
        
        if (!arquivoMap.has(chave)) {
          arquivoMap.set(chave, {
            modalidade: item.modalidade,
            especialidade: item.especialidade,
            categoria: item.categoria,
            prioridade: item.prioridade,
            quantidade: 0,
            valor: 0
          });
        }
        
        const grupo = arquivoMap.get(chave)!;
        grupo.quantidade += item.laudos;
        grupo.valor += item.valor;
      });

      // Comparar: grupos no arquivo vs sistema
      arquivoMap.forEach((grupoArquivo, chave) => {
        const grupoSistema = sistemaMap.get(chave);
        
        if (!grupoSistema) {
          // Grupo não existe no sistema
          diferencasEncontradas.push({
            tipo: 'arquivo_apenas',
            chave,
            modalidade: grupoArquivo.modalidade,
            especialidade: grupoArquivo.especialidade,
            categoria: grupoArquivo.categoria,
            prioridade: grupoArquivo.prioridade,
            quantidadeArquivo: grupoArquivo.quantidade,
            valorArquivo: grupoArquivo.valor,
            detalhes: 'Grupo Modal/Espec/Cat/Prior existe apenas no arquivo'
          });
        } else {
          // Grupo existe em ambos, verificar divergências
          const divergencias: string[] = [];
          
          const qtdSistema = Number(grupoSistema.quantidade) || 0;
          const qtdArquivo = grupoArquivo.quantidade;
          if (qtdArquivo !== qtdSistema) {
            divergencias.push(`Quantidade: Arquivo=${qtdArquivo} vs Sistema=${qtdSistema}`);
          }
          
          const valorSistema = Number(grupoSistema.valor_total) || 0;
          const valorArquivo = grupoArquivo.valor;
          if (Math.abs(valorArquivo - valorSistema) > 0.01) {
            divergencias.push(`Valor: Arquivo=R$ ${valorArquivo.toFixed(2)} vs Sistema=R$ ${valorSistema.toFixed(2)}`);
          }

          if (divergencias.length > 0) {
            diferencasEncontradas.push({
              tipo: 'valores_diferentes',
              chave,
              modalidade: grupoArquivo.modalidade,
              especialidade: grupoArquivo.especialidade,
              categoria: grupoArquivo.categoria,
              prioridade: grupoArquivo.prioridade,
              quantidadeArquivo: qtdArquivo,
              quantidadeSistema: qtdSistema,
              valorArquivo: valorArquivo,
              valorSistema: valorSistema,
              detalhes: divergencias.join(' | ')
            });
          }
        }
      });

      // Comparar: grupos no sistema que não estão no arquivo
      sistemaMap.forEach((grupoSistema, chave) => {
        if (!arquivoMap.has(chave)) {
          diferencasEncontradas.push({
            tipo: 'sistema_apenas',
            chave,
            modalidade: grupoSistema.modalidade,
            especialidade: grupoSistema.especialidade,
            categoria: grupoSistema.categoria,
            prioridade: grupoSistema.prioridade,
            quantidadeSistema: Number(grupoSistema.quantidade) || 0,
            valorSistema: Number(grupoSistema.valor_total) || 0,
            detalhes: 'Grupo Modal/Espec/Cat/Prior existe apenas no sistema'
          });
        }
      });
      
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
  }, [clienteSelecionado, periodoSelecionado, uploadedData, toast, clientes]);

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
        'Modalidade': d.modalidade || '',
        'Especialidade': d.especialidade || '',
        'Categoria': d.categoria || '',
        'Prioridade': d.prioridade || '',
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
                  {loading ? (
                    <SelectItem value="loading" disabled>Carregando...</SelectItem>
                  ) : clientes.length === 0 ? (
                    <SelectItem value="empty" disabled>Nenhum cliente encontrado</SelectItem>
                  ) : (
                    clientes.map(cliente => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </SelectItem>
                    ))
                  )}
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
                  {loading ? (
                    <SelectItem value="loading" disabled>Carregando...</SelectItem>
                  ) : periodos.length === 0 ? (
                    <SelectItem value="empty" disabled>Nenhum período encontrado</SelectItem>
                  ) : (
                    periodos.map(periodo => (
                      <SelectItem key={periodo} value={periodo}>
                        {periodo}
                      </SelectItem>
                    ))
                  )}
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
          <CardContent className="space-y-4">
            {/* Resumo por tipo */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">
                  {diferencas.filter(d => d.tipo === 'arquivo_apenas').length}
                </div>
                <div className="text-sm text-blue-600">Apenas no Arquivo</div>
              </div>
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="text-2xl font-bold text-purple-700">
                  {diferencas.filter(d => d.tipo === 'sistema_apenas').length}
                </div>
                <div className="text-sm text-purple-600">Apenas no Sistema</div>
              </div>
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="text-2xl font-bold text-yellow-700">
                  {diferencas.filter(d => d.tipo === 'valores_diferentes').length}
                </div>
                <div className="text-sm text-yellow-600">Com Divergências</div>
              </div>
            </div>

            {/* Tabela de diferenças */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-2 font-medium">Tipo</th>
                    <th className="text-left p-2 font-medium">Modalidade</th>
                    <th className="text-left p-2 font-medium">Especialidade</th>
                    <th className="text-left p-2 font-medium">Categoria</th>
                    <th className="text-left p-2 font-medium">Prioridade</th>
                    <th className="text-left p-2 font-medium">Qtd Arq/Sis</th>
                    <th className="text-left p-2 font-medium">Valor Arq/Sis</th>
                    <th className="text-left p-2 font-medium">Divergências</th>
                  </tr>
                </thead>
                <tbody>
                  {diferencas.map((diff, idx) => {
                    // Extrair tipos de divergências do campo detalhes
                    const temQuantidadeDif = diff.detalhes.includes('Quantidade:');
                    const temValorDif = diff.detalhes.includes('Valor:');

                    return (
                      <tr key={idx} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-2">
                          <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                            diff.tipo === 'arquivo_apenas' ? 'bg-blue-100 text-blue-700' :
                            diff.tipo === 'sistema_apenas' ? 'bg-purple-100 text-purple-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {diff.tipo === 'arquivo_apenas' ? 'Só Arquivo' :
                             diff.tipo === 'sistema_apenas' ? 'Só Sistema' :
                             'Divergente'}
                          </span>
                        </td>
                        <td className="p-2 font-medium">{diff.modalidade || '-'}</td>
                        <td className="p-2">{diff.especialidade || '-'}</td>
                        <td className="p-2">{diff.categoria || '-'}</td>
                        <td className="p-2">{diff.prioridade || '-'}</td>
                        <td className={`p-2 ${temQuantidadeDif ? 'bg-red-50 font-medium' : ''}`}>
                          {diff.quantidadeArquivo || '-'} / {diff.quantidadeSistema || '-'}
                        </td>
                        <td className={`p-2 ${temValorDif ? 'bg-red-50 font-medium' : ''}`}>
                          {diff.valorArquivo ? `R$ ${diff.valorArquivo.toFixed(2)}` : '-'} / 
                          {diff.valorSistema ? ` R$ ${diff.valorSistema.toFixed(2)}` : '-'}
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            {temQuantidadeDif && (
                              <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded">Qtd</span>
                            )}
                            {temValorDif && (
                              <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded">Valor</span>
                            )}
                            {!temQuantidadeDif && !temValorDif && (
                              <span className="text-xs text-gray-500">{diff.detalhes}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
