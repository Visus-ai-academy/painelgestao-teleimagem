import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarIcon, Download, Eye, Calculator, Filter, Search, Upload, BarChart3, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Medico {
  id: string;
  nome: string;
  crm: string;
  especialidade: string;
  categoria: string;
  email: string;
}

interface ExameDetalhe {
  id: string;
  data_exame: string;
  modalidade: string;
  especialidade: string;
  categoria: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  cliente_nome: string;
  paciente_nome: string;
  prioridade: string;
  sem_valor_configurado: boolean;
}

interface ArranjoAgrupado {
  modalidade: string;
  especialidade: string;
  categoria: string;
  prioridade: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  exames_sem_valor: number;
}

interface ResumoMedico {
  medico: Medico;
  total_exames: number;
  valor_bruto: number;
  descontos: number;
  valor_liquido: number;
  exames: ExameDetalhe[];
  exames_sem_valor: number;
  arranjos: ArranjoAgrupado[];
}

export default function PagamentosMedicos() {
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [resumos, setResumos] = useState<ResumoMedico[]>([]);
  const [periodoReferencia, setPeriodoReferencia] = useState(() => {
    const hoje = new Date();
    return format(hoje, 'yyyy-MM');
  });
  const [loading, setLoading] = useState(false);
  const [filtroMedico, setFiltroMedico] = useState("");
  const [filtroEspecialidade, setFiltroEspecialidade] = useState("");
  const [medicoDetalhado, setMedicoDetalhado] = useState<ResumoMedico | null>(null);
  const [medicoExpandido, setMedicoExpandido] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    carregarMedicos();
  }, []);

  // Remover auto-cálculo - apenas quando clicar no botão

  const carregarMedicos = async () => {
    try {
      const { data, error } = await supabase
        .from('medicos')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      setMedicos(data || []);
    } catch (error) {
      console.error('Erro ao carregar médicos:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar lista de médicos",
        variant: "destructive",
      });
    }
  };

  const calcularPagamentos = async () => {
    if (!periodoReferencia) {
      toast({
        title: "Atenção",
        description: "Selecione um período de referência",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      console.log('Calculando pagamentos para período:', periodoReferencia);

      // Buscar volumetria do período
      const { data: volumetria, error: volumetriaError } = await supabase
        .from('volumetria_mobilemed')
        .select('*')
        .eq('periodo_referencia', periodoReferencia);

      if (volumetriaError) throw volumetriaError;

      console.log(`Encontrados ${volumetria?.length || 0} registros de volumetria`);

      if (!volumetria || volumetria.length === 0) {
        toast({
          title: "Aviso",
          description: "Nenhum registro de volumetria encontrado para este período",
          variant: "destructive",
        });
        setResumos([]);
        setLoading(false);
        return;
      }

      // Buscar valores de repasse com joins para obter nomes
      const { data: valoresRepasse, error: repasseError } = await supabase
        .from('medicos_valores_repasse')
        .select(`
          *,
          medicos (nome),
          clientes (nome)
        `);

      if (repasseError) throw repasseError;

      console.log(`Encontrados ${valoresRepasse?.length || 0} registros de valores de repasse`);

      // Agrupar por médico
      const resumosPorMedico = new Map<string, ResumoMedico>();
      let totalSemValor = 0;
      let totalComValor = 0;

      console.log('=== INICIANDO CÁLCULO DE PAGAMENTOS ===');
      console.log('Total de registros volumetria:', volumetria.length);
      console.log('Total de valores de repasse:', valoresRepasse?.length);

      volumetria.forEach((registro, index) => {
        const medicoNome = registro.MEDICO;
        if (!medicoNome) return;

        // BUSCA HIERÁRQUICA: do mais específico para o mais genérico
        let valorRepasse = null;
        
        // Normalizar campos para comparação
        const medicoNorm = medicoNome.trim().toLowerCase();
        const modalidadeNorm = registro.MODALIDADE?.trim();
        const especialidadeNorm = registro.ESPECIALIDADE?.trim();
        const categoriaNorm = registro.CATEGORIA?.trim();
        const prioridadeNorm = registro.PRIORIDADE?.trim();
        const clienteNorm = registro.EMPRESA?.trim();

        if (index < 3) {
          console.log(`\n--- Registro ${index + 1} ---`);
          console.log('Médico:', medicoNome);
          console.log('Modalidade:', modalidadeNorm);
          console.log('Especialidade:', especialidadeNorm);
          console.log('Categoria:', categoriaNorm);
          console.log('Prioridade:', prioridadeNorm);
          console.log('Cliente:', clienteNorm);
        }

        // NÍVEL 1: Match completo com cliente específico
        valorRepasse = valoresRepasse?.find(vr => {
          const medicoMatch = vr.medicos?.nome?.trim().toLowerCase() === medicoNorm;
          const modalidadeMatch = vr.modalidade === modalidadeNorm;
          const especialidadeMatch = vr.especialidade === especialidadeNorm;
          const categoriaMatch = vr.categoria === categoriaNorm;
          const prioridadeMatch = vr.prioridade === prioridadeNorm;
          const clienteMatch = vr.cliente_id && vr.clientes?.nome?.trim() === clienteNorm;
          
          return medicoMatch && modalidadeMatch && especialidadeMatch && categoriaMatch && prioridadeMatch && clienteMatch;
        });

        // NÍVEL 2: Match completo SEM cliente (genérico)
        if (!valorRepasse) {
          valorRepasse = valoresRepasse?.find(vr => {
            const medicoMatch = vr.medicos?.nome?.trim().toLowerCase() === medicoNorm;
            const modalidadeMatch = vr.modalidade === modalidadeNorm;
            const especialidadeMatch = vr.especialidade === especialidadeNorm;
            const categoriaMatch = vr.categoria === categoriaNorm;
            const prioridadeMatch = vr.prioridade === prioridadeNorm;
            
            return medicoMatch && modalidadeMatch && especialidadeMatch && categoriaMatch && prioridadeMatch && !vr.cliente_id;
          });
        }

        // NÍVEL 3: Match sem categoria
        if (!valorRepasse) {
          valorRepasse = valoresRepasse?.find(vr => {
            const medicoMatch = vr.medicos?.nome?.trim().toLowerCase() === medicoNorm;
            const modalidadeMatch = vr.modalidade === modalidadeNorm;
            const especialidadeMatch = vr.especialidade === especialidadeNorm;
            const prioridadeMatch = vr.prioridade === prioridadeNorm;
            
            return medicoMatch && modalidadeMatch && especialidadeMatch && prioridadeMatch && !vr.categoria && !vr.cliente_id;
          });
        }

        // NÍVEL 4: Match sem categoria E sem prioridade
        if (!valorRepasse) {
          valorRepasse = valoresRepasse?.find(vr => {
            const medicoMatch = vr.medicos?.nome?.trim().toLowerCase() === medicoNorm;
            const modalidadeMatch = vr.modalidade === modalidadeNorm;
            const especialidadeMatch = vr.especialidade === especialidadeNorm;
            
            return medicoMatch && modalidadeMatch && especialidadeMatch && !vr.categoria && !vr.prioridade && !vr.cliente_id;
          });
        }

        if (index < 3) {
          console.log('Valor encontrado?', !!valorRepasse);
          if (valorRepasse) {
            console.log('Valor unitário:', valorRepasse.valor);
          }
        }

        const semValorConfigurado = !valorRepasse;
        if (semValorConfigurado) {
          totalSemValor++;
        } else {
          totalComValor++;
        }

        const valorUnitario = valorRepasse ? Number(valorRepasse.valor) : 0;
        const quantidade = Number(registro.VALORES) || 0;
        const valorTotal = valorUnitario * quantidade;

        // Criar ou atualizar resumo do médico
        if (!resumosPorMedico.has(medicoNome)) {
          resumosPorMedico.set(medicoNome, {
            medico: {
              id: medicoNome,
              nome: medicoNome,
              crm: '',
              especialidade: registro.ESPECIALIDADE || '',
              categoria: registro.CATEGORIA || '',
              email: ''
            },
            total_exames: 0,
            valor_bruto: 0,
            descontos: 0,
            valor_liquido: 0,
            exames: [],
            exames_sem_valor: 0,
            arranjos: []
          });
        }

        const resumo = resumosPorMedico.get(medicoNome)!;
        resumo.total_exames += quantidade;
        resumo.valor_bruto += valorTotal;
        if (semValorConfigurado) {
          resumo.exames_sem_valor++;
        }

        resumo.exames.push({
          id: registro.id,
          data_exame: registro.DATA_LAUDO || registro.DATA_REALIZACAO || '',
          modalidade: registro.MODALIDADE || '',
          especialidade: registro.ESPECIALIDADE || '',
          categoria: registro.CATEGORIA || '',
          prioridade: registro.PRIORIDADE || '',
          quantidade: quantidade,
          valor_unitario: valorUnitario,
          valor_total: valorTotal,
          cliente_nome: registro.EMPRESA || '',
          paciente_nome: registro.NOME_PACIENTE || '',
          sem_valor_configurado: semValorConfigurado
        });
      });

      // Calcular valor líquido (sem descontos por enquanto)
      resumosPorMedico.forEach(resumo => {
        resumo.valor_liquido = resumo.valor_bruto - resumo.descontos;
      });

      // Agrupar arranjos para cada médico
      resumosPorMedico.forEach(resumo => {
        const arranjosMap = new Map<string, ArranjoAgrupado>();
        
        resumo.exames.forEach(exame => {
          const chave = `${exame.modalidade}|${exame.especialidade}|${exame.categoria}|${exame.prioridade}`;
          
          if (!arranjosMap.has(chave)) {
            arranjosMap.set(chave, {
              modalidade: exame.modalidade,
              especialidade: exame.especialidade,
              categoria: exame.categoria,
              prioridade: exame.prioridade,
              quantidade: 0,
              valor_unitario: exame.valor_unitario,
              valor_total: 0,
              exames_sem_valor: 0
            });
          }
          
          const arranjo = arranjosMap.get(chave)!;
          arranjo.quantidade += exame.quantidade;
          arranjo.valor_total += exame.valor_total;
          if (exame.sem_valor_configurado) {
            arranjo.exames_sem_valor += exame.quantidade;
          }
        });
        
        resumo.arranjos = Array.from(arranjosMap.values()).sort((a, b) => b.valor_total - a.valor_total);
      });

      const resumosArray = Array.from(resumosPorMedico.values());
      
      console.log('\n=== RESULTADO FINAL ===');
      console.log(`Total de médicos: ${resumosArray.length}`);
      console.log(`Total de exames COM valor: ${totalComValor}`);
      console.log(`Total de exames SEM valor: ${totalSemValor}`);
      console.log(`Valor total a pagar: R$ ${resumosArray.reduce((sum, r) => sum + r.valor_bruto, 0).toFixed(2)}`);
      
      setResumos(resumosArray);

      if (totalSemValor > 0) {
        toast({
          title: "Atenção",
          description: `${resumosArray.length} médico(s) processados. ${totalComValor} exames com valor, ${totalSemValor} sem valor.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sucesso",
          description: `Pagamento calculado para ${resumosArray.length} médico(s) - ${totalComValor} exames`,
        });
      }
    } catch (error) {
      console.error('Erro ao calcular pagamentos:', error);
      toast({
        title: "Erro",
        description: "Erro ao calcular pagamentos dos médicos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const gerarArquivoPagamento = async () => {
    try {
      const dados = resumos.map(resumo => ({
        medico: resumo.medico.nome,
        crm: resumo.medico.crm,
        especialidade: resumo.medico.especialidade,
        categoria: resumo.medico.categoria,
        total_exames: resumo.total_exames,
        valor_bruto: resumo.valor_bruto,
        descontos: resumo.descontos,
        valor_liquido: resumo.valor_liquido,
        periodo: periodoReferencia
      }));

      // Criar CSV
      const headers = ['Médico', 'CRM', 'Especialidade', 'Categoria', 'Total Exames', 'Valor Bruto', 'Descontos', 'Valor Líquido', 'Período'];
      const csvContent = [
        headers.join(','),
        ...dados.map(row => [
          row.medico,
          row.crm,
          row.especialidade,
          row.categoria,
          row.total_exames,
          row.valor_bruto.toFixed(2),
          row.descontos.toFixed(2),
          row.valor_liquido.toFixed(2),
          row.periodo
        ].join(','))
      ].join('\n');

      // Download do arquivo
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `pagamentos_medicos_${periodoReferencia.replace('/', '_')}.csv`;
      link.click();

      toast({
        title: "Sucesso",
        description: "Arquivo de pagamento médico gerado com sucesso",
      });
    } catch (error) {
      console.error('Erro ao gerar arquivo:', error);
      toast({
        title: "Erro",
        description: "Erro ao gerar arquivo de pagamento",
        variant: "destructive",
      });
    }
  };

  const resumosFiltrados = resumos.filter(resumo => {
    const nomeMatch = resumo.medico.nome.toLowerCase().includes(filtroMedico.toLowerCase());
    const especialidadeMatch = !filtroEspecialidade || filtroEspecialidade === "all" || resumo.medico.especialidade === filtroEspecialidade;
    return nomeMatch && especialidadeMatch;
  });

  const totalGeral = resumosFiltrados.reduce((acc, resumo) => ({
    exames: acc.exames + resumo.total_exames,
    bruto: acc.bruto + resumo.valor_bruto,
    descontos: acc.descontos + resumo.descontos,
    liquido: acc.liquido + resumo.valor_liquido
  }), { exames: 0, bruto: 0, descontos: 0, liquido: 0 });

  const especialidades = [...new Set(medicos.map(m => m.especialidade).filter(esp => esp && esp.trim() !== ''))];

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Pagamento Médico</h1>
          <p className="text-muted-foreground">Gestão de pagamentos e repasses médicos</p>
        </div>
      </div>

      {/* Controles e Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Controles de Período e Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Período de Referência
                </label>
                <Input
                  type="month"
                  min="2025-06"
                  value={periodoReferencia}
                  onChange={(e) => setPeriodoReferencia(e.target.value)}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Formato: YYYY-MM (ex: 2025-06)
                </p>
              </div>
              <div className="flex items-end">
                <Button onClick={calcularPagamentos} className="w-full" disabled={loading}>
                  <Calculator className="h-4 w-4 mr-2" />
                  {loading ? 'Processando...' : 'Gerar Pagamento Médico'}
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Buscar Médico</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nome do médico..."
                    value={filtroMedico}
                    onChange={(e) => setFiltroMedico(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Especialidade</label>
                <Select value={filtroEspecialidade} onValueChange={setFiltroEspecialidade}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas especialidades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas especialidades</SelectItem>
                    {especialidades.map(esp => (
                      <SelectItem key={esp} value={esp}>{esp}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={gerarArquivoPagamento} variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar CSV
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo Geral */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Total de Exames</p>
              <p className="text-2xl font-bold text-primary">{totalGeral.exames}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Valor Bruto</p>
              <p className="text-2xl font-bold text-blue-600">R$ {totalGeral.bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Descontos</p>
              <p className="text-2xl font-bold text-red-600">R$ {totalGeral.descontos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Valor Líquido</p>
              <p className="text-2xl font-bold text-green-600">R$ {totalGeral.liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista Detalhada */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Médico</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Carregando dados...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Médico</TableHead>
                  <TableHead className="text-right">Exames</TableHead>
                  <TableHead className="text-right">Valor a Pagar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumosFiltrados.map((resumo) => (
                  <>
                    <TableRow 
                      key={resumo.medico.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setMedicoExpandido(medicoExpandido === resumo.medico.id ? null : resumo.medico.id)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                          {resumo.medico.nome}
                          {resumo.exames_sem_valor > 0 && (
                            <Badge variant="outline" className="ml-2 text-orange-600 border-orange-600">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              {resumo.exames_sem_valor} sem valor
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{resumo.total_exames}</TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        R$ {resumo.valor_bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                    
                    {/* Detalhamento expandido */}
                    {medicoExpandido === resumo.medico.id && (
                      <TableRow>
                        <TableCell colSpan={3} className="bg-muted/30 p-6">
                          <div className="space-y-4">
                            <h4 className="font-semibold text-sm">Detalhamento por Arranjo</h4>
                            <div className="grid gap-2">
                              {resumo.arranjos.map((arranjo, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-background rounded-md border">
                                  <div className="flex-1">
                                    <div className="font-medium">
                                      {arranjo.modalidade} / {arranjo.especialidade} / {arranjo.categoria} / {arranjo.prioridade}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      Quantidade: {arranjo.quantidade} exame(s)
                                      {arranjo.exames_sem_valor > 0 && (
                                        <span className="ml-2 text-orange-600">
                                          ({arranjo.exames_sem_valor} sem valor)
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-medium">
                                      R$ {arranjo.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      R$ {arranjo.valor_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /un
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}