import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart3, 
  Clock, 
  Users, 
  TrendingUp, 
  AlertCircle,
  CheckCircle,
  Calendar,
  Target
} from 'lucide-react';

const PCP = () => {
  const stats = [
    {
      title: "Produção do Dia",
      value: "1,234",
      description: "Laudos processados",
      icon: BarChart3,
      trend: "+12%",
      color: "text-green-600"
    },
    {
      title: "Tempo Médio",
      value: "2.4h",
      description: "Por laudo",
      icon: Clock,
      trend: "-5%",
      color: "text-blue-600"
    },
    {
      title: "Médicos Ativos",
      value: "48",
      description: "Online agora",
      icon: Users,
      trend: "+3",
      color: "text-purple-600"
    },
    {
      title: "Meta do Mês",
      value: "87%",
      description: "Atingida",
      icon: Target,
      trend: "+2%",
      color: "text-orange-600"
    }
  ];

  const pendingTasks = [
    { id: 1, cliente: "Hospital A", exames: 15, prazo: "2h", prioridade: "Alta" },
    { id: 2, cliente: "Clínica B", exames: 8, prazo: "4h", prioridade: "Média" },
    { id: 3, cliente: "Hospital C", exames: 23, prazo: "6h", prioridade: "Baixa" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">PCP - Planejamento e Controle da Produção</h1>
          <p className="text-muted-foreground">Controle e monitoramento da produção de laudos</p>
        </div>
        <Button>
          <Calendar className="mr-2 h-4 w-4" />
          Relatório Diário
        </Button>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Produção por Modalidade</CardTitle>
                <CardDescription>Laudos processados hoje por tipo de exame</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Raio-X</span>
                    <span>45%</span>
                  </div>
                  <Progress value={45} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Tomografia</span>
                    <span>30%</span>
                  </div>
                  <Progress value={30} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Ressonância</span>
                    <span>25%</span>
                  </div>
                  <Progress value={25} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Desempenho da Equipe</CardTitle>
                <CardDescription>Produtividade dos médicos hoje</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Dr. Silva</span>
                    </div>
                    <Badge variant="secondary">45 laudos</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Dra. Santos</span>
                    </div>
                    <Badge variant="secondary">38 laudos</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-yellow-500" />
                      <span>Dr. Costa</span>
                    </div>
                    <Badge variant="secondary">12 laudos</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pendencias" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tarefas Pendentes</CardTitle>
              <CardDescription>Exames aguardando processamento</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="font-medium">{task.cliente}</div>
                      <div className="text-sm text-muted-foreground">
                        {task.exames} exames • Prazo: {task.prazo}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={
                        task.prioridade === 'Alta' ? 'destructive' :
                        task.prioridade === 'Média' ? 'default' : 'secondary'
                      }>
                        {task.prioridade}
                      </Badge>
                      <Button size="sm">Processar</Button>
                    </div>
                  </div>
                ))}
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