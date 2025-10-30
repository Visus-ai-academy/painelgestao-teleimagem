import { useState, useEffect, Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CalendarIcon, Download, Eye, Calculator, Filter, Search, Upload, BarChart3, AlertCircle, ChevronDown, ChevronRight, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Normalização de strings para comparação robusta
const normalizeStr = (v?: string | null) =>
  (v ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const normalizeCategoria = (v?: string | null) => {
  const n = normalizeStr(v);
  if (n === "SC") return "SCORE"; // mapeamento comum
  return n;
};

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

// Cache de resultados por período
const CACHE_KEY = (periodo: string) => `pag_medicos_${periodo}`;
function salvarResumosCache(periodo: string, dados: ResumoMedico[]) {
  try { localStorage.setItem(CACHE_KEY(periodo), JSON.stringify(dados)); } catch (e) { console.warn('Falha ao salvar cache', e); }
}
function carregarResumosCache(periodo: string): ResumoMedico[] | null {
  try { const raw = localStorage.getItem(CACHE_KEY(periodo)); return raw ? JSON.parse(raw) : null; } catch (e) { console.warn('Falha ao ler cache', e); return null; }
}

export default function PagamentosMedicos() {
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [resumos, setResumos] = useState<ResumoMedico[]>([]);
  const [periodoReferencia, setPeriodoReferencia] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('pag_medicos_periodo') : null;
    return saved || format(new Date(), 'yyyy-MM');
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

  // Restaurar do cache ao mudar o período
  useEffect(() => {
    const cached = carregarResumosCache(periodoReferencia);
    if (cached) setResumos(cached);
  }, [periodoReferencia]);

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
        .select('id, "MEDICO", "MODALIDADE", "ESPECIALIDADE", "CATEGORIA", "PRIORIDADE", "VALORES", "EMPRESA", "Cliente_Nome_Fantasia", "DATA_LAUDO", "DATA_REALIZACAO", "NOME_PACIENTE"')
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

      // Buscar mapeamentos de nomes para normalização
      const { data: mapeamentos, error: mapeamentosError } = await supabase
        .from('mapeamento_nomes_medicos')
        .select('*')
        .eq('ativo', true);

      if (mapeamentosError) throw mapeamentosError;

      // Criar mapas de nomes normalizados por origem
      const mapeamentoVolumetria = new Map<string, string>();
      const mapeamentoRepasse = new Map<string, string>();
      
      (mapeamentos || []).forEach(map => {
        const nomeNorm = normalizeStr(map.nome_origem);
        const medicoNomeNormalizado = map.medico_nome || map.nome_origem_normalizado;
        if (!medicoNomeNormalizado) return;
        
        if (map.tipo_origem === 'volumetria') {
          mapeamentoVolumetria.set(nomeNorm, medicoNomeNormalizado);
        } else if (map.tipo_origem === 'repasse') {
          mapeamentoRepasse.set(nomeNorm, medicoNomeNormalizado);
        }
      });

      console.log(`Encontrados ${valoresRepasse?.length || 0} registros de valores de repasse`);
      console.log(`Mapeamentos volumetria: ${mapeamentoVolumetria.size}, repasse: ${mapeamentoRepasse.size}`);

      // Agrupar por médico
      const resumosPorMedico = new Map<string, ResumoMedico>();
      let totalSemValor = 0;
      let totalComValor = 0;

      console.log('=== INICIANDO CÁLCULO DE PAGAMENTOS ===');
      console.log('Total de registros volumetria:', volumetria.length);
      console.log('Total de valores de repasse:', valoresRepasse?.length);

      // Função de busca com pontuação para escolher o melhor valor de repasse
      const buscarValorRepasse = (reg: any) => {
        const medicoNomeOriginal = reg.MEDICO;
        const medicoNorm = normalizeStr(medicoNomeOriginal);
        
        // Tentar obter nome normalizado do mapeamento de volumetria
        const medicoNormalizado = mapeamentoVolumetria.get(medicoNorm) || medicoNomeOriginal;
        const medicoNormFinal = normalizeStr(medicoNormalizado);
        
        const modalidadeNorm = normalizeStr(reg.MODALIDADE);
        const especialidadeNorm = normalizeStr(reg.ESPECIALIDADE);
        const categoriaNorm = normalizeCategoria(reg.CATEGORIA);
        const prioridadeNorm = normalizeStr(reg.PRIORIDADE);
        const clienteNorm = normalizeStr(reg.EMPRESA);
        const clienteFantasiaNorm = normalizeStr(reg.Cliente_Nome_Fantasia || reg.cliente_nome_fantasia);

        // Buscar valores de repasse considerando o nome normalizado
        const candidatosBase = (valoresRepasse || []).filter(vr => {
          const medicoRepasseNome = vr.medicos?.nome || vr.medico_nome_original;
          if (!medicoRepasseNome) return false;
          
          const medicoRepasseNorm = normalizeStr(medicoRepasseNome);
          // Verificar se tem mapeamento do repasse
          const medicoRepasseNormalizado = mapeamentoRepasse.get(medicoRepasseNorm) || medicoRepasseNome;
          const medicoRepasseNormFinal = normalizeStr(medicoRepasseNormalizado);
          
          return (
            (medicoRepasseNormFinal === medicoNormFinal || medicoRepasseNorm === medicoNorm) &&
            normalizeStr(vr.modalidade) === modalidadeNorm &&
            normalizeStr(vr.especialidade) === especialidadeNorm
          );
        });

        let melhor: any = null;
        let melhorScore = -1;

        for (const vr of candidatosBase) {
          const catMatch = normalizeCategoria(vr.categoria) === categoriaNorm;
          const priMatch = normalizeStr(vr.prioridade) === prioridadeNorm;
          const clienteNomeNorm = normalizeStr(vr.clientes?.nome);
          const clienteMatch = !!vr.cliente_id && (clienteNomeNorm === clienteNorm || clienteNomeNorm === clienteFantasiaNorm);
          const generico = !vr.cliente_id;

          let score = 0;
          if (clienteMatch) score += 10;
          if (catMatch) score += 5;
          if (priMatch) score += 3;
          if (generico) score += 1; // pequeno bônus para genérico na falta de cliente específico

          if (score > melhorScore) {
            melhor = vr;
            melhorScore = score;
          }
        }

        return melhor;
      };

      for (let index = 0; index < volumetria.length; index++) {
        const registro = volumetria[index];
        const medicoNome = registro.MEDICO;
        if (!medicoNome) continue;

        // Normalizar campos para comparação (remoção de acentos, espaços extras e case)
        const medicoNorm = normalizeStr(medicoNome);
        const modalidadeNorm = normalizeStr(registro.MODALIDADE);
        const especialidadeNorm = normalizeStr(registro.ESPECIALIDADE);
        const categoriaNorm = normalizeCategoria(registro.CATEGORIA);
        const prioridadeNorm = normalizeStr(registro.PRIORIDADE);
        const clienteNorm = normalizeStr(registro.EMPRESA);

        if (index < 3) {
          console.log(`\n--- Registro ${index + 1} ---`);
          console.log('Médico:', medicoNome);
          console.log('Modalidade:', modalidadeNorm);
          console.log('Especialidade:', especialidadeNorm);
          console.log('Categoria:', categoriaNorm);
          console.log('Prioridade:', prioridadeNorm);
          console.log('Cliente:', clienteNorm);
        }

        // Buscar melhor valor de repasse para este registro
        const valorRepasse = buscarValorRepasse(registro);

        if (index < 3) {
          console.log('Valor encontrado?', !!valorRepasse);
          if (valorRepasse) {
            console.log('Valor unitário:', valorRepasse.valor, 'Cliente amarrado?', !!valorRepasse.cliente_id);
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

        // Ceder o thread a cada 1000 registros para evitar travar a UI
        if (index > 0 && index % 1000 === 0) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }

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
      salvarResumosCache(periodoReferencia, resumosArray);

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
          <p className="text-sm text-muted-foreground mt-1">
            Clique em um médico para ver os detalhes
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Carregando dados...</div>
          ) : (
            <div className="space-y-2">
              {resumosFiltrados.map((resumo) => (
                <Collapsible key={resumo.medico.id}>
                  <CollapsibleTrigger 
                    className="w-full"
                    onClick={() => setMedicoExpandido(medicoExpandido === resumo.medico.id ? null : resumo.medico.id)}
                  >
                    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        {medicoExpandido === resumo.medico.id ? 
                          <ChevronDown className="h-4 w-4" /> : 
                          <ChevronRight className="h-4 w-4" />
                        }
                        <Eye className="h-4 w-4" />
                        <span className="font-medium">{resumo.medico.nome}</span>
                        {resumo.exames_sem_valor > 0 && (
                          <Badge variant="outline" className="ml-2 text-orange-600 border-orange-600">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {resumo.exames_sem_valor} sem valor
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <div className="font-medium">{resumo.total_exames}</div>
                          <div className="text-muted-foreground">Exames</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-lg text-green-600">
                            R$ {resumo.valor_bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-muted-foreground">Valor a Pagar</div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="p-4 border-l border-r border-b rounded-b-lg bg-muted/25 space-y-4">
                      {/* Detalhes dos Arranjos */}
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Detalhamento por Arranjo
                        </h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Modalidade</TableHead>
                              <TableHead>Especialidade</TableHead>
                              <TableHead>Categoria</TableHead>
                              <TableHead>Prioridade</TableHead>
                              <TableHead className="text-right">Quantidade</TableHead>
                              <TableHead className="text-right">Valor Unit.</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {resumo.arranjos.map((arranjo, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-medium">{arranjo.modalidade}</TableCell>
                                <TableCell>{arranjo.especialidade}</TableCell>
                                <TableCell>{arranjo.categoria}</TableCell>
                                <TableCell>{arranjo.prioridade}</TableCell>
                                <TableCell className="text-right">
                                  {arranjo.quantidade}
                                  {arranjo.exames_sem_valor > 0 && (
                                    <Badge variant="outline" className="ml-2 text-xs text-orange-600 border-orange-600">
                                      {arranjo.exames_sem_valor} s/ valor
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  R$ {arranjo.valor_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-right font-medium text-green-600">
                                  R$ {arranjo.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="font-bold bg-muted/50">
                              <TableCell colSpan={4} className="text-right">Total Geral</TableCell>
                              <TableCell className="text-right">{resumo.total_exames}</TableCell>
                              <TableCell></TableCell>
                              <TableCell className="text-right text-green-600">
                                R$ {resumo.valor_bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}