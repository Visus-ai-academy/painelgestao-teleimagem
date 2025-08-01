import React, { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CalendarDays, Clock, MapPin, Users } from 'lucide-react';
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { EscalaMedicaCompleta } from '@/hooks/useEscalasMedicasCompleta';

interface CalendarioEscalasProps {
  escalas: EscalaMedicaCompleta[];
  onCriarEscala: (escala: Partial<EscalaMedicaCompleta>) => void;
  onEditarEscala: (escala: EscalaMedicaCompleta) => void;
  isMedico: boolean;
  medicoId?: string;
}

export const CalendarioEscalas: React.FC<CalendarioEscalasProps> = ({
  escalas,
  onCriarEscala,
  onEditarEscala,
  isMedico,
  medicoId
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTurno, setSelectedTurno] = useState<string>('');
  const [selectedTipoPlantao, setSelectedTipoPlantao] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const escalasDoMes = escalas.filter(escala => {
    const dataEscala = new Date(escala.data);
    return dataEscala.getMonth() === selectedDate.getMonth() &&
           dataEscala.getFullYear() === selectedDate.getFullYear();
  });

  const escalasDodia = escalas.filter(escala => {
    const dataEscala = new Date(escala.data);
    return format(dataEscala, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
  });

  const getTurnoColor = (turno: string) => {
    switch (turno) {
      case 'manha': return 'bg-blue-100 text-blue-800';
      case 'tarde': return 'bg-orange-100 text-orange-800';
      case 'noite': return 'bg-purple-100 text-purple-800';
      case 'plantao': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmada': return 'bg-green-100 text-green-800';
      case 'pendente': return 'bg-yellow-100 text-yellow-800';
      case 'ausencia': return 'bg-red-100 text-red-800';
      case 'cancelada': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleCriarEscala = () => {
    if (!selectedTurno) return;

    const novaEscala: Partial<EscalaMedicaCompleta> = {
      medico_id: medicoId || '',
      data: format(selectedDate, 'yyyy-MM-dd'),
      turno: selectedTurno as any,
      tipo_escala: selectedTipoPlantao === 'plantao' ? 'plantao' : 'normal',
      modalidade: '',
      especialidade: '',
      status: 'pendente',
      tipo_plantao: selectedTipoPlantao as any,
      mes_referencia: selectedDate.getMonth() + 1,
      ano_referencia: selectedDate.getFullYear()
    };

    onCriarEscala(novaEscala);
    setIsDialogOpen(false);
    setSelectedTurno('');
    setSelectedTipoPlantao('');
  };

  const diasComEscala = new Set(
    escalasDoMes.map(escala => format(new Date(escala.data), 'yyyy-MM-dd'))
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendário */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Calendário de Escalas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            className="rounded-md border"
            modifiers={{
              hasEscala: (date) => diasComEscala.has(format(date, 'yyyy-MM-dd'))
            }}
            modifiersStyles={{
              hasEscala: { 
                backgroundColor: 'hsl(var(--primary))', 
                color: 'hsl(var(--primary-foreground))',
                fontWeight: 'bold'
              }
            }}
          />
        </CardContent>
      </Card>

      {/* Escalas do Dia Selecionado */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
          </CardTitle>
          {isMedico && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="mt-2">
                  Nova Escala
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Nova Escala</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Data</label>
                    <p className="text-sm text-muted-foreground">
                      {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Turno</label>
                    <Select value={selectedTurno} onValueChange={setSelectedTurno}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o turno" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manha">Manhã</SelectItem>
                        <SelectItem value="tarde">Tarde</SelectItem>
                        <SelectItem value="noite">Noite</SelectItem>
                        <SelectItem value="plantao">Plantão</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Tipo de Plantão</label>
                    <Select value={selectedTipoPlantao} onValueChange={setSelectedTipoPlantao}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="noturno">Noturno</SelectItem>
                        <SelectItem value="feriado">Feriado</SelectItem>
                        <SelectItem value="final_semana">Final de Semana</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={handleCriarEscala} 
                    disabled={!selectedTurno}
                    className="w-full"
                  >
                    Criar Escala
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {escalasDodia.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma escala para este dia
              </p>
            ) : (
              escalasDodia.map((escala) => (
                <div
                  key={escala.id}
                  className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => onEditarEscala(escala)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">
                        {escala.medico?.nome || 'Médico'}
                      </span>
                    </div>
                    <Badge className={getStatusColor(escala.status)}>
                      {escala.status}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <Badge className={getTurnoColor(escala.turno)}>
                      {escala.turno}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{escala.especialidade} - {escala.modalidade}</span>
                  </div>
                  
                  {escala.horario_inicio && escala.horario_fim && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {escala.horario_inicio} - {escala.horario_fim}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};