import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, FileBarChart, Building, Filter, Download, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as XLSX from 'xlsx';

interface DetalheVolumetria {
  modalidade: string;
  especialidade: string;
  categoria: string;
  prioridade: string;
  quantidade: number;
}

interface VolumetriaCliente {
  cliente_id: string;
  cliente_nome: string;
  periodo: string;
  total_exames: number;
  detalhes_exames: DetalheVolumetria[];
}

interface ResumoVolumetria {
  total_clientes: number;
  total_exames_geral: number;
  total_modalidades: number;
  total_especialidades: number;
}

interface DemonstrativoVolumetriaPorClienteProps {
  periodo: string;
}

export function DemonstrativoVolumetriaPorCliente({ periodo: periodoInicial }: DemonstrativoVolumetriaPorClienteProps) {
  const [loading, setLoading] = useState(false);
  const [volumetrias, setVolumetrias] = useState<VolumetriaCliente[]>([]);
  const [resumo, setResumo] = useState<ResumoVolumetria | null>(null);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [periodosFiltro, setPeriodosFiltro] = useState<string[]>([]);
  const [periodoSelecionado, setPeriodoSelecionado] = useState<string>(periodoInicial || '');
  const [tiposCliente, setTiposCliente] = useState<string[]>([]);
  const [tipoClienteSelecionado, setTipoClienteSelecionado] = useState<string>('todos');
  const { toast } = useToast();

  // Buscar períodos disponíveis
  useEffect(() => {
    const fetchPeriodos = async () => {
      try {
        const { data, error } = await supabase
          .from('volumetria_mobilemed')
          .select('periodo_referencia')
          .not('arquivo_fonte', 'in', '("volumetria_onco_padrao")')
          .not('periodo_referencia', 'is', null);

        if (error) throw error;

        const periodosUnicos = Array.from(new Set(data?.map(d => d.periodo_referencia) || []))
          .filter(p => p)
          .sort()
          .reverse();

        setPeriodosFiltro(periodosUnicos as string[]);
        
        // Se tem período inicial, usar ele, senão usar o primeiro disponível
        if (periodoInicial) {
          setPeriodoSelecionado(periodoInicial);
        } else if (periodosUnicos.length > 0) {
          setPeriodoSelecionado(periodosUnicos[0] as string);
        }
      } catch (error: any) {
        console.error('Erro ao buscar períodos:', error);
      }
    };

    fetchPeriodos();
  }, [periodoInicial]);

  // Buscar tipos de cliente disponíveis
  useEffect(() => {
    const fetchTiposCliente = async () => {
      try {
        const { data, error } = await supabase
          .from('clientes')
          .select('tipo_cliente')
          .not('tipo_cliente', 'is', null);

        if (error) throw error;

        const tiposUnicos = Array.from(new Set(data?.map(d => d.tipo_cliente) || []))
          .filter(t => t)
          .sort();

        setTiposCliente(tiposUnicos as string[]);
      } catch (error: any) {
        console.error('Erro ao buscar tipos de cliente:', error);
      }
    };

    fetchTiposCliente();
  }, []);

  // Carregar dados automaticamente quando período ou tipo de cliente mudar
  useEffect(() => {
    if (periodoSelecionado) {
      carregarDemonstrativo(periodoSelecionado);
    }
  }, [periodoSelecionado, tipoClienteSelecionado]);

  const carregarDemonstrativo = async (periodo: string) => {
    if (!periodo) return;

    setLoading(true);
    try {
      console.log('🔄 Carregando demonstrativo de volumetria para:', periodo);

      // Buscar clientes filtrados por tipo (se selecionado)
      let clientesFiltrados: string[] | null = null;
      if (tipoClienteSelecionado !== 'todos') {
        const { data: clientesData, error: clientesError } = await supabase
          .from('clientes')
          .select('nome_mobilemed, nome')
          .eq('tipo_cliente', tipoClienteSelecionado);

        if (clientesError) throw clientesError;

        clientesFiltrados = clientesData?.map(c => c.nome_mobilemed || c.nome).filter(Boolean) || [];
      }

      // Buscar mapeamento nome_mobilemed -> nome_fantasia
      const { data: mapData, error: mapError } = await supabase
        .from('clientes')
        .select('nome_mobilemed, nome_fantasia')
        .not('nome_mobilemed', 'is', null)
        .not('nome_fantasia', 'is', null);

      if (mapError) throw mapError;

      const nomeMap = new Map<string, string>();
      mapData?.forEach((c: any) => {
        const key = String(c.nome_mobilemed || '').trim().toUpperCase();
        const val = String(c.nome_fantasia || '').trim();
        if (key && val) nomeMap.set(key, val);
      });

      // Buscar dados agrupados por cliente com todas as combinações
      let query = supabase
        .from('volumetria_mobilemed')
        .select('EMPRESA, MODALIDADE, ESPECIALIDADE, PRIORIDADE, CATEGORIA, VALORES, unidade_origem')
        .eq('periodo_referencia', periodo)
        .not('arquivo_fonte', 'in', '("volumetria_onco_padrao")');

      // Aplicar filtro de clientes se necessário
      if (clientesFiltrados && clientesFiltrados.length > 0) {
        query = query.in('EMPRESA', clientesFiltrados);
      }

      const { data: volumetriaData, error: volumetriaError } = await query;

      if (volumetriaError) throw volumetriaError;

      // Agrupar por cliente e combinação de modalidade/especialidade/categoria/prioridade
      const clientesMap = new Map<string, any>();

      volumetriaData?.forEach((item: any) => {
        const empresaBase = item.EMPRESA || 'SEM CLIENTE';
        const origemKey = String(item.unidade_origem || empresaBase || '').trim().toUpperCase();
        const clienteNome = nomeMap.get(origemKey) || empresaBase || 'SEM CLIENTE';
        
        if (!clientesMap.has(clienteNome)) {
          clientesMap.set(clienteNome, {
            cliente_nome: clienteNome,
            total_exames: 0,
            detalhes: new Map<string, DetalheVolumetria>()
          });
        }

        const cliente = clientesMap.get(clienteNome);
        const valores = Number(item.VALORES || 0);
        
        cliente.total_exames += valores;

        // Criar chave única para a combinação
        const modalidade = item.MODALIDADE || 'SEM MODALIDADE';
        const especialidade = item.ESPECIALIDADE || 'SEM ESPECIALIDADE';
        const categoria = item.CATEGORIA || 'SEM CATEGORIA';
        const prioridade = item.PRIORIDADE || 'SEM PRIORIDADE';
        const chave = `${modalidade}|${especialidade}|${categoria}|${prioridade}`;

        if (!cliente.detalhes.has(chave)) {
          cliente.detalhes.set(chave, {
            modalidade,
            especialidade,
            categoria,
            prioridade,
            quantidade: 0
          });
        }
        
        const detalhe = cliente.detalhes.get(chave);
        detalhe.quantidade += valores;
      });

      // Converter para array e formatar
      const volumetriasFormatadas: VolumetriaCliente[] = Array.from(clientesMap.entries()).map(([clienteNome, dados]) => ({
        cliente_id: clienteNome,
        cliente_nome: clienteNome,
        periodo,
        total_exames: Math.round(dados.total_exames),
        detalhes_exames: Array.from(dados.detalhes.values())
          .map((d: DetalheVolumetria) => ({
            modalidade: d.modalidade,
            especialidade: d.especialidade,
            categoria: d.categoria,
            prioridade: d.prioridade,
            quantidade: Math.round(d.quantidade)
          }))
          .sort((a, b) => b.quantidade - a.quantidade)
      })).sort((a, b) => a.cliente_nome.localeCompare(b.cliente_nome));

      // Calcular resumo
      const totalExamesGeral = volumetriasFormatadas.reduce((acc, v) => acc + v.total_exames, 0);
      const modalidadesUnicas = new Set<string>();
      const especialidadesUnicas = new Set<string>();

      volumetriasFormatadas.forEach(v => {
        v.detalhes_exames.forEach(d => {
          modalidadesUnicas.add(d.modalidade);
          especialidadesUnicas.add(d.especialidade);
        });
      });

      const resumoCalculado: ResumoVolumetria = {
        total_clientes: volumetriasFormatadas.length,
        total_exames_geral: totalExamesGeral,
        total_modalidades: modalidadesUnicas.size,
        total_especialidades: especialidadesUnicas.size
      };

      setVolumetrias(volumetriasFormatadas);
      setResumo(resumoCalculado);
    } catch (error: any) {
      console.error('❌ Erro ao carregar demonstrativo:', error);
      toast({
        title: 'Erro ao carregar demonstrativo',
        description: error.message || 'Erro desconhecido',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleClientExpansion = (clienteId: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clienteId)) {
      newExpanded.delete(clienteId);
    } else {
      newExpanded.add(clienteId);
    }
    setExpandedClients(newExpanded);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  const exportarRelatorioGeral = () => {
    if (volumetrias.length === 0) {
      toast({
        title: 'Sem dados para exportar',
        description: 'Não há dados disponíveis para exportação',
        variant: 'destructive'
      });
      return;
    }

    // Preparar dados para exportação
    const dadosExportacao = volumetrias.flatMap(vol => 
      vol.detalhes_exames.map(detalhe => ({
        'Cliente': vol.cliente_nome,
        'Modalidade': detalhe.modalidade,
        'Especialidade': detalhe.especialidade,
        'Categoria': detalhe.categoria,
        'Prioridade': detalhe.prioridade,
        'Quantidade': detalhe.quantidade
      }))
    );

    // Criar workbook e worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dadosExportacao);

    // Adicionar worksheet ao workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Volumetria Geral');

    // Gerar arquivo
    const fileName = `Volumetria_Geral_${periodoSelecionado.replace('/', '-')}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast({
      title: 'Relatório exportado',
      description: 'Relatório geral exportado com sucesso'
    });
  };

  const exportarRelatorioPorCliente = () => {
    if (volumetrias.length === 0) {
      toast({
        title: 'Sem dados para exportar',
        description: 'Não há dados disponíveis para exportação',
        variant: 'destructive'
      });
      return;
    }

    // Preparar dados - uma linha por cliente com total
    const dadosExportacao = volumetrias.map(vol => ({
      'Cliente': vol.cliente_nome,
      'Total de Exames': vol.total_exames
    }));

    // Criar workbook e worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dadosExportacao);

    // Adicionar worksheet ao workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Volumetria por Cliente');

    // Gerar arquivo
    const fileName = `Volumetria_Por_Cliente_${periodoSelecionado.replace('/', '-')}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast({
      title: 'Relatório exportado',
      description: `${volumetrias.length} cliente(s) exportado(s) com sucesso`
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileBarChart className="h-5 w-5" />
            Demonstrativo de Volumetria por Cliente
          </CardTitle>
          <CardDescription>
            Visualize a distribuição de exames por cliente, modalidade, especialidade e prioridade
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={periodoSelecionado} onValueChange={setPeriodoSelecionado}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  {periodosFiltro.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <Select value={tipoClienteSelecionado} onValueChange={setTipoClienteSelecionado}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Tipo de Cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Tipos</SelectItem>
                  {tiposCliente.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {tipo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Button 
                variant="outline" 
                size="sm"
                onClick={exportarRelatorioGeral}
                disabled={loading || volumetrias.length === 0}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Relatório Geral
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={exportarRelatorioPorCliente}
                disabled={loading || volumetrias.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Por Cliente
              </Button>
            </div>

            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </CardContent>
      </Card>

      {resumo && periodoSelecionado && (
        <Card>
          <CardHeader>
            <CardTitle>Resumo Geral - {periodoSelecionado}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {resumo.total_clientes}
                </div>
                <div className="text-sm text-muted-foreground">Clientes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {formatNumber(resumo.total_exames_geral)}
                </div>
                <div className="text-sm text-muted-foreground">Total Exames</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {resumo.total_modalidades}
                </div>
                <div className="text-sm text-muted-foreground">Modalidades</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {resumo.total_especialidades}
                </div>
                <div className="text-sm text-muted-foreground">Especialidades</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {volumetrias.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Volumetria por Cliente</CardTitle>
            <CardDescription>
              Clique em um cliente para ver os detalhes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {volumetrias.map((vol) => (
                <Collapsible key={vol.cliente_id}>
                  <CollapsibleTrigger 
                    className="w-full"
                    onClick={() => toggleClientExpansion(vol.cliente_id)}
                  >
                    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        {expandedClients.has(vol.cliente_id) ? 
                          <ChevronDown className="h-4 w-4" /> : 
                          <ChevronRight className="h-4 w-4" />
                        }
                        <Building className="h-4 w-4" />
                        <span className="font-medium">{vol.cliente_nome}</span>
                      </div>
                      
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <div className="font-medium">{formatNumber(vol.total_exames)}</div>
                          <div className="text-xs text-muted-foreground">Exames</div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="p-4 border-x border-b rounded-b-lg bg-muted/20">
                      {/* Detalhamento por Modalidade/Especialidade/Categoria/Prioridade */}
                      {vol.detalhes_exames.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-3 text-sm flex items-center gap-2">
                            <FileBarChart className="h-4 w-4" />
                            Detalhamento por Modalidade/Especialidade
                          </h4>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Modalidade</TableHead>
                                <TableHead>Especialidade</TableHead>
                                <TableHead>Categoria</TableHead>
                                <TableHead>Prioridade</TableHead>
                                <TableHead className="text-right">Qtd</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {vol.detalhes_exames.map((item, index) => (
                                <TableRow key={index}>
                                  <TableCell>{item.modalidade}</TableCell>
                                  <TableCell>{item.especialidade}</TableCell>
                                  <TableCell>{item.categoria}</TableCell>
                                  <TableCell>{item.prioridade}</TableCell>
                                  <TableCell className="text-right font-medium">
                                    {formatNumber(item.quantidade)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
