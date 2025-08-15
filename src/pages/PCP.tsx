import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  BarChart3, 
  Clock, 
  Users, 
  TrendingUp, 
  AlertCircle,
  CheckCircle,
  Calendar,
  Target,
  RefreshCw
} from 'lucide-react';
import { useProducaoMedica } from '@/hooks/useProducaoMedica';
import ProducaoGeral from '@/components/pcp/ProducaoGeral';
import ProducaoMedicos from '@/components/pcp/ProducaoMedicos';
import ProducaoEspecialidades from '@/components/pcp/ProducaoEspecialidades';

const PCP = () => {
  const { data: producaoData, refreshData } = useProducaoMedica();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  // Stats baseados em dados reais
  const stats = [
    {
      title: "Produção Mês Atual",
      value: producaoData.loading ? "..." : producaoData.resumo_geral.total_mes_atual.toLocaleString(),
      description: "Laudos processados",
      icon: BarChart3,
      trend: producaoData.loading ? "..." : `${producaoData.resumo_geral.variacao_mensal >= 0 ? '+' : ''}${producaoData.resumo_geral.variacao_mensal.toFixed(1)}%`,
      color: producaoData.resumo_geral.variacao_mensal >= 0 ? "text-green-600" : "text-red-600"
    },
    {
      title: "Médicos Ativos",
      value: producaoData.loading ? "..." : producaoData.medicos.length.toString(),
      description: "Produzindo",
      icon: Users,
      trend: "",
      color: "text-blue-600"
    },
    {
      title: "Especialidades",
      value: producaoData.loading ? "..." : producaoData.especialidades.length.toString(),
      description: "Ativas",
      icon: Target,
      trend: "",
      color: "text-purple-600"
    },
    {
      title: "Variação Semanal",
      value: producaoData.loading ? "..." : `${producaoData.resumo_geral.variacao_semanal >= 0 ? '+' : ''}${producaoData.resumo_geral.variacao_semanal.toFixed(1)}%`,
      description: "vs semana anterior",
      icon: TrendingUp,
      trend: "",
      color: producaoData.resumo_geral.variacao_semanal >= 0 ? "text-green-600" : "text-red-600"
    }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">PCP - Planejamento e Controle da Produção</h1>
          <p className="text-muted-foreground">Controle e monitoramento da produção de laudos médicos</p>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button>
            <Calendar className="mr-2 h-4 w-4" />
            Relatório Diário
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
                <span className={`ml-2 ${stat.color}`}>{stat.trend}</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="producao" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="producao">Produção</TabsTrigger>
          <TabsTrigger value="pendencias">Pendências</TabsTrigger>
          <TabsTrigger value="qualidade">Qualidade</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="producao" className="space-y-6">
          {producaoData.loading ? (
            <div className="space-y-6">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-96 w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Visão Geral */}
              <ProducaoGeral data={producaoData} />
              
              {/* Tabelas com as três visões */}
              <Tabs defaultValue="medicos" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="medicos">Por Médico</TabsTrigger>
                  <TabsTrigger value="especialidades">Por Especialidade</TabsTrigger>
                  <TabsTrigger value="geral">Visão Geral</TabsTrigger>
                </TabsList>
                
                <TabsContent value="medicos" className="mt-6">
                  <ProducaoMedicos data={producaoData} />
                </TabsContent>
                
                <TabsContent value="especialidades" className="mt-6">
                  <ProducaoEspecialidades data={producaoData} />
                </TabsContent>
                
                <TabsContent value="geral" className="mt-6">
                  <ProducaoGeral data={producaoData} />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </TabsContent>

        <TabsContent value="pendencias" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pendências de Sistema</CardTitle>
              <CardDescription>Monitoramento de pendências operacionais</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma pendência crítica identificada no momento.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qualidade" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Indicadores de Qualidade</CardTitle>
                <CardDescription>Métricas de qualidade dos laudos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Taxa de Aprovação</span>
                  <div className="flex items-center space-x-2">
                    <Progress value={96} className="w-20 h-2" />
                    <span className="text-sm font-medium">96%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span>Revisões Necessárias</span>
                  <div className="flex items-center space-x-2">
                    <Progress value={4} className="w-20 h-2" />
                    <span className="text-sm font-medium">4%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Alertas de Qualidade</CardTitle>
                <CardDescription>Situações que requerem atenção</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm">3 laudos em revisão há mais de 2h</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Meta de qualidade atingida</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="relatorios" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Relatórios Disponíveis</CardTitle>
              <CardDescription>Gere relatórios detalhados da produção</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Button variant="outline" className="h-20 flex flex-col">
                <BarChart3 className="h-6 w-6 mb-2" />
                Produção Diária
              </Button>
              <Button variant="outline" className="h-20 flex flex-col">
                <TrendingUp className="h-6 w-6 mb-2" />
                Tendências
              </Button>
              <Button variant="outline" className="h-20 flex flex-col">
                <Users className="h-6 w-6 mb-2" />
                Desempenho Equipe
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PCP;