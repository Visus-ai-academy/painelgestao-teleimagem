import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useHasPermission } from './useUserPermissions';

export interface EscalaMedicaCompleta {
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
  capacidade_maxima_exames?: number;
  preferencias_clientes?: string[];
  exclusoes_clientes?: string[];
  horario_inicio?: string;
  horario_fim?: string;
  dias_semana?: number[];
  tipo_plantao?: 'noturno' | 'feriado' | 'final_semana' | 'normal';
  mes_referencia?: number;
  ano_referencia?: number;
  escala_replicada_de?: string;
  medico?: {
    nome: string;
    crm: string;
    especialidade: string;
  };
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
  tipo_ausencia?: {
    nome: string;
    descricao: string;
    cor: string;
  };
}

export interface TipoAusencia {
  id: string;
  nome: string;
  descricao?: string;
  cor: string;
  ativo: boolean;
}

export interface ConfiguracaoEscala {
  id: string;
  dia_envio_email: number;
  meses_antecipacao: number;
  capacidade_default_exames: number;
  horario_padrao_inicio: string;
  horario_padrao_fim: string;
  ativo: boolean;
}

export const useEscalasMedicasCompleta = () => {
  const [escalas, setEscalas] = useState<EscalaMedicaCompleta[]>([]);
  const [ausencias, setAusencias] = useState<AusenciaMedica[]>([]);
  const [tiposAusencia, setTiposAusencia] = useState<TipoAusencia[]>([]);
  const [configuracao, setConfiguracao] = useState<ConfiguracaoEscala | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { hasPermission } = useHasPermission(['admin', 'manager']);
  const isMedico = useHasPermission(['medico']).hasPermission;

  const fetchEscalas = async (mesReferencia?: number, anoReferencia?: number) => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('escalas_medicas')
        .select(`
          *,
          medico:medicos(nome, crm, especialidade)
        `)
        .order('data', { ascending: true });

      // Filtrar por mês/ano se especificado
      if (mesReferencia && anoReferencia) {
        query = query
          .eq('mes_referencia', mesReferencia)
          .eq('ano_referencia', anoReferencia);
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

      setEscalas((data || []) as EscalaMedicaCompleta[]);
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

  const fetchAusencias = async () => {
    try {
      const { data, error } = await supabase
        .from('ausencias_medicas')
        .select(`
          *,
          tipo_ausencia:tipos_ausencia(nome, descricao, cor)
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

      setTiposAusencia((data || []) as TipoAusencia[]);
    } catch (error) {
      console.error('Erro ao buscar tipos de ausência:', error);
    }
  };

  const fetchConfiguracao = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes_escala')
        .select('*')
        .eq('ativo', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao buscar configuração:', error);
        return;
      }

      setConfiguracao(data as ConfiguracaoEscala);
    } catch (error) {
      console.error('Erro ao buscar configuração:', error);
    }
  };

  const criarEscala = async (escala: Partial<EscalaMedicaCompleta>) => {
    try {
      const user = await supabase.auth.getUser();
      const { error } = await supabase
        .from('escalas_medicas')
        .insert({
          medico_id: escala.medico_id!,
          data: escala.data!,
          turno: escala.turno!,
          tipo_escala: escala.tipo_escala!,
          modalidade: escala.modalidade!,
          especialidade: escala.especialidade!,
          status: escala.status || 'pendente',
          observacoes: escala.observacoes,
          cliente_id: escala.cliente_id,
          capacidade_maxima_exames: escala.capacidade_maxima_exames,
          preferencias_clientes: escala.preferencias_clientes,
          exclusoes_clientes: escala.exclusoes_clientes,
          horario_inicio: escala.horario_inicio,
          horario_fim: escala.horario_fim,
          dias_semana: escala.dias_semana,
          tipo_plantao: escala.tipo_plantao,
          mes_referencia: escala.mes_referencia,
          ano_referencia: escala.ano_referencia,
          escala_replicada_de: escala.escala_replicada_de,
          created_by: user.data.user?.id
        });

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

  const replicarEscala = async (escalaId: string, mesesParaReplicar: number[]) => {
    try {
      const user = await supabase.auth.getUser();
      const escalasParaReplicar = escalas.filter(e => 
        mesesParaReplicar.some(mes => e.mes_referencia === mes && e.ano_referencia === new Date().getFullYear())
      );

      const novasEscalas = escalasParaReplicar.map(escala => ({
        medico_id: escala.medico_id,
        data: escala.data,
        turno: escala.turno,
        tipo_escala: escala.tipo_escala,
        modalidade: escala.modalidade,
        especialidade: escala.especialidade,
        status: 'pendente' as const,
        cliente_id: escala.cliente_id,
        capacidade_maxima_exames: escala.capacidade_maxima_exames,
        preferencias_clientes: escala.preferencias_clientes,
        exclusoes_clientes: escala.exclusoes_clientes,
        horario_inicio: escala.horario_inicio,
        horario_fim: escala.horario_fim,
        dias_semana: escala.dias_semana,
        tipo_plantao: escala.tipo_plantao,
        escala_replicada_de: escalaId,
        created_by: user.data.user?.id
      }));

      const { error } = await supabase
        .from('escalas_medicas')
        .insert(novasEscalas);

      if (error) {
        console.error('Erro ao replicar escalas:', error);
        toast({
          title: "Erro ao replicar escalas",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Escalas replicadas",
        description: `${novasEscalas.length} escalas replicadas com sucesso`,
      });

      await fetchEscalas();
      return true;
    } catch (error) {
      console.error('Erro ao replicar escalas:', error);
      toast({
        title: "Erro ao replicar escalas",
        description: "Erro inesperado ao replicar escalas",
        variant: "destructive",
      });
      return false;
    }
  };

  const informarAusencia = async (ausencia: Partial<AusenciaMedica>) => {
    try {
      const user = await supabase.auth.getUser();
      const { error } = await supabase
        .from('ausencias_medicas')
        .insert({
          medico_id: ausencia.medico_id!,
          tipo_ausencia_id: ausencia.tipo_ausencia_id!,
          data_inicio: ausencia.data_inicio!,
          data_fim: ausencia.data_fim!,
          turno: ausencia.turno,
          motivo: ausencia.motivo,
          aprovado: false,
          created_by: user.data.user?.id
        });

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
        description: "Ausência registrada com sucesso e enviada para aprovação",
      });

      await fetchAusencias();
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

  const aprovarAusencia = async (ausenciaId: string, aprovado: boolean) => {
    try {
      const user = await supabase.auth.getUser();
      const { error } = await supabase
        .from('ausencias_medicas')
        .update({
          aprovado,
          aprovado_por: user.data.user?.id,
          aprovado_em: new Date().toISOString()
        })
        .eq('id', ausenciaId);

      if (error) {
        console.error('Erro ao processar ausência:', error);
        toast({
          title: "Erro ao processar ausência",
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
      console.error('Erro ao processar ausência:', error);
      toast({
        title: "Erro ao processar ausência",
        description: "Erro inesperado ao processar ausência",
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
    fetchAusencias();
    fetchTiposAusencia();
    fetchConfiguracao();
  }, []);

  return {
    escalas,
    ausencias,
    tiposAusencia,
    configuracao,
    loading,
    criarEscala,
    replicarEscala,
    informarAusencia,
    aprovarAusencia,
    confirmarEscala,
    fetchEscalas,
    fetchAusencias,
    canManageAll: hasPermission,
    isMedico
  };
};