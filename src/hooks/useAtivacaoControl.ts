import { useState, useEffect, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export interface AtivacaoStatus {
  ativacao_id: string;
  medico_id: string;
  medico_nome: string;
  escala_id: string;
  data_ativacao: string;
  horario_checkin: string | null;
  horario_checkout: string | null;
  status_ativacao: string;
  alerta_ativo: boolean;
  tempo_online: unknown;
}

interface CheckinResponse {
  sucesso: boolean;
  erro?: string;
  ativacao_id?: string;
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

export const useAtivacaoControl = () => {
  const [ativacaoAtual, setAtivacaoAtual] = useState<AtivacaoStatus | null>(null);
  const [statusGeral, setStatusGeral] = useState<AtivacaoStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Buscar status atual de ativação
  const fetchAtivacaoStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('obter_status_ativacao_atual');
      
      if (error) {
        console.error('Erro ao buscar status de ativação:', error);
        return;
      }

      setStatusGeral(data || []);
      
      // Encontrar ativação do usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: medicoData } = await supabase
          .from('medicos')
          .select('id')
          .eq('user_id', user.id)
          .single();
        
        if (medicoData) {
          const ativacaoUsuario = data?.find((a: AtivacaoStatus) => a.medico_id === medicoData.id);
          setAtivacaoAtual(ativacaoUsuario || null);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar ativação:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fazer check-in
  const fazerCheckin = async (escalaId: string) => {
    try {
      const { data, error } = await supabase.rpc('fazer_checkin_ativacao', {
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
          description: "Você está ativo e pronto para receber exames!",
        });
        await fetchAtivacaoStatus();
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
  const fazerCheckout = async (ativacaoId: string, observacoes?: string) => {
    try {
      const { data, error } = await supabase.rpc('fazer_checkout_ativacao', {
        p_ativacao_id: ativacaoId,
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
        await fetchAtivacaoStatus();
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
    fetchAtivacaoStatus();

    // Subscription para mudanças em tempo real
    const channel = supabase
      .channel('ativacao-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ativacao_medico'
        },
        () => {
          fetchAtivacaoStatus();
        }
      )
      .subscribe();

    // Atualizar status periodicamente (para checkout automático)
    const interval = setInterval(fetchAtivacaoStatus, 60000); // A cada minuto

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchAtivacaoStatus]);

  return {
    ativacaoAtual,
    statusGeral,
    loading,
    fazerCheckin,
    fazerCheckout,
    verificarEscalaHoje,
    refetch: fetchAtivacaoStatus
  };
};