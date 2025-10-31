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
  Lock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AdicionaisMedicos } from "@/components/repasse/AdicionaisMedicos";
import { StatusPorMedico } from "@/components/repasse/StatusPorMedico";
import { ControlePeriodoFaturamento } from "@/components/ControlePeriodoFaturamento";

export default function PagamentosMedicos() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("adicionais");
  
  // Controle de período
  const [periodoSelecionado, setPeriodoSelecionado] = useState(() => {
    const saved = localStorage.getItem('periodoRepasseSelecionado');
    return saved || "2025-06";
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
          emailDestino: medico.email,
          erro: status?.erro,
          erroEmail: status?.erro_email
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
    try {
      setGerandoDemonstrativos(true);

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
      setGerandoRelatorios(true);

      for (const medicoId of selecionados) {
        await supabase.functions.invoke('gerar-relatorio-repasse', {
          body: { 
            medico_id: medicoId,
            periodo: periodoSelecionado 
          }
        });
      }

      toast({
        title: "Relatórios gerados",
        description: `${selecionados.length} relatórios foram gerados com sucesso.`
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
      await supabase.functions.invoke('gerar-relatorio-repasse', {
        body: { 
          medico_id: medicoId,
          periodo: periodoSelecionado 
        }
      });

      await carregarDados();
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  const handleEnviarEmailIndividual = async (medicoId: string) => {
    try {
      await supabase.functions.invoke('enviar-email-repasse', {
        body: {
          medico_id: medicoId,
          periodo: periodoSelecionado
        }
      });

      await carregarDados();
    } catch (error) {
      console.error('Erro:', error);
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
                  disabled={gerandoRelatorios || medicosSelecionados.size === 0 || periodoBloqueado}
                  size="lg"
                  className="w-full"
                >
                  <Download className="mr-2 h-5 w-5" />
                  {gerandoRelatorios ? "Gerando..." : `Gerar Relatórios (${medicosSelecionados.size})`}
                </Button>

                <Button
                  onClick={handleEnviarEmails}
                  disabled={enviandoEmails || medicosSelecionados.size === 0 || periodoBloqueado}
                  size="lg"
                  variant="secondary"
                  className="w-full"
                >
                  <Mail className="mr-2 h-5 w-5" />
                  {enviandoEmails ? "Enviando..." : `Enviar Emails (${medicosSelecionados.size})`}
                </Button>

                <Button
                  onClick={handleGerarContasOmie}
                  disabled={gerandoContasOmie || medicosSelecionados.size === 0 || periodoBloqueado}
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

          {/* Status por Médico */}
          <StatusPorMedico
            medicos={medicosFiltrados}
            onGerarRelatorio={handleGerarRelatorioIndividual}
            onEnviarEmail={handleEnviarEmailIndividual}
            onVisualizarRelatorio={handleVisualizarRelatorio}
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
          <Card>
            <CardHeader>
              <CardTitle>Demonstrativos de Repasse</CardTitle>
              <CardDescription>
                Visualize os demonstrativos detalhados por médico
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Funcionalidade de visualização de demonstrativos em desenvolvimento.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 4: RELATÓRIOS */}
        <TabsContent value="relatorios" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Relatórios Gerados</CardTitle>
              <CardDescription>
                Consulte e faça download dos relatórios de repasse
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Funcionalidade de consulta de relatórios em desenvolvimento.
              </p>
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
