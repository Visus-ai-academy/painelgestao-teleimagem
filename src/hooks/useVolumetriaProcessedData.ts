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
  
  // PROCESSAR TODOS OS DADOS UMA ÚNICA VEZ
  const processedData = useMemo(() => {
    if (!data.detailedData || data.detailedData.length === 0) {
      return {
        clientes: [],
        modalidades: [],
        especialidades: [],
        categorias: [],
        prioridades: [],
        medicos: [],
        loading: data.loading,
        totalExames: 0,
        totalRegistros: 0
      };
    }

    console.log('🔄 [useVolumetriaProcessedData] Processando dados completos:', data.detailedData.length);

    // CLIENTES
    const clientesMap = new Map<string, ProcessedClienteData>();
    data.detailedData.forEach(item => {
      const cliente = item.EMPRESA;
      if (!cliente) return;
      
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
      clienteData.total_exames += Number(item.VALORES) || 0;
      clienteData.total_registros += 1;
      
      // Calcular atrasos
      if (item.DATA_LAUDO && item.HORA_LAUDO && item.DATA_PRAZO && item.HORA_PRAZO) {
        try {
          const dataLaudo = new Date(`${item.DATA_LAUDO}T${item.HORA_LAUDO}`);
          const dataPrazo = new Date(`${item.DATA_PRAZO}T${item.HORA_PRAZO}`);
          if (dataLaudo > dataPrazo) {
            clienteData.atrasados += 1;
          }
        } catch {}
      }
    });
    
    // Calcular percentuais e valores médios
    clientesMap.forEach(cliente => {
      cliente.percentual_atraso = cliente.total_registros > 0 ? 
        (cliente.atrasados / cliente.total_registros) * 100 : 0;
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
            modalidadeData.atrasados! += 1;
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
            especialidadeData.atrasados! += 1;
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
      medicoData.total_exames += Number(item.VALORES) || 0;
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

    // Calcular percentuais finais
    const totalExames = data.dashboardStats.total_exames;
    
    modalidadesMap.forEach(modalidade => {
      modalidade.percentual = totalExames > 0 ? (modalidade.total_exames / totalExames) * 100 : 0;
      modalidade.percentual_atraso = modalidade.total_registros > 0 ? 
        ((modalidade.atrasados || 0) / modalidade.total_registros) * 100 : 0;
    });
    
    especialidadesMap.forEach(especialidade => {
      especialidade.percentual = totalExames > 0 ? (especialidade.total_exames / totalExames) * 100 : 0;
      especialidade.percentual_atraso = especialidade.total_registros > 0 ? 
        ((especialidade.atrasados || 0) / especialidade.total_registros) * 100 : 0;
    });
    
    categoriasMap.forEach(categoria => {
      categoria.percentual = totalExames > 0 ? (categoria.total_exames / totalExames) * 100 : 0;
    });
    
    prioridadesMap.forEach(prioridade => {
      prioridade.percentual = totalExames > 0 ? (prioridade.total_exames / totalExames) * 100 : 0;
    });
    
    medicosMap.forEach(medico => {
      medico.percentual = totalExames > 0 ? (medico.total_exames / totalExames) * 100 : 0;
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
      totalExames: totalExames,
      totalRegistros: data.detailedData.length
    };

    console.log('✅ [useVolumetriaProcessedData] Dados processados:', {
      clientes: result.clientes.length,
      modalidades: result.modalidades.length,
      especialidades: result.especialidades.length,
      totalExames: result.totalExames,
      totalRegistros: result.totalRegistros
    });

    return result;
  }, [data.detailedData, data.dashboardStats, data.loading]);

  return processedData;
}