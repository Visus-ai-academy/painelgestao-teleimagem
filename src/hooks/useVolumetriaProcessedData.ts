import { useMemo } from 'react';
import { useVolumetria } from '@/contexts/VolumetriaContext';

// TIPOS CENTRALIZADOS
export interface ProcessedClienteData {
  nome: string;
  total_exames: number;
  total_registros: number;
  atrasados: number;
  percentual_atraso: number;
  valor_medio: number;
  cidade?: string;
  estado?: string;
}

export interface ProcessedModalidadeData {
  nome: string;
  total_exames: number;
  total_registros: number;
  percentual: number;
  atrasados?: number;
  percentual_atraso?: number;
}

export interface ProcessedEspecialidadeData {
  nome: string;
  total_exames: number;
  total_registros: number;
  percentual: number;
  atrasados?: number;
  percentual_atraso?: number;
}

export interface ProcessedMedicoData {
  nome: string;
  total_exames: number;
  total_registros: number;
  percentual: number;
  atrasados: number;
  percentual_atraso: number;
  especialidades: string[];
  modalidades: string[];
}

// HOOK CENTRALIZADO PARA DADOS PROCESSADOS
export function useVolumetriaProcessedData() {
  const { data } = useVolumetria();
  
  const processedData = useMemo(() => {
    // SE TEMOS STATS COMPLETAS DOS CLIENTES, USAR ELAS EM VEZ DE PROCESSAR
    if (data.clientesStats && data.clientesStats.length > 0) {
      console.log('🔥 [useVolumetriaProcessedData] Usando stats completas dos clientes:', data.clientesStats.length);
      
      // Buscar CEDI_RJ especificamente
      const cediStats = data.clientesStats.find((c: any) => c.empresa === 'CEDI_RJ');
      console.log('🎯 [useVolumetriaProcessedData] CEDI_RJ stats completas:', cediStats);
      
      const clientesProcessados = data.clientesStats.map((cliente: any) => ({
        nome: cliente.empresa,
        total_exames: Number(cliente.total_laudos),
        total_registros: Number(cliente.total_registros),
        atrasados: Number(cliente.laudos_atrasados),
        percentual_atraso: Number(cliente.percentual_atraso),
        valor_medio: Number(cliente.total_laudos) / Number(cliente.total_registros) || 0
      }));
      
      return {
        clientes: clientesProcessados,
        modalidades: [],
        especialidades: [],
        categorias: [],
        prioridades: [],
        medicos: [],
        loading: data.loading,
        totalExames: data.dashboardStats?.total_exames || 0,
        totalAtrasados: data.dashboardStats?.total_atrasados || 0,
        percentualAtraso: data.dashboardStats?.percentual_atraso || 0
      };
    }
    
    if (!data.detailedData || data.detailedData.length === 0) {
      return {
        clientes: [],
        modalidades: [],
        especialidades: [],
        categorias: [],
        prioridades: [],
        medicos: [],
        loading: data.loading,
        totalExames: data.dashboardStats?.total_exames || 0,
        totalAtrasados: data.dashboardStats?.total_atrasados || 0,
        percentualAtraso: data.dashboardStats?.percentual_atraso || 0
      };
    }

    console.log('🔄 [useVolumetriaProcessedData] Processando dados completos:', data.detailedData.length);
    console.log('📊 [useVolumetriaProcessedData] Usando dados do dashboard:', {
      total_exames: data.dashboardStats?.total_exames,
      total_atrasados: data.dashboardStats?.total_atrasados,
      percentual_atraso: data.dashboardStats?.percentual_atraso
    });
    
    // LOG DETALHADO DO CEDI_RJ PARA DEBUG
    const cediRegistros = data.detailedData.filter(item => item.EMPRESA === 'CEDI_RJ');
    const cediLaudos = cediRegistros.reduce((sum, item) => sum + (Number(item.VALORES) || 0), 0);
    console.log('🔍 [DEBUG CEDI_RJ] Total registros CEDI_RJ no detailedData:', cediRegistros.length);
    console.log('🔍 [DEBUG CEDI_RJ] Total laudos CEDI_RJ calculados:', cediLaudos);
    console.log('🔍 [DEBUG CEDI_RJ] Primeiros 5 registros:', cediRegistros.slice(0, 5));
    
    // USAR APENAS DADOS DE VOLUMES (VALORES) - DASHBOARD NÃO USA REGISTROS
    const totalExamesReal = data.dashboardStats?.total_exames || 0;
    const totalAtrasadosReal = data.dashboardStats?.total_atrasados || 0;
    const percentualAtrasoReal = data.dashboardStats?.percentual_atraso || 0;
    
    console.log('🔍 [useVolumetriaProcessedData] Dashboard usando APENAS volumes (valores):', {
      totalExamesReal,
      totalAtrasadosReal,
      percentualAtrasoReal
    });

    // CLIENTES - Processar dados detalhados para análise granular
    const clientesMap = new Map<string, ProcessedClienteData>();
    data.detailedData.forEach(item => {
      const cliente = item.EMPRESA;
      if (!cliente) return;
      
      const valores = Number(item.VALORES) || 0;
      
      if (!clientesMap.has(cliente)) {
        clientesMap.set(cliente, {
          nome: cliente,
          total_exames: 0,
          total_registros: 0,
          atrasados: 0,
          percentual_atraso: 0,
          valor_medio: 0
        });
      }
      
      const clienteData = clientesMap.get(cliente)!;
      clienteData.total_exames += valores;
      clienteData.total_registros += 1;
      
      // Calcular atrasos baseado nos dados detalhados
      if (item.DATA_LAUDO && item.HORA_LAUDO && item.DATA_PRAZO && item.HORA_PRAZO) {
        try {
          const dataLaudo = new Date(`${item.DATA_LAUDO}T${item.HORA_LAUDO}`);
          const dataPrazo = new Date(`${item.DATA_PRAZO}T${item.HORA_PRAZO}`);
          const isAtrasado = dataLaudo > dataPrazo;
          
          if (isAtrasado) {
            clienteData.atrasados += valores;
          }
        } catch (error) {
          console.log(`❌ Erro ao processar data para ${cliente}:`, error);
        }
      }
    });
    
    // Calcular percentuais e valores médios
    clientesMap.forEach(cliente => {
      cliente.percentual_atraso = cliente.total_exames > 0 ? 
        (cliente.atrasados / cliente.total_exames) * 100 : 0;
      cliente.valor_medio = cliente.total_registros > 0 ? 
        cliente.total_exames / cliente.total_registros : 0;
    });

    // MODALIDADES
    const modalidadesMap = new Map<string, ProcessedModalidadeData>();
    data.detailedData.forEach(item => {
      const modalidade = item.MODALIDADE;
      if (!modalidade) return;
      
      if (!modalidadesMap.has(modalidade)) {
        modalidadesMap.set(modalidade, {
          nome: modalidade,
          total_exames: 0,
          total_registros: 0,
          percentual: 0,
          atrasados: 0,
          percentual_atraso: 0
        });
      }
      
      const modalidadeData = modalidadesMap.get(modalidade)!;
      modalidadeData.total_exames += Number(item.VALORES) || 0;
      modalidadeData.total_registros += 1;
      
      // Calcular atrasos
      if (item.DATA_LAUDO && item.HORA_LAUDO && item.DATA_PRAZO && item.HORA_PRAZO) {
        try {
          const dataLaudo = new Date(`${item.DATA_LAUDO}T${item.HORA_LAUDO}`);
          const dataPrazo = new Date(`${item.DATA_PRAZO}T${item.HORA_PRAZO}`);
          if (dataLaudo > dataPrazo) {
            modalidadeData.atrasados! += Number(item.VALORES) || 0;
          }
        } catch {}
      }
    });

    // ESPECIALIDADES
    const especialidadesMap = new Map<string, ProcessedEspecialidadeData>();
    data.detailedData.forEach(item => {
      const especialidade = item.ESPECIALIDADE;
      if (!especialidade) return;
      
      if (!especialidadesMap.has(especialidade)) {
        especialidadesMap.set(especialidade, {
          nome: especialidade,
          total_exames: 0,
          total_registros: 0,
          percentual: 0,
          atrasados: 0,
          percentual_atraso: 0
        });
      }
      
      const especialidadeData = especialidadesMap.get(especialidade)!;
      especialidadeData.total_exames += Number(item.VALORES) || 0;
      especialidadeData.total_registros += 1;
      
      // Calcular atrasos
      if (item.DATA_LAUDO && item.HORA_LAUDO && item.DATA_PRAZO && item.HORA_PRAZO) {
        try {
          const dataLaudo = new Date(`${item.DATA_LAUDO}T${item.HORA_LAUDO}`);
          const dataPrazo = new Date(`${item.DATA_PRAZO}T${item.HORA_PRAZO}`);
          if (dataLaudo > dataPrazo) {
            especialidadeData.atrasados! += Number(item.VALORES) || 0;
          }
        } catch {}
      }
    });

    // CATEGORIAS
    const categoriasMap = new Map<string, ProcessedModalidadeData>();
    data.detailedData.forEach(item => {
      const categoria = item.CATEGORIA;
      if (!categoria) return;
      
      if (!categoriasMap.has(categoria)) {
        categoriasMap.set(categoria, {
          nome: categoria,
          total_exames: 0,
          total_registros: 0,
          percentual: 0
        });
      }
      
      const categoriaData = categoriasMap.get(categoria)!;
      categoriaData.total_exames += Number(item.VALORES) || 0;
      categoriaData.total_registros += 1;
    });

    // PRIORIDADES
    const prioridadesMap = new Map<string, ProcessedModalidadeData>();
    data.detailedData.forEach(item => {
      const prioridade = item.PRIORIDADE;
      if (!prioridade) return;
      
      if (!prioridadesMap.has(prioridade)) {
        prioridadesMap.set(prioridade, {
          nome: prioridade,
          total_exames: 0,
          total_registros: 0,
          percentual: 0
        });
      }
      
      const prioridadeData = prioridadesMap.get(prioridade)!;
      prioridadeData.total_exames += Number(item.VALORES) || 0;
      prioridadeData.total_registros += 1;
    });

    // MÉDICOS
    const medicosMap = new Map<string, ProcessedMedicoData>();
    data.detailedData.forEach(item => {
      const medico = item.MEDICO;
      if (!medico) return;
      
      if (!medicosMap.has(medico)) {
        medicosMap.set(medico, {
          nome: medico,
          total_exames: 0,
          total_registros: 0,
          percentual: 0,
          atrasados: 0,
          percentual_atraso: 0,
          especialidades: [],
          modalidades: []
        });
      }
      
      const medicoData = medicosMap.get(medico)!;
      medicoData.total_exames += 1; // Contar cada registro como um exame
      medicoData.total_registros += 1;
      
      // Adicionar especialidades e modalidades únicas
      if (item.ESPECIALIDADE && !medicoData.especialidades.includes(item.ESPECIALIDADE)) {
        medicoData.especialidades.push(item.ESPECIALIDADE);
      }
      if (item.MODALIDADE && !medicoData.modalidades.includes(item.MODALIDADE)) {
        medicoData.modalidades.push(item.MODALIDADE);
      }
      
      // Calcular atrasos
      if (item.DATA_LAUDO && item.HORA_LAUDO && item.DATA_PRAZO && item.HORA_PRAZO) {
        try {
          const dataLaudo = new Date(`${item.DATA_LAUDO}T${item.HORA_LAUDO}`);
          const dataPrazo = new Date(`${item.DATA_PRAZO}T${item.HORA_PRAZO}`);
          if (dataLaudo > dataPrazo) {
            medicoData.atrasados += 1;
          }
        } catch {}
      }
    });

    // Calcular percentuais finais usando os valores calculados
    const totalRegistros = data.detailedData.length; // Total de registros para médicos
    
    // Calcular total de exames processados para percentuais
    let totalExamesProcessados = 0;
    clientesMap.forEach(cliente => {
      totalExamesProcessados += cliente.total_exames;
    });
    
    modalidadesMap.forEach(modalidade => {
      modalidade.percentual = totalExamesProcessados > 0 ? (modalidade.total_exames / totalExamesProcessados) * 100 : 0;
      modalidade.percentual_atraso = modalidade.total_exames > 0 ? 
        ((modalidade.atrasados || 0) / modalidade.total_exames) * 100 : 0;
    });
    
    especialidadesMap.forEach(especialidade => {
      especialidade.percentual = totalExamesProcessados > 0 ? (especialidade.total_exames / totalExamesProcessados) * 100 : 0;
      especialidade.percentual_atraso = especialidade.total_exames > 0 ? 
        ((especialidade.atrasados || 0) / especialidade.total_exames) * 100 : 0;
    });
    
    categoriasMap.forEach(categoria => {
      categoria.percentual = totalExamesProcessados > 0 ? (categoria.total_exames / totalExamesProcessados) * 100 : 0;
    });
    
    prioridadesMap.forEach(prioridade => {
      prioridade.percentual = totalExamesProcessados > 0 ? (prioridade.total_exames / totalExamesProcessados) * 100 : 0;
    });
    
    medicosMap.forEach(medico => {
      // Para médicos, usar totalRegistros como base para o percentual
      medico.percentual = totalRegistros > 0 ? (medico.total_exames / totalRegistros) * 100 : 0;
      medico.percentual_atraso = medico.total_registros > 0 ? 
        (medico.atrasados / medico.total_registros) * 100 : 0;
    });

    const result = {
      clientes: Array.from(clientesMap.values()).sort((a, b) => b.total_exames - a.total_exames),
      modalidades: Array.from(modalidadesMap.values()).sort((a, b) => b.total_exames - a.total_exames),
      especialidades: Array.from(especialidadesMap.values()).sort((a, b) => b.total_exames - a.total_exames),
      categorias: Array.from(categoriasMap.values()).sort((a, b) => b.total_exames - a.total_exames),
      prioridades: Array.from(prioridadesMap.values()).sort((a, b) => b.total_exames - a.total_exames),
      medicos: Array.from(medicosMap.values()).sort((a, b) => b.total_exames - a.total_exames),
      loading: data.loading,
      totalExames: totalExamesReal,
      totalAtrasados: totalAtrasadosReal,
      percentualAtraso: percentualAtrasoReal
    };
    
    console.log('✅ [useVolumetriaProcessedData] DADOS REAIS FINAIS:', {
      clientes: result.clientes.length,
      modalidades: result.modalidades.length,
      especialidades: result.especialidades.length,
      totalExamesReal: result.totalExames,
      totalAtrasadosReal: result.totalAtrasados,
      percentualAtrasoReal: result.percentualAtraso.toFixed(2) + '%',
      clientesComAtrasos: result.clientes.filter(c => c.atrasados > 0).length,
      dadosProcessados: `${totalExamesProcessados} exames em ${data.detailedData.length} registros`
    });
    
    // LOG ESPECÍFICO DO CEDI_RJ PROCESSADO
    const cediProcessado = result.clientes.find(c => c.nome === 'CEDI_RJ');
    if (cediProcessado) {
      console.log('🎯 [DEBUG CEDI_RJ PROCESSADO]:', cediProcessado);
    } else {
      console.log('❌ [DEBUG] CEDI_RJ NÃO ENCONTRADO NO RESULTADO PROCESSADO!');
    }

    return result;
  }, [data.detailedData, data.dashboardStats, data.loading, data.clientesStats]);

  return processedData;
}