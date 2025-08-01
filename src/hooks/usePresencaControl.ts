import { useState, useEffect, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export interface PresencaStatus {
  presenca_id: string;
  medico_id: string;
  medico_nome: string;
  escala_id: string;
  data_presenca: string;
  horario_checkin: string | null;
  horario_checkout: string | null;
  status_presenca: string;
  alerta_ativo: boolean;
  tempo_online: unknown;
}

interface CheckinResponse {
  sucesso: boolean;
  erro?: string;
  presenca_id?: string;
  horario_checkin?: string;
  status?: string;
}

interface CheckoutResponse {
  sucesso: boolean;
  erro?: string;
  horario_checkout?: string;
  status?: string;
  alerta_ativo?: boolean;
}

export const usePresencaControl = () => {
  const [presencaAtual, setPresencaAtual] = useState<PresencaStatus | null>(null);
  const [statusGeral, setStatusGeral] = useState<PresencaStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Buscar status atual de presença
  const fetchPresencaStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('obter_status_presenca_atual');
      
      if (error) {
        console.error('Erro ao buscar status de presença:', error);
        return;
      }

      setStatusGeral(data || []);
      
      // Encontrar presença do usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: medicoData } = await supabase
          .from('medicos')
          .select('id')
          .eq('user_id', user.id)
          .single();
        
        if (medicoData) {
          const presencaUsuario = data?.find(p => p.medico_id === medicoData.id);
          setPresencaAtual(presencaUsuario || null);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar presença:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fazer check-in
  const fazerCheckin = async (escalaId: string) => {
    try {
      const { data, error } = await supabase.rpc('fazer_checkin_presenca', {
        p_escala_id: escalaId,
        p_ip_address: null, // Poderia capturar IP real
        p_dispositivo_info: {
          user_agent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      });

      if (error) throw error;

      const response = data as unknown as CheckinResponse;
      
      if (response.sucesso) {
        toast({
          title: "Check-in realizado",
          description: "Você está presente e pronto para receber exames!",
        });
        await fetchPresencaStatus();
        return { success: true, data: response };
      } else {
        toast({
          title: "Erro no check-in",
          description: response.erro || "Erro desconhecido",
          variant: "destructive",
        });
        return { success: false, error: response.erro || "Erro desconhecido" };
      }
    } catch (error: any) {
      console.error('Erro ao fazer check-in:', error);
      toast({
        title: "Erro no check-in",
        description: error.message,
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  };

  // Fazer check-out manual
  const fazerCheckout = async (presencaId: string, observacoes?: string) => {
    try {
      const { data, error } = await supabase.rpc('fazer_checkout_presenca', {
        p_presenca_id: presencaId,
        p_observacoes: observacoes
      });

      if (error) throw error;

      const response = data as unknown as CheckoutResponse;
      
      if (response.sucesso) {
        toast({
          title: "Check-out realizado",
          description: "Você saiu do turno. Alerta ativo para a equipe.",
          variant: "destructive", // Alerta vermelho
        });
        await fetchPresencaStatus();
        return { success: true, data: response };
      } else {
        toast({
          title: "Erro no check-out",
          description: response.erro || "Erro desconhecido",
          variant: "destructive",
        });
        return { success: false, error: response.erro || "Erro desconhecido" };
      }
    } catch (error: any) {
      console.error('Erro ao fazer check-out:', error);
      toast({
        title: "Erro no check-out",
        description: error.message,
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  };

  // Verificar escalas do usuário para hoje
  const verificarEscalaHoje = async () => {
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return null;

      const { data: medicoData } = await supabase
        .from('medicos')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (!medicoData) return null;

      const { data: escalas, error } = await supabase
        .from('escalas_medicas')
        .select('*')
        .eq('medico_id', medicoData.id)
        .eq('data', hoje)
        .eq('status', 'confirmada');

      if (error) throw error;
      return escalas;
    } catch (error) {
      console.error('Erro ao verificar escala:', error);
      return null;
    }
  };

  // Setup realtime subscriptions
  useEffect(() => {
    fetchPresencaStatus();

    // Subscription para mudanças em tempo real
    const channel = supabase
      .channel('presenca-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'presenca_medico'
        },
        () => {
          fetchPresencaStatus();
        }
      )
      .subscribe();

    // Atualizar status periodicamente (para checkout automático)
    const interval = setInterval(fetchPresencaStatus, 60000); // A cada minuto

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchPresencaStatus]);

  return {
    presencaAtual,
    statusGeral,
    loading,
    fazerCheckin,
    fazerCheckout,
    verificarEscalaHoje,
    refetch: fetchPresencaStatus
  };
};