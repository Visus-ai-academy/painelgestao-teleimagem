import React, { useState } from 'react';
import { RoleProtectedRoute } from '@/components/RoleProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarIcon, Clock, User, AlertTriangle, CheckCircle, UserCheck } from 'lucide-react';
import { useEscalasMedicasCompleto } from '@/hooks/useEscalasMedicasCompleto';
import { CalendarioEscala } from '@/components/escalas/CalendarioEscala';
import { DialogAusencia } from '@/components/escalas/DialogAusencia';
import { ReplicarEscalaDialog } from '@/components/escalas/ReplicarEscalaDialog';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const EscalaMedica = () => {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [abaSelecionada, setAbaSelecionada] = useState<string>('calendario');
  
  const { 
    escalas, 
    ausencias,
    tiposAusencia,
    configuracao,
    loading, 
    criarEscala,
    replicarEscala,
    criarAusencia,
    aprovarAusencia,
    canManageAll, 
    isMedico 
  } = useEscalasMedicasCompleto();

  const handleCriarEscala = async (data: Date, turno: string, tipo: string) => {
    const novaEscala = {
      medico_id: 'medico-id', // TODO: Buscar do contexto
      data: format(data, 'yyyy-MM-dd'),
      turno,
      tipo_escala: tipo,
      modalidade: 'Raio-X',
      especialidade: 'Radiologia',
      status: 'pendente',
      mes_referencia: data.getMonth() + 1,
      ano_referencia: data.getFullYear(),
      capacidade_maxima_exames: 50,
      preferencias_clientes: [],
      exclusoes_clientes: [],
      dias_semana: [data.getDay()],
    };

    await criarEscala(novaEscala);
  };

  const stats = {
    confirmadas: escalas.filter(e => e.status === 'confirmada').length,
    ausencias: escalas.filter(e => e.status === 'ausencia').length,
    pendentes: escalas.filter(e => e.status === 'pendente').length,
    plantoes: escalas.filter(e => e.turno === 'plantao').length,
  };

  const ausenciasPendentes = ausencias.filter(a => !a.aprovado).length;

  return (
    <RoleProtectedRoute requiredRoles={['admin', 'manager', 'medico']}>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Escalas Médicas</h1>
            <p className="text-muted-foreground">
              Sistema completo de gestão de escalas médicas com permissões baseadas em perfil
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {isMedico && (
              <DialogAusencia
                tiposAusencia={tiposAusencia}
                onCriarAusencia={criarAusencia}
                medicoId="medico-atual-id"
              />
            )}
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Confirmadas</p>
                  <p className="text-2xl font-bold text-green-600">{stats.confirmadas}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Ausências</p>
                  <p className="text-2xl font-bold text-red-600">{stats.ausencias}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pendentes</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pendentes}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {canManageAll ? 'Ausências Pendentes' : 'Plantões'}
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    {canManageAll ? ausenciasPendentes : stats.plantoes}
                  </p>
                </div>
                <UserCheck className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs principais */}
        <Tabs value={abaSelecionada} onValueChange={setAbaSelecionada} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="calendario">
              <CalendarIcon className="h-4 w-4 mr-2" />
              Calendário
            </TabsTrigger>
            <TabsTrigger value="escalas">
              <Clock className="h-4 w-4 mr-2" />
              Escalas
            </TabsTrigger>
            <TabsTrigger value="ausencias">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Ausências
            </TabsTrigger>
            {canManageAll && (
              <TabsTrigger value="gestao">
                <User className="h-4 w-4 mr-2" />
                Gestão
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="calendario">
            <CalendarioEscala
              escalas={escalas}
              onSelecionarData={setSelectedDate}
              onCriarEscala={handleCriarEscala}
              canEdit={canManageAll}
            />
          </TabsContent>

          <TabsContent value="escalas">
            <Card>
              <CardHeader>
                <CardTitle>Lista de Escalas</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {escalas.map((escala) => (
                      <Card key={escala.id} className="border-l-4 border-l-primary">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold">{escala.medico?.nome}</h4>
                              <p className="text-sm text-muted-foreground">
                                {format(parseISO(escala.data), "dd/MM/yyyy", { locale: ptBR })} - 
                                {escala.modalidade} | {escala.especialidade}
                              </p>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Badge>{escala.turno}</Badge>
                              <Badge variant="outline">{escala.status}</Badge>
                              {canManageAll && (
                                <ReplicarEscalaDialog
                                  escala={escala}
                                  configuracao={configuracao}
                                  onReplicar={replicarEscala}
                                />
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ausencias">
            <Card>
              <CardHeader>
                <CardTitle>Gestão de Ausências</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {ausencias.map((ausencia) => (
                    <Card key={ausencia.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold">{ausencia.medico?.nome}</h4>
                            <p className="text-sm text-muted-foreground">
                              {format(parseISO(ausencia.data_inicio), "dd/MM", { locale: ptBR })} - 
                              {format(parseISO(ausencia.data_fim), "dd/MM", { locale: ptBR })}
                            </p>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Badge variant={ausencia.aprovado ? 'default' : 'secondary'}>
                              {ausencia.aprovado ? 'Aprovada' : 'Pendente'}
                            </Badge>
                            {canManageAll && !ausencia.aprovado && (
                              <Button
                                size="sm"
                                onClick={() => aprovarAusencia(ausencia.id, true)}
                              >
                                Aprovar
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {canManageAll && (
            <TabsContent value="gestao">
              <Card>
                <CardHeader>
                  <CardTitle>Configurações</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-muted-foreground">Email automático</p>
                      <p className="text-2xl font-semibold">Dia {configuracao?.dia_envio_email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Capacidade padrão</p>
                      <p className="text-2xl font-semibold">{configuracao?.capacidade_default_exames} exames</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </RoleProtectedRoute>
  );
};

export default EscalaMedica;