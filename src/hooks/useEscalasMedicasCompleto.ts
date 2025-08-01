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
  tipo_plantao?: 'noturno' | 'feriado' | 'final_semana' | 'normal';
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
  mes_referencia: number;
  ano_referencia: number;
  escala_replicada_de?: string;
  medico?: {
    nome: string;
    crm: string;
    especialidade: string;
    email?: string;
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
  turno?: 'manha' | 'tarde' | 'noite' | 'dia_inteiro';
  motivo?: string;
  aprovado: boolean;
  aprovado_por?: string;
  aprovado_em?: string;
  tipo_ausencia?: TipoAusencia;
  medico?: {
    nome: string;
    crm: string;
  };
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

export const useEscalasMedicasCompleto = () => {
  const [escalas, setEscalas] = useState<EscalaMedicaCompleta[]>([]);
  const [ausencias, setAusencias] = useState<AusenciaMedica[]>([]);
  const [tiposAusencia, setTiposAusencia] = useState<TipoAusencia[]>([]);
  const [configuracao, setConfiguracao] = useState<ConfiguracaoEscala | null>(null);
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
          medico:medicos(nome, crm, especialidade, email),
          cliente:clientes(nome)
        `)
        .order('data', { ascending: true });

      // Filtrar por mês/ano se especificado
      if (mesAno) {
        query = query
          .eq('mes_referencia', mesAno.mes)
          .eq('ano_referencia', mesAno.ano);
      }

      // Se for médico, mostrar apenas suas escalas
      if (isMedico && !hasPermission) {
        const { data: medico } = await supabase
          .from('medicos')
          .select('id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .single();
        
        if (medico) {
          query = query.eq('medico_id', medico.id);
        }
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
      let query = supabase
        .from('ausencias_medicas')
        .select(`
          *,
          tipo_ausencia:tipos_ausencia(*),
          medico:medicos(nome, crm)
        `)
        .order('data_inicio', { ascending: false });

      // Se for médico, mostrar apenas suas ausências
      if (isMedico && !hasPermission) {
        const { data: medico } = await supabase
          .from('medicos')
          .select('id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .single();
        
        if (medico) {
          query = query.eq('medico_id', medico.id);
        }
      }

      const { data, error } = await query;

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

  const criarEscala = async (dadosEscala: any) => {
    try {
      const { error } = await supabase
        .from('escalas_medicas')
        .insert([dadosEscala]);

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

  const replicarEscala = async (escalaId: string, mesesDestino: { mes: number; ano: number }[]) => {
    try {
      const escalaOriginal = escalas.find(e => e.id === escalaId);
      if (!escalaOriginal) {
        toast({
          title: "Erro",
          description: "Escala não encontrada",
          variant: "destructive",
        });
        return false;
      }

      const novasEscalas = mesesDestino.map(mesAno => {
        const { id, medico: medicoData, cliente: clienteData, ...escalaData } = escalaOriginal;
        return {
          ...escalaData,
          mes_referencia: mesAno.mes,
          ano_referencia: mesAno.ano,
          escala_replicada_de: escalaId,
        };
      });

      const { error } = await supabase
        .from('escalas_medicas')
        .insert(novasEscalas);

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
        title: "Escalas replicadas",
        description: `Escala replicada para ${mesesDestino.length} mês(es)`,
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

  const criarAusencia = async (dadosAusencia: any) => {
    try {
      const { error } = await supabase
        .from('ausencias_medicas')
        .insert([dadosAusencia]);

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
        title: "Ausência registrada",
        description: "Ausência registrada com sucesso",
      });

      await fetchAusencias();
      return true;
    } catch (error) {
      console.error('Erro ao criar ausência:', error);
      toast({
        title: "Erro ao criar ausência",
        description: "Erro inesperado ao registrar ausência",
        variant: "destructive",
      });
      return false;
    }
  };

  const aprovarAusencia = async (ausenciaId: string, aprovado: boolean) => {
    try {
      const { error } = await supabase
        .from('ausencias_medicas')
        .update({
          aprovado,
          aprovado_em: aprovado ? new Date().toISOString() : null,
          aprovado_por: aprovado ? (await supabase.auth.getUser()).data.user?.id : null,
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
        title: aprovado ? "Ausência aprovada" : "Ausência rejeitada",
        description: aprovado ? "Ausência foi aprovada" : "Ausência foi rejeitada",
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
    fetchEscalas,
    fetchAusencias,
    criarEscala,
    replicarEscala,
    criarAusencia,
    aprovarAusencia,
    canManageAll: hasPermission,
    isMedico
  };
};