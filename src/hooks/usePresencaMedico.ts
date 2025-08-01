import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PresencaMedico {
  id: string;
  medico_id: string;
  data_escala: string;
  turno: string;
  status: 'ausente' | 'presente' | 'checkout_manual' | 'checkout_automatico';
  checkin_timestamp: string | null;
  checkout_timestamp: string | null;
  tempo_total_presenca: number | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  medico?: {
    nome: string;
    crm: string;
    especialidade: string;
  };
}

export interface LogPresenca {
  id: string;
  presenca_id: string;
  acao: 'checkin' | 'checkout_manual' | 'checkout_automatico' | 'alerta_deslogado';
  timestamp: string;
  observacoes: string | null;
}

export const usePresencaMedico = () => {
  const [presencasHoje, setPresencasHoje] = useState<PresencaMedico[]>([]);
  const [minhaPresenca, setMinhaPresenca] = useState<PresencaMedico | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPresencasHoje = async () => {
    try {
      const hoje = new Date().toISOString().split('T')[0];
      
      // Simulação temporária até as tabelas serem criadas no banco
      const simulatedData: PresencaMedico[] = [
        {
          id: '1',
          medico_id: 'med1',
          data_escala: hoje,
          turno: 'manha',
          status: 'presente',
          checkin_timestamp: new Date().toISOString(),
          checkout_timestamp: null,
          tempo_total_presenca: null,
          observacoes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          medico: {
            nome: 'Dr. João Silva',
            crm: '12345',
            especialidade: 'Radiologia'
          }
        }
      ];
      
      setPresencasHoje(simulatedData);
    } catch (error) {
      console.error('Erro ao buscar presenças:', error);
    }
  };

  const fetchMinhaPresenca = async () => {
    try {
      // Simulação temporária - verificar se o médico tem escala hoje
      const hoje = new Date().toISOString().split('T')[0];
      const simulatedPresenca: PresencaMedico = {
        id: '1',
        medico_id: 'med1',
        data_escala: hoje,
        turno: 'manha',
        status: 'ausente', // Padrão ausente até fazer check-in
        checkin_timestamp: null,
        checkout_timestamp: null,
        tempo_total_presenca: null,
        observacoes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      setMinhaPresenca(simulatedPresenca);
    } catch (error) {
      console.error('Erro ao buscar minha presença:', error);
    }
  };

  const fazerCheckin = async () => {
    try {
      setLoading(true);
      
      // Simulação temporária - atualizar status para presente
      if (minhaPresenca) {
        const novaPresenca = {
          ...minhaPresenca,
          status: 'presente' as const,
          checkin_timestamp: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setMinhaPresenca(novaPresenca);
        
        toast({
          title: "Check-in realizado",
          description: "Você agora está presente e disponível para exames",
        });
        
        await fetchPresencasHoje();
        return true;
      } else {
        toast({
          title: "Erro no check-in",
          description: "Nenhuma escala encontrada para hoje",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      console.error('Erro ao fazer check-in:', error);
      toast({
        title: "Erro no check-in",
        description: "Erro inesperado ao realizar check-in",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const fazerCheckout = async (observacoes?: string) => {
    try {
      setLoading(true);
      
      if (minhaPresenca && minhaPresenca.checkin_timestamp) {
        const checkout = new Date().toISOString();
        const checkin = new Date(minhaPresenca.checkin_timestamp);
        const tempoTotal = Math.round((new Date(checkout).getTime() - checkin.getTime()) / (1000 * 60));
        
        const novaPresenca = {
          ...minhaPresenca,
          status: 'checkout_manual' as const,
          checkout_timestamp: checkout,
          tempo_total_presenca: tempoTotal,
          observacoes: observacoes || null,
          updated_at: new Date().toISOString()
        };
        setMinhaPresenca(novaPresenca);
        
        toast({
          title: "Check-out realizado",
          description: `Tempo total de presença: ${tempoTotal} minutos`,
        });
        
        await fetchPresencasHoje();
        return true;
      } else {
        toast({
          title: "Erro no check-out",
          description: "Você precisa fazer check-in primeiro",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      console.error('Erro ao fazer check-out:', error);
      toast({
        title: "Erro no check-out",
        description: "Erro inesperado ao realizar check-out",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const verificarCheckoutAutomatico = async () => {
    try {
      // Simulação temporária - verificar se passou 60min do fim do turno
      // Em produção, isso seria feito pelo banco de dados
      console.log('Verificando checkout automático...');
      return { processados: 0 };
    } catch (error) {
      console.error('Erro ao verificar checkout automático:', error);
      return null;
    }
  };

  // Configurar real-time para atualizações automáticas (temporariamente desabilitado)
  useEffect(() => {
    // Em produção, seria configurado o real-time aqui
    console.log('Real-time presence updates seria configurado aqui');
  }, []);

  // Verificar checkout automático a cada 5 minutos
  useEffect(() => {
    const interval = setInterval(() => {
      verificarCheckoutAutomatico();
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await Promise.all([
        fetchPresencasHoje(),
        fetchMinhaPresenca()
      ]);
      setLoading(false);
    };

    initializeData();
  }, []);

  return {
    presencasHoje,
    minhaPresenca,
    loading,
    fazerCheckin,
    fazerCheckout,
    fetchPresencasHoje,
    fetchMinhaPresenca,
    verificarCheckoutAutomatico
  };
};