import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useHasPermission } from './useUserPermissions';

export interface EscalaCompleta {
  id: string;
  medico_id: string;
  data: string;
  turno: 'manha' | 'tarde' | 'noite' | 'plantao';
  tipo_escala: 'normal' | 'plantao' | 'extra' | 'backup';
  tipo_plantao?: 'noturno' | 'feriado' | 'final_semana' | 'normal';
  modalidade: string;
  especialidade: string;
  status: 'confirmada' | 'pendente' | 'ausencia' | 'cancelada';
  horario_inicio?: string;
  horario_fim?: string;
  dias_semana?: number[];
  capacidade_maxima_exames?: number;
  preferencias_clientes?: string[];
  exclusoes_clientes?: string[];
  mes_referencia?: number;
  ano_referencia?: number;
  escala_replicada_de?: string;
  observacoes?: string;
  medico?: {
    nome: string;
    crm: string;
    especialidade: string;
  };
}

export interface TipoAusencia {
  id: string;
  nome: string;
  descricao?: string;
  cor: string;
  ativo: boolean;
}

export interface AusenciaMedica {
  id: string;
  medico_id: string;
  tipo_ausencia_id: string;
  data_inicio: string;
  data_fim: string;
  turno?: 'manha' | 'tarde' | 'noite' | 'dia_inteiro';
  motivo?: string;
  aprovado: boolean;
  aprovado_por?: string;
  aprovado_em?: string;
  tipo_ausencia?: TipoAusencia;
}

export const useEscalasAvancadas = () => {
  const [escalas, setEscalas] = useState<EscalaCompleta[]>([]);
  const [tiposAusencia, setTiposAusencia] = useState<TipoAusencia[]>([]);
  const [ausencias, setAusencias] = useState<AusenciaMedica[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { hasPermission } = useHasPermission(['admin', 'manager']);
  const isMedico = useHasPermission(['medico']).hasPermission;

  const fetchEscalas = async (mesAno?: { mes: number; ano: number }) => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('escalas_medicas')
        .select(`
          *,
          medico:medicos(nome, crm, especialidade)
        `)
        .order('data', { ascending: true });

      if (mesAno) {
        query = query
          .eq('mes_referencia', mesAno.mes)
          .eq('ano_referencia', mesAno.ano);
      }

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

      setEscalas((data || []) as EscalaCompleta[]);
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

  const fetchTiposAusencia = async () => {
    try {
      const { data, error } = await supabase
        .from('tipos_ausencia')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (error) {
        console.error('Erro ao buscar tipos de ausência:', error);
        return;
      }

      setTiposAusencia(data || []);
    } catch (error) {
      console.error('Erro ao buscar tipos de ausência:', error);
    }
  };

  const fetchAusencias = async () => {
    try {
      const { data, error } = await supabase
        .from('ausencias_medicas')
        .select(`
          *,
          tipo_ausencia:tipos_ausencia(*)
        `)
        .order('data_inicio', { ascending: false });

      if (error) {
        console.error('Erro ao buscar ausências:', error);
        return;
      }

      setAusencias((data || []) as AusenciaMedica[]);
    } catch (error) {
      console.error('Erro ao buscar ausências:', error);
    }
  };

  const criarEscala = async (escala: any) => {
    try {
      const { error } = await supabase
        .from('escalas_medicas')
        .insert(escala);

      if (error) {
        console.error('Erro ao criar escala:', error);
        toast({
          title: "Erro ao criar escala",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Escala criada",
        description: "Escala criada com sucesso",
      });

      await fetchEscalas();
      return true;
    } catch (error) {
      console.error('Erro ao criar escala:', error);
      toast({
        title: "Erro ao criar escala",
        description: "Erro inesperado ao criar escala",
        variant: "destructive",
      });
      return false;
    }
  };

  const replicarEscala = async (escalaId: string, mesesParaReplicar: number) => {
    try {
      // Buscar a escala original
      const { data: escalaOriginal, error: fetchError } = await supabase
        .from('escalas_medicas')
        .select('*')
        .eq('id', escalaId)
        .single();

      if (fetchError || !escalaOriginal) {
        throw new Error('Escala não encontrada');
      }

      const escalasParaInserir = [];
      const dataOriginal = new Date(escalaOriginal.data);
      
      for (let i = 1; i <= mesesParaReplicar; i++) {
        const novaData = new Date(dataOriginal);
        novaData.setMonth(novaData.getMonth() + i);
        
        escalasParaInserir.push({
          ...escalaOriginal,
          id: undefined,
          data: novaData.toISOString().split('T')[0],
          mes_referencia: novaData.getMonth() + 1,
          ano_referencia: novaData.getFullYear(),
          escala_replicada_de: escalaId,
          status: 'pendente',
          created_at: undefined,
          updated_at: undefined
        });
      }

      const { error } = await supabase
        .from('escalas_medicas')
        .insert(escalasParaInserir);

      if (error) {
        console.error('Erro ao replicar escala:', error);
        toast({
          title: "Erro ao replicar escala",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Escala replicada",
        description: `Escala replicada para ${mesesParaReplicar} meses`,
      });

      await fetchEscalas();
      return true;
    } catch (error) {
      console.error('Erro ao replicar escala:', error);
      toast({
        title: "Erro ao replicar escala",
        description: "Erro inesperado ao replicar escala",
        variant: "destructive",
      });
      return false;
    }
  };

  const criarAusencia = async (ausencia: any) => {
    try {
      const { error } = await supabase
        .from('ausencias_medicas')
        .insert(ausencia);

      if (error) {
        console.error('Erro ao criar ausência:', error);
        toast({
          title: "Erro ao criar ausência",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Ausência criada",
        description: "Ausência registrada com sucesso",
      });

      await fetchAusencias();
      return true;
    } catch (error) {
      console.error('Erro ao criar ausência:', error);
      toast({
        title: "Erro ao criar ausência",
        description: "Erro inesperado ao criar ausência",
        variant: "destructive",
      });
      return false;
    }
  };

  const aprovarAusencia = async (ausenciaId: string) => {
    try {
      const { error } = await supabase
        .from('ausencias_medicas')
        .update({
          aprovado: true,
          aprovado_em: new Date().toISOString()
        })
        .eq('id', ausenciaId);

      if (error) {
        console.error('Erro ao aprovar ausência:', error);
        toast({
          title: "Erro ao aprovar ausência",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Ausência aprovada",
        description: "Ausência aprovada com sucesso",
      });

      await fetchAusencias();
      return true;
    } catch (error) {
      console.error('Erro ao aprovar ausência:', error);
      toast({
        title: "Erro ao aprovar ausência",
        description: "Erro inesperado ao aprovar ausência",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    fetchEscalas();
    fetchTiposAusencia();
    fetchAusencias();
  }, []);

  return {
    escalas,
    tiposAusencia,
    ausencias,
    loading,
    criarEscala,
    replicarEscala,
    criarAusencia,
    aprovarAusencia,
    fetchEscalas,
    fetchTiposAusencia,
    fetchAusencias,
    canManageAll: hasPermission,
    isMedico
  };
};