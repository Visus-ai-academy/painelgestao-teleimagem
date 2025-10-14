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

interface VolumetriaCliente {
  cliente_id: string;
  cliente_nome: string;
  periodo: string;
  total_exames: number;
  total_registros: number;
  detalhes_modalidades: {
    modalidade: string;
    total_exames: number;
    total_registros: number;
  }[];
  detalhes_especialidades: {
    especialidade: string;
    total_exames: number;
    total_registros: number;
  }[];
  detalhes_prioridades: {
    prioridade: string;
    total_exames: number;
    total_registros: number;
  }[];
}

interface ResumoVolumetria {
  total_clientes: number;
  total_exames_geral: number;
  total_registros_geral: number;
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

      // Buscar dados agrupados por cliente
      const { data: volumetriaData, error: volumetriaError } = await supabase
        .from('volumetria_mobilemed')
        .select('EMPRESA, MODALIDADE, ESPECIALIDADE, PRIORIDADE, VALORES')
        .eq('periodo_referencia', periodo)
        .not('arquivo_fonte', 'in', '("volumetria_onco_padrao")');

      if (volumetriaError) throw volumetriaError;

      // Agrupar por cliente
      const clientesMap = new Map<string, any>();

      volumetriaData?.forEach((item: any) => {
        const clienteNome = item.EMPRESA || 'SEM CLIENTE';
        
        if (!clientesMap.has(clienteNome)) {
          clientesMap.set(clienteNome, {
            cliente_nome: clienteNome,
            total_exames: 0,
            total_registros: 0,
            modalidades: new Map<string, { exames: number, registros: number }>(),
            especialidades: new Map<string, { exames: number, registros: number }>(),
            prioridades: new Map<string, { exames: number, registros: number }>()
          });
        }

        const cliente = clientesMap.get(clienteNome);
        const valores = Number(item.VALORES || 0);
        
        cliente.total_exames += valores;
        cliente.total_registros += 1;

        // Modalidades
        const modalidade = item.MODALIDADE || 'SEM MODALIDADE';
        if (!cliente.modalidades.has(modalidade)) {
          cliente.modalidades.set(modalidade, { exames: 0, registros: 0 });
        }
        const modData = cliente.modalidades.get(modalidade);
        modData.exames += valores;
        modData.registros += 1;

        // Especialidades
        const especialidade = item.ESPECIALIDADE || 'SEM ESPECIALIDADE';
        if (!cliente.especialidades.has(especialidade)) {
          cliente.especialidades.set(especialidade, { exames: 0, registros: 0 });
        }
        const espData = cliente.especialidades.get(especialidade);
        espData.exames += valores;
        espData.registros += 1;

        // Prioridades
        const prioridade = item.PRIORIDADE || 'SEM PRIORIDADE';
        if (!cliente.prioridades.has(prioridade)) {
          cliente.prioridades.set(prioridade, { exames: 0, registros: 0 });
        }
        const prioData = cliente.prioridades.get(prioridade);
        prioData.exames += valores;
        prioData.registros += 1;
      });

      // Converter para array e formatar
      const volumetriasFormatadas: VolumetriaCliente[] = Array.from(clientesMap.entries()).map(([clienteNome, dados]) => ({
        cliente_id: clienteNome,
        cliente_nome: clienteNome,
        periodo,
        total_exames: Math.round(dados.total_exames),
        total_registros: dados.total_registros,
        detalhes_modalidades: Array.from(dados.modalidades.entries()).map(([modalidade, valores]) => ({
          modalidade,
          total_exames: Math.round(valores.exames),
          total_registros: valores.registros
        })).sort((a, b) => b.total_exames - a.total_exames),
        detalhes_especialidades: Array.from(dados.especialidades.entries()).map(([especialidade, valores]) => ({
          especialidade,
          total_exames: Math.round(valores.exames),
          total_registros: valores.registros
        })).sort((a, b) => b.total_exames - a.total_exames),
        detalhes_prioridades: Array.from(dados.prioridades.entries()).map(([prioridade, valores]) => ({
          prioridade,
          total_exames: Math.round(valores.exames),
          total_registros: valores.registros
        })).sort((a, b) => b.total_exames - a.total_exames)
      })).sort((a, b) => a.cliente_nome.localeCompare(b.cliente_nome));

      // Calcular resumo
      const totalExamesGeral = volumetriasFormatadas.reduce((acc, v) => acc + v.total_exames, 0);
      const totalRegistrosGeral = volumetriasFormatadas.reduce((acc, v) => acc + v.total_registros, 0);
      const modalidadesUnicas = new Set<string>();
      const especialidadesUnicas = new Set<string>();

      volumetriasFormatadas.forEach(v => {
        v.detalhes_modalidades.forEach(m => modalidadesUnicas.add(m.modalidade));
        v.detalhes_especialidades.forEach(e => especialidadesUnicas.add(e.especialidade));
      });

      const resumoCalculado: ResumoVolumetria = {
        total_clientes: volumetriasFormatadas.length,
        total_exames_geral: totalExamesGeral,
        total_registros_geral: totalRegistrosGeral,
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                <div className="text-2xl font-bold text-purple-600">
                  {formatNumber(resumo.total_registros_geral)}
                </div>
                <div className="text-sm text-muted-foreground">Total Registros</div>
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
                        <div className="text-center">
                          <div className="font-medium">{formatNumber(vol.total_registros)}</div>
                          <div className="text-xs text-muted-foreground">Registros</div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="p-4 border-x border-b rounded-b-lg bg-muted/20">
                      <div className="space-y-6">
                        {/* Detalhes por Modalidade */}
                        <div>
                          <h4 className="font-semibold mb-3 text-sm">Por Modalidade</h4>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Modalidade</TableHead>
                                <TableHead className="text-right">Total Exames</TableHead>
                                <TableHead className="text-right">Total Registros</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {vol.detalhes_modalidades.map((mod, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-medium">{mod.modalidade}</TableCell>
                                  <TableCell className="text-right">{formatNumber(mod.total_exames)}</TableCell>
                                  <TableCell className="text-right">{formatNumber(mod.total_registros)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Detalhes por Especialidade */}
                        <div>
                          <h4 className="font-semibold mb-3 text-sm">Por Especialidade</h4>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Especialidade</TableHead>
                                <TableHead className="text-right">Total Exames</TableHead>
                                <TableHead className="text-right">Total Registros</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {vol.detalhes_especialidades.map((esp, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-medium">{esp.especialidade}</TableCell>
                                  <TableCell className="text-right">{formatNumber(esp.total_exames)}</TableCell>
                                  <TableCell className="text-right">{formatNumber(esp.total_registros)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Detalhes por Prioridade */}
                        <div>
                          <h4 className="font-semibold mb-3 text-sm">Por Prioridade</h4>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Prioridade</TableHead>
                                <TableHead className="text-right">Total Exames</TableHead>
                                <TableHead className="text-right">Total Registros</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {vol.detalhes_prioridades.map((prio, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-medium">{prio.prioridade}</TableCell>
                                  <TableCell className="text-right">{formatNumber(prio.total_exames)}</TableCell>
                                  <TableCell className="text-right">{formatNumber(prio.total_registros)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
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
