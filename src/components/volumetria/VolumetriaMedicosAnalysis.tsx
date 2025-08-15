import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { User, Activity, TrendingUp, Users, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface MedicoData {
  nome: string;
  total_exames: number;
  total_registros: number;
  percentual: number;
  detalhes?: {
    modalidades: { [key: string]: { exames: number; registros: number } };
    especialidades: { [key: string]: { exames: number; registros: number } };
    prioridades?: { [key: string]: { exames: number; registros: number } };
    categorias?: { [key: string]: { exames: number; registros: number } };
  };
}

interface SegmentData {
  nome: string;
  total_exames: number;
  total_registros: number;
  percentual: number;
  total_medicos: number;
}

interface VolumetriaMedicosAnalysisProps {
  medicos: MedicoData[];
  modalidades: SegmentData[];
  especialidades: SegmentData[];
  categorias: SegmentData[];
  prioridades: SegmentData[];
  totalExames: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C', '#8DD1E1', '#D084D0'];

export function VolumetriaMedicosAnalysis({ 
  medicos, 
  modalidades, 
  especialidades, 
  categorias, 
  prioridades, 
  totalExames 
}: VolumetriaMedicosAnalysisProps) {
  const [expandedMedicos, setExpandedMedicos] = useState<Set<string>>(new Set());
  
  const formatPercentual = (valor: number | undefined) => {
    if (valor === undefined || valor === null || isNaN(valor)) return '0.0%';
    return `${valor.toFixed(1)}%`;
  };

  const getPerformanceBadge = (percentual: number) => {
    if (percentual >= 10) return <Badge variant="default" className="bg-green-500">Alto Volume</Badge>;
    if (percentual >= 5) return <Badge variant="default" className="bg-blue-500">Médio Volume</Badge>;
    if (percentual >= 1) return <Badge variant="default" className="bg-yellow-500">Baixo Volume</Badge>;
    return <Badge variant="outline">Mínimo</Badge>;
  };

  const toggleMedicoExpansion = (medicoNome: string) => {
    const newExpanded = new Set(expandedMedicos);
    if (newExpanded.has(medicoNome)) {
      newExpanded.delete(medicoNome);
    } else {
      newExpanded.add(medicoNome);
    }
    setExpandedMedicos(newExpanded);
  };

  const topMedicos = medicos.slice(0, 10);
  const topModalidades = modalidades.slice(0, 8);
  const topEspecialidades = especialidades.slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Métricas Principais dos Médicos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Médicos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{medicos.length}</div>
            <p className="text-xs text-muted-foreground">
              Médicos ativos no período
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maior Volume</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{medicos[0]?.total_exames.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              {medicos[0]?.nome || 'N/A'} - {formatPercentual(medicos[0]?.percentual || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média por Médico</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {medicos.length > 0 ? Math.round(totalExames / medicos.length).toLocaleString() : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Exames por médico
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top 10 Concentram</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercentual(topMedicos.reduce((acc, m) => acc + m.percentual, 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              Do volume total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs para diferentes visualizações */}
      <Tabs defaultValue="medicos" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="medicos">Médicos</TabsTrigger>
          <TabsTrigger value="modalidades">Modalidades</TabsTrigger>
          <TabsTrigger value="especialidades">Especialidades</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="prioridades">Prioridades</TabsTrigger>
        </TabsList>

        {/* Tab dos Médicos */}
        <TabsContent value="medicos" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de Barras - Top 10 Médicos */}
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Médicos por Volume</CardTitle>
                <CardDescription>Distribuição de exames realizados</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topMedicos} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="nome" 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      fontSize={10}
                    />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        `${value.toLocaleString()} exames`,
                        'Volume'
                      ]}
                      labelFormatter={(label) => `Dr(a). ${label}`}
                    />
                    <Bar dataKey="total_exames" fill="#0088FE" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gráfico de Pizza - Concentração */}
            <Card>
              <CardHeader>
                <CardTitle>Concentração de Volume</CardTitle>
                <CardDescription>Percentual de participação no total</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={topMedicos}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ nome, percentual }) => `${nome.split(' ')[0]} ${formatPercentual(percentual)}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="percentual"
                    >
                      {topMedicos.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [`${formatPercentual(value)}`, 'Participação']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Tabela Detalhada dos Médicos com Expansão */}
          <Card>
            <CardHeader>
              <CardTitle>Ranking Completo de Médicos</CardTitle>
              <CardDescription>Volume de exames e participação percentual - Clique para ver detalhes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96 overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Médico</TableHead>
                      <TableHead className="text-right">Exames</TableHead>
                      <TableHead className="text-right">Registros</TableHead>
                      <TableHead className="text-right">% do Total</TableHead>
                      <TableHead className="text-center">Categoria</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {medicos.map((medico, index) => (
                      <>
                        <TableRow key={medico.nome} className="cursor-pointer hover:bg-muted/50">
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleMedicoExpansion(medico.nome)}
                              className="p-0 h-6 w-6"
                            >
                              {expandedMedicos.has(medico.nome) ? 
                                <ChevronDown className="h-4 w-4" /> : 
                                <ChevronRight className="h-4 w-4" />
                              }
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell className="font-medium">{medico.nome}</TableCell>
                          <TableCell className="text-right">{medico.total_exames.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{medico.total_registros.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{formatPercentual(medico.percentual)}</TableCell>
                          <TableCell className="text-center">{getPerformanceBadge(medico.percentual)}</TableCell>
                        </TableRow>
                        
                        {/* Linha expandida com detalhes */}
                        {expandedMedicos.has(medico.nome) && medico.detalhes && (
                          <TableRow key={`${medico.nome}-details`}>
                            <TableCell colSpan={7} className="p-4 bg-muted/20">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                {/* Modalidades */}
                                <div className="min-w-0">
                                  <h4 className="font-semibold mb-2 text-sm">Por Modalidade</h4>
                                  <div className="space-y-1">
                                    {Object.entries(medico.detalhes.modalidades).map(([modalidade, data]) => (
                                      <div key={modalidade} className="flex justify-between text-xs">
                                        <span className="text-muted-foreground truncate mr-2">{modalidade}</span>
                                        <span className="font-medium text-nowrap">{data.exames.toLocaleString()}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                
                                {/* Especialidades */}
                                <div className="min-w-0">
                                  <h4 className="font-semibold mb-2 text-sm">Por Especialidade</h4>
                                  <div className="space-y-1">
                                    {Object.entries(medico.detalhes.especialidades).map(([especialidade, data]) => (
                                      <div key={especialidade} className="flex justify-between text-xs">
                                        <span className="text-muted-foreground truncate mr-2">{especialidade}</span>
                                        <span className="font-medium text-nowrap">{data.exames.toLocaleString()}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Prioridades */}
                                <div className="min-w-0">
                                  <h4 className="font-semibold mb-2 text-sm">Por Prioridade</h4>
                                  <div className="space-y-1">
                                    {Object.entries(medico.detalhes.prioridades || {}).map(([prioridade, data]) => (
                                      <div key={prioridade} className="flex justify-between text-xs">
                                        <span className="text-muted-foreground truncate mr-2">{prioridade}</span>
                                        <span className="font-medium text-nowrap">{data.exames.toLocaleString()}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Categorias */}
                                <div className="min-w-0">
                                  <h4 className="font-semibold mb-2 text-sm">Por Categoria</h4>
                                  <div className="space-y-1">
                                    {Object.entries(medico.detalhes.categorias || {}).map(([categoria, data]) => (
                                      <div key={categoria} className="flex justify-between text-xs">
                                        <span className="text-muted-foreground truncate mr-2">{categoria}</span>
                                        <span className="font-medium text-nowrap">{data.exames.toLocaleString()}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab das Modalidades */}
        <TabsContent value="modalidades" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Distribuição por Modalidade</CardTitle>
                <CardDescription>Volume de exames por modalidade</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topModalidades}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nome" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="total_exames" fill="#00C49F" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tabela - Modalidades</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80 overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead>Modalidade</TableHead>
                        <TableHead className="text-right">Exames</TableHead>
                        <TableHead className="text-right">Médicos</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {modalidades.map((item) => (
                        <TableRow key={item.nome}>
                          <TableCell>{item.nome}</TableCell>
                          <TableCell className="text-right">{item.total_exames.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{item.total_medicos}</TableCell>
                          <TableCell className="text-right">{formatPercentual(item.percentual)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab das Especialidades */}
        <TabsContent value="especialidades" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Distribuição por Especialidade</CardTitle>
                <CardDescription>Volume de exames por especialidade</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topEspecialidades}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nome" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="total_exames" fill="#FFBB28" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tabela - Especialidades</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80 overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead>Especialidade</TableHead>
                        <TableHead className="text-right">Exames</TableHead>
                        <TableHead className="text-right">Médicos</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {especialidades.map((item) => (
                        <TableRow key={item.nome}>
                          <TableCell>{item.nome}</TableCell>
                          <TableCell className="text-right">{item.total_exames.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{item.total_medicos}</TableCell>
                          <TableCell className="text-right">{formatPercentual(item.percentual)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab das Categorias */}
        <TabsContent value="categorias" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Distribuição por Categoria</CardTitle>
                <CardDescription>Volume de exames por categoria</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categorias}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nome" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="total_exames" fill="#FF8042" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tabela - Categorias</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80 overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Exames</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categorias.map((item) => (
                        <TableRow key={item.nome}>
                          <TableCell>{item.nome}</TableCell>
                          <TableCell className="text-right">{item.total_exames.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{formatPercentual(item.percentual)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab das Prioridades */}
        <TabsContent value="prioridades" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Distribuição por Prioridade</CardTitle>
                <CardDescription>Volume de exames por prioridade</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={prioridades}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nome" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="total_exames" fill="#8884D8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tabela - Prioridades</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80 overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead>Prioridade</TableHead>
                        <TableHead className="text-right">Exames</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {prioridades.map((item) => (
                        <TableRow key={item.nome}>
                          <TableCell>{item.nome}</TableCell>
                          <TableCell className="text-right">{item.total_exames.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{formatPercentual(item.percentual)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}