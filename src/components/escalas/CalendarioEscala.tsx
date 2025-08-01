import React, { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarDays } from 'lucide-react';
import { format } from 'date-fns';

interface CalendarioEscalaProps {
  onCriarEscala: (escala: any) => void;
  canManage?: boolean;
  medicoId?: string;
  // Legacy props for EscalaMedica.tsx
  escalas?: any[];
  onSelecionarData?: (date: Date) => void;
  canEdit?: boolean;
}

export const CalendarioEscala: React.FC<CalendarioEscalaProps> = ({
  onCriarEscala,
  canManage
}) => {
  const [datasSelecionadas, setDatasSelecionadas] = useState<Date[] | undefined>(undefined);
  const [turno, setTurno] = useState<string>('');
  const [modalidade, setModalidade] = useState<string>('');
  const [especialidade, setEspecialidade] = useState<string>('');

  const handleCriarEscala = () => {
    if (!datasSelecionadas || datasSelecionadas.length === 0 || !turno || !modalidade || !especialidade) {
      return;
    }

    datasSelecionadas.forEach(data => {
      const escala = {
        data: format(data, 'yyyy-MM-dd'),
        turno,
        modalidade,
        especialidade,
        tipo_escala: 'normal',
        status: 'pendente'
      };
      onCriarEscala(escala);
    });

    setDatasSelecionadas(undefined);
    setTurno('');
    setModalidade('');
    setEspecialidade('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Calendário de Escalas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="multiple"
            selected={datasSelecionadas}
            onSelect={setDatasSelecionadas}
            className="rounded-md border"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuração da Escala</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="turno">Turno</Label>
            <Select value={turno} onValueChange={setTurno}>
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
            <Label htmlFor="modalidade">Modalidade</Label>
            <Input
              id="modalidade"
              value={modalidade}
              onChange={(e) => setModalidade(e.target.value)}
              placeholder="Ex: Radiologia"
            />
          </div>

          <div>
            <Label htmlFor="especialidade">Especialidade</Label>
            <Input
              id="especialidade"
              value={especialidade}
              onChange={(e) => setEspecialidade(e.target.value)}
              placeholder="Ex: Radiologia Geral"
            />
          </div>

          <Button 
            onClick={handleCriarEscala}
            disabled={!datasSelecionadas || datasSelecionadas.length === 0 || !turno || !modalidade || !especialidade}
            className="w-full"
          >
            <CalendarDays className="h-4 w-4 mr-2" />
            Criar Escala
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};