import { useState, useCallback } from 'react';
import { 
  ExameRealizado, 
  RegraContrato, 
  PeriodoFaturamento, 
  CalculoFaturamento,
  FaturamentoItem,
  Fatura,
  ProcessoFaturamento,
  LogOperacao,
  StatusRelatorio,
  StatusEmail
} from '@/types/faturamento';

// Mock data - em produção viria da API/banco de dados
const mockExamesRealizados: ExameRealizado[] = [
  {
    id: "1",
    paciente: "João Silva",
    cliente: "Hospital São Lucas",
    medico: "Dr. João Silva",
    dataExame: "2024-01-15",
    modalidade: "MR",
    especialidade: "NE",
    categoria: "Angio",
    prioridade: "Urgente",
    status: "Realizado"
  },
  {
    id: "2", 
    paciente: "Maria Santos",
    cliente: "Hospital São Lucas",
    medico: "Dra. Ana Costa",
    dataExame: "2024-01-16",
    modalidade: "CT",
    especialidade: "CA", 
    categoria: "Contrastado",
    prioridade: "Rotina",
    status: "Realizado"
  },
  {
    id: "3",
    paciente: "Pedro Costa",
    cliente: "Clínica Vida Plena",
    medico: "Dr. Carlos Lima",
    dataExame: "2024-01-17",
    modalidade: "DO",
    especialidade: "ME",
    categoria: "Score",
    prioridade: "Rotina",
    status: "Realizado"
  }
];

const mockRegrasContrato: RegraContrato[] = [
  {
    id: "1",
    clienteId: "1", // Hospital São Lucas
    modalidade: "MR",
    especialidade: "NE",
    categoria: "Angio",
    prioridade: "Urgente",
    valor: 450.00,
    dataVigenciaInicio: "2024-01-01",
    dataVigenciaFim: "2024-12-31"
  },
  {
    id: "2",
    clienteId: "1", // Hospital São Lucas  
    modalidade: "CT",
    especialidade: "CA",
    categoria: "Contrastado",
    prioridade: "Rotina",
    valor: 380.00,
    dataVigenciaInicio: "2024-01-01",
    dataVigenciaFim: "2024-12-31"
  },
  {
    id: "3",
    clienteId: "2", // Clínica Vida Plena
    modalidade: "DO", 
    especialidade: "ME",
    categoria: "Score",
    prioridade: "Rotina",
    valor: 220.00,
    dataVigenciaInicio: "2023-06-01",
    dataVigenciaFim: "2024-05-31"
  }
];

const mockPeriodos: PeriodoFaturamento[] = [
  {
    id: "1",
    periodo: "2024-01",
    dataInicio: "2024-01-01",
    dataFim: "2024-01-31", 
    status: "Aberto",
    bloqueado: false,
    totalExames: 0,
    valorTotal: 0
  },
  {
    id: "2", 
    periodo: "2023-12",
    dataInicio: "2023-12-01",
    dataFim: "2023-12-31",
    status: "Faturado",
    bloqueado: true,
    totalExames: 245,
    valorTotal: 125000,
    dataProcessamento: "2024-01-05"
  }
];

export const useFaturamento = () => {
  const [exames] = useState<ExameRealizado[]>(mockExamesRealizados);
  const [regras] = useState<RegraContrato[]>(mockRegrasContrato);
  const [periodos] = useState<PeriodoFaturamento[]>(mockPeriodos);
  const [loading, setLoading] = useState(false);
  const [processos, setProcessos] = useState<ProcessoFaturamento[]>([]);
  const [logs, setLogs] = useState<LogOperacao[]>([]);

  // Buscar exames por período
  const getExamesPorPeriodo = useCallback((periodo: string) => {
    const [ano, mes] = periodo.split('-');
    return exames.filter(exame => {
      const dataExame = new Date(exame.dataExame);
      return dataExame.getFullYear() === parseInt(ano) && 
             (dataExame.getMonth() + 1) === parseInt(mes);
    });
  }, [exames]);

  // Buscar regras de contrato para um cliente específico
  const getRegrasCliente = useCallback((clienteId: string, dataExame: string) => {
    return regras.filter(regra => {
      return regra.clienteId === clienteId &&
             new Date(dataExame) >= new Date(regra.dataVigenciaInicio) &&
             new Date(dataExame) <= new Date(regra.dataVigenciaFim);
    });
  }, [regras]);

  // Calcular valor do exame baseado nas regras do contrato
  const calcularValorExame = useCallback((
    exame: ExameRealizado, 
    regrasCliente: RegraContrato[]
  ): number => {
    const regraAplicavel = regrasCliente.find(regra => 
      regra.modalidade === exame.modalidade &&
      regra.especialidade === exame.especialidade &&
      regra.categoria === exame.categoria &&
      regra.prioridade === exame.prioridade
    );

    if (!regraAplicavel) {
      console.warn(`Regra não encontrada para exame ${exame.id}`);
      return 0;
    }

    let valor = regraAplicavel.valor;
    
    // Aplicar desconto se houver
    if (regraAplicavel.desconto) {
      valor -= (valor * regraAplicavel.desconto / 100);
    }
    
    // Aplicar acréscimo se houver  
    if (regraAplicavel.acrescimo) {
      valor += (valor * regraAplicavel.acrescimo / 100);
    }

    return valor;
  }, []);

  // Processar faturamento para um cliente e período
  const processarFaturamento = useCallback(async (
    clienteId: string,
    periodo: string
  ): Promise<CalculoFaturamento> => {
    setLoading(true);
    
    try {
      // Verificar se período está bloqueado
      const periodoInfo = periodos.find(p => p.periodo === periodo);
      if (periodoInfo?.bloqueado) {
        throw new Error(`Período ${periodo} já foi faturado e está bloqueado`);
      }

      // Buscar exames do período
      const examesPeriodo = getExamesPorPeriodo(periodo);
      const examesCliente = examesPeriodo.filter(exame => {
        // Aqui você precisa mapear o nome do cliente para o ID
        // Por enquanto usando uma conversão simples
        const clienteMap: { [key: string]: string } = {
          "Hospital São Lucas": "1",
          "Clínica Vida Plena": "2",
          "Centro Médico Norte": "3"
        };
        return clienteMap[exame.cliente] === clienteId;
      });

      // Buscar regras do cliente
      const regrasCliente = getRegrasCliente(clienteId, `${periodo}-01`);

      // Calcular valores
      const items: FaturamentoItem[] = [];
      let subtotal = 0;
      let totalDesconto = 0;
      let totalAcrescimo = 0;

      for (const exame of examesCliente) {
        const valor = calcularValorExame(exame, regrasCliente);
        
        const item: FaturamentoItem = {
          id: `item_${exame.id}`,
          exameId: exame.id,
          clienteId,
          periodo,
          modalidade: exame.modalidade,
          especialidade: exame.especialidade,
          categoria: exame.categoria,
          prioridade: exame.prioridade,
          valorContrato: valor,
          desconto: 0,
          acrescimo: 0,
          valorFinal: valor,
          dataFaturamento: new Date().toISOString().split('T')[0]
        };

        items.push(item);
        subtotal += valor;
      }

      const calculo: CalculoFaturamento = {
        clienteId,
        periodo,
        exames: examesCliente,
        regrasAplicadas: regrasCliente,
        items,
        resumo: {
          totalExames: examesCliente.length,
          subtotal,
          totalDesconto,
          totalAcrescimo,
          valorFinal: subtotal - totalDesconto + totalAcrescimo
        }
      };

      return calculo;
      
    } finally {
      setLoading(false);
    }
  }, [periodos, getExamesPorPeriodo, getRegrasCliente, calcularValorExame]);

  // Gerar fatura
  const gerarFatura = useCallback(async (
    calculo: CalculoFaturamento,
    dataVencimento: string,
    observacoes?: string
  ): Promise<Fatura> => {
    setLoading(true);

    try {
      const numeroFatura = `#${new Date().getFullYear()}${String(Date.now()).slice(-6)}`;
      
      const fatura: Fatura = {
        id: `fatura_${Date.now()}`,
        numero: numeroFatura,
        clienteId: calculo.clienteId,
        cliente: "Nome do Cliente", // Buscar nome real do cliente
        periodo: calculo.periodo,
        dataEmissao: new Date().toISOString().split('T')[0],
        dataVencimento,
        status: "Gerada",
        items: calculo.items,
        subtotal: calculo.resumo.subtotal,
        desconto: calculo.resumo.totalDesconto,
        acrescimo: calculo.resumo.totalAcrescimo,
        valorTotal: calculo.resumo.valorFinal,
        observacoes
      };

      // Aqui você salvaria a fatura no banco de dados
      console.log("Fatura gerada:", fatura);
      
      return fatura;
      
    } finally {
      setLoading(false);
    }
  }, []);

  // Verificar se período pode ser faturado
  const podeSerFaturado = useCallback((periodo: string): boolean => {
    const periodoInfo = periodos.find(p => p.periodo === periodo);
    return !periodoInfo?.bloqueado;
  }, [periodos]);

  // Gerar fatura completa (com PDF e envio de email) - rotina Python
  const gerarFaturaCompleta = useCallback(async (
    calculo: CalculoFaturamento,
    dataVencimento: string,
    observacoes?: string
  ): Promise<ProcessoFaturamento> => {
    const clienteMap: { [key: string]: string } = {
      "1": "Hospital São Lucas",
      "2": "Clínica Vida Plena", 
      "3": "Centro Médico Norte"
    };

    const processo: ProcessoFaturamento = {
      id: `proc_${Date.now()}`,
      clienteId: calculo.clienteId,
      clienteNome: clienteMap[calculo.clienteId] || "Cliente Desconhecido",
      periodo: calculo.periodo,
      statusRelatorio: "pendente",
      statusEmail: "pendente",
      emailDestinatario: `financeiro@${clienteMap[calculo.clienteId]?.toLowerCase().replace(/ /g, '')}.com.br`,
      dataInicio: new Date().toISOString()
    };

    setProcessos(prev => [processo, ...prev]);

    // Log inicial
    const logInicial: LogOperacao = {
      id: `log_${Date.now()}`,
      processoId: processo.id,
      timestamp: new Date().toISOString(),
      tipo: "relatorio",
      mensagem: "Iniciando geração de relatório PDF...",
      detalhes: { cliente: processo.clienteNome, periodo: processo.periodo }
    };
    setLogs(prev => [logInicial, ...prev]);

    // Simular processo de geração de PDF
    setTimeout(() => {
      setProcessos(prev => prev.map(p => 
        p.id === processo.id 
          ? { ...p, statusRelatorio: "gerando" }
          : p
      ));
      
      const logGerando: LogOperacao = {
        id: `log_${Date.now() + 1}`,
        processoId: processo.id,
        timestamp: new Date().toISOString(),
        tipo: "relatorio",
        mensagem: "Processando dados e gerando PDF...",
      };
      setLogs(prev => [logGerando, ...prev]);
    }, 1000);

    // Simular conclusão do PDF
    setTimeout(() => {
      setProcessos(prev => prev.map(p => 
        p.id === processo.id 
          ? { 
              ...p, 
              statusRelatorio: "gerado",
              dataFimRelatorio: new Date().toISOString(),
              arquivoPdf: `fatura_${processo.clienteNome.replace(/ /g, '_')}_${processo.periodo}.pdf`
            }
          : p
      ));

      const logPdfGerado: LogOperacao = {
        id: `log_${Date.now() + 2}`,
        processoId: processo.id,
        timestamp: new Date().toISOString(),
        tipo: "relatorio",
        mensagem: "PDF gerado com sucesso!",
        detalhes: { arquivo: `fatura_${processo.clienteNome.replace(/ /g, '_')}_${processo.periodo}.pdf` }
      };
      setLogs(prev => [logPdfGerado, ...prev]);

      // Iniciar envio de email
      setTimeout(() => {
        setProcessos(prev => prev.map(p => 
          p.id === processo.id 
            ? { ...p, statusEmail: "enviando" }
            : p
        ));

        const logEmail: LogOperacao = {
          id: `log_${Date.now() + 3}`,
          processoId: processo.id,
          timestamp: new Date().toISOString(),
          tipo: "email",
          mensagem: `Enviando fatura por email para ${processo.emailDestinatario}...`,
        };
        setLogs(prev => [logEmail, ...prev]);
      }, 1000);

      // Concluir envio de email
      setTimeout(() => {
        setProcessos(prev => prev.map(p => 
          p.id === processo.id 
            ? { 
                ...p, 
                statusEmail: "enviado",
                dataFimEmail: new Date().toISOString()
              }
            : p
        ));

        const logEmailEnviado: LogOperacao = {
          id: `log_${Date.now() + 4}`,
          processoId: processo.id,
          timestamp: new Date().toISOString(),
          tipo: "email",
          mensagem: "Email enviado com sucesso!",
          detalhes: { destinatario: processo.emailDestinatario }
        };
        setLogs(prev => [logEmailEnviado, ...prev]);
      }, 2500);
    }, 3000);

    return processo;
  }, []);

  // Limpar histórico de processos
  const limparProcessos = useCallback(() => {
    setProcessos([]);
    setLogs([]);
  }, []);

  // Cancelar processo em andamento
  const cancelarProcesso = useCallback((processoId: string) => {
    setProcessos(prev => prev.map(p => 
      p.id === processoId 
        ? { 
            ...p, 
            statusRelatorio: p.statusRelatorio === "gerando" ? "erro" : p.statusRelatorio,
            statusEmail: p.statusEmail === "enviando" ? "erro" : p.statusEmail,
            erro: "Processo cancelado pelo usuário"
          }
        : p
    ));

    const logCancelamento: LogOperacao = {
      id: `log_${Date.now()}`,
      processoId,
      timestamp: new Date().toISOString(),
      tipo: "erro",
      mensagem: "Processo cancelado pelo usuário",
    };
    setLogs(prev => [logCancelamento, ...prev]);
  }, []);

  // Reenviar email
  const reenviarEmail = useCallback(async (processoId: string) => {
    const processo = processos.find(p => p.id === processoId);
    if (!processo || processo.statusRelatorio !== "gerado") return;

    setProcessos(prev => prev.map(p => 
      p.id === processoId 
        ? { ...p, statusEmail: "enviando" }
        : p
    ));

    const logReenvio: LogOperacao = {
      id: `log_${Date.now()}`,
      processoId,
      timestamp: new Date().toISOString(),
      tipo: "email",
      mensagem: "Reenviando email...",
    };
    setLogs(prev => [logReenvio, ...prev]);

    // Simular reenvio
    setTimeout(() => {
      setProcessos(prev => prev.map(p => 
        p.id === processoId 
          ? { 
              ...p, 
              statusEmail: "enviado",
              dataFimEmail: new Date().toISOString()
            }
          : p
      ));

      const logSucesso: LogOperacao = {
        id: `log_${Date.now() + 1}`,
        processoId,
        timestamp: new Date().toISOString(),
        tipo: "email",
        mensagem: "Email reenviado com sucesso!",
      };
      setLogs(prev => [logSucesso, ...prev]);
    }, 2000);
  }, [processos]);

  return {
    exames,
    regras,
    periodos,
    loading,
    processos,
    logs,
    getExamesPorPeriodo,
    getRegrasCliente,
    calcularValorExame,
    processarFaturamento,
    gerarFatura,
    gerarFaturaCompleta,
    limparProcessos,
    cancelarProcesso,
    reenviarEmail,
    podeSerFaturado
  };
};