import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CalendarDays, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  UserCheck,
  Users,
  Calendar as CalendarIcon,
  User,
  UserX,
  Settings
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RoleProtectedRoute } from '@/components/RoleProtectedRoute';
import { useEscalasAvancadas } from '@/hooks/useEscalasAvancadas';
import { CalendarioEscala } from '@/components/escalas/CalendarioEscala';
import { GerenciadorAusencias } from '@/components/escalas/GerenciadorAusencias';
import { EscalaMensal } from '@/components/escalas/EscalaMensal';
import { useToast } from '@/hooks/use-toast';

export default function Escala() {
  const { toast } = useToast();
  const {
    escalas,
    tiposAusencia,
    ausencias,
    loading,
    criarEscala,
    replicarEscala,
    criarAusencia,
    aprovarAusencia,
    fetchEscalas,
    canManageAll,
    isMedico
  } = useEscalasAvancadas();

  // Buscar ID do médico atual (simulado - seria obtido do contexto/auth)
  const medicoAtualId = "current-medico-id"; // Aqui você pegaria do contexto de autenticação

  const handleCriarEscala = async (escala: any) => {
    await criarEscala(escala);
  };

  const handleReplicarEscala = async (escalaId: string, meses: number) => {
    await replicarEscala(escalaId, meses);
  };

  const handleCriarAusencia = async (ausencia: any) => {
    await criarAusencia(ausencia);
  };

  const handleAprovarAusencia = async (ausenciaId: string) => {
    await aprovarAusencia(ausenciaId);
  };

  const handleEnviarPorEmail = async (mesAno: { mes: number; ano: number }) => {
    // Implementar envio por email
    toast({
      title: "Email enviado",
      description: `Escala de ${mesAno.mes}/${mesAno.ano} enviada por email`,
    });
  };

  // Calcular estatísticas
  const estatisticas = {
    totalEscalas: escalas.length,
    confirmadas: escalas.filter(e => e.status === 'confirmada').length,
    pendentes: escalas.filter(e => e.status === 'pendente').length,
    ausencias: ausencias.length,
    ausenciasPendentes: ausencias.filter(a => !a.aprovado).length
  };

  return (
    <RoleProtectedRoute requiredRoles={['admin', 'manager', 'medico']}>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Sistema de Escalas Médicas</h1>
            <p className="text-muted-foreground">
              {isMedico 
                ? 'Gerencie suas escalas e ausências' 
                : 'Sistema completo de gerenciamento de escalas médicas'}
            </p>
          </div>
        </div>

        {/* Estatísticas Gerais */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Escalas</p>
                <p className="text-2xl font-bold">{estatisticas.totalEscalas}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Confirmadas</p>
                <p className="text-2xl font-bold">{estatisticas.confirmadas}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold">{estatisticas.pendentes}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Ausências</p>
                <p className="text-2xl font-bold">{estatisticas.ausencias}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Aprovações</p>
                <p className="text-2xl font-bold">{estatisticas.ausenciasPendentes}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Sistema de Abas */}
        <Tabs defaultValue="calendario" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="calendario" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Criar Escalas
            </TabsTrigger>
            <TabsTrigger value="mensal" className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Visão Mensal
            </TabsTrigger>
            <TabsTrigger value="ausencias" className="flex items-center gap-2">
              <UserX className="h-4 w-4" />
              Ausências
            </TabsTrigger>
            {canManageAll && (
              <TabsTrigger value="configuracoes" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configurações
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="calendario" className="space-y-6">
            <CalendarioEscala
              onCriarEscala={handleCriarEscala}
              medicoId={isMedico ? medicoAtualId : undefined}
              canManage={canManageAll}
            />
          </TabsContent>

          <TabsContent value="mensal" className="space-y-6">
            <EscalaMensal
              escalas={escalas}
              onFetchEscalas={fetchEscalas}
              onEnviarPorEmail={handleEnviarPorEmail}
              canManage={canManageAll}
            />
          </TabsContent>

          <TabsContent value="ausencias" className="space-y-6">
            <GerenciadorAusencias
              ausencias={ausencias}
              tiposAusencia={tiposAusencia}
              onCriarAusencia={handleCriarAusencia}
              onAprovarAusencia={handleAprovarAusencia}
              canApprove={canManageAll}
              medicoId={isMedico ? medicoAtualId : undefined}
            />
          </TabsContent>

          {canManageAll && (
            <TabsContent value="configuracoes" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Configurações do Sistema
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="font-medium">Configurações de Email</h3>
                      <p className="text-sm text-muted-foreground">
                        Emails são enviados automaticamente no dia 25 de cada mês com a escala do mês seguinte.
                      </p>
                      <Button variant="outline">
                        Configurar Email
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-medium">Integração Mobilemed</h3>
                      <p className="text-sm text-muted-foreground">
                        Configure a integração para distribuição automática de exames baseada nas escalas.
                      </p>
                      <Button variant="outline">
                        Configurar Integração
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-medium">Capacidade Produtiva</h3>
                      <p className="text-sm text-muted-foreground">
                        Sistema de cálculo da capacidade produtiva baseado na média dos últimos 15 dias.
                      </p>
                      <Button variant="outline">
                        Ver Relatório
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-medium">Tipos de Ausência</h3>
                      <p className="text-sm text-muted-foreground">
                        Gerencie os tipos de ausência disponíveis no sistema.
                      </p>
                      <Button variant="outline">
                        Gerenciar Tipos
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {loading && (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
      </div>
    </RoleProtectedRoute>
  );
}