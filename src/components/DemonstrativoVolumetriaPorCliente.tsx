import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileBarChart, Building, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

  // Carregar dados automaticamente quando período mudar
  useEffect(() => {
    if (periodoSelecionado) {
      carregarDemonstrativo(periodoSelecionado);
    }
  }, [periodoSelecionado]);

  const carregarDemonstrativo = async (periodo: string) => {
    if (!periodo) return;

    setLoading(true);
    try {
      console.log('🔄 Carregando demonstrativo de volumetria para:', periodo);

      // Buscar dados agrupados por cliente com todas as combinações
      const { data: volumetriaData, error: volumetriaError } = await supabase
        .from('volumetria_mobilemed')
        .select('EMPRESA, MODALIDADE, ESPECIALIDADE, PRIORIDADE, CATEGORIA, VALORES')
        .eq('periodo_referencia', periodo)
        .not('arquivo_fonte', 'in', '("volumetria_onco_padrao")');

      if (volumetriaError) throw volumetriaError;

      // Agrupar por cliente e combinação de modalidade/especialidade/categoria/prioridade
      const clientesMap = new Map<string, any>();

      volumetriaData?.forEach((item: any) => {
        const clienteNome = item.EMPRESA || 'SEM CLIENTE';
        
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
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 flex-1">
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
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
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
