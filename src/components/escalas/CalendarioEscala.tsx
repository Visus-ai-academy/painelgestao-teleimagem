import React, { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Clock, Users, Settings } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EscalaMedicaCompleta } from '@/hooks/useEscalasMedicasCompleto';

interface CalendarioEscalaProps {
  escalas: EscalaMedicaCompleta[];
  onSelecionarData: (data: Date) => void;
  onCriarEscala: (data: Date, turno: string, tipo: string) => void;
  canEdit: boolean;
}

export const CalendarioEscala = ({ 
  escalas, 
  onSelecionarData, 
  onCriarEscala, 
  canEdit 
}: CalendarioEscalaProps) => {
  const [dataSelecionada, setDataSelecionada] = useState<Date>();
  const [turnoSelecionado, setTurnoSelecionado] = useState<string>('');
  const [tipoSelecionado, setTipoSelecionado] = useState<string>('normal');

  const handleSelecionarData = (data: Date | undefined) => {
    if (!data) return;
    setDataSelecionada(data);
    onSelecionarData(data);
  };

  const handleCriarEscala = () => {
    if (!dataSelecionada || !turnoSelecionado) return;
    onCriarEscala(dataSelecionada, turnoSelecionado, tipoSelecionado);
    setTurnoSelecionado('');
  };

  const getEscalasDoDia = (data: Date) => {
    const dataStr = format(data, 'yyyy-MM-dd');
    return escalas.filter(escala => escala.data === dataStr);
  };

  const getTurnoBadge = (turno: string) => {
    const cores = {
      manha: 'bg-blue-500',
      tarde: 'bg-orange-500', 
      noite: 'bg-purple-500',
      plantao: 'bg-red-500'
    };
    
    const nomes = {
      manha: 'Manhã',
      tarde: 'Tarde',
      noite: 'Noite', 
      plantao: 'Plantão'
    };

    return (
      <Badge className={`${cores[turno as keyof typeof cores]} text-white text-xs`}>
        {nomes[turno as keyof typeof nomes]}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const cores = {
      confirmada: 'bg-green-500',
      pendente: 'bg-yellow-500',
      ausencia: 'bg-red-500',
      cancelada: 'bg-gray-500'
    };

    return (
      <Badge className={`${cores[status as keyof typeof cores]} text-white text-xs ml-1`}>
        {status}
      </Badge>
    );
  };

  const modifiers = {
    temEscala: escalas.map(escala => parseISO(escala.data)),
    ausencia: escalas
      .filter(escala => escala.status === 'ausencia')
      .map(escala => parseISO(escala.data)),
  };

  const modifiersStyles = {
    temEscala: {
      backgroundColor: 'hsl(var(--primary))',
      color: 'white',
      borderRadius: '8px'
    },
    ausencia: {
      backgroundColor: 'hsl(var(--destructive))',
      color: 'white',
      borderRadius: '8px'
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendário */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Calendário de Escalas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={dataSelecionada}
            onSelect={handleSelecionarData}
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
            className="w-full"
            locale={ptBR}
          />
          
          <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-primary rounded"></div>
              <span>Com escala</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-destructive rounded"></div>
              <span>Ausência</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Painel lateral */}
      <div className="space-y-4">
        {/* Nova Escala */}
        {canEdit && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Nova Escala
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Turno</label>
                <Select value={turnoSelecionado} onValueChange={setTurnoSelecionado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o turno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manha">Manhã (08:00 - 12:00)</SelectItem>
                    <SelectItem value="tarde">Tarde (13:00 - 18:00)</SelectItem>
                    <SelectItem value="noite">Noite (19:00 - 23:00)</SelectItem>
                    <SelectItem value="plantao">Plantão (24h)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Tipo</label>
                <Select value={tipoSelecionado} onValueChange={setTipoSelecionado}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="plantao">Plantão</SelectItem>
                    <SelectItem value="extra">Extra</SelectItem>
                    <SelectItem value="backup">Backup</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleCriarEscala}
                disabled={!dataSelecionada || !turnoSelecionado}
                className="w-full"
              >
                Criar Escala
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Escalas do dia selecionado */}
        {dataSelecionada && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {format(dataSelecionada, "dd 'de' MMMM", { locale: ptBR })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {getEscalasDoDia(dataSelecionada).length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Nenhuma escala para este dia
                </p>
              ) : (
                <div className="space-y-3">
                  {getEscalasDoDia(dataSelecionada).map((escala) => (
                    <div 
                      key={escala.id} 
                      className="p-3 border rounded-lg bg-card"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">
                          {escala.medico?.nome}
                        </span>
                        {getTurnoBadge(escala.turno)}
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {escala.modalidade} - {escala.especialidade}
                        </span>
                        {getStatusBadge(escala.status)}
                      </div>
                      
                      {escala.horario_inicio && escala.horario_fim && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {escala.horario_inicio} - {escala.horario_fim}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};