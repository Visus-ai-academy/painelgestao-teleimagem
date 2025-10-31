import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface MedicoRepasse {
  id: string;
  nome: string;
  crm: string;
  cpf: string;
  email: string;
  ativo: boolean;
}

export interface ValorAdicional {
  data: string;
  valor: number;
  descricao: string;
}

export interface DemonstrativoRepasse {
  medico_id: string;
  medico_nome: string;
  medico_crm: string;
  medico_cpf: string;
  total_laudos: number;
  valor_exames: number;
  valor_adicionais: number;
  valor_total: number;
  detalhes_exames: Array<{
    modalidade: string;
    especialidade: string;
    categoria: string;
    prioridade: string;
    cliente: string;
    quantidade: number;
    valor_unitario: number;
    valor_total: number;
  }>;
  adicionais: ValorAdicional[];
}

export interface StatusRepasse {
  medico_id: string;
  medico_nome: string;
  demonstrativo_gerado: boolean;
  relatorio_gerado: boolean;
  email_enviado: boolean;
  omie_conta_gerada: boolean;
  link_relatorio?: string;
  erro?: string;
}

export function useRepasseMedico(periodoSelecionado: string) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [medicos, setMedicos] = useState<MedicoRepasse[]>([]);
  const [demonstrativos, setDemonstrativos] = useState<DemonstrativoRepasse[]>([]);
  const [statusRepasses, setStatusRepasses] = useState<StatusRepasse[]>([]);

  // Carregar médicos ativos
  const carregarMedicos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('medicos')
        .select('id, nome, crm, cpf, email, ativo')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;

      setMedicos(data || []);
    } catch (error) {
      console.error('Erro ao carregar médicos:', error);
      toast({
        title: "Erro ao carregar médicos",
        description: "Não foi possível carregar a lista de médicos.",
        variant: "destructive"
      });
    }
  }, [toast]);

  // Carregar status dos repasses
  const carregarStatusRepasses = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('relatorios_repasse_status')
        .select('*')
        .eq('periodo', periodoSelecionado);

      if (error) throw error;

      const status: StatusRepasse[] = (data || []).map(item => ({
        medico_id: item.medico_id,
        medico_nome: item.medico_nome,
        demonstrativo_gerado: item.demonstrativo_gerado || false,
        relatorio_gerado: item.relatorio_gerado || false,
        email_enviado: item.email_enviado || false,
        omie_conta_gerada: item.omie_conta_gerada || false,
        link_relatorio: item.link_relatorio || undefined,
        erro: item.erro || undefined
      }));

      setStatusRepasses(status);
    } catch (error) {
      console.error('Erro ao carregar status:', error);
    }
  }, [periodoSelecionado]);

  // Gerar demonstrativos
  const gerarDemonstrativos = useCallback(async () => {
    try {
      setLoading(true);

      // Chamar edge function para gerar demonstrativos
      const { data, error } = await supabase.functions.invoke('gerar-demonstrativos-repasse', {
        body: { periodo: periodoSelecionado }
      });

      if (error) throw error;

      setDemonstrativos(data.demonstrativos || []);

      toast({
        title: "Demonstrativos gerados",
        description: `${data.demonstrativos?.length || 0} demonstrativos foram gerados com sucesso.`
      });

      await carregarStatusRepasses();
    } catch (error) {
      console.error('Erro ao gerar demonstrativos:', error);
      toast({
        title: "Erro ao gerar demonstrativos",
        description: "Não foi possível gerar os demonstrativos de repasse.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [periodoSelecionado, toast, carregarStatusRepasses]);

  // Gerar relatório individual
  const gerarRelatorio = useCallback(async (medicoId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('gerar-relatorio-repasse', {
        body: { 
          medico_id: medicoId,
          periodo: periodoSelecionado 
        }
      });

      if (error) throw error;

      toast({
        title: "Relatório gerado",
        description: "O relatório de repasse foi gerado com sucesso."
      });

      await carregarStatusRepasses();

      return data;
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast({
        title: "Erro ao gerar relatório",
        description: "Não foi possível gerar o relatório de repasse.",
        variant: "destructive"
      });
      throw error;
    }
  }, [periodoSelecionado, toast, carregarStatusRepasses]);

  // Enviar email
  const enviarEmail = useCallback(async (medicoId: string) => {
    try {
      const { error } = await supabase.functions.invoke('enviar-email-repasse', {
        body: {
          medico_id: medicoId,
          periodo: periodoSelecionado
        }
      });

      if (error) throw error;

      toast({
        title: "Email enviado",
        description: "O relatório foi enviado por email com sucesso."
      });

      await carregarStatusRepasses();
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      toast({
        title: "Erro ao enviar email",
        description: "Não foi possível enviar o email.",
        variant: "destructive"
      });
      throw error;
    }
  }, [periodoSelecionado, toast, carregarStatusRepasses]);

  useEffect(() => {
    carregarMedicos();
    carregarStatusRepasses();
  }, [carregarMedicos, carregarStatusRepasses]);

  return {
    loading,
    medicos,
    demonstrativos,
    statusRepasses,
    gerarDemonstrativos,
    gerarRelatorio,
    enviarEmail,
    recarregar: carregarStatusRepasses
  };
}
