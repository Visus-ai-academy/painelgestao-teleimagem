import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  Mail,
  Users,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EscalaCompleta } from '@/hooks/useEscalasAvancadas';

interface EscalaMensalProps {
  escalas: EscalaCompleta[];
  onFetchEscalas: (mesAno: { mes: number; ano: number }) => void;
  onEnviarPorEmail: (mesAno: { mes: number; ano: number }) => void;
  canManage: boolean;
}

export const EscalaMensal: React.FC<EscalaMensalProps> = ({
  escalas,
  onFetchEscalas,
  onEnviarPorEmail,
  canManage
}) => {
  const [mesAtual, setMesAtual] = useState(new Date());
  const [escalasDoMes, setEscalasDoMes] = useState<EscalaCompleta[]>([]);

  useEffect(() => {
    const mes = mesAtual.getMonth() + 1;
    const ano = mesAtual.getFullYear();
    onFetchEscalas({ mes, ano });
  }, [mesAtual, onFetchEscalas]);

  useEffect(() => {
    const mes = mesAtual.getMonth() + 1;
    const ano = mesAtual.getFullYear();
    const escalasFiltradasDoMes = escalas.filter(escala => {
      const dataEscala = new Date(escala.data);
      return dataEscala.getMonth() + 1 === mes && dataEscala.getFullYear() === ano;
    });
    setEscalasDoMes(escalasFiltradasDoMes);
  }, [escalas, mesAtual]);

  const proximoMes = () => {
    setMesAtual(prev => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + 1);
      return next;
    });
  };

  const mesAnterior = () => {
    setMesAtual(prev => {
      const previous = new Date(prev);
      previous.setMonth(previous.getMonth() - 1);
      return previous;
    });
  };

  const diasDoMes = eachDayOfInterval({
    start: startOfMonth(mesAtual),
    end: endOfMonth(mesAtual)
  });

  const getEscalasDoDia = (dia: Date) => {
    return escalasDoMes.filter(escala => 
      isSameDay(new Date(escala.data), dia)
    );
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      confirmada: { icon: CheckCircle, color: 'bg-green-500', label: 'Confirmada' },
      pendente: { icon: AlertCircle, color: 'bg-yellow-500', label: 'Pendente' },
      ausencia: { icon: AlertCircle, color: 'bg-red-500', label: 'Inatividade' },
      cancelada: { icon: AlertCircle, color: 'bg-gray-500', label: 'Cancelada' }
    };

    const config = statusMap[status as keyof typeof statusMap] || statusMap.pendente;
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} text-white`}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getTurnoBadge = (turno: string) => {
    const turnoMap = {
      manha: { color: 'bg-blue-500', label: 'M' },
      tarde: { color: 'bg-orange-500', label: 'T' },
      noite: { color: 'bg-purple-500', label: 'N' },
      plantao: { color: 'bg-red-500', label: 'P' }
    };

    const config = turnoMap[turno as keyof typeof turnoMap];
    if (!config) return null;

    return (
      <Badge className={`${config.color} text-white text-xs`}>
        {config.label}
      </Badge>
    );
  };

  const estatisticas = {
    totalEscalas: escalasDoMes.length,
    confirmadas: escalasDoMes.filter(e => e.status === 'confirmada').length,
    pendentes: escalasDoMes.filter(e => e.status === 'pendente').length,
    ausencias: escalasDoMes.filter(e => e.status === 'ausencia').length
  };

  const handleEnviarEmail = () => {
    const mes = mesAtual.getMonth() + 1;
    const ano = mesAtual.getFullYear();
    onEnviarPorEmail({ mes, ano });
  };

  return (
    <div className="space-y-6">
      {/* Header com controles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" onClick={mesAnterior}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {format(mesAtual, "MMMM 'de' yyyy", { locale: ptBR })}
              </CardTitle>
              
              <Button variant="outline" size="icon" onClick={proximoMes}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex gap-2">
              <Button variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Gerar PDF
              </Button>
              
              {canManage && (
                <Button onClick={handleEnviarEmail}>
                  <Mail className="h-4 w-4 mr-2" />
                  Enviar por Email
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
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
            <AlertCircle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm text-muted-foreground">Inatividades</p>
              <p className="text-2xl font-bold">{estatisticas.ausencias}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Calendário */}
      <Card>
        <CardHeader>
          <CardTitle>Calendário do Mês</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 mb-4">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia) => (
              <div key={dia} className="p-2 text-center font-medium text-sm text-muted-foreground">
                {dia}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {/* Dias vazios no início do mês */}
            {Array.from({ length: startOfMonth(mesAtual).getDay() }).map((_, index) => (
              <div key={`empty-${index}`} className="p-2 h-24" />
            ))}

            {/* Dias do mês */}
            {diasDoMes.map((dia) => {
              const escalasNoDia = getEscalasDoDia(dia);
              const isHoje = isSameDay(dia, new Date());

              return (
                <div
                  key={dia.toISOString()}
                  className={`p-2 h-24 border rounded-lg ${
                    isHoje ? 'border-primary bg-primary/5' : 'border-border'
                  } ${escalasNoDia.length > 0 ? 'bg-muted/50' : ''}`}
                >
                  <div className="text-sm font-medium mb-1">
                    {format(dia, 'd')}
                  </div>
                  
                  <div className="space-y-1">
                    {escalasNoDia.slice(0, 2).map((escala, index) => (
                      <div
                        key={escala.id}
                        className="text-xs p-1 rounded bg-white border flex items-center justify-between"
                      >
                        <span className="truncate">
                          {escala.medico?.nome || 'Médico'}
                        </span>
                        {getTurnoBadge(escala.turno)}
                      </div>
                    ))}
                    
                    {escalasNoDia.length > 2 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{escalasNoDia.length - 2} mais
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Lista de escalas */}
      <Card>
        <CardHeader>
          <CardTitle>Escalas do Mês</CardTitle>
        </CardHeader>
        <CardContent>
          {escalasDoMes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma escala registrada para este mês</p>
            </div>
          ) : (
            <div className="space-y-3">
              {escalasDoMes.map((escala) => (
                <Card key={escala.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <h4 className="font-medium">{escala.medico?.nome}</h4>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(escala.data), "dd/MM/yyyy", { locale: ptBR })} - {escala.especialidade}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {escala.horario_inicio} às {escala.horario_fim} | Capacidade: {escala.capacidade_maxima_exames} exames
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {getTurnoBadge(escala.turno)}
                      {getStatusBadge(escala.status)}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};