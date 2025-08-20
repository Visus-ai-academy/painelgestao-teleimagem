import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface QuebraStatus {
  arquivo_fonte: string;
  registros_originais: number;
  registros_quebrados: number;
  foiAplicada: boolean;
}

export function useQuebrasStatus() {
  const [statusQuebras, setStatusQuebras] = useState<QuebraStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const verificarStatusQuebras = async () => {
    try {
      setLoading(true);
      
      const tiposArquivo = [
        'volumetria_padrao',
        'volumetria_fora_padrao',
        'volumetria_padrao_retroativo',
        'volumetria_fora_padrao_retroativo'
      ];

      const status: QuebraStatus[] = [];

      for (const arquivo of tiposArquivo) {
        // Verificar registros originais que ainda precisam ser quebrados
        const { count: originaisCount } = await supabase
          .from('volumetria_mobilemed')
          .select('id', { count: 'exact' })
          .eq('arquivo_fonte', arquivo)
          .eq('ESTUDO_DESCRICAO', 'TC CRANIO E ANGIO ARTERIAL E VENOSA CRANIO');

        // Verificar registros já quebrados
        const { count: quebradosCount } = await supabase
          .from('volumetria_mobilemed')
          .select('id', { count: 'exact' })
          .eq('arquivo_fonte', arquivo)
          .in('ESTUDO_DESCRICAO', ['TC CRANIO', 'ANGIOTC ARTERIAL CRANIO', 'ANGIOTC VENOSA CRANIO']);

        const registrosOriginais = originaisCount || 0;
        const registrosQuebrados = quebradosCount || 0;
        // Regra aplicada = OK se não há dados originais (independente se gerou quebras ou não)
        const foiAplicada = registrosOriginais === 0;

        status.push({
          arquivo_fonte: arquivo,
          registros_originais: registrosOriginais,
          registros_quebrados: registrosQuebrados,
          foiAplicada
        });
      }

      setStatusQuebras(status);
    } catch (error) {
      console.error('Erro ao verificar status das quebras:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    verificarStatusQuebras();

    // Atualizar a cada 30 segundos
    const interval = setInterval(verificarStatusQuebras, 30000);

    return () => clearInterval(interval);
  }, []);

  return { statusQuebras, loading, verificarStatusQuebras };
}