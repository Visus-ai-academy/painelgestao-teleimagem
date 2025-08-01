import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Users, 
  CheckCircle, 
  AlertTriangle, 
  LogOut,
  Clock,
  User
} from 'lucide-react';
import { usePresencaMedico } from '@/hooks/usePresencaMedico';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const MonitorPresencaGeral: React.FC = () => {
  const { presencasHoje, loading } = usePresencaMedico();

  const estatisticas = {
    total: presencasHoje.length,
    presentes: presencasHoje.filter(p => p.status === 'presente').length,
    ausentes: presencasHoje.filter(p => p.status === 'ausente').length,
    finalizados: presencasHoje.filter(p => p.status.includes('checkout')).length,
    alertas: presencasHoje.filter(p => p.status === 'checkout_manual').length
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'presente':
        return <Badge className="bg-green-100 text-green-800">Presente</Badge>;
      case 'ausente':
        return <Badge variant="destructive">Ausente</Badge>;
      case 'checkout_manual':
        return <Badge variant="secondary">Check-out Manual</Badge>;
      case 'checkout_automatico':
        return <Badge variant="outline">Check-out Automático</Badge>;
      default:
        return <Badge variant="secondary">Indefinido</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'presente':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'ausente':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'checkout_manual':
      case 'checkout_automatico':
        return <LogOut className="h-4 w-4 text-gray-600" />;
      default:
        return <User className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estatísticas Resumidas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{estatisticas.total}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Presentes</p>
              <p className="text-2xl font-bold">{estatisticas.presentes}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm text-muted-foreground">Ausentes</p>
              <p className="text-2xl font-bold">{estatisticas.ausentes}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <LogOut className="h-5 w-5 text-gray-500" />
            <div>
              <p className="text-sm text-muted-foreground">Finalizados</p>
              <p className="text-2xl font-bold">{estatisticas.finalizados}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            <div>
              <p className="text-sm text-muted-foreground">Alertas</p>
              <p className="text-2xl font-bold">{estatisticas.alertas}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Alertas */}
      {estatisticas.alertas > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {estatisticas.alertas} médico(s) realizaram check-out manual durante o turno.
            Verifique a distribuição de exames.
          </AlertDescription>
        </Alert>
      )}

      {/* Lista de Presenças */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Presenças de Hoje ({format(new Date(), 'dd/MM/yyyy', { locale: ptBR })})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {presencasHoje.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma escala programada para hoje</p>
            </div>
          ) : (
            <div className="space-y-4">
              {presencasHoje.map((presenca) => (
                <div
                  key={presenca.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(presenca.status)}
                    <div>
                      <h4 className="font-medium">
                        {presenca.medico?.nome || 'Nome não disponível'}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        CRM: {presenca.medico?.crm} | {presenca.medico?.especialidade}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Turno: <span className="capitalize">{presenca.turno}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm">
                      {presenca.checkin_timestamp && (
                        <p className="text-muted-foreground">
                          Check-in: {format(new Date(presenca.checkin_timestamp), 'HH:mm', { locale: ptBR })}
                        </p>
                      )}
                      {presenca.checkout_timestamp && (
                        <p className="text-muted-foreground">
                          Check-out: {format(new Date(presenca.checkout_timestamp), 'HH:mm', { locale: ptBR })}
                        </p>
                      )}
                      {presenca.tempo_total_presenca && (
                        <p className="text-muted-foreground">
                          Total: {presenca.tempo_total_presenca}min
                        </p>
                      )}
                    </div>
                    {getStatusBadge(presenca.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};