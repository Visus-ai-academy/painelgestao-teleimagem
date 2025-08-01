import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, CheckCircle, XCircle, Power } from 'lucide-react';
import { usePresencaControl } from '@/hooks/usePresencaControl';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export const ControlePresenca = () => {
  const { 
    presencaAtual, 
    statusGeral, 
    loading, 
    fazerCheckin, 
    fazerCheckout, 
    verificarEscalaHoje 
  } = usePresencaControl();
  
  const [escalasHoje, setEscalasHoje] = useState<any[]>([]);
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const carregarEscalas = async () => {
      const escalas = await verificarEscalaHoje();
      setEscalasHoje(escalas || []);
    };
    carregarEscalas();
  }, [verificarEscalaHoje]);

  const handleCheckin = async (escalaId: string) => {
    const result = await fazerCheckin(escalaId);
    if (result.success) {
      toast({
        title: "✅ Presença confirmada!",
        description: "Você está ativo para receber exames",
      });
    }
  };

  const handleCheckout = async () => {
    if (!presencaAtual?.presenca_id) return;
    
    const result = await fazerCheckout(presencaAtual.presenca_id, observacoes);
    if (result.success) {
      setShowCheckoutDialog(false);
      setObservacoes('');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'presente': return 'bg-green-500';
      case 'checkout_manual': return 'bg-red-500';
      case 'checkout_automatico': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'presente': return 'Presente';
      case 'checkout_manual': return 'Saiu do turno';
      case 'checkout_automatico': return 'Logout automático';
      default: return 'Ausente';
    }
  };

  const formatTempo = (tempo: unknown) => {
    if (!tempo || typeof tempo !== 'string') return '0min';
    
    try {
      // Parse interval PostgreSQL format (HH:MM:SS)
      const parts = tempo.split(':');
      const hours = parseInt(parts[0]);
      const minutes = parseInt(parts[1]);
      
      if (hours > 0) {
        return `${hours}h ${minutes}min`;
      }
      return `${minutes}min`;
    } catch {
      return '0min';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Clock className="mr-2 h-4 w-4 animate-spin" />
            Carregando status de presença...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Pessoal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Power className="h-5 w-5" />
            Controle de Presença
          </CardTitle>
          <CardDescription>
            Gerencie sua presença durante o turno para distribuição de exames
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {escalasHoje.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhuma escala confirmada para hoje</p>
            </div>
          ) : presencaAtual ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(presencaAtual.status_presenca)}`} />
                  <div>
                    <div className="font-medium">{getStatusText(presencaAtual.status_presenca)}</div>
                    {presencaAtual.horario_checkin && (
                      <div className="text-sm text-muted-foreground">
                        Check-in: {new Date(presencaAtual.horario_checkin).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                        {presencaAtual.tempo_online && (
                          <span className="ml-2">({formatTempo(presencaAtual.tempo_online)})</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {presencaAtual.alerta_ativo && (
                  <Badge variant="destructive" className="animate-pulse">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Alerta Ativo
                  </Badge>
                )}
              </div>

              {presencaAtual.status_presenca === 'presente' ? (
                <Button 
                  variant="destructive" 
                  onClick={() => setShowCheckoutDialog(true)}
                  className="w-full"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Fazer Check-out
                </Button>
              ) : (
                <Button 
                  onClick={() => handleCheckin(presencaAtual.escala_id)}
                  className="w-full"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Fazer Check-in
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Escalas disponíveis para check-in hoje:
              </p>
              {escalasHoje.map((escala) => (
                <div key={escala.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">
                      {escala.especialidade} - {escala.modalidade}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {escala.turno} ({escala.horario_inicio} - {escala.horario_fim})
                    </div>
                  </div>
                  <Button onClick={() => handleCheckin(escala.id)}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Check-in
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Geral da Equipe (apenas para managers/admins) */}
      {statusGeral.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Status da Equipe</CardTitle>
            <CardDescription>
              Presença em tempo real de todos os médicos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {statusGeral.map((status) => (
                <div key={status.presenca_id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(status.status_presenca)}`} />
                    <div>
                      <div className="font-medium">{status.medico_nome}</div>
                      <div className="text-sm text-muted-foreground">
                        {getStatusText(status.status_presenca)}
                        {status.tempo_online && (
                          <span className="ml-2">({formatTempo(status.tempo_online)})</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {status.alerta_ativo && (
                    <Badge variant="destructive" className="animate-pulse">
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      Alerta
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog de Check-out */}
      <Dialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Check-out</DialogTitle>
            <DialogDescription>
              Ao fazer check-out, você será removido da distribuição de exames e um alerta será ativado.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações (opcional)</Label>
              <Textarea
                id="observacoes"
                placeholder="Motivo do check-out, observações, etc..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCheckoutDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleCheckout}>
              <XCircle className="mr-2 h-4 w-4" />
              Confirmar Check-out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};