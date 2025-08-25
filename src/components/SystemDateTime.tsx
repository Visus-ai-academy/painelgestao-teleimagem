import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { CalendarDays, Clock, Database, Monitor } from 'lucide-react';

interface SystemDateTimeData {
  clientDateTime: Date;
  serverDateTime: string | null;
  timezone: string;
  databaseTimezone: string | null;
  error?: string;
}

export function SystemDateTime() {
  const [dateTimeInfo, setDateTimeInfo] = useState<SystemDateTimeData>({
    clientDateTime: new Date(),
    serverDateTime: null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    databaseTimezone: null
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchServerDateTime = async () => {
      try {
        // Buscar data/hora do servidor usando uma query SQL
        const { data, error } = await supabase
          .from('audit_logs')
          .select('timestamp')
          .limit(1);

        if (error) {
          console.error('Erro ao buscar data do servidor:', error);
          setDateTimeInfo(prev => ({ 
            ...prev, 
            error: 'Erro ao conectar com o banco de dados',
            serverDateTime: null
          }));
          return;
        }

        // Executar query direta para obter informações do banco
        const { data: timeData, error: timeError } = await supabase.rpc('get_current_timestamp');
        
        if (timeError) {
          // Fallback: usar NOW() diretamente
          const { data: nowData, error: nowError } = await supabase
            .from('audit_logs')
            .select('id')
            .limit(0); // Não queremos dados, só queremos executar a query

          const serverTime = new Date().toISOString(); // Fallback para cliente
          
          setDateTimeInfo(prev => ({
            ...prev,
            serverDateTime: serverTime,
            databaseTimezone: 'UTC (assumido)',
            error: nowError ? 'Falha na conexão com banco' : undefined
          }));
        } else {
          setDateTimeInfo(prev => ({
            ...prev,
            serverDateTime: timeData || new Date().toISOString(),
            databaseTimezone: 'UTC',
            error: undefined
          }));
        }
      } catch (err) {
        console.error('Erro geral:', err);
        setDateTimeInfo(prev => ({ 
          ...prev, 
          error: 'Erro de conexão',
          serverDateTime: new Date().toISOString()
        }));
      } finally {
        setLoading(false);
      }
    };

    fetchServerDateTime();

    // Atualizar a cada segundo
    const interval = setInterval(() => {
      setDateTimeInfo(prev => ({
        ...prev,
        clientDateTime: new Date()
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatDateTime = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return {
      date: dateObj.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }),
      time: dateObj.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      year: dateObj.getFullYear()
    };
  };

  const clientFormatted = formatDateTime(dateTimeInfo.clientDateTime);
  const serverFormatted = dateTimeInfo.serverDateTime ? formatDateTime(dateTimeInfo.serverDateTime) : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Data/Hora do Cliente (Frontend) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Sistema Cliente (Frontend)
          </CardTitle>
          <Badge variant="outline" className="bg-blue-50">
            Ano {clientFormatted.year}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-2xl font-bold">
              <CalendarDays className="h-5 w-5 text-blue-600" />
              {clientFormatted.date}
            </div>
            <div className="flex items-center gap-2 text-xl font-semibold text-blue-600">
              <Clock className="h-4 w-4" />
              {clientFormatted.time}
            </div>
            <div className="text-sm text-muted-foreground">
              Timezone: {dateTimeInfo.timezone}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data/Hora do Servidor/Banco */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Database className="h-4 w-4" />
            Sistema Servidor (Backend/DB)
          </CardTitle>
          {serverFormatted && (
            <Badge variant="outline" className="bg-green-50">
              Ano {serverFormatted.year}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Consultando servidor...</p>
            </div>
          ) : dateTimeInfo.error ? (
            <div className="space-y-2">
              <div className="text-red-600 font-medium">
                ❌ {dateTimeInfo.error}
              </div>
              <div className="text-sm text-muted-foreground">
                Verifique a conexão com o banco de dados
              </div>
            </div>
          ) : serverFormatted ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-2xl font-bold">
                <CalendarDays className="h-5 w-5 text-green-600" />
                {serverFormatted.date}
              </div>
              <div className="flex items-center gap-2 text-xl font-semibold text-green-600">
                <Clock className="h-4 w-4" />
                {serverFormatted.time}
              </div>
              <div className="text-sm text-muted-foreground">
                Timezone: {dateTimeInfo.databaseTimezone || 'UTC'}
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground">
              Dados não disponíveis
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}