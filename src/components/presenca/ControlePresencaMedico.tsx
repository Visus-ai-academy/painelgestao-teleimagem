import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  LogIn, 
  LogOut, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  User
} from 'lucide-react';
import { usePresencaMedico } from '@/hooks/usePresencaMedico';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const ControlePresencaMedico: React.FC = () => {
  const { minhaPresenca, loading, fazerCheckin, fazerCheckout } = usePresencaMedico();
  const [observacoes, setObservacoes] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleCheckin = async () => {
    await fazerCheckin();
  };

  const handleCheckout = async () => {
    const sucesso = await fazerCheckout(observacoes);
    if (sucesso) {
      setObservacoes('');
      setDialogOpen(false);
    }
  };

  const getStatusInfo = () => {
    if (!minhaPresenca) {
      return {
        status: 'Sem escala hoje',
        color: 'secondary',
        icon: User,
        description: 'Você não possui escalas programadas para hoje'
      };
    }

    switch (minhaPresenca.status) {
      case 'presente':
        return {
          status: 'Presente',
          color: 'default',
          icon: CheckCircle,
          description: `Check-in realizado às ${minhaPresenca.checkin_timestamp ? format(new Date(minhaPresenca.checkin_timestamp), 'HH:mm', { locale: ptBR }) : '--:--'}`
        };
      case 'ausente':
        return {
          status: 'Ausente',
          color: 'destructive',
          icon: AlertTriangle,
          description: 'Realize o check-in para iniciar sua presença'
        };
      case 'checkout_manual':
      case 'checkout_automatico':
        return {
          status: 'Finalizado',
          color: 'secondary',
          icon: LogOut,
          description: `Check-out realizado às ${minhaPresenca.checkout_timestamp ? format(new Date(minhaPresenca.checkout_timestamp), 'HH:mm', { locale: ptBR }) : '--:--'}`
        };
      default:
        return {
          status: 'Indefinido',
          color: 'secondary',
          icon: User,
          description: 'Status não identificado'
        };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  const podeRealizarCheckin = minhaPresenca && minhaPresenca.status === 'ausente';
  const podeRealizarCheckout = minhaPresenca && minhaPresenca.status === 'presente';

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <StatusIcon className="h-5 w-5" />
          Controle de Presença
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Atual */}
        <div className="text-center space-y-2">
          <Badge 
            variant={statusInfo.color as any}
            className="px-4 py-2 text-sm"
          >
            {statusInfo.status}
          </Badge>
          <p className="text-sm text-muted-foreground">
            {statusInfo.description}
          </p>
        </div>

        {/* Informações da Escala */}
        {minhaPresenca && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Turno:</span>
              <span className="capitalize">{minhaPresenca.turno}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-medium">Data:</span>
              <span>{format(new Date(minhaPresenca.data_escala), 'dd/MM/yyyy', { locale: ptBR })}</span>
            </div>
            {minhaPresenca.tempo_total_presenca && (
              <div className="flex justify-between text-sm">
                <span className="font-medium">Tempo Total:</span>
                <span>{minhaPresenca.tempo_total_presenca} minutos</span>
              </div>
            )}
          </div>
        )}

        {/* Botões de Ação */}
        <div className="flex gap-2">
          {podeRealizarCheckin && (
            <Button 
              onClick={handleCheckin} 
              disabled={loading}
              className="flex-1"
              size="lg"
            >
              <LogIn className="h-4 w-4 mr-2" />
              Check-in
            </Button>
          )}

          {podeRealizarCheckout && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  disabled={loading}
                  className="flex-1"
                  size="lg"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Check-out
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Realizar Check-out</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="observacoes">
                      Observações (opcional)
                    </Label>
                    <Textarea
                      id="observacoes"
                      placeholder="Adicione observações sobre sua presença..."
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleCheckout}
                      disabled={loading}
                      className="flex-1"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Confirmar Check-out
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Informação sobre checkout automático */}
        {podeRealizarCheckout && (
          <div className="text-xs text-muted-foreground text-center border-t pt-3">
            <Clock className="h-3 w-3 inline mr-1" />
            Check-out automático após 60min do fim do turno
          </div>
        )}
      </CardContent>
    </Card>
  );
};