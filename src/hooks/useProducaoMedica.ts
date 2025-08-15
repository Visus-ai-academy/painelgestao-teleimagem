import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ProducaoTurno {
  turno: string;
  quantidade: number;
  percentual: number;
}

export interface ProducaoMedico {
  nome: string;
  especialidade: string;
  total_mes_atual: number;
  total_mes_anterior: number;
  total_semana_atual: number;
  total_semana_anterior: number;
  media_mensal: number;
  turnos: ProducaoTurno[];
  capacidade_produtiva: number;
}

export interface ProducaoEspecialidade {
  nome: string;
  total_mes_atual: number;
  total_mes_anterior: number;
  total_semana_atual: number;
  total_semana_anterior: number;
  medicos_count: number;
  media_por_medico: number;
}

export interface CapacidadeVsDemanda {
  dia_semana: string;
  dia_numero: number;
  total_demanda_dia: number;
  total_capacidade_dia: number;
  utilizacao_dia: number;
  turnos: {
    turno: string;
    demanda_turno: number;
    capacidade_turno: number;
    utilizacao_turno: number;
    especialidades: {
      especialidade: string;
      demanda_especialidade: number;
      capacidade_especialidade: number;
      utilizacao_especialidade: number;
      medicos: {
        nome: string;
        especialidade: string;
        capacidade_produtiva: number;
        demanda_medico: number;
      }[];
    }[];
  }[];
}

export interface ProducaoData {
  resumo_geral: {
    total_mes_atual: number;
    total_mes_anterior: number;
    total_semana_atual: number;
    total_semana_anterior: number;
    variacao_mensal: number;
    variacao_semanal: number;
  };
  medicos: ProducaoMedico[];
  especialidades: ProducaoEspecialidade[];
  capacidade_vs_demanda: CapacidadeVsDemanda[];
  loading: boolean;
}

const getTurnoFromHour = (hora: string, diaSemana: number): string => {
  if (!hora) return 'Não definido';
  
  const [horaNum] = hora.split(':').map(Number);
  
  // Sábado (6) e Domingo (0)
  if (diaSemana === 0 || diaSemana === 6) {
    if (horaNum >= 7 && horaNum < 13) return 'Plantão Sábado/Domingo manhã';
    if (horaNum >= 13 && horaNum < 19) return 'Plantão Sábado/Domingo tarde';
    return 'Plantão Noturno';
  }
  
  // Dias úteis
  if (horaNum >= 7 && horaNum < 13) return 'Turno da manhã';
  if (horaNum >= 13 && horaNum < 19) return 'Turno da tarde';
  return 'Plantão Noturno';
};

const getDiaSemanaName = (diaSemana: number): string => {
  const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  return dias[diaSemana];
};

const getDiaSemanaOrdem = (diaSemana: number): number => {
  // Converter para ordem Segunda=1, Domingo=7
  return diaSemana === 0 ? 7 : diaSemana;
};

const getOrdemTurno = (turno: string): number => {
  if (turno.includes('manhã')) return 1;
  if (turno.includes('tarde')) return 2;
  return 3; // Plantão
};

export const useProducaoMedica = () => {
  const [data, setData] = useState<ProducaoData>({
    resumo_geral: {
      total_mes_atual: 0,
      total_mes_anterior: 0,
      total_semana_atual: 0,
      total_semana_anterior: 0,
      variacao_mensal: 0,
      variacao_semanal: 0,
    },
    medicos: [],
    especialidades: [],
    capacidade_vs_demanda: [],
    loading: true,
  });
  
  const { toast } = useToast();

  const dateRanges = useMemo(() => {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    
    // Semana atual (começando na segunda-feira)
    const today = new Date();
    const currentDay = today.getDay();
    const daysToSubtract = currentDay === 0 ? 6 : currentDay - 1; // Se domingo, volta 6 dias
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - daysToSubtract);
    
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
    
    // Semana anterior
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(currentWeekStart.getDate() - 7);
    
    const previousWeekEnd = new Date(previousWeekStart);
    previousWeekEnd.setDate(previousWeekStart.getDate() + 6);

    return {
      currentMonth: currentMonth.toISOString().split('T')[0],
      currentMonthEnd: now.toISOString().split('T')[0],
      previousMonth: previousMonth.toISOString().split('T')[0],
      previousMonthEnd: previousMonthEnd.toISOString().split('T')[0],
      currentWeekStart: currentWeekStart.toISOString().split('T')[0],
      currentWeekEnd: currentWeekEnd.toISOString().split('T')[0],
      previousWeekStart: previousWeekStart.toISOString().split('T')[0],
      previousWeekEnd: previousWeekEnd.toISOString().split('T')[0],
    };
  }, []);

  const loadProducaoData = async () => {
    try {
      setData(prev => ({ ...prev, loading: true }));

      // Buscar dados da volumetria_mobilemed
      const { data: volumetriaData, error } = await supabase
        .from('volumetria_mobilemed')
        .select('*')
        .not('DATA_LAUDO', 'is', null)
        .not('HORA_LAUDO', 'is', null)
        .not('MEDICO', 'is', null)
        .not('ESPECIALIDADE', 'is', null);

      if (error) {
        console.error('Erro ao buscar dados de produção:', error);
        toast({
          title: "Erro ao carregar dados",
          description: "Não foi possível carregar os dados de produção.",
          variant: "destructive",
        });
        return;
      }

      // Processar dados
      interface MedicoTemp {
        nome: string;
        especialidade: string;
        total_mes_atual: number;
        total_mes_anterior: number;
        total_semana_atual: number;
        total_semana_anterior: number;
        turnos: Map<string, number>;
        registros_mes: number[];
      }

      const medicosMap = new Map<string, MedicoTemp>();
      const especialidadesMap = new Map<string, any>();
      const capacidadeDemandaMap = new Map<string, { 
        total_demanda_dia: number;
        dia_numero: number;
        turnos: Map<string, {
          demanda_turno: number;
          especialidades: Map<string, {
            demanda_especialidade: number;
            capacidade_especialidade: number;
            medicos: Map<string, { capacidade_produtiva: number; demanda_medico: number }>;
          }>;
        }>;
        // Para calcular MÉDIA: agrupar valores por data específica
        demanda_por_data: Map<string, number>; // data específica -> soma valores demanda
        capacidade_por_data: Map<string, number>; // data específica -> soma valores capacidade
        turnos_demanda_por_data: Map<string, Map<string, number>>; // data -> turno -> soma valores demanda
        turnos_capacidade_por_data: Map<string, Map<string, number>>; // data -> turno -> soma valores capacidade
        especialidades_demanda_por_data: Map<string, Map<string, Map<string, number>>>; // data -> turno -> especialidade -> soma demanda
        especialidades_capacidade_por_data: Map<string, Map<string, Map<string, number>>>; // data -> turno -> especialidade -> soma capacidade
      }>();

      let totalMesAtual = 0;
      let totalMesAnterior = 0;
      let totalSemanaAtual = 0;
      let totalSemanaAnterior = 0;

      // Contadores para debug
      let registrosProcessados = 0;
      let registrosComTransferencia = 0;
      let registrosComLaudo = 0;
      
      volumetriaData?.forEach((record) => {
        registrosProcessados++;
        const dataLaudo = record.DATA_LAUDO;
        const horaLaudo = record.HORA_LAUDO;
        const medico = record.MEDICO;
        const especialidade = record.ESPECIALIDADE;
        const valores = record.VALORES || 0;

        
        if (!dataLaudo || !medico || !especialidade) return;
        
        registrosComLaudo++;
        const dateLaudo = new Date(dataLaudo);
        const diaSemana = dateLaudo.getDay();
        const diaSemanaName = getDiaSemanaName(diaSemana);
        const turno = getTurnoFromHour(horaLaudo, diaSemana);

        // Contabilizar totais por período
        const dataStr = dataLaudo;
        if (dataStr >= dateRanges.currentMonth && dataStr <= dateRanges.currentMonthEnd) {
          totalMesAtual += valores;
        }
        if (dataStr >= dateRanges.previousMonth && dataStr <= dateRanges.previousMonthEnd) {
          totalMesAnterior += valores;
        }
        if (dataStr >= dateRanges.currentWeekStart && dataStr <= dateRanges.currentWeekEnd) {
          totalSemanaAtual += valores;
        }
        if (dataStr >= dateRanges.previousWeekStart && dataStr <= dateRanges.previousWeekEnd) {
          totalSemanaAnterior += valores;
        }

        // Processar dados por médico
        if (!medicosMap.has(medico)) {
          medicosMap.set(medico, {
            nome: medico,
            especialidade,
            total_mes_atual: 0,
            total_mes_anterior: 0,
            total_semana_atual: 0,
            total_semana_anterior: 0,
            turnos: new Map(),
            registros_mes: []
          });
        }

        const medicoData = medicosMap.get(medico);
        
        // Contabilizar por período
        if (dataStr >= dateRanges.currentMonth && dataStr <= dateRanges.currentMonthEnd) {
          medicoData.total_mes_atual += valores;
          medicoData.registros_mes.push(valores);
        }
        if (dataStr >= dateRanges.previousMonth && dataStr <= dateRanges.previousMonthEnd) {
          medicoData.total_mes_anterior += valores;
        }
        if (dataStr >= dateRanges.currentWeekStart && dataStr <= dateRanges.currentWeekEnd) {
          medicoData.total_semana_atual += valores;
        }
        if (dataStr >= dateRanges.previousWeekStart && dataStr <= dateRanges.previousWeekEnd) {
          medicoData.total_semana_anterior += valores;
        }

        // Contabilizar por turno
        if (!medicoData.turnos.has(turno)) {
          medicoData.turnos.set(turno, 0);
        }
        medicoData.turnos.set(turno, medicoData.turnos.get(turno) + valores);

        // Processar dados por especialidade
        if (!especialidadesMap.has(especialidade)) {
          especialidadesMap.set(especialidade, {
            nome: especialidade,
            total_mes_atual: 0,
            total_mes_anterior: 0,
            total_semana_atual: 0,
            total_semana_anterior: 0,
            medicos: new Set()
          });
        }

        const especialidadeDataMap = especialidadesMap.get(especialidade);
        especialidadeDataMap.medicos.add(medico);
        
        if (dataStr >= dateRanges.currentMonth && dataStr <= dateRanges.currentMonthEnd) {
          especialidadeDataMap.total_mes_atual += valores;
        }
        if (dataStr >= dateRanges.previousMonth && dataStr <= dateRanges.previousMonthEnd) {
          especialidadeDataMap.total_mes_anterior += valores;
        }
        if (dataStr >= dateRanges.currentWeekStart && dataStr <= dateRanges.currentWeekEnd) {
          especialidadeDataMap.total_semana_atual += valores;
        }
        if (dataStr >= dateRanges.previousWeekStart && dataStr <= dateRanges.previousWeekEnd) {
          especialidadeDataMap.total_semana_anterior += valores;
        }

        // Processar capacidade produtiva por data específica (usando DATA_LAUDO)
        const diaSemanaOrdem = getDiaSemanaOrdem(diaSemana);
        if (!capacidadeDemandaMap.has(diaSemanaName)) {
          capacidadeDemandaMap.set(diaSemanaName, { 
            total_demanda_dia: 0,
            dia_numero: diaSemanaOrdem,
            turnos: new Map(),
            demanda_por_data: new Map(),
            capacidade_por_data: new Map(),
            turnos_demanda_por_data: new Map(),
            turnos_capacidade_por_data: new Map(),
            especialidades_demanda_por_data: new Map(),
            especialidades_capacidade_por_data: new Map()
          });
        }
        
        const diaData = capacidadeDemandaMap.get(diaSemanaName)!;
        
        // Agrupar capacidade produtiva por data específica para depois calcular média
        if (!diaData.capacidade_por_data.has(dataStr)) {
          diaData.capacidade_por_data.set(dataStr, 0);
        }
        diaData.capacidade_por_data.set(dataStr, diaData.capacidade_por_data.get(dataStr)! + valores);

        // Agrupar capacidade por data e turno
        if (!diaData.turnos_capacidade_por_data.has(dataStr)) {
          diaData.turnos_capacidade_por_data.set(dataStr, new Map());
        }
        const turnosCapData = diaData.turnos_capacidade_por_data.get(dataStr)!;
        if (!turnosCapData.has(turno)) {
          turnosCapData.set(turno, 0);
        }
        turnosCapData.set(turno, turnosCapData.get(turno)! + valores);

        // Agrupar capacidade por data, turno e especialidade
        if (!diaData.especialidades_capacidade_por_data.has(dataStr)) {
          diaData.especialidades_capacidade_por_data.set(dataStr, new Map());
        }
        if (!diaData.especialidades_capacidade_por_data.get(dataStr)!.has(turno)) {
          diaData.especialidades_capacidade_por_data.get(dataStr)!.set(turno, new Map());
        }
        const espCapData = diaData.especialidades_capacidade_por_data.get(dataStr)!.get(turno)!;
        if (!espCapData.has(especialidade)) {
          espCapData.set(especialidade, 0);
        }
        espCapData.set(especialidade, espCapData.get(especialidade)! + valores);

        // Processar demanda usando DATA_TRANSFERENCIA e HORA_TRANSFERENCIA
        if (record.DATA_TRANSFERENCIA && record.HORA_TRANSFERENCIA) {
          registrosComTransferencia++;
          const dataTransferencia = record.DATA_TRANSFERENCIA;
          const dataTransferenciaObj = new Date(dataTransferencia);
          const diaSemanaTransferencia = dataTransferenciaObj.getDay();
          const diaSemanaTransferenciaName = getDiaSemanaName(diaSemanaTransferencia);
          const turnoTransferencia = getTurnoFromHour(record.HORA_TRANSFERENCIA, diaSemanaTransferencia);

          // Inicializar estrutura para demanda se não existir
          if (!capacidadeDemandaMap.has(diaSemanaTransferenciaName)) {
            capacidadeDemandaMap.set(diaSemanaTransferenciaName, { 
              total_demanda_dia: 0,
              dia_numero: getDiaSemanaOrdem(diaSemanaTransferencia),
              turnos: new Map(),
              demanda_por_data: new Map(),
              capacidade_por_data: new Map(),
              turnos_demanda_por_data: new Map(),
              turnos_capacidade_por_data: new Map(),
              especialidades_demanda_por_data: new Map(),
              especialidades_capacidade_por_data: new Map()
            });
          }

          const diaDataDemanda = capacidadeDemandaMap.get(diaSemanaTransferenciaName)!;

          // Agrupar demanda por data específica para depois calcular média
          if (!diaDataDemanda.demanda_por_data.has(dataTransferencia)) {
            diaDataDemanda.demanda_por_data.set(dataTransferencia, 0);
          }
          diaDataDemanda.demanda_por_data.set(dataTransferencia, 
            diaDataDemanda.demanda_por_data.get(dataTransferencia)! + valores);

          // Agrupar demanda por data e turno
          if (!diaDataDemanda.turnos_demanda_por_data.has(dataTransferencia)) {
            diaDataDemanda.turnos_demanda_por_data.set(dataTransferencia, new Map());
          }
          const turnosDemData = diaDataDemanda.turnos_demanda_por_data.get(dataTransferencia)!;
          if (!turnosDemData.has(turnoTransferencia)) {
            turnosDemData.set(turnoTransferencia, 0);
          }
          turnosDemData.set(turnoTransferencia, turnosDemData.get(turnoTransferencia)! + valores);

          // Agrupar demanda por data, turno e especialidade
          if (!diaDataDemanda.especialidades_demanda_por_data.has(dataTransferencia)) {
            diaDataDemanda.especialidades_demanda_por_data.set(dataTransferencia, new Map());
          }
          if (!diaDataDemanda.especialidades_demanda_por_data.get(dataTransferencia)!.has(turnoTransferencia)) {
            diaDataDemanda.especialidades_demanda_por_data.get(dataTransferencia)!.set(turnoTransferencia, new Map());
          }
          const espDemData = diaDataDemanda.especialidades_demanda_por_data.get(dataTransferencia)!.get(turnoTransferencia)!;
          if (!espDemData.has(especialidade)) {
            espDemData.set(especialidade, 0);
          }
          espDemData.set(especialidade, espDemData.get(especialidade)! + valores);
        }
      });

      // Converter mapas para arrays
      const medicos: ProducaoMedico[] = Array.from(medicosMap.values()).map(medico => {
        const totalTurnos = Array.from(medico.turnos.values()).reduce((a: number, b: number) => a + b, 0);
        const turnos: ProducaoTurno[] = Array.from(medico.turnos.entries()).map(([turno, quantidade]: [string, number]) => ({
          turno,
          quantidade,
          percentual: totalTurnos > 0 ? (quantidade / totalTurnos) * 100 : 0
        }));

        const registrosMes = medico.registros_mes as number[];
        const media_mensal = registrosMes.length > 0 
          ? registrosMes.reduce((a: number, b: number) => a + b, 0) / registrosMes.length 
          : 0;

        return {
          nome: medico.nome,
          especialidade: medico.especialidade,
          total_mes_atual: medico.total_mes_atual,
          total_mes_anterior: medico.total_mes_anterior,
          total_semana_atual: medico.total_semana_atual,
          total_semana_anterior: medico.total_semana_anterior,
          turnos,
          media_mensal,
          capacidade_produtiva: media_mensal * 30 // Estimativa mensal
        };
      }).sort((a, b) => b.total_mes_atual - a.total_mes_atual);

      const especialidades: ProducaoEspecialidade[] = Array.from(especialidadesMap.values()).map(esp => ({
        ...esp,
        medicos_count: esp.medicos.size,
        media_por_medico: esp.medicos.size > 0 ? esp.total_mes_atual / esp.medicos.size : 0
      })).sort((a, b) => b.total_mes_atual - a.total_mes_atual);

      // Calcular capacidade vs demanda com MÉDIAS por dia da semana
      const capacidade_vs_demanda: CapacidadeVsDemanda[] = Array.from(capacidadeDemandaMap.entries()).map(([dia, dados]) => {
        
        // Calcular MÉDIA da demanda diária (soma dos valores por data / número de datas)
        const valoresDemandaPorData = Array.from(dados.demanda_por_data.values());
        const mediaDemandaDia = valoresDemandaPorData.length > 0 
          ? valoresDemandaPorData.reduce((sum, val) => sum + val, 0) / valoresDemandaPorData.length 
          : 0;

        // Calcular MÉDIA da capacidade produtiva diária
        const valoresCapacidadePorData = Array.from(dados.capacidade_por_data.values());
        const mediaCapacidadeDia = valoresCapacidadePorData.length > 0 
          ? valoresCapacidadePorData.reduce((sum, val) => sum + val, 0) / valoresCapacidadePorData.length 
          : 0;
        
        // Calcular médias por turno
        const turnosSet = new Set<string>();
        dados.turnos_demanda_por_data.forEach(turnos => {
          turnos.forEach((_, turno) => turnosSet.add(turno));
        });
        dados.turnos_capacidade_por_data.forEach(turnos => {
          turnos.forEach((_, turno) => turnosSet.add(turno));
        });

        const turnos = Array.from(turnosSet).map(turnoNome => {
          // Calcular média da demanda do turno
          const valoresDemandaTurno: number[] = [];
          dados.turnos_demanda_por_data.forEach(turnos => {
            if (turnos.has(turnoNome)) {
              valoresDemandaTurno.push(turnos.get(turnoNome)!);
            }
          });
          const mediaDemandaTurno = valoresDemandaTurno.length > 0 
            ? valoresDemandaTurno.reduce((sum, val) => sum + val, 0) / valoresDemandaTurno.length 
            : 0;

          // Calcular média da capacidade do turno
          const valoresCapacidadeTurno: number[] = [];
          dados.turnos_capacidade_por_data.forEach(turnos => {
            if (turnos.has(turnoNome)) {
              valoresCapacidadeTurno.push(turnos.get(turnoNome)!);
            }
          });
          const mediaCapacidadeTurno = valoresCapacidadeTurno.length > 0 
            ? valoresCapacidadeTurno.reduce((sum, val) => sum + val, 0) / valoresCapacidadeTurno.length 
            : 0;

          // Calcular médias por especialidade
          const especialidadesSet = new Set<string>();
          dados.especialidades_demanda_por_data.forEach(turnos => {
            if (turnos.has(turnoNome)) {
              turnos.get(turnoNome)!.forEach((_, esp) => especialidadesSet.add(esp));
            }
          });
          dados.especialidades_capacidade_por_data.forEach(turnos => {
            if (turnos.has(turnoNome)) {
              turnos.get(turnoNome)!.forEach((_, esp) => especialidadesSet.add(esp));
            }
          });

          const especialidades = Array.from(especialidadesSet).map(espNome => {
            // Calcular média da demanda da especialidade
            const valoresDemandaEsp: number[] = [];
            dados.especialidades_demanda_por_data.forEach(turnos => {
              if (turnos.has(turnoNome) && turnos.get(turnoNome)!.has(espNome)) {
                valoresDemandaEsp.push(turnos.get(turnoNome)!.get(espNome)!);
              }
            });
            const mediaDemandaEsp = valoresDemandaEsp.length > 0 
              ? valoresDemandaEsp.reduce((sum, val) => sum + val, 0) / valoresDemandaEsp.length 
              : 0;

            // Calcular média da capacidade da especialidade
            const valoresCapacidadeEsp: number[] = [];
            dados.especialidades_capacidade_por_data.forEach(turnos => {
              if (turnos.has(turnoNome) && turnos.get(turnoNome)!.has(espNome)) {
                valoresCapacidadeEsp.push(turnos.get(turnoNome)!.get(espNome)!);
              }
            });
            const mediaCapacidadeEsp = valoresCapacidadeEsp.length > 0 
              ? valoresCapacidadeEsp.reduce((sum, val) => sum + val, 0) / valoresCapacidadeEsp.length 
              : 0;

            return {
              especialidade: espNome,
              demanda_especialidade: mediaDemandaEsp,
              capacidade_especialidade: mediaCapacidadeEsp,
              utilizacao_especialidade: mediaCapacidadeEsp > 0 ? (mediaDemandaEsp / mediaCapacidadeEsp) * 100 : 0,
              medicos: [] // Simplified for now - would need similar logic for individual doctors
            };
          });

          return {
            turno: turnoNome,
            demanda_turno: mediaDemandaTurno,
            capacidade_turno: mediaCapacidadeTurno,
            utilizacao_turno: mediaCapacidadeTurno > 0 ? (mediaDemandaTurno / mediaCapacidadeTurno) * 100 : 0,
            especialidades
          };
        }).sort((a, b) => getOrdemTurno(a.turno) - getOrdemTurno(b.turno)); // Ordenar turnos: manhã, tarde, plantão

        return {
          dia_semana: dia,
          dia_numero: dados.dia_numero,
          total_demanda_dia: mediaDemandaDia,
          total_capacidade_dia: mediaCapacidadeDia,
          utilizacao_dia: mediaCapacidadeDia > 0 ? (mediaDemandaDia / mediaCapacidadeDia) * 100 : 0,
          turnos
        };
      }).sort((a, b) => a.dia_numero - b.dia_numero); // Ordenar de segunda a domingo

      const variacao_mensal = totalMesAnterior > 0 ? ((totalMesAtual - totalMesAnterior) / totalMesAnterior) * 100 : 0;
      const variacao_semanal = totalSemanaAnterior > 0 ? ((totalSemanaAtual - totalSemanaAnterior) / totalSemanaAnterior) * 100 : 0;

      // Debug: Mostrar estatísticas de processamento
      console.log('🔍 [PRODUÇÃO DEBUG] Estatísticas de processamento:', {
        registrosProcessados,
        registrosComLaudo,
        registrosComTransferencia,
        percentualComTransferencia: registrosComLaudo > 0 ? (registrosComTransferencia / registrosComLaudo * 100).toFixed(1) + '%' : '0%',
        diasDaSemanaEncontrados: Array.from(capacidadeDemandaMap.keys()),
        totalDiasDaSemana: capacidadeDemandaMap.size
      });

      // Debug: Mostrar amostra de dados por dia da semana
      capacidadeDemandaMap.forEach((dados, dia) => {
        console.log(`🔍 [${dia}] Dados:`, {
          diasComDemanda: dados.demanda_por_data.size,
          diasComCapacidade: dados.capacidade_por_data.size,
          mediaDemanda: dados.demanda_por_data.size > 0 ? 
            Array.from(dados.demanda_por_data.values()).reduce((a, b) => a + b, 0) / dados.demanda_por_data.size : 0,
          mediaCapacidade: dados.capacidade_por_data.size > 0 ? 
            Array.from(dados.capacidade_por_data.values()).reduce((a, b) => a + b, 0) / dados.capacidade_por_data.size : 0,
          turnosEncontrados: Array.from(dados.turnos_demanda_por_data.values()).flatMap(t => Array.from(t.keys())),
          primeiraDataDemanda: dados.demanda_por_data.size > 0 ? Array.from(dados.demanda_por_data.keys())[0] : 'nenhuma',
          primeiraDataCapacidade: dados.capacidade_por_data.size > 0 ? Array.from(dados.capacidade_por_data.keys())[0] : 'nenhuma'
        });
      });

      setData({
        resumo_geral: {
          total_mes_atual: totalMesAtual,
          total_mes_anterior: totalMesAnterior,
          total_semana_atual: totalSemanaAtual,
          total_semana_anterior: totalSemanaAnterior,
          variacao_mensal,
          variacao_semanal,
        },
        medicos,
        especialidades,
        capacidade_vs_demanda,
        loading: false,
      });

    } catch (error) {
      console.error('Erro ao processar dados de produção:', error);
      toast({
        title: "Erro ao processar dados",
        description: "Ocorreu um erro ao processar os dados de produção.",
        variant: "destructive",
      });
      setData(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    loadProducaoData();
  }, []);

  return { data, refreshData: loadProducaoData };
};