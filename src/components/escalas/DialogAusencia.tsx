import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CalendarOff, Clock, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TipoAusencia } from '@/hooks/useEscalasMedicasCompleto';

interface DialogAusenciaProps {
  tiposAusencia: TipoAusencia[];
  onCriarAusencia: (ausencia: any) => Promise<boolean>;
  medicoId?: string;
  trigger?: React.ReactNode;
}

export const DialogAusencia = ({ 
  tiposAusencia, 
  onCriarAusencia, 
  medicoId,
  trigger 
}: DialogAusenciaProps) => {
  const [open, setOpen] = useState(false);
  const [dataInicio, setDataInicio] = useState<Date>();
  const [dataFim, setDataFim] = useState<Date>();
  const [tipoAusenciaId, setTipoAusenciaId] = useState<string>('');
  const [turno, setTurno] = useState<string>('dia_inteiro');
  const [motivo, setMotivo] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!dataInicio || !dataFim || !tipoAusenciaId || !medicoId) return;

    setLoading(true);
    try {
      const ausencia = {
        medico_id: medicoId,
        tipo_ausencia_id: tipoAusenciaId,
        data_inicio: format(dataInicio, 'yyyy-MM-dd'),
        data_fim: format(dataFim, 'yyyy-MM-dd'),
        turno: turno === 'dia_inteiro' ? null : turno,
        motivo: motivo.trim() || null,
      };

      const sucesso = await onCriarAusencia(ausencia);
      if (sucesso) {
        setOpen(false);
        // Reset form
        setDataInicio(undefined);
        setDataFim(undefined);
        setTipoAusenciaId('');
        setTurno('dia_inteiro');
        setMotivo('');
      }
    } catch (error) {
      console.error('Erro ao criar ausência:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTipoAusenciaBadge = (tipo: TipoAusencia) => (
    <Badge 
      style={{ backgroundColor: tipo.cor }} 
      className="text-white"
    >
      {tipo.nome}
    </Badge>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="flex items-center gap-2">
            <CalendarOff className="h-4 w-4" />
            Informar Inatividade
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarOff className="h-5 w-5" />
            Informar Inatividade
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Período da Ausência */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                 Período da Inatividade
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Data de Início
                  </label>
                  <Calendar
                    mode="single"
                    selected={dataInicio}
                    onSelect={setDataInicio}
                    disabled={(date) => date < new Date()}
                    className="w-full"
                    locale={ptBR}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Data de Fim
                  </label>
                  <Calendar
                    mode="single"
                    selected={dataFim}
                    onSelect={setDataFim}
                    disabled={(date) => date < (dataInicio || new Date())}
                    className="w-full"
                    locale={ptBR}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detalhes da Ausência */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <User className="h-4 w-4" />
                   Detalhes da Inatividade
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Tipo de Inatividade
                    </label>
                    <Select value={tipoAusenciaId} onValueChange={setTipoAusenciaId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {tiposAusencia.map((tipo) => (
                          <SelectItem key={tipo.id} value={tipo.id}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: tipo.cor }}
                              />
                              {tipo.nome}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Período do Dia
                    </label>
                    <Select value={turno} onValueChange={setTurno}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dia_inteiro">Dia Inteiro</SelectItem>
                        <SelectItem value="manha">Manhã</SelectItem>
                        <SelectItem value="tarde">Tarde</SelectItem>
                        <SelectItem value="noite">Noite</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Motivo (Opcional)
                    </label>
                    <Textarea
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Descreva o motivo da inatividade..."
                      rows={3}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Preview da Ausência */}
            {dataInicio && dataFim && tipoAusenciaId && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4">
                  <h4 className="font-medium mb-3">Resumo da Inatividade</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Período:</span>
                      <span>
                        {format(dataInicio, 'dd/MM/yyyy', { locale: ptBR })} até{' '}
                        {format(dataFim, 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Tipo:</span>
                      {getTipoAusenciaBadge(
                        tiposAusencia.find(t => t.id === tipoAusenciaId)!
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Turno:</span>
                      <span className="capitalize">
                        {turno === 'dia_inteiro' ? 'Dia Inteiro' : turno}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={!dataInicio || !dataFim || !tipoAusenciaId || loading}
              >
                {loading ? 'Registrando...' : 'Registrar Inatividade'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};