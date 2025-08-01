import React, { useState } from 'react';
import { RoleProtectedRoute } from '@/components/RoleProtectedRoute';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarioEscalas } from '@/components/escalas/CalendarioEscalas';
import { ReplicadorEscalas } from '@/components/escalas/ReplicadorEscalas';
import { useEscalasMedicasCompleta } from '@/hooks/useEscalasMedicasCompleta';
import { Calendar, Copy, Settings } from 'lucide-react';

export default function EscalasMedicas() {
  const {
    escalas,
    ausencias,
    tiposAusencia,
    configuracao,
    loading,
    criarEscala,
    replicarEscala,
    informarAusencia,
    aprovarAusencia,
    confirmarEscala,
    canManageAll,
    isMedico
  } = useEscalasMedicasCompleta();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p>Carregando escalas...</p>
        </div>
      </div>
    );
  }

  return (
    <RoleProtectedRoute requiredRoles={['admin', 'manager', 'medico']}>
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Escalas Médicas</h1>
          <p className="text-muted-foreground">
            Gerencie escalas, ausências e plantões médicos
          </p>
        </div>

        <Tabs defaultValue="calendario" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="calendario" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Calendário
            </TabsTrigger>
            <TabsTrigger value="replicacao" className="flex items-center gap-2">
              <Copy className="h-4 w-4" />
              Replicação
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendario">
            <CalendarioEscalas
              escalas={escalas}
              onCriarEscala={criarEscala}
              onEditarEscala={(escala) => console.log('Editar:', escala)}
              isMedico={isMedico}
              medicoId={isMedico ? "medico-id" : undefined}
            />
          </TabsContent>

          <TabsContent value="replicacao">
            <ReplicadorEscalas
              escalas={escalas}
              configuracao={configuracao}
              onReplicarEscala={replicarEscala}
              isMedico={isMedico}
              medicoId={isMedico ? "medico-id" : undefined}
            />
          </TabsContent>
        </Tabs>
      </div>
    </RoleProtectedRoute>
  );
}