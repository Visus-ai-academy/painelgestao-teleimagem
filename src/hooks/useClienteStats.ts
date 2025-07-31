import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ClienteStats {
  totalRegistros: number;
  totalNomeMobilemed: number;
  totalCnpjUnicos: number;
  totalNomeFantasia: number;
  tipoClienteCO: number;
  tipoClienteNC: number;
}

export function useClienteStats() {
  const [stats, setStats] = useState<ClienteStats>({
    totalRegistros: 0,
    totalNomeMobilemed: 0,
    totalCnpjUnicos: 0,
    totalNomeFantasia: 0,
    tipoClienteCO: 0,
    tipoClienteNC: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    try {
      setLoading(true);
      
      // Total de registros
      const { count: totalRegistros } = await supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true });

      // Total com NOME_MOBILEMED preenchido (usando nome como proxy)
      const { count: totalNomeMobilemed } = await supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true })
        .not('nome', 'is', null)
        .neq('nome', '');

      // Total de CNPJs únicos (não nulos/vazios)
      const { data: cnpjData } = await supabase
        .from('clientes')
        .select('cnpj')
        .not('cnpj', 'is', null)
        .neq('cnpj', '');
      
      const cnpjUnicos = new Set(cnpjData?.map(item => item.cnpj) || []).size;

  // Total com Nome_Fantasia preenchido (usando contato como proxy)
  const { count: totalNomeFantasia } = await supabase
    .from('clientes')
    .select('*', { count: 'exact', head: true })
    .not('contato', 'is', null)
    .neq('contato', '');

  // Tipos de cliente - verificando status atual
  const { count: tipoClienteCO } = await supabase
    .from('clientes')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Ativo');

  const { count: tipoClienteNC } = await supabase
    .from('clientes')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Inativo');

      setStats({
        totalRegistros: totalRegistros || 0,
        totalNomeMobilemed: totalNomeMobilemed || 0,
        totalCnpjUnicos: cnpjUnicos,
        totalNomeFantasia: totalNomeFantasia || 0,
        tipoClienteCO: tipoClienteCO || 0,
        tipoClienteNC: tipoClienteNC || 0,
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  return { stats, loading, refreshStats: loadStats };
}