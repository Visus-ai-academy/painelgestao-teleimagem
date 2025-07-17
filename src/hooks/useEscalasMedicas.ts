import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useHasPermission } from './useUserPermissions';

export interface EscalaMedica {
  id: string;
  medico_id: string;
  data: string;
  turno: 'manha' | 'tarde' | 'noite' | 'plantao';
  tipo_escala: 'normal' | 'plantao' | 'extra' | 'backup';
  modalidade: string;
  especialidade: string;
  status: 'confirmada' | 'pendente' | 'ausencia' | 'cancelada';
  observacoes?: string;
  motivo_ausencia?: string;
  data_ausencia?: string;
  medico?: {
    nome: string;
    crm: string;
    especialidade: string;
  };
}

export const useEscalasMedicas = () => {
  const [escalas, setEscalas] = useState<EscalaMedica[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { hasPermission } = useHasPermission(['admin', 'manager']);
  const isMedico = useHasPermission(['medico']).hasPermission;

  const fetchEscalas = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('escalas_medicas')
        .select(`
          *,
          medico:medicos(nome, crm, especialidade)
        `)
        .order('data', { ascending: true });

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar escalas:', error);
        toast({
          title: "Erro ao carregar escalas",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setEscalas((data || []) as EscalaMedica[]);
    } catch (error) {
      console.error('Erro ao buscar escalas:', error);
      toast({
        title: "Erro ao carregar escalas",
        description: "Erro inesperado ao carregar escalas médicas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const informarAusencia = async (escalaId: string, motivo: string) => {
    try {
      const { error } = await supabase
        .from('escalas_medicas')
        .update({
          status: 'ausencia',
          motivo_ausencia: motivo,
          data_ausencia: new Date().toISOString()
        })
        .eq('id', escalaId);

      if (error) {
        console.error('Erro ao informar ausência:', error);
        toast({
          title: "Erro ao informar ausência",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Ausência informada",
        description: "Ausência registrada com sucesso",
      });

      await fetchEscalas();
      return true;
    } catch (error) {
      console.error('Erro ao informar ausência:', error);
      toast({
        title: "Erro ao informar ausência",
        description: "Erro inesperado ao registrar ausência",
        variant: "destructive",
      });
      return false;
    }
  };

  const confirmarEscala = async (escalaId: string) => {
    try {
      const { error } = await supabase
        .from('escalas_medicas')
        .update({
          status: 'confirmada',
          motivo_ausencia: null,
          data_ausencia: null
        })
        .eq('id', escalaId);

      if (error) {
        console.error('Erro ao confirmar escala:', error);
        toast({
          title: "Erro ao confirmar escala",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Escala confirmada",
        description: "Escala confirmada com sucesso",
      });

      await fetchEscalas();
      return true;
    } catch (error) {
      console.error('Erro ao confirmar escala:', error);
      toast({
        title: "Erro ao confirmar escala",
        description: "Erro inesperado ao confirmar escala",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    fetchEscalas();
  }, []);

  return {
    escalas,
    loading,
    informarAusencia,
    confirmarEscala,
    fetchEscalas,
    canManageAll: hasPermission,
    isMedico
  };
};