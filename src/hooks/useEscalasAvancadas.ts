import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useHasPermission } from './useUserPermissions';

export interface EscalaAvancada {
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
  cliente_id?: string;
  capacidade_maxima_exames: number;
  preferencias_clientes: string[];
  exclusoes_clientes: string[];
  horario_inicio?: string;
  horario_fim?: string;
  dias_semana: number[];
  tipo_plantao?: 'noturno' | 'feriado' | 'final_semana' | 'normal';
  mes_referencia?: number;
  ano_referencia?: number;
  escala_replicada_de?: string;
  medico?: {
    nome: string;
    crm: string;
    especialidade: string;
    email: string;
  };
  cliente?: {
    nome: string;
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
  turno?: string;
  motivo?: string;
  aprovado: boolean;
  aprovado_por?: string;
  aprovado_em?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  tipo_ausencia?: TipoAusencia;
}

// Alias para compatibilidade
export type EscalaCompleta = EscalaAvancada;

export interface ConfiguracaoEscala {
  id: string;
  dia_envio_email: number;
  meses_antecipacao: number;
  capacidade_default_exames: number;
  horario_padrao_inicio: string;
  horario_padrao_fim: string;
  ativo: boolean;
}

export const useEscalasAvancadas = () => {
  const [escalas, setEscalas] = useState<EscalaAvancada[]>([]);
  const [tiposAusencia, setTiposAusencia] = useState<TipoAusencia[]>([]);
  const [ausencias, setAusencias] = useState<AusenciaMedica[]>([]);
  const [configuracao, setConfiguracao] = useState<ConfiguracaoEscala | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { hasPermission } = useHasPermission(['admin', 'manager']);
  const isMedico = useHasPermission(['medico']).hasPermission;

  const fetchEscalas = async (medicoId?: string, mesAno?: { mes: number; ano: number }) => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('escalas_medicas')
        .select(`
          *,
          medico:medicos(nome, crm, especialidade, email),
          cliente:clientes(nome)
        `)
        .order('data', { ascending: true });

      if (medicoId) {
        query = query.eq('medico_id', medicoId);
      }

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

      setEscalas((data || []) as EscalaAvancada[]);
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

      if (error) throw error;
      setTiposAusencia(data || []);
    } catch (error) {
      console.error('Erro ao buscar tipos de ausência:', error);
    }
  };

  const fetchAusencias = async (medicoId?: string) => {
    try {
      let query = supabase
        .from('ausencias_medicas')
        .select(`
          *,
          tipo_ausencia:tipos_ausencia(*)
        `)
        .order('data_inicio', { ascending: false });

      if (medicoId) {
        query = query.eq('medico_id', medicoId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAusencias(data || []);
    } catch (error) {
      console.error('Erro ao buscar ausências:', error);
    }
  };

  const fetchConfiguracao = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes_escala')
        .select('*')
        .eq('ativo', true)
        .maybeSingle();

      if (error) throw error;
      setConfiguracao(data);
    } catch (error) {
      console.error('Erro ao buscar configuração:', error);
    }
  };

  const criarEscala = async (escalaData: Partial<EscalaAvancada> & { data: string }) => {
    try {
      const dataObj = {
        medico_id: escalaData.medico_id!,
        data: escalaData.data,
        turno: escalaData.turno || 'manha',
        tipo_escala: escalaData.tipo_escala || 'normal',
        modalidade: escalaData.modalidade || '',
        especialidade: escalaData.especialidade || '',
        status: escalaData.status || 'confirmada',
        mes_referencia: new Date(escalaData.data).getMonth() + 1,
        ano_referencia: new Date(escalaData.data).getFullYear(),
        capacidade_maxima_exames: escalaData.capacidade_maxima_exames || 50,
        preferencias_clientes: escalaData.preferencias_clientes || [],
        exclusoes_clientes: escalaData.exclusoes_clientes || [],
        dias_semana: escalaData.dias_semana || [],
        observacoes: escalaData.observacoes,
        horario_inicio: escalaData.horario_inicio,
        horario_fim: escalaData.horario_fim,
        tipo_plantao: escalaData.tipo_plantao,
        cliente_id: escalaData.cliente_id
      };

      const { error } = await supabase
        .from('escalas_medicas')
        .insert(dataObj);

      if (error) {
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
      return false;
    }
  };

  const atualizarEscala = async (id: string, dados: Partial<EscalaAvancada>) => {
    try {
      const { error } = await supabase
        .from('escalas_medicas')
        .update(dados)
        .eq('id', id);

      if (error) {
        toast({
          title: "Erro ao atualizar escala",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Escala atualizada",
        description: "Escala atualizada com sucesso",
      });

      await fetchEscalas();
      return true;
    } catch (error) {
      console.error('Erro ao atualizar escala:', error);
      return false;
    }
  };

  const criarAusencia = async (ausenciaData: { 
    medico_id: string; 
    tipo_ausencia_id: string; 
    data_inicio: string; 
    data_fim: string; 
    turno?: string; 
    motivo?: string;
  }) => {
    try {
      const { error } = await supabase
        .from('ausencias_medicas')
        .insert(ausenciaData);

      if (error) {
        toast({
          title: "Erro ao registrar ausência",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Ausência registrada",
        description: "Ausência registrada com sucesso e aguarda aprovação",
      });

      await fetchAusencias();
      return true;
    } catch (error) {
      console.error('Erro ao criar ausência:', error);
      return false;
    }
  };

  const aprovarAusencia = async (id: string, aprovado: boolean) => {
    try {
      const { error } = await supabase
        .from('ausencias_medicas')
        .update({
          aprovado,
          aprovado_em: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        toast({
          title: "Erro ao aprovar ausência",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: aprovado ? "Ausência aprovada" : "Ausência rejeitada",
        description: `Ausência ${aprovado ? 'aprovada' : 'rejeitada'} com sucesso`,
      });

      await fetchAusencias();
      return true;
    } catch (error) {
      console.error('Erro ao aprovar ausência:', error);
      return false;
    }
  };

  const replicarEscala = async (
    medicoId: string,
    mesOrigem: number,
    anoOrigem: number,
    mesDestino: number,
    anoDestino: number
  ) => {
    try {
      const { data, error } = await supabase.rpc('replicar_escala_medico', {
        p_medico_id: medicoId,
        p_mes_origem: mesOrigem,
        p_ano_origem: anoOrigem,
        p_mes_destino: mesDestino,
        p_ano_destino: anoDestino
      });

      if (error) {
        toast({
          title: "Erro ao replicar escala",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      const result = data as any;
      toast({
        title: "Escala replicada",
        description: `${result.escalas_replicadas || 0} escalas replicadas com sucesso`,
      });

      await fetchEscalas();
      return true;
    } catch (error) {
      console.error('Erro ao replicar escala:', error);
      return false;
    }
  };

  const calcularCapacidadeProdutiva = async (medicoId: string) => {
    try {
      const { data, error } = await supabase.rpc('calcular_capacidade_produtiva', {
        p_medico_id: medicoId
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao calcular capacidade:', error);
      return null;
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      await Promise.all([
        fetchEscalas(),
        fetchTiposAusencia(),
        fetchAusencias(),
        fetchConfiguracao()
      ]);
    };

    initializeData();
  }, []);

  return {
    escalas,
    tiposAusencia,
    ausencias,
    configuracao,
    loading,
    fetchEscalas,
    criarEscala,
    atualizarEscala,
    criarAusencia,
    aprovarAusencia,
    replicarEscala,
    calcularCapacidadeProdutiva,
    canManageAll: hasPermission,
    isMedico
  };
};