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
  ESPECIALIDADE: string;
  MODALIDADE: string;
  MEDICO: string;
  VALORES: number;
  data_referencia: string;
  DATA_REALIZACAO: string;
  DATA_LAUDO: string;
  STATUS: string;
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

export default function VolumetriaMobileMed() {
  const [data, setData] = useState<VolumetriaData[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    empresa: '',
    especialidade: '',
    modalidade: '',
    arquivo_fonte: '',
    data_inicio: '',
    data_fim: ''
  });
  const [empresas, setEmpresas] = useState<string[]>([]);
  const [especialidades, setEspecialidades] = useState<string[]>([]);
  const [modalidades, setModalidades] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
    loadFilterOptions();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Construir query com filtros
      let query = supabase
        .from('volumetria_mobilemed')
        .select('*')
        .order('data_upload', { ascending: false });

      if (filters.empresa) {
        query = query.eq('EMPRESA', filters.empresa);
      }
      if (filters.especialidade) {
        query = query.eq('ESPECIALIDADE', filters.especialidade);
      }
      if (filters.modalidade) {
        query = query.eq('MODALIDADE', filters.modalidade);
      }
      if (filters.arquivo_fonte) {
        query = query.eq('arquivo_fonte', filters.arquivo_fonte);
      }
      if (filters.data_inicio) {
        query = query.gte('data_referencia', filters.data_inicio);
      }
      if (filters.data_fim) {
        query = query.lte('data_referencia', filters.data_fim);
      }

      const { data: volumetriaData, error } = await query.limit(1000);

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

  const applyFilters = () => {
    loadData();
  };

  const clearFilters = () => {
    setFilters({
      empresa: '',
      especialidade: '',
      modalidade: '',
      arquivo_fonte: '',
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
                      <SelectItem value="">Todas as empresas</SelectItem>
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
                      <SelectItem value="">Todas as especialidades</SelectItem>
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
                      <SelectItem value="">Todas as modalidades</SelectItem>
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
                      <SelectItem value="">Todos os tipos</SelectItem>
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
                <Button onClick={applyFilters}>Aplicar Filtros</Button>
                <Button variant="outline" onClick={clearFilters}>Limpar Filtros</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dados">
          <Card>
            <CardHeader>
              <CardTitle>Dados de Volumetria</CardTitle>
              <CardDescription>
                Mostrando {data.length} registros {data.length === 1000 ? '(limitado a 1000)' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Especialidade</TableHead>
                      <TableHead>Modalidade</TableHead>
                      <TableHead>Médico</TableHead>
                      <TableHead>Valores</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Data Ref.</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.EMPRESA}</TableCell>
                        <TableCell>{item.NOME_PACIENTE}</TableCell>
                        <TableCell>{item.ESPECIALIDADE}</TableCell>
                        <TableCell>{item.MODALIDADE}</TableCell>
                        <TableCell>{item.MEDICO}</TableCell>
                        <TableCell className="text-right">{item.VALORES}</TableCell>
                        <TableCell>
                          <Badge variant={item.arquivo_fonte === 'data_laudo' ? 'default' : 'secondary'}>
                            {item.arquivo_fonte === 'data_laudo' ? 'Laudo' : 'Exame'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.data_referencia ? format(parseISO(item.data_referencia), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.STATUS || 'N/A'}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
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