import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  FileText, 
  Mail,
  DollarSign,
  Download,
  Search,
  Lock,
  FileSpreadsheet
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { AdicionaisMedicos } from "@/components/repasse/AdicionaisMedicos";
import { StatusPorMedico } from "@/components/repasse/StatusPorMedico";
import { ListaDemonstrativos } from "@/components/repasse/ListaDemonstrativos";
import { ResumoGeralRepasse } from "@/components/repasse/ResumoGeralRepasse";
import { ControlePeriodoFaturamento } from "@/components/ControlePeriodoFaturamento";
import { RelatorioExamesSemMedico } from "@/components/RelatorioExamesSemMedico";
import { CorrigirAssociacaoRepasses } from "@/components/CorrigirAssociacaoRepasses";
import * as XLSX from 'xlsx';

export default function PagamentosMedicos() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("adicionais");
  
  // Controle de período
  const [periodoSelecionado, setPeriodoSelecionado] = useState(() => {
    return localStorage.getItem('periodoRepasseSelecionado') || "";
  });
  const [mostrarApenasDisponiveis, setMostrarApenasDisponiveis] = useState(true);
  const [periodoBloqueado, setPeriodoBloqueado] = useState(false);
  
  // Estados para médicos e status
  const [medicos, setMedicos] = useState<any[]>([]);
  const [statusPorMedico, setStatusPorMedico] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Estados para processos
  const [gerandoDemonstrativos, setGerandoDemonstrativos] = useState(false);
  const [gerandoRelatorios, setGerandoRelatorios] = useState(false);
  const [enviandoEmails, setEnviandoEmails] = useState(false);
  const [gerandoContasOmie, setGerandoContasOmie] = useState(false);
  
  // Estados para progresso
  const [progressoRelatorios, setProgressoRelatorios] = useState({ current: 0, total: 0 });
  const [processandoRelatorios, setProcessandoRelatorios] = useState<Set<string>>(new Set());
  const [processandoEmails, setProcessandoEmails] = useState<Set<string>>(new Set());
  
  // Filtros e seleção
  const [filtroMedico, setFiltroMedico] = useState("");
  const [ordemAlfabetica, setOrdemAlfabetica] = useState(true);
  const [medicosSelecionados, setMedicosSelecionados] = useState<Set<string>>(new Set());
  
  // Persistir período selecionado
  useEffect(() => {
    localStorage.setItem('periodoRepasseSelecionado', periodoSelecionado);
  }, [periodoSelecionado]);

  // Verificar se período está bloqueado
  useEffect(() => {
    verificarPeriodoBloqueado();
  }, [periodoSelecionado]);

  // Carregar dados ao mudar período
  useEffect(() => {
    carregarDados();
  }, [periodoSelecionado]);

  const verificarPeriodoBloqueado = async () => {
    try {
      const { data, error } = await supabase
        .from('fechamento_faturamento')
        .select('*')
        .eq('periodo_referencia', periodoSelecionado)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      setPeriodoBloqueado(data?.status === 'fechado');
    } catch (error) {
      console.error('Erro ao verificar período bloqueado:', error);
    }
  };

  const carregarDados = async () => {
    try {
      setLoading(true);

      // Carregar médicos ativos
      const { data: medicosData, error: medicosError } = await supabase
        .from('medicos')
        .select('id, nome, crm, cpf, email, ativo')
        .eq('ativo', true)
        .order('nome');

      if (medicosError) throw medicosError;

      // Carregar status dos repasses
      const { data: statusData, error: statusError } = await supabase
        .from('relatorios_repasse_status')
        .select('*')
        .eq('periodo', periodoSelecionado);

      if (statusError) throw statusError;

      // Combinar dados
      const medicosComStatus = (medicosData || []).map(medico => {
        const status: any = (statusData || []).find((s: any) => s.medico_id === medico.id) || {};
        
        return {
          medicoId: medico.id,
          medicoNome: medico.nome,
          medicoCRM: medico.crm || '',
          medicoCPF: medico.cpf || '',
          demonstrativoGerado: status?.demonstrativo_gerado || false,
          relatorioGerado: status?.relatorio_gerado || false,
          emailEnviado: status?.email_enviado || false,
          omieContaGerada: status?.omie_conta_gerada || false,
          linkRelatorio: status?.link_relatorio,
          dataGeracaoRelatorio: status?.data_geracao_relatorio,
          emailDestino: medico.email,
          erro: status?.erro,
          erroEmail: status?.erro_email,
          detalhesRelatorio: status?.detalhes_relatorio
        };
      });

      setMedicos(medicosData || []);
      setStatusPorMedico(medicosComStatus);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro ao carregar",
        description: "Não foi possível carregar os dados.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGerarDemonstrativos = async () => {
    // Validar período antes de chamar a função
    if (!periodoSelecionado || periodoSelecionado.trim() === '') {
      toast({
        title: "Período não selecionado",
        description: "Por favor, selecione um período antes de gerar os demonstrativos.",
        variant: "destructive"
      });
      return;
    }

    try {
      setGerandoDemonstrativos(true);

      console.log('[Repasse] Chamando edge function com período:', periodoSelecionado);

      const { data, error } = await supabase.functions.invoke('gerar-demonstrativos-repasse', {
        body: { periodo: periodoSelecionado }
      });

      if (error) throw error;

      toast({
        title: "Demonstrativos gerados",
        description: `${data.total || 0} demonstrativos foram gerados com sucesso.`
      });

      await carregarDados();
    } catch (error) {
      console.error('Erro ao gerar demonstrativos:', error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar os demonstrativos.",
        variant: "destructive"
      });
    } finally {
      setGerandoDemonstrativos(false);
    }
  };

  const handleGerarRelatorios = async () => {
    let medicosParaProcessar = Array.from(medicosSelecionados);
    
    // Se nenhum médico selecionado, buscar todos com demonstrativos gerados
    if (medicosParaProcessar.length === 0) {
      const { data: medicosComDemonstrativo, error } = await supabase
        .from('relatorios_repasse_status')
        .select('medico_id')
        .eq('periodo', periodoSelecionado)
        .eq('demonstrativo_gerado', true);
      
      if (error) {
        console.error('Erro ao buscar médicos com demonstrativos:', error);
        toast({
          title: "Erro",
          description: "Erro ao buscar médicos com demonstrativos.",
          variant: "destructive"
        });
        return;
      }
      
      if (!medicosComDemonstrativo || medicosComDemonstrativo.length === 0) {
        toast({
          title: "Atenção",
          description: "Nenhum médico possui demonstrativo gerado neste período.",
          variant: "destructive"
        });
        return;
      }
      
      medicosParaProcessar = medicosComDemonstrativo.map(m => m.medico_id);
    }

    try {
      setGerandoRelatorios(true);
      setProgressoRelatorios({ current: 0, total: medicosParaProcessar.length });

      for (let i = 0; i < medicosParaProcessar.length; i++) {
        const medicoId = medicosParaProcessar[i];
        
        setProgressoRelatorios({ current: i, total: medicosParaProcessar.length });
        
        await supabase.functions.invoke('gerar-relatorio-repasse', {
          body: { 
            medico_id: medicoId,
            periodo: periodoSelecionado 
          }
        });
        
        setProgressoRelatorios({ current: i + 1, total: medicosParaProcessar.length });
      }

      toast({
        title: "Relatórios gerados",
        description: `${medicosParaProcessar.length} relatórios foram gerados com sucesso.`
      });

      await carregarDados();
    } catch (error) {
      console.error('Erro ao gerar relatórios:', error);
      toast({
        title: "Erro",
        description: "Erro ao gerar relatórios.",
        variant: "destructive"
      });
    } finally {
      setGerandoRelatorios(false);
      setProgressoRelatorios({ current: 0, total: 0 });
    }
  };

  const handleEnviarEmails = async () => {
    const selecionados = Array.from(medicosSelecionados);
    
    if (selecionados.length === 0) {
      toast({
        title: "Atenção",
        description: "Selecione pelo menos um médico.",
        variant: "destructive"
      });
      return;
    }

    try {
      setEnviandoEmails(true);

      for (const medicoId of selecionados) {
        await supabase.functions.invoke('enviar-email-repasse', {
          body: {
            medico_id: medicoId,
            periodo: periodoSelecionado
          }
        });
      }

      toast({
        title: "Emails enviados",
        description: `${selecionados.length} emails foram enviados com sucesso.`
      });

      await carregarDados();
    } catch (error) {
      console.error('Erro ao enviar emails:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar emails.",
        variant: "destructive"
      });
    } finally {
      setEnviandoEmails(false);
    }
  };

  const handleGerarContasOmie = async () => {
    toast({
      title: "Em desenvolvimento",
      description: "Funcionalidade de gerar contas a pagar no OMIE será implementada em breve."
    });
  };

  const handleGerarRelatorioIndividual = async (medicoId: string) => {
    try {
      setProcessandoRelatorios(prev => new Set(prev).add(medicoId));
      
      await supabase.functions.invoke('gerar-relatorio-repasse', {
        body: { 
          medico_id: medicoId,
          periodo: periodoSelecionado 
        }
      });

      await carregarDados();
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setProcessandoRelatorios(prev => {
        const novo = new Set(prev);
        novo.delete(medicoId);
        return novo;
      });
    }
  };

  const handleEnviarEmailIndividual = async (medicoId: string) => {
    try {
      setProcessandoEmails(prev => new Set(prev).add(medicoId));
      
      await supabase.functions.invoke('enviar-email-repasse', {
        body: {
          medico_id: medicoId,
          periodo: periodoSelecionado
        }
      });

      await carregarDados();
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setProcessandoEmails(prev => {
        const novo = new Set(prev);
        novo.delete(medicoId);
        return novo;
      });
    }
  };

  const handleVisualizarRelatorio = (medicoId: string) => {
    const medico = statusPorMedico.find(m => m.medicoId === medicoId);
    if (medico?.linkRelatorio) {
      window.open(medico.linkRelatorio, '_blank');
    }
  };

  const handleMedicoToggle = (medicoId: string) => {
    setMedicosSelecionados(prev => {
      const novos = new Set(prev);
      if (novos.has(medicoId)) {
        novos.delete(medicoId);
      } else {
        novos.add(medicoId);
      }
      return novos;
    });
  };

  const handleTodosMedicosToggle = (selecionar: boolean) => {
    if (selecionar) {
      setMedicosSelecionados(new Set(statusPorMedico.map(m => m.medicoId)));
    } else {
      setMedicosSelecionados(new Set());
    }
  };

  const handleExportarExcel = () => {
    try {
      // Preparar dados para exportação
      const dadosExportacao = demonstrativosParaListar.map(demo => ({
        'Nome do Médico': demo.medicoNome,
        'Quantidade de Exames': demo.totalLaudos,
        'Valor Total': demo.valorTotal
      }));

      // Criar workbook e worksheet
      const ws = XLSX.utils.json_to_sheet(dadosExportacao);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Demonstrativos');

      // Ajustar largura das colunas
      const colWidths = [
        { wch: 40 }, // Nome do Médico
        { wch: 20 }, // Quantidade de Exames
        { wch: 15 }  // Valor Total
      ];
      ws['!cols'] = colWidths;

      // Gerar arquivo e fazer download
      const nomeArquivo = `demonstrativos_repasse_${periodoSelecionado}.xlsx`;
      XLSX.writeFile(wb, nomeArquivo);

      toast({
        title: "Excel exportado",
        description: `Arquivo ${nomeArquivo} foi baixado com sucesso.`
      });
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      toast({
        title: "Erro",
        description: "Não foi possível exportar o arquivo Excel.",
        variant: "destructive"
      });
    }
  };

  const handleExportarRelatoriosExcel = async () => {
    try {
      setLoading(true);
      toast({
        title: "Carregando dados",
        description: "Buscando detalhes dos exames..."
      });

      // Buscar médicos com relatórios gerados
      const medicosComRelatorio = statusPorMedico.filter(m => m.relatorioGerado);
      
      if (medicosComRelatorio.length === 0) {
        toast({
          title: "Atenção",
          description: "Nenhum relatório gerado neste período.",
          variant: "destructive"
        });
        return;
      }

      const medicosNomes = medicosComRelatorio.map(m => m.medicoNome);

      // Buscar exames detalhados de todos os médicos com relatório
      const { data: exames, error: examesError } = await supabase
        .from('volumetria_mobilemed')
        .select(`
          DATA_REALIZACAO,
          DATA_LAUDO,
          NOME_PACIENTE,
          MEDICO,
          ESTUDO_DESCRICAO,
          ESPECIALIDADE,
          MODALIDADE,
          CATEGORIA,
          PRIORIDADE,
          ACCESSION_NUMBER,
          EMPRESA,
          Cliente_Nome_Fantasia,
          cliente_nome_fantasia
        `)
        .eq('periodo_referencia', periodoSelecionado)
        .in('MEDICO', medicosNomes)
        .order('MEDICO', { ascending: true })
        .order('DATA_REALIZACAO', { ascending: true });

      if (examesError) {
        throw examesError;
      }

      if (!exames || exames.length === 0) {
        toast({
          title: "Sem dados",
          description: "Nenhum exame encontrado para este período.",
          variant: "destructive"
        });
        return;
      }

      // Buscar valores de repasse para todos os médicos
      const medicosIds = medicosComRelatorio.map(m => m.medicoId);
      const { data: repasses, error: repasseError } = await supabase
        .from('medicos_valores_repasse')
        .select('*')
        .in('medico_id', medicosIds)
        .eq('ativo', true);

      if (repasseError) {
        console.error('Erro ao buscar repasses:', repasseError);
      }

      // Mapear clientes
      const clienteNomes = Array.from(new Set(
        exames.map(e => e.EMPRESA || e.Cliente_Nome_Fantasia || e.cliente_nome_fantasia).filter(Boolean)
      ));
      
      const clienteMap = new Map<string, string>();
      if (clienteNomes.length > 0) {
        const { data: clientes, error: clientesError } = await supabase
          .from('clientes')
          .select('id, nome')
          .in('nome', clienteNomes);
        
        if (!clientesError && clientes) {
          for (const c of clientes) {
            clienteMap.set(c.nome, c.id);
          }
        }
      }

      // Função para normalizar strings
      const norm = (s: any) => (s ?? '').toString().trim().toUpperCase();

      // Função para obter valor de repasse de um exame
      const getValorRepasse = (exame: any, medicoId: string) => {
        const repassesMedico = (repasses || []).filter((r: any) => r.medico_id === medicoId);
        const clienteNome = exame.EMPRESA || exame.Cliente_Nome_Fantasia || exame.cliente_nome_fantasia || '';
        const clienteId = clienteMap.get(clienteNome);
        const modalidade = exame.MODALIDADE || '';
        const especialidade = exame.ESPECIALIDADE || '';
        const categoria = exame.CATEGORIA || '';
        const prioridade = exame.PRIORIDADE || '';

        // 1) Com cliente específico + categoria
        let valorRepasse = repassesMedico.find((r: any) =>
          norm(r.modalidade) === norm(modalidade) &&
          norm(r.especialidade) === norm(especialidade) &&
          norm(r.categoria) === norm(categoria) &&
          norm(r.prioridade) === norm(prioridade) &&
          (!!clienteId && r.cliente_id === clienteId)
        );

        // 2) Sem cliente, com categoria
        if (!valorRepasse) {
          valorRepasse = repassesMedico.find((r: any) =>
            norm(r.modalidade) === norm(modalidade) &&
            norm(r.especialidade) === norm(especialidade) &&
            norm(r.categoria) === norm(categoria) &&
            norm(r.prioridade) === norm(prioridade) &&
            (r.cliente_id == null)
          );
        }

        // 3) Sem cliente e sem categoria
        if (!valorRepasse) {
          valorRepasse = repassesMedico.find((r: any) =>
            norm(r.modalidade) === norm(modalidade) &&
            norm(r.especialidade) === norm(especialidade) &&
            norm(r.prioridade) === norm(prioridade) &&
            (!r.categoria || norm(r.categoria) === '') &&
            (r.cliente_id == null)
          );
        }

        // 4) Fallback: apenas modalidade + especialidade
        if (!valorRepasse) {
          valorRepasse = repassesMedico.find((r: any) =>
            norm(r.modalidade) === norm(modalidade) &&
            norm(r.especialidade) === norm(especialidade) &&
            (r.cliente_id == null)
          );
        }

        return Number(valorRepasse?.valor) || 0;
      };

      // Preparar dados para exportação
      const dadosExportacao = exames.map(exame => {
        const medico = medicosComRelatorio.find(m => m.medicoNome === exame.MEDICO);
        const valor = medico ? getValorRepasse(exame, medico.medicoId) : 0;
        
        return {
          'Data': exame.DATA_REALIZACAO ? new Date(exame.DATA_REALIZACAO).toLocaleDateString('pt-BR') : '-',
          'Data Laudo': exame.DATA_LAUDO ? new Date(exame.DATA_LAUDO).toLocaleDateString('pt-BR') : '-',
          'Paciente': exame.NOME_PACIENTE || '-',
          'Médico': exame.MEDICO || '-',
          'Exame': exame.ESTUDO_DESCRICAO || '-',
          'Modalidade': exame.MODALIDADE || '-',
          'Especialidade': exame.ESPECIALIDADE || '-',
          'Categoria': exame.CATEGORIA || '-',
          'Prioridade': exame.PRIORIDADE || '-',
          'Accession': exame.ACCESSION_NUMBER || '-',
          'Origem': exame.Cliente_Nome_Fantasia || exame.cliente_nome_fantasia || exame.EMPRESA || '-',
          'Quantidade': 1,
          'Valor': valor,
          'Total': valor
        };
      });

      // Criar workbook e worksheet
      const ws = XLSX.utils.json_to_sheet(dadosExportacao);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Detalhamento Exames');

      // Ajustar largura das colunas
      const colWidths = [
        { wch: 12 }, // Data
        { wch: 12 }, // Data Laudo
        { wch: 30 }, // Paciente
        { wch: 25 }, // Médico
        { wch: 35 }, // Exame
        { wch: 12 }, // Modalidade
        { wch: 20 }, // Especialidade
        { wch: 15 }, // Categoria
        { wch: 12 }, // Prioridade
        { wch: 18 }, // Accession
        { wch: 20 }, // Origem
        { wch: 10 }, // Quantidade
        { wch: 12 }, // Valor
        { wch: 12 }  // Total
      ];
      ws['!cols'] = colWidths;

      // Gerar arquivo e fazer download
      const nomeArquivo = `detalhamento_exames_repasse_${periodoSelecionado}.xlsx`;
      XLSX.writeFile(wb, nomeArquivo);

      toast({
        title: "Excel exportado",
        description: `Arquivo exportado com ${exames.length} exames.`
      });
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      toast({
        title: "Erro",
        description: "Não foi possível exportar o arquivo Excel.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Médicos filtrados e ordenados
  const medicosFiltrados = useMemo(() => {
    let filtrados = [...statusPorMedico];

    if (filtroMedico) {
      filtrados = filtrados.filter(m =>
        m.medicoNome.toLowerCase().includes(filtroMedico.toLowerCase())
      );
    }

    filtrados.sort((a, b) => {
      const comparison = a.medicoNome.localeCompare(b.medicoNome, 'pt-BR');
      return ordemAlfabetica ? comparison : -comparison;
    });

    return filtrados;
  }, [statusPorMedico, filtroMedico, ordemAlfabetica]);

  // Estatísticas
  const stats = useMemo(() => {
    return {
      totalMedicos: statusPorMedico.length,
      demonstrativosGerados: statusPorMedico.filter(m => m.demonstrativoGerado).length,
      relatoriosGerados: statusPorMedico.filter(m => m.relatorioGerado).length,
      emailsEnviados: statusPorMedico.filter(m => m.emailEnviado).length,
      contasGeradas: statusPorMedico.filter(m => m.omieContaGerada).length
    };
  }, [statusPorMedico]);

  // Demonstrativos para listagem
  const demonstrativosParaListar = useMemo(() => {
    return statusPorMedico
      .filter(m => m.demonstrativoGerado)
      .map(m => {
        // Buscar detalhes do relatórios_repasse_status
        const detalhes = m.detalhesRelatorio || {};
        
        return {
          medicoId: m.medicoId,
          medicoNome: m.medicoNome,
          medicoCRM: m.medicoCRM,
          medicoCPF: m.medicoCPF,
          totalLaudos: detalhes.total_laudos || 0,
          valorExames: detalhes.valor_exames || 0,
          valorAdicionais: detalhes.valor_adicionais || 0,
          valorTotal: detalhes.valor_total || 0,
          detalhesExames: detalhes.detalhes_exames || [],
          adicionais: detalhes.adicionais || [],
          erro: m.erro
        };
      });
  }, [statusPorMedico]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pagamento Médico</h1>
          <p className="text-muted-foreground">Geração de repasses e relatórios para médicos</p>
        </div>
        {periodoBloqueado && (
          <Badge variant="destructive" className="text-lg px-4 py-2">
            <Lock className="mr-2 h-5 w-5" />
            Período Bloqueado
          </Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="adicionais">Adicionais</TabsTrigger>
          <TabsTrigger value="gerar">Gerar Repasse</TabsTrigger>
          <TabsTrigger value="demonstrativos">Demonstrativos</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          <TabsTrigger value="fechamento">Fechar Período</TabsTrigger>
        </TabsList>

        {/* ABA 1: ADICIONAIS */}
        <TabsContent value="adicionais" className="space-y-6">
          <ControlePeriodoFaturamento
            periodoSelecionado={periodoSelecionado}
            setPeriodoSelecionado={setPeriodoSelecionado}
            mostrarApenasDisponiveis={mostrarApenasDisponiveis}
            setMostrarApenasDisponiveis={setMostrarApenasDisponiveis}
            onPeriodoChange={(periodo) => {
              setPeriodoSelecionado(periodo);
              carregarDados();
            }}
          />

          <AdicionaisMedicos
            periodoSelecionado={periodoSelecionado}
            periodoBloqueado={periodoBloqueado}
          />
        </TabsContent>

        {/* ABA 2: GERAR REPASSE */}
        <TabsContent value="gerar" className="space-y-6">
          <ControlePeriodoFaturamento
            periodoSelecionado={periodoSelecionado}
            setPeriodoSelecionado={setPeriodoSelecionado}
            mostrarApenasDisponiveis={mostrarApenasDisponiveis}
            setMostrarApenasDisponiveis={setMostrarApenasDisponiveis}
            onPeriodoChange={(periodo) => {
              setPeriodoSelecionado(periodo);
              carregarDados();
            }}
          />

          {/* Card de Estatísticas */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Médicos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalMedicos}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Demonstrativos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.demonstrativosGerados}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Relatórios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.relatoriosGerados}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Emails
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.emailsEnviados}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Contas OMIE
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.contasGeradas}</div>
              </CardContent>
            </Card>
          </div>

          {/* Card de Processo de Geração */}
          <Card>
            <CardHeader>
              <CardTitle>Processo de Geração de Repasse</CardTitle>
              <CardDescription>
                Execute as etapas do processo de geração de pagamento médico
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Button
                  onClick={handleGerarDemonstrativos}
                  disabled={gerandoDemonstrativos || periodoBloqueado || loading}
                  size="lg"
                  className="w-full"
                >
                  <FileText className="mr-2 h-5 w-5" />
                  {gerandoDemonstrativos ? "Gerando..." : "Gerar Demonstrativos"}
                </Button>

                <Button
                  onClick={handleGerarRelatorios}
                  disabled={
                    gerandoRelatorios || 
                    periodoBloqueado
                  }
                  size="lg"
                  className="w-full"
                >
                  <Download className="mr-2 h-5 w-5" />
                  {gerandoRelatorios ? "Gerando..." : `Gerar Relatórios (${medicosSelecionados.size})`}
                </Button>

                <Button
                  onClick={handleEnviarEmails}
                  disabled={
                    enviandoEmails || 
                    periodoBloqueado || 
                    stats.relatoriosGerados === 0 ||
                    medicosSelecionados.size === 0
                  }
                  size="lg"
                  variant="secondary"
                  className="w-full"
                >
                  <Mail className="mr-2 h-5 w-5" />
                  {enviandoEmails ? "Enviando..." : `Enviar Emails (${medicosSelecionados.size})`}
                </Button>

                <Button
                  onClick={handleGerarContasOmie}
                  disabled={
                    gerandoContasOmie || 
                    periodoBloqueado || 
                    stats.emailsEnviados === 0 ||
                    medicosSelecionados.size === 0
                  }
                  size="lg"
                  variant="secondary"
                  className="w-full"
                >
                  <DollarSign className="mr-2 h-5 w-5" />
                  {gerandoContasOmie ? "Gerando..." : `Gerar Contas OMIE (${medicosSelecionados.size})`}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Barra de Progresso */}
          {gerandoRelatorios && progressoRelatorios.total > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Gerando Relatórios</CardTitle>
                <CardDescription>
                  Progresso: {progressoRelatorios.current} de {progressoRelatorios.total} relatórios
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Progress 
                    value={(progressoRelatorios.current / progressoRelatorios.total) * 100} 
                    className="w-full h-3"
                  />
                  <p className="text-sm text-muted-foreground text-center">
                    {Math.round((progressoRelatorios.current / progressoRelatorios.total) * 100)}% concluído
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status por Médico */}
          <StatusPorMedico
            medicos={medicosFiltrados}
            onGerarRelatorio={handleGerarRelatorioIndividual}
            onEnviarEmail={handleEnviarEmailIndividual}
            onVisualizarRelatorio={handleVisualizarRelatorio}
            processandoRelatorios={processandoRelatorios}
            processandoEmails={processandoEmails}
            filtro={filtroMedico}
            onFiltroChange={setFiltroMedico}
            ordemAlfabetica={ordemAlfabetica}
            onOrdemChange={setOrdemAlfabetica}
            medicosSelecionados={medicosSelecionados}
            onMedicoToggle={handleMedicoToggle}
            onTodosMedicosToggle={handleTodosMedicosToggle}
          />
        </TabsContent>

        {/* ABA 3: DEMONSTRATIVOS */}
        <TabsContent value="demonstrativos" className="space-y-6">
          <ControlePeriodoFaturamento
            periodoSelecionado={periodoSelecionado}
            setPeriodoSelecionado={setPeriodoSelecionado}
            mostrarApenasDisponiveis={mostrarApenasDisponiveis}
            setMostrarApenasDisponiveis={setMostrarApenasDisponiveis}
            onPeriodoChange={(periodo) => {
              setPeriodoSelecionado(periodo);
              carregarDados();
            }}
          />

          <div className="flex justify-end">
            <Button
              onClick={handleExportarExcel}
              disabled={demonstrativosParaListar.length === 0}
              variant="outline"
              size="lg"
            >
              <FileSpreadsheet className="mr-2 h-5 w-5" />
              Exportar Excel
            </Button>
          </div>

          <ResumoGeralRepasse
            demonstrativos={demonstrativosParaListar}
            periodo={periodoSelecionado}
          />

          <ListaDemonstrativos
            demonstrativos={demonstrativosParaListar}
            periodo={periodoSelecionado}
          />
        </TabsContent>

        {/* ABA 4: RELATÓRIOS */}
        <TabsContent value="relatorios" className="space-y-6">
          {/* Ferramentas de Correção */}
          <CorrigirAssociacaoRepasses />
          
          {/* Relatório de Exames sem Médico */}
          <RelatorioExamesSemMedico />

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Relatórios Gerados</CardTitle>
                  <CardDescription>
                    Consulte e faça download dos relatórios de repasse do período {periodoSelecionado}
                  </CardDescription>
                </div>
                <Button
                  onClick={handleExportarRelatoriosExcel}
                  disabled={loading || statusPorMedico.filter(s => s.relatorioGerado).length === 0}
                  variant="outline"
                  size="lg"
                >
                  <FileSpreadsheet className="mr-2 h-5 w-5" />
                  Exportar Detalhamento (Excel)
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar médico..."
                      value={filtroMedico}
                      onChange={(e) => setFiltroMedico(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>

                  {statusPorMedico.filter(s => s.relatorioGerado).length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Nenhum relatório gerado neste período.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {statusPorMedico
                        .filter(s => s.relatorioGerado)
                        .filter(s => s.medicoNome.toLowerCase().includes(filtroMedico.toLowerCase()))
                        .sort((a, b) => (a.medicoNome || '').localeCompare(b.medicoNome || ''))
                        .map((status) => (
                          <div
                            key={status.medicoId}
                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex-1">
                              <h4 className="font-medium">{status.medicoNome}</h4>
                              {status.dataGeracaoRelatorio && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Gerado em: {new Date(status.dataGeracaoRelatorio).toLocaleDateString('pt-BR')} às {new Date(status.dataGeracaoRelatorio).toLocaleTimeString('pt-BR')}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              {status.linkRelatorio && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(status.linkRelatorio, '_blank')}
                                >
                                  <Download className="mr-2 h-4 w-4" />
                                  Download
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 5: FECHAR PERÍODO */}
        <TabsContent value="fechamento" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Fechar Período de Repasse</CardTitle>
              <CardDescription>
                Bloqueie o período para evitar alterações após a geração dos repasses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Funcionalidade de fechamento de período em desenvolvimento.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
