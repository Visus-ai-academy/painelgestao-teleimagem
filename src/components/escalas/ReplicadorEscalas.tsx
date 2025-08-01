import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Copy, Calendar, Clock } from 'lucide-react';
import { format, addMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { EscalaMedicaCompleta, ConfiguracaoEscala } from '@/hooks/useEscalasMedicasCompleta';

interface ReplicadorEscalasProps {
  escalas: EscalaMedicaCompleta[];
  configuracao: ConfiguracaoEscala | null;
  onReplicarEscala: (escalaId: string, mesesParaReplicar: number[]) => void;
  isMedico: boolean;
  medicoId?: string;
}

export const ReplicadorEscalas: React.FC<ReplicadorEscalasProps> = ({
  escalas,
  configuracao,
  onReplicarEscala,
  isMedico,
  medicoId
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEscalaId, setSelectedEscalaId] = useState<string>('');
  const [selectedMeses, setSelectedMeses] = useState<number[]>([]);

  const escalasDoMedicoAtual = escalas.filter(escala => {
    if (isMedico && medicoId) {
      return escala.medico_id === medicoId;
    }
    return true;
  });

  const maxMesesAntecipacao = configuracao?.meses_antecipacao || 6;
  const hoje = new Date();
  const mesesDisponiveis = Array.from({ length: maxMesesAntecipacao }, (_, index) => {
    const mes = addMonths(hoje, index + 1);
    return {
      numero: mes.getMonth() + 1,
      ano: mes.getFullYear(),
      nome: format(mes, 'MMMM yyyy', { locale: ptBR })
    };
  });

  const handleToggleMes = (mesNumero: number) => {
    setSelectedMeses(prev => 
      prev.includes(mesNumero) 
        ? prev.filter(m => m !== mesNumero)
        : [...prev, mesNumero]
    );
  };

  const handleReplicar = () => {
    if (!selectedEscalaId || selectedMeses.length === 0) return;

    onReplicarEscala(selectedEscalaId, selectedMeses);
    setIsDialogOpen(false);
    setSelectedEscalaId('');
    setSelectedMeses([]);
  };

  const getEscalasByMes = (mes: number, ano: number) => {
    return escalasDoMedicoAtual.filter(escala => {
      const dataEscala = new Date(escala.data);
      return dataEscala.getMonth() + 1 === mes && dataEscala.getFullYear() === ano;
    });
  };

  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();
  const escalasDoMesAtual = getEscalasByMes(mesAtual, anoAtual);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Replicação de Escalas
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Replique escalas do mês atual para os próximos meses (até {maxMesesAntecipacao} meses)
          </p>
        </CardHeader>
        <CardContent>
          {/* Escalas do Mês Atual */}
          <div className="mb-6">
            <h4 className="font-medium mb-3">
              Escalas de {format(hoje, 'MMMM yyyy', { locale: ptBR })}
            </h4>
            <div className="grid gap-3">
              {escalasDoMesAtual.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
                  Nenhuma escala encontrada para este mês
                </p>
              ) : (
                escalasDoMesAtual.map((escala) => (
                  <div key={escala.id} className="p-3 border rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">
                          {format(new Date(escala.data), "dd 'de' MMMM", { locale: ptBR })}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{escala.turno}</span>
                          <Badge variant="outline" className="text-xs">
                            {escala.especialidade}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Dialog open={isDialogOpen && selectedEscalaId === escala.id} 
                           onOpenChange={(open) => {
                             setIsDialogOpen(open);
                             if (open) setSelectedEscalaId(escala.id);
                           }}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Copy className="h-3 w-3 mr-1" />
                          Replicar
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Replicar Escala</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="p-3 border rounded-lg bg-muted/50">
                            <div className="flex items-center gap-2 mb-2">
                              <Calendar className="h-4 w-4" />
                              <span className="font-medium">
                                {format(new Date(escala.data), "dd 'de' MMMM", { locale: ptBR })}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {escala.turno} - {escala.especialidade} - {escala.modalidade}
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium mb-3 block">
                              Selecione os meses para replicar:
                            </label>
                            <div className="space-y-2">
                              {mesesDisponiveis.map((mes) => {
                                const escalasExistentes = getEscalasByMes(mes.numero, mes.ano);
                                const hasConflict = escalasExistentes.some(e => 
                                  format(new Date(e.data), 'dd') === format(new Date(escala.data), 'dd')
                                );

                                return (
                                  <div key={`${mes.numero}-${mes.ano}`} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`mes-${mes.numero}-${mes.ano}`}
                                      checked={selectedMeses.includes(mes.numero)}
                                      onCheckedChange={() => handleToggleMes(mes.numero)}
                                      disabled={hasConflict}
                                    />
                                    <label 
                                      htmlFor={`mes-${mes.numero}-${mes.ano}`}
                                      className={`text-sm ${hasConflict ? 'text-muted-foreground line-through' : ''}`}
                                    >
                                      {mes.nome}
                                      {hasConflict && (
                                        <span className="ml-2 text-xs text-red-600">
                                          (Conflito - escala já existe)
                                        </span>
                                      )}
                                    </label>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex gap-2 pt-4">
                            <Button
                              variant="outline"
                              onClick={() => setIsDialogOpen(false)}
                              className="flex-1"
                            >
                              Cancelar
                            </Button>
                            <Button
                              onClick={handleReplicar}
                              disabled={selectedMeses.length === 0}
                              className="flex-1"
                            >
                              Replicar para {selectedMeses.length} {selectedMeses.length === 1 ? 'mês' : 'meses'}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Resumo dos Próximos Meses */}
          <div>
            <h4 className="font-medium mb-3">Próximos Meses</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {mesesDisponiveis.map((mes) => {
                const escalasDoMes = getEscalasByMes(mes.numero, mes.ano);
                return (
                  <div key={`${mes.numero}-${mes.ano}`} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{mes.nome}</span>
                      <Badge variant="secondary">
                        {escalasDoMes.length} {escalasDoMes.length === 1 ? 'escala' : 'escalas'}
                      </Badge>
                    </div>
                    {escalasDoMes.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {escalasDoMes.map(e => format(new Date(e.data), 'dd')).join(', ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};