import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  UserX, 
  CalendarX, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  CalendarDays
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { AusenciaMedica, TipoAusencia } from '@/hooks/useEscalasAvancadas';

interface GerenciadorAusenciasProps {
  ausencias: AusenciaMedica[];
  tiposAusencia: TipoAusencia[];
  onCriarAusencia: (ausencia: any) => void;
  onAprovarAusencia: (ausenciaId: string) => void;
  canApprove: boolean;
  medicoId?: string;
}

export const GerenciadorAusencias: React.FC<GerenciadorAusenciasProps> = ({
  ausencias,
  tiposAusencia,
  onCriarAusencia,
  onAprovarAusencia,
  canApprove,
  medicoId
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [tipoAusenciaId, setTipoAusenciaId] = useState<string>('');
  const [dataInicio, setDataInicio] = useState<Date>();
  const [dataFim, setDataFim] = useState<Date>();
  const [turno, setTurno] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('');

  const handleCriarAusencia = () => {
    if (!tipoAusenciaId || !dataInicio || !dataFim) return;

    const ausencia = {
      medico_id: medicoId,
      tipo_ausencia_id: tipoAusenciaId,
      data_inicio: format(dataInicio, 'yyyy-MM-dd'),
      data_fim: format(dataFim, 'yyyy-MM-dd'),
      turno: turno || null,
      motivo: motivo || null,
      aprovado: false
    };

    onCriarAusencia(ausencia);
    
    // Limpar formulário
    setTipoAusenciaId('');
    setDataInicio(undefined);
    setDataFim(undefined);
    setTurno('');
    setMotivo('');
    setIsDialogOpen(false);
  };

  const getStatusBadge = (ausencia: AusenciaMedica) => {
    if (ausencia.aprovado) {
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle className="h-3 w-3 mr-1" />
          Aprovada
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Pendente
        </Badge>
      );
    }
  };

  const getTurnoBadge = (turno?: string) => {
    if (!turno) return null;
    
    const turnoMap = {
      manha: { label: 'Manhã', color: 'bg-blue-500' },
      tarde: { label: 'Tarde', color: 'bg-orange-500' },
      noite: { label: 'Noite', color: 'bg-purple-500' },
      dia_inteiro: { label: 'Dia Inteiro', color: 'bg-gray-500' }
    };

    const config = turnoMap[turno as keyof typeof turnoMap];
    if (!config) return null;

    return (
      <Badge className={config.color}>
        <Clock className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5" />
            Gerenciar Ausências
          </CardTitle>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <CalendarX className="h-4 w-4 mr-2" />
                Nova Ausência
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Registrar Ausência</DialogTitle>
              </DialogHeader>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="tipo_ausencia">Tipo de Ausência</Label>
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
                    <Label htmlFor="turno">Turno (Opcional)</Label>
                    <Select value={turno} onValueChange={setTurno}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o turno" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Dia Inteiro</SelectItem>
                        <SelectItem value="manha">Manhã</SelectItem>
                        <SelectItem value="tarde">Tarde</SelectItem>
                        <SelectItem value="noite">Noite</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="motivo">Motivo</Label>
                    <Textarea
                      id="motivo"
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Descreva o motivo da ausência..."
                      rows={4}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>Data de Início</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !dataInicio && "text-muted-foreground"
                          )}
                        >
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {dataInicio ? format(dataInicio, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={dataInicio}
                          onSelect={setDataInicio}
                          initialFocus
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label>Data de Fim</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !dataFim && "text-muted-foreground"
                          )}
                        >
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {dataFim ? format(dataFim, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={dataFim}
                          onSelect={setDataFim}
                          initialFocus
                          locale={ptBR}
                          disabled={(date) => dataInicio ? date < dataInicio : false}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <Button 
                    onClick={handleCriarAusencia}
                    disabled={!tipoAusenciaId || !dataInicio || !dataFim}
                    className="w-full"
                  >
                    Registrar Ausência
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {ausencias.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UserX className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma ausência registrada</p>
              </div>
            ) : (
              ausencias.map((ausencia) => (
                <Card key={ausencia.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: ausencia.tipo_ausencia?.cor || '#ef4444' }}
                      />
                      <div>
                        <h4 className="font-medium">{ausencia.tipo_ausencia?.nome}</h4>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(ausencia.data_inicio), "dd/MM/yyyy", { locale: ptBR })} até{' '}
                          {format(new Date(ausencia.data_fim), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                        {ausencia.motivo && (
                          <p className="text-sm text-muted-foreground mt-1">{ausencia.motivo}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {getTurnoBadge(ausencia.turno)}
                      {getStatusBadge(ausencia)}
                      
                      {canApprove && !ausencia.aprovado && (
                        <Button
                          size="sm"
                          onClick={() => onAprovarAusencia(ausencia.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Aprovar
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};