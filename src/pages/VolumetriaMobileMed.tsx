import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Calendar, FileText, TrendingUp, Users, Building2, Stethoscope } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface VolumetriaData {
  id: string;
  arquivo_fonte: string;
  EMPRESA: string;
  NOME_PACIENTE: string;
  CODIGO_PACIENTE: string;
  ESTUDO_DESCRICAO: string;
  ACCESSION_NUMBER: string;
  ESPECIALIDADE: string;
  MODALIDADE: string;
  MEDICO: string;
  PRIORIDADE: string;
  VALORES: number;
  STATUS: string;
  DATA_REALIZACAO: string;
  HORA_REALIZACAO: string;
  DATA_LAUDO: string;
  HORA_LAUDO: string;
  data_upload: string;
}

interface Stats {
  total_registros: number;
  total_empresas: number;
  total_especialidades: number;
  total_modalidades: number;
  total_medicos: number;
  total_valores: number;
}

interface FilteredStats {
  total_registros: number;
  total_valores: number;
  empresas_filtradas: number;
  especialidades_filtradas: number;
  modalidades_filtradas: number;
}

export default function VolumetriaMobileMed() {
  const [data, setData] = useState<VolumetriaData[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filteredStats, setFilteredStats] = useState<FilteredStats | null>(null);
  const [loading, setLoading] = useState(false); // Não iniciar carregando
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [filters, setFilters] = useState({
    empresa: '__all__',
    especialidade: '__all__',
    modalidade: '__all__',
    arquivo_fonte: '__all__',
    data_inicio: '',
    data_fim: ''
  });
  const [empresas, setEmpresas] = useState<string[]>([]);
  const [especialidades, setEspecialidades] = useState<string[]>([]);
  const [modalidades, setModalidades] = useState<string[]>([]);
  const { toast } = useToast();
  
  // Carregamento inicial apenas das opções de filtro
  useEffect(() => {
    loadFilterOptions();
    loadStats(); // Carregar stats iniciais
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Construir query com filtros - selecionando apenas campos necessários para performance
      let query = supabase
        .from('volumetria_mobilemed')
        .select(`
          id, arquivo_fonte, EMPRESA, NOME_PACIENTE, CODIGO_PACIENTE, 
          ESTUDO_DESCRICAO, ACCESSION_NUMBER, ESPECIALIDADE, MODALIDADE, 
          MEDICO, PRIORIDADE, VALORES, STATUS, DATA_REALIZACAO, 
          HORA_REALIZACAO, DATA_LAUDO, HORA_LAUDO, data_upload
        `)
        .order('data_upload', { ascending: false });

      if (filters.empresa && filters.empresa !== '__all__') {
        query = query.eq('EMPRESA', filters.empresa);
      }
      if (filters.especialidade && filters.especialidade !== '__all__') {
        query = query.eq('ESPECIALIDADE', filters.especialidade);
      }
      if (filters.modalidade && filters.modalidade !== '__all__') {
        query = query.eq('MODALIDADE', filters.modalidade);
      }
      if (filters.arquivo_fonte && filters.arquivo_fonte !== '__all__') {
        query = query.eq('arquivo_fonte', filters.arquivo_fonte);
      }
      if (filters.data_inicio) {
        if (filters.arquivo_fonte === 'data_laudo') {
          query = query.gte('DATA_LAUDO', filters.data_inicio);
        } else {
          query = query.gte('DATA_REALIZACAO', filters.data_inicio);
        }
      }
      if (filters.data_fim) {
        if (filters.arquivo_fonte === 'data_laudo') {
          query = query.lte('DATA_LAUDO', filters.data_fim);
        } else {
          query = query.lte('DATA_REALIZACAO', filters.data_fim);
        }
      }

      const { data: volumetriaData, error } = await query.limit(500); // Reduzindo para 500 para melhor performance

      if (error) throw error;

      setData(volumetriaData || []);

      // Carregar estatísticas
      await loadStats();

    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      // Calcular estatísticas manualmente
      const { data: allData, error: dataError } = await supabase
        .from('volumetria_mobilemed')
        .select('EMPRESA, ESPECIALIDADE, MODALIDADE, MEDICO, VALORES');

      if (dataError) throw dataError;

      const empresasUnicas = new Set(allData?.map(d => d.EMPRESA).filter(Boolean));
      const especialidadesUnicas = new Set(allData?.map(d => d.ESPECIALIDADE).filter(Boolean));
      const modalidadesUnicas = new Set(allData?.map(d => d.MODALIDADE).filter(Boolean));
      const medicosUnicos = new Set(allData?.map(d => d.MEDICO).filter(Boolean));
      const totalValores = allData?.reduce((sum, d) => sum + (d.VALORES || 0), 0) || 0;

      setStats({
        total_registros: allData?.length || 0,
        total_empresas: empresasUnicas.size,
        total_especialidades: especialidadesUnicas.size,
        total_modalidades: modalidadesUnicas.size,
        total_medicos: medicosUnicos.size,
        total_valores: totalValores
      });
    } catch (error: any) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const loadFilterOptions = async () => {
    try {
      const { data: volumetriaData, error } = await supabase
        .from('volumetria_mobilemed')
        .select('EMPRESA, ESPECIALIDADE, MODALIDADE');

      if (error) throw error;

      const empresasUnicas = [...new Set(volumetriaData?.map(d => d.EMPRESA).filter(Boolean))].sort();
      const especialidadesUnicas = [...new Set(volumetriaData?.map(d => d.ESPECIALIDADE).filter(Boolean))].sort();
      const modalidadesUnicas = [...new Set(volumetriaData?.map(d => d.MODALIDADE).filter(Boolean))].sort();

      setEmpresas(empresasUnicas);
      setEspecialidades(especialidadesUnicas);
      setModalidades(modalidadesUnicas);

    } catch (error: any) {
      console.error('Erro ao carregar opções de filtro:', error);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = async () => {
    setLoadingFilters(true);
    await loadData();
    setLoadingFilters(false);
  };

  const clearFilters = () => {
    setFilters({
      empresa: '__all__',
      especialidade: '__all__',
      modalidade: '__all__',
      arquivo_fonte: '__all__',
      data_inicio: '',
      data_fim: ''
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Carregando dados de volumetria...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Volumetria MobileMed</h1>
          <p className="text-muted-foreground">
            Análise dos dados de volumetria importados
          </p>
        </div>
      </div>

      {/* Estatísticas Resumidas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Registros</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_registros.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Empresas</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_empresas}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Especialidades</CardTitle>
              <Stethoscope className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_especialidades}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Modalidades</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_modalidades}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Médicos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_medicos}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Exames</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_valores.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="dados" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="filtros">Filtros</TabsTrigger>
        </TabsList>

        <TabsContent value="filtros">
          <Card>
            <CardHeader>
              <CardTitle>Filtros de Pesquisa</CardTitle>
              <CardDescription>
                Use os filtros abaixo para refinar a visualização dos dados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="empresa">Empresa</Label>
                  <Select value={filters.empresa} onValueChange={(value) => handleFilterChange('empresa', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todas as empresas</SelectItem>
                      {empresas.map(empresa => (
                        <SelectItem key={empresa} value={empresa}>{empresa}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="especialidade">Especialidade</Label>
                  <Select value={filters.especialidade} onValueChange={(value) => handleFilterChange('especialidade', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a especialidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todas as especialidades</SelectItem>
                      {especialidades.map(esp => (
                        <SelectItem key={esp} value={esp}>{esp}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="modalidade">Modalidade</Label>
                  <Select value={filters.modalidade} onValueChange={(value) => handleFilterChange('modalidade', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a modalidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todas as modalidades</SelectItem>
                      {modalidades.map(mod => (
                        <SelectItem key={mod} value={mod}>{mod}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="arquivo_fonte">Tipo de Arquivo</Label>
                  <Select value={filters.arquivo_fonte} onValueChange={(value) => handleFilterChange('arquivo_fonte', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos os tipos</SelectItem>
                      <SelectItem value="data_laudo">Data Laudo</SelectItem>
                      <SelectItem value="data_exame">Data Exame</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="data_inicio">Data Início</Label>
                  <Input
                    type="date"
                    value={filters.data_inicio}
                    onChange={(e) => handleFilterChange('data_inicio', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="data_fim">Data Fim</Label>
                  <Input
                    type="date"
                    value={filters.data_fim}
                    onChange={(e) => handleFilterChange('data_fim', e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={applyFilters} 
                  disabled={loadingFilters}
                >
                  {loadingFilters ? 'Carregando...' : 'Aplicar Filtros'}
                </Button>
                <Button variant="outline" onClick={clearFilters} disabled={loadingFilters}>
                  Limpar Filtros
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dados">
          <Card>
            <CardHeader>
              <CardTitle>Dados de Volumetria</CardTitle>
              <CardDescription>
                Mostrando {data.length} registros {data.length === 500 ? '(limitado a 500 para melhor performance)' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Código Paciente</TableHead>
                      <TableHead>Accession Number</TableHead>
                      <TableHead>Especialidade</TableHead>
                      <TableHead>Modalidade</TableHead>
                      <TableHead>Médico</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead className="text-right">Valores</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data Realização</TableHead>
                      <TableHead>Data Laudo</TableHead>
                      <TableHead>Tipo Arquivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.length === 0 && !loadingFilters ? (
                      <TableRow>
                        <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                          {Object.values(filters).some(f => f !== '__all__' && f !== '') 
                            ? 'Nenhum resultado encontrado com os filtros aplicados. Tente ajustar os filtros.'
                            : 'Clique em "Aplicar Filtros" para carregar os dados.'
                          }
                        </TableCell>
                      </TableRow>
                    ) : loadingFilters ? (
                      <TableRow>
                        <TableCell colSpan={13} className="text-center py-8">
                          Carregando dados...
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.EMPRESA}</TableCell>
                          <TableCell>{item.NOME_PACIENTE}</TableCell>
                          <TableCell>{item.CODIGO_PACIENTE || '-'}</TableCell>
                          <TableCell>{item.ACCESSION_NUMBER || '-'}</TableCell>
                          <TableCell>{item.ESPECIALIDADE}</TableCell>
                          <TableCell>{item.MODALIDADE}</TableCell>
                          <TableCell>{item.MEDICO}</TableCell>
                          <TableCell>{item.PRIORIDADE || '-'}</TableCell>
                          <TableCell className="text-right">{item.VALORES?.toLocaleString() || 0}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.STATUS || 'N/A'}</Badge>
                          </TableCell>
                          <TableCell>
                            {item.DATA_REALIZACAO ? format(parseISO(item.DATA_REALIZACAO), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                          </TableCell>
                          <TableCell>
                            {item.DATA_LAUDO ? format(parseISO(item.DATA_LAUDO), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={item.arquivo_fonte === 'data_laudo' ? 'default' : 'secondary'}>
                              {item.arquivo_fonte === 'data_laudo' ? 'Data Laudo' : 'Data Exame'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}