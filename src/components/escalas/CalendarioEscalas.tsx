import React, { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarDays, Clock, MapPin, Users, CalendarIcon } from 'lucide-react';
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, differenceInMonths, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { EscalaMedicaCompleta } from '@/hooks/useEscalasMedicasCompleta';

interface CalendarioEscalasProps {
  escalas: EscalaMedicaCompleta[];
  onCriarEscala: (escala: Partial<EscalaMedicaCompleta>) => void;
  onEditarEscala: (escala: EscalaMedicaCompleta) => void;
  isMedico: boolean;
  medicoId?: string;
}

const diasDaSemana = [
  { id: 1, nome: 'Segunda', short: 'Seg' },
  { id: 2, nome: 'Terça', short: 'Ter' },
  { id: 3, nome: 'Quarta', short: 'Qua' },
  { id: 4, nome: 'Quinta', short: 'Qui' },
  { id: 5, nome: 'Sexta', short: 'Sex' },
  { id: 6, nome: 'Sábado', short: 'Sáb' },
  { id: 0, nome: 'Domingo', short: 'Dom' }
];

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
  const [tipoEscala, setTipoEscala] = useState<'unica' | 'recorrente' | 'periodo'>('unica');
  const [diasSemana, setDiasSemana] = useState<number[]>([]);
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();

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

  const validarPeriodo = () => {
    if (tipoEscala === 'periodo' && dataInicio && dataFim) {
      const diffMonths = differenceInMonths(dataFim, dataInicio);
      const diffDays = differenceInDays(dataFim, dataInicio);
      
      if (diffMonths > 6) {
        return 'Período máximo de 6 meses';
      }
      if (diffDays < 60) { // ~2 meses
        return 'Período mínimo de 2 meses';
      }
    }
    return null;
  };

  const handleToggleDiaSemana = (diaId: number) => {
    setDiasSemana(prev => 
      prev.includes(diaId) 
        ? prev.filter(d => d !== diaId)
        : [...prev, diaId]
    );
  };

  const gerarEscalasRecorrentes = () => {
    const escalas: Partial<EscalaMedicaCompleta>[] = [];
    let dataAtual = new Date();
    
    if (tipoEscala === 'periodo' && dataInicio && dataFim) {
      dataAtual = new Date(dataInicio);
      const dataLimite = new Date(dataFim);
      
      while (dataAtual <= dataLimite) {
        const diaSemana = dataAtual.getDay();
        if (diasSemana.includes(diaSemana)) {
          escalas.push({
            medico_id: medicoId || '',
            data: format(dataAtual, 'yyyy-MM-dd'),
            turno: selectedTurno as any,
            tipo_escala: selectedTipoPlantao === 'plantao' ? 'plantao' : 'normal',
            modalidade: '',
            especialidade: '',
            status: 'pendente',
            tipo_plantao: selectedTipoPlantao as any,
            mes_referencia: dataAtual.getMonth() + 1,
            ano_referencia: dataAtual.getFullYear(),
            dias_semana: diasSemana
          });
        }
        dataAtual = addDays(dataAtual, 1);
      }
    } else if (tipoEscala === 'recorrente') {
      // Gerar para os próximos 6 meses
      const dataLimite = addDays(new Date(), 180); // ~6 meses
      
      while (dataAtual <= dataLimite) {
        const diaSemana = dataAtual.getDay();
        if (diasSemana.includes(diaSemana)) {
          escalas.push({
            medico_id: medicoId || '',
            data: format(dataAtual, 'yyyy-MM-dd'),
            turno: selectedTurno as any,
            tipo_escala: selectedTipoPlantao === 'plantao' ? 'plantao' : 'normal',
            modalidade: '',
            especialidade: '',
            status: 'pendente',
            tipo_plantao: selectedTipoPlantao as any,
            mes_referencia: dataAtual.getMonth() + 1,
            ano_referencia: dataAtual.getFullYear(),
            dias_semana: diasSemana
          });
        }
        dataAtual = addDays(dataAtual, 1);
      }
    }
    
    return escalas;
  };

  const handleCriarEscala = () => {
    if (!selectedTurno) return;

    const erroValidacao = validarPeriodo();
    if (erroValidacao) {
      alert(erroValidacao);
      return;
    }

    if (tipoEscala === 'unica') {
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
    } else {
      const escalasRecorrentes = gerarEscalasRecorrentes();
      escalasRecorrentes.forEach(escala => onCriarEscala(escala));
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setSelectedTurno('');
    setSelectedTipoPlantao('');
    setTipoEscala('unica');
    setDiasSemana([]);
    setDataInicio(undefined);
    setDataFim(undefined);
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
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Criar Nova Escala</DialogTitle>
                </DialogHeader>
                <div className="space-y-6">
                  {/* Tipo de Escala */}
                  <div>
                    <Label className="text-sm font-medium">Tipo de Escala</Label>
                    <RadioGroup value={tipoEscala} onValueChange={(value: any) => setTipoEscala(value)}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="unica" id="unica" />
                        <Label htmlFor="unica">Escala Única</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="recorrente" id="recorrente" />
                        <Label htmlFor="recorrente">Recorrente (próximos 6 meses)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="periodo" id="periodo" />
                        <Label htmlFor="periodo">Período Específico</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Data para escala única */}
                  {tipoEscala === 'unica' && (
                    <div>
                      <Label className="text-sm font-medium">Data</Label>
                      <p className="text-sm text-muted-foreground">
                        {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  )}

                  {/* Período específico */}
                  {tipoEscala === 'periodo' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Data Início</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !dataInicio && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Selecionar"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={dataInicio}
                              onSelect={setDataInicio}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Data Fim</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !dataFim && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {dataFim ? format(dataFim, "dd/MM/yyyy") : "Selecionar"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={dataFim}
                              onSelect={setDataFim}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  )}

                  {/* Dias da Semana (para recorrente e período) */}
                  {(tipoEscala === 'recorrente' || tipoEscala === 'periodo') && (
                    <div>
                      <Label className="text-sm font-medium">Dias da Semana</Label>
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        {diasDaSemana.map((dia) => (
                          <div key={dia.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`dia-${dia.id}`}
                              checked={diasSemana.includes(dia.id)}
                              onCheckedChange={() => handleToggleDiaSemana(dia.id)}
                            />
                            <Label 
                              htmlFor={`dia-${dia.id}`}
                              className="text-sm cursor-pointer"
                            >
                              {dia.short}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Turno */}
                  <div>
                    <Label className="text-sm font-medium">Turno</Label>
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

                  {/* Tipo de Plantão */}
                  <div>
                    <Label className="text-sm font-medium">Tipo de Plantão</Label>
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

                  {validarPeriodo() && (
                    <div className="p-3 border border-red-200 bg-red-50 rounded-lg">
                      <p className="text-sm text-red-600">{validarPeriodo()}</p>
                    </div>
                  )}

                  <Button 
                    onClick={handleCriarEscala} 
                    disabled={!selectedTurno || (tipoEscala !== 'unica' && diasSemana.length === 0) || !!validarPeriodo()}
                    className="w-full"
                  >
                    {tipoEscala === 'unica' ? 'Criar Escala' : 'Criar Escalas'}
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