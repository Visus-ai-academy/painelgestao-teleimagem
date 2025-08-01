import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  User,
  Calendar,
  LogIn,
  LogOut
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAtivacaoControl, type AtivacaoStatus } from '@/hooks/useAtivacaoControl';
import { useToast } from '@/hooks/use-toast';

export const ControleAtivacao: React.FC = () => {
  const { 
    ativacaoAtual, 
    statusGeral, 
    loading, 
    fazerCheckin, 
    fazerCheckout, 
    verificarEscalaHoje 
  } = useAtivacaoControl();
  
  const { toast } = useToast();
  const [escalasHoje, setEscalasHoje] = useState<any[]>([]);
  const [observacoes, setObservacoes] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);

  useEffect(() => {
    const buscarEscalas = async () => {
      const escalas = await verificarEscalaHoje();
      setEscalasHoje(escalas || []);
    };
    buscarEscalas();
  }, [verificarEscalaHoje]);

  const handleCheckin = async (escalaId: string) => {
    setLoadingAction(true);
    try {
      await fazerCheckin(escalaId);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleCheckout = async () => {
    if (!ativacaoAtual?.ativacao_id) return;
    
    setLoadingAction(true);
    try {
      await fazerCheckout(ativacaoAtual.ativacao_id, observacoes);
      setObservacoes('');
    } finally {
      setLoadingAction(false);
    }
  };

  const getStatusBadge = (status: string, alertaAtivo: boolean) => {
    if (status === 'ativo') {
      return <Badge className="bg-green-500">{alertaAtivo ? '🔴 Ativo' : '🟢 Ativo'}</Badge>;
    } else if (status === 'checkout_manual') {
      return <Badge variant="destructive">🔴 Check-out Manual</Badge>;
    } else if (status === 'checkout_automatico') {
      return <Badge variant="secondary">⚪ Check-out Automático</Badge>;
    }
    return <Badge variant="outline">Inativo</Badge>;
  };

  const formatTempo = (tempo: any) => {
    if (!tempo) return 'N/A';
    try {
      // Assumindo que tempo vem como string PostgreSQL interval
      const match = String(tempo).match(/(\d+):(\d+):(\d+)/);
      if (match) {
        const [, hours, minutes] = match;
        return `${hours}h ${minutes}min`;
      }
      return String(tempo);
    } catch {
      return 'N/A';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status do Médico Atual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Meu Status de Ativação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ativacaoAtual ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {format(new Date(ativacaoAtual.data_ativacao), 'dd/MM/yyyy', { locale: ptBR })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Check-in: {ativacaoAtual.horario_checkin ? format(new Date(ativacaoAtual.horario_checkin), 'HH:mm', { locale: ptBR }) : 'N/A'}
                  </span>
                </div>
                {ativacaoAtual.horario_checkout && (
                  <div className="flex items-center gap-2">
                    <LogOut className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Check-out: {format(new Date(ativacaoAtual.horario_checkout), 'HH:mm', { locale: ptBR })}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Tempo ativo: {formatTempo(ativacaoAtual.tempo_online)}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div>
                  {getStatusBadge(ativacaoAtual.status_ativacao, ativacaoAtual.alerta_ativo)}
                </div>
                
                {ativacaoAtual.status_ativacao === 'ativo' && (
                  <div className="space-y-2">
                    <Label htmlFor="observacoes">Observações (opcional)</Label>
                    <Textarea
                      id="observacoes"
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      placeholder="Motivo do check-out..."
                      rows={2}
                    />
                    <Button 
                      onClick={handleCheckout}
                      disabled={loadingAction}
                      variant="destructive"
                      className="w-full"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      {loadingAction ? 'Fazendo check-out...' : 'Fazer Check-out'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">Você não está ativo hoje</p>
              
              {escalasHoje.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Escalas disponíveis para ativação:</p>
                  {escalasHoje.map((escala) => (
                    <div key={escala.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{escala.turno} - {escala.especialidade}</p>
                        <p className="text-sm text-muted-foreground">{escala.modalidade}</p>
                      </div>
                      <Button 
                        onClick={() => handleCheckin(escala.id)}
                        disabled={loadingAction}
                        size="sm"
                      >
                        <LogIn className="h-4 w-4 mr-2" />
                        {loadingAction ? 'Ativando...' : 'Fazer Check-in'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              {escalasHoje.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma escala confirmada para hoje
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monitor Geral (para admins/managers) */}
      {statusGeral.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Monitor Geral de Ativação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {statusGeral.map((ativacao: AtivacaoStatus) => (
                <div key={ativacao.ativacao_id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{ativacao.medico_nome}</h4>
                    {getStatusBadge(ativacao.status_ativacao, ativacao.alerta_ativo)}
                  </div>
                  
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      Check-in: {ativacao.horario_checkin ? format(new Date(ativacao.horario_checkin), 'HH:mm') : 'N/A'}
                    </div>
                    
                    {ativacao.horario_checkout && (
                      <div className="flex items-center gap-2">
                        <LogOut className="h-3 w-3" />
                        Check-out: {format(new Date(ativacao.horario_checkout), 'HH:mm')}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      Tempo: {formatTempo(ativacao.tempo_online)}
                    </div>
                    
                    {ativacao.alerta_ativo && (
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-3 w-3" />
                        Alerta ativo
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};