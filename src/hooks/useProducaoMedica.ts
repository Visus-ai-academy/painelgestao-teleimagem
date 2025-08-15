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
    medicos: {
      nome: string;
      especialidade: string;
      capacidade_produtiva: number;
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
          medicos: Map<string, { capacidade_produtiva: number; especialidade: string }>;
        }>;
      }>();

      let totalMesAtual = 0;
      let totalMesAnterior = 0;
      let totalSemanaAtual = 0;
      let totalSemanaAnterior = 0;

      volumetriaData?.forEach((record) => {
        const dataLaudo = record.DATA_LAUDO;
        const horaLaudo = record.HORA_LAUDO;
        const medico = record.MEDICO;
        const especialidade = record.ESPECIALIDADE;
        const valores = record.VALORES || 0;

        if (!dataLaudo || !medico || !especialidade) return;

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

        const especialidadeData = especialidadesMap.get(especialidade);
        especialidadeData.medicos.add(medico);
        
        if (dataStr >= dateRanges.currentMonth && dataStr <= dateRanges.currentMonthEnd) {
          especialidadeData.total_mes_atual += valores;
        }
        if (dataStr >= dateRanges.previousMonth && dataStr <= dateRanges.previousMonthEnd) {
          especialidadeData.total_mes_anterior += valores;
        }
        if (dataStr >= dateRanges.currentWeekStart && dataStr <= dateRanges.currentWeekEnd) {
          especialidadeData.total_semana_atual += valores;
        }
        if (dataStr >= dateRanges.previousWeekStart && dataStr <= dateRanges.previousWeekEnd) {
          especialidadeData.total_semana_anterior += valores;
        }

        // Processar capacidade vs demanda por dia/turno
        const diaSemanaOrdem = getDiaSemanaOrdem(diaSemana);
        if (!capacidadeDemandaMap.has(diaSemanaName)) {
          capacidadeDemandaMap.set(diaSemanaName, { 
            total_demanda_dia: 0,
            dia_numero: diaSemanaOrdem,
            turnos: new Map()
          });
        }
        
        const diaData = capacidadeDemandaMap.get(diaSemanaName)!;
        
        // Processar por turno do dia
        if (!diaData.turnos.has(turno)) {
          diaData.turnos.set(turno, {
            demanda_turno: 0,
            medicos: new Map()
          });
        }
        
        const turnoData = diaData.turnos.get(turno)!;
        
        // A demanda é o total de exames que entraram (sempre conta 1 exame que entrou)
        diaData.total_demanda_dia += 1;
        turnoData.demanda_turno += 1;
        
        // A capacidade produtiva é quanto o médico realizou (usa o valor real do exame)
        if (!turnoData.medicos.has(medico)) {
          turnoData.medicos.set(medico, { capacidade_produtiva: 0, especialidade });
        }
        turnoData.medicos.get(medico)!.capacidade_produtiva += valores;
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

      // Calcular capacidade vs demanda com a estrutura correta: Dia → Turno → Médicos
      const capacidade_vs_demanda: CapacidadeVsDemanda[] = Array.from(capacidadeDemandaMap.entries()).map(([dia, dados]) => {
        let totalCapacidadeDia = 0;
        
        // Processar turnos do dia
        const turnos = Array.from(dados.turnos.entries()).map(([turnoNome, turnoData]) => {
          // Calcular capacidade total do turno (soma de todos os médicos do turno)
          const capacidadeTurno = Array.from(turnoData.medicos.values()).reduce((total, medicoData) => total + medicoData.capacidade_produtiva, 0);
          totalCapacidadeDia += capacidadeTurno;
          
          // Processar médicos do turno
          const medicos = Array.from(turnoData.medicos.entries()).map(([medicoNome, medicoData]) => ({
            nome: medicoNome,
            especialidade: medicoData.especialidade,
            capacidade_produtiva: medicoData.capacidade_produtiva
          }));
          
          return {
            turno: turnoNome,
            demanda_turno: turnoData.demanda_turno,
            capacidade_turno: capacidadeTurno,
            utilizacao_turno: capacidadeTurno > 0 ? (turnoData.demanda_turno / capacidadeTurno) * 100 : 0,
            medicos
          };
        });

        return {
          dia_semana: dia,
          dia_numero: dados.dia_numero,
          total_demanda_dia: dados.total_demanda_dia,
          total_capacidade_dia: totalCapacidadeDia,
          utilizacao_dia: totalCapacidadeDia > 0 ? (dados.total_demanda_dia / totalCapacidadeDia) * 100 : 0,
          turnos
        };
      }).sort((a, b) => a.dia_numero - b.dia_numero); // Ordenar de segunda a domingo

      const variacao_mensal = totalMesAnterior > 0 ? ((totalMesAtual - totalMesAnterior) / totalMesAnterior) * 100 : 0;
      const variacao_semanal = totalSemanaAnterior > 0 ? ((totalSemanaAtual - totalSemanaAnterior) / totalSemanaAnterior) * 100 : 0;

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