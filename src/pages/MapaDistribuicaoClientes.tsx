import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useClienteData } from '@/hooks/useClienteData';
import { useVolumetria } from '@/contexts/VolumetriaContext';
import { toast } from "sonner";
import { MapPin, Users, Building2, RefreshCw, Filter, BarChart3, Zap } from "lucide-react";
import { MapaPorEstado } from "@/components/mapa/MapaPorEstado";
import { MapaPorCidade } from "@/components/mapa/MapaPorCidade";

interface ClienteVolumetria {
  id: string;
  nome: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  status: string;
  ativo: boolean;
  email?: string;
  tipo_cliente?: string;
  volume_exames: number;
  total_registros: number;
  modalidades: string[];
  especialidades: string[];
  prioridades: string[];
}

interface RegiaoEstatistica {
  regiao: string;
  estados: string[];
  total_clientes: number;
  volume_total: number;
  clientes: ClienteVolumetria[];
  cor_intensidade: number;
}

interface EstadoEstatistica {
  estado: string;
  regiao: string;
  total_clientes: number;
  volume_total: number;
  cidades: { [cidade: string]: ClienteVolumetria[] };
}

// Mapeamento de regiões do Brasil
const REGIOES_BRASIL = {
  'Norte': ['AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO'],
  'Nordeste': ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
  'Centro-Oeste': ['DF', 'GO', 'MT', 'MS'],
  'Sudeste': ['ES', 'MG', 'RJ', 'SP'],
  'Sul': ['PR', 'RS', 'SC']
};

const getRegiaoByEstado = (estado: string): string => {
  for (const [regiao, estados] of Object.entries(REGIOES_BRASIL)) {
    if (estados.includes(estado)) return regiao;
  }
  return 'Não identificado';
};

const getCorIntensidade = (volume: number, maxVolume: number): string => {
  if (volume === 0) return 'bg-gray-200 text-gray-600';
  const intensidade = (volume / maxVolume) * 100;
  if (intensidade < 20) return 'bg-red-400 text-white';
  if (intensidade < 40) return 'bg-red-500 text-white';
  if (intensidade < 60) return 'bg-red-600 text-white';
  if (intensidade < 80) return 'bg-red-700 text-white';
  return 'bg-red-800 text-white';
};

export default function MapaDistribuicaoClientes() {
  const [regioesEstatisticas, setRegioesEstatisticas] = useState<RegiaoEstatistica[]>([]);
  const [estadosEstatisticas, setEstadosEstatisticas] = useState<EstadoEstatistica[]>([]);
  
  // USAR APENAS DADOS DO CONTEXTO CENTRALIZADO - NÃO MAIS useVolumetriaSimple
  const { data: clientesData, loading: loadingClientes, stats: clienteStats, refetch: refetchClientes } = useClienteData();
  const { data: contextData } = useVolumetria(); // ÚNICA FONTE DE DADOS CORRETOS
  
  console.log('🗺️ [MapaDistribuicaoClientes] Dados do contexto:', {
    detailedData: contextData.detailedData.length,
    totalExames: contextData.dashboardStats.total_exames,
    loading: contextData.loading
  });
  
  // Filtros
  const [filtroModalidade, setFiltroModalidade] = useState<string>('todas');
  const [filtroEspecialidade, setFiltroEspecialidade] = useState<string>('todas');
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>('todas');
  const [filtroTipoCliente, setFiltroTipoCliente] = useState<string>('todos');
  const [visualizacao, setVisualizacao] = useState<'regioes' | 'estados' | 'cidades'>('regioes');

  // Processar dados para o mapa - com verificação de filtros
  const dadosProcessados = useMemo(() => {
    if (!clientesData) return [];
    
    console.log('🔍 Processando estatísticas para', clientesData.length, 'clientes');
    console.log('📊 Filtros ativos:', {
      filtroTipoCliente,
      filtroModalidade,
      filtroEspecialidade,
      filtroPrioridade
    });

    // Verificar se há filtros de volumetria ativos
    const temFiltrosVolumetria = filtroModalidade !== 'todas' || filtroEspecialidade !== 'todas' || filtroPrioridade !== 'todas';
    const temFiltroTipoCliente = filtroTipoCliente !== 'todos';
    const temQualquerFiltro = temFiltrosVolumetria || temFiltroTipoCliente;

    console.log('🔍 Status dos filtros:', {
      temFiltrosVolumetria,
      temFiltroTipoCliente,
      temQualquerFiltro
    });

    // Primeiro aplicar filtro de tipo de cliente nos clientes APENAS se houver filtro ativo
    let clientesFiltrados = clientesData;
    if (temFiltroTipoCliente) {
      clientesFiltrados = clientesData.filter(cliente => {
        if (filtroTipoCliente !== 'todos' && cliente.tipo_cliente !== filtroTipoCliente) return false;
        return true;
      });
    }

    let volumetriaPorEmpresa: Record<string, any> = {};
    
    // Criar mapa de volumetria por empresa usando dados do contexto centralizado
    if (contextData.detailedData && contextData.detailedData.length > 0) {
      let volumetriaFiltrada = contextData.detailedData;
      
      // Se há filtros de volumetria, aplicar
      if (temFiltrosVolumetria) {
        console.log('🔧 COM FILTROS - Processando dados filtrados');
        volumetriaFiltrada = contextData.detailedData.filter(item => {
          if (filtroModalidade !== 'todas' && item.MODALIDADE !== filtroModalidade) return false;
          if (filtroEspecialidade !== 'todas' && item.ESPECIALIDADE !== filtroEspecialidade) return false;
          if (filtroPrioridade !== 'todas' && item.PRIORIDADE !== filtroPrioridade) return false;
          return true;
        });
        
        // Filtrar apenas clientes que têm volumetria com os filtros aplicados
        const empresasComVolumetria = new Set(volumetriaFiltrada.map(item => item.EMPRESA));
        clientesFiltrados = clientesFiltrados.filter(cliente => empresasComVolumetria.has(cliente.nome));
        
        console.log('📋 Clientes após filtros de volumetria:', clientesFiltrados.length);
      } else {
        console.log('🚀 SEM FILTROS - Usando dados reais');
      }

      // Criar mapa de volumetria por empresa usando dados reais do contexto
      volumetriaPorEmpresa = volumetriaFiltrada.reduce((acc, item) => {
        const empresa = item.EMPRESA;
        if (!empresa) return acc;
        
        if (!acc[empresa]) {
          acc[empresa] = {
            volume_exames: 0,
            total_registros: 0,
            modalidades: new Set<string>(),
            especialidades: new Set<string>(),
            prioridades: new Set<string>()
          };
        }
        
        acc[empresa].volume_exames += Number(item.VALORES) || 0; // Valores reais dos dados
        acc[empresa].total_registros += 1;
        
        if (item.MODALIDADE) acc[empresa].modalidades.add(item.MODALIDADE);
        if (item.ESPECIALIDADE) acc[empresa].especialidades.add(item.ESPECIALIDADE);
        if (item.PRIORIDADE) acc[empresa].prioridades.add(item.PRIORIDADE);
        
        return acc;
      }, {} as Record<string, any>);
    }

    // Processar todos os clientes filtrados
    const clientesProcessados = clientesFiltrados.map(cliente => {
      const volumetria = volumetriaPorEmpresa[cliente.nome] || {
        volume_exames: 0,
        total_registros: 0,
        modalidades: new Set(),
        especialidades: new Set(),
        prioridades: new Set()
      };

      return {
        id: cliente.id,
        nome: cliente.nome,
        endereco: cliente.endereco,
        cidade: cliente.cidade || 'N/A',
        estado: cliente.estado || 'N/A',
        status: cliente.status,
        ativo: cliente.ativo,
        email: cliente.email,
        tipo_cliente: cliente.tipo_cliente,
        volume_exames: volumetria.volume_exames,
        total_registros: volumetria.total_registros,
        modalidades: Array.from(volumetria.modalidades) as string[],
        especialidades: Array.from(volumetria.especialidades) as string[],
        prioridades: Array.from(volumetria.prioridades) as string[]
      } as ClienteVolumetria;
    });
    
    console.log('✅ Clientes processados:', clientesProcessados.length);
    console.log('📊 Volume total dos clientes processados:', clientesProcessados.reduce((sum, c) => sum + c.volume_exames, 0));
    console.log('🎯 Tem qualquer filtro ativo:', temQualquerFiltro);
    
    return clientesProcessados;
  }, [clientesData, contextData.detailedData, contextData.stats, filtroTipoCliente, filtroModalidade, filtroEspecialidade, filtroPrioridade]);

  // Usar dados corretos do contexto para totais gerais
  const totalGeralCorreto = {
    clientes: clienteStats.total, // Total de clientes cadastrados
    volume: contextData.dashboardStats.total_exames // DADOS CORRETOS DO CONTEXTO: 39.035 exames
  };

  // Verificar se há filtros realmente ativos para decidir qual total usar
  const temFiltrosAtivosDisplay = Object.entries({
    filtroTipoCliente,
    filtroModalidade, 
    filtroEspecialidade,
    filtroPrioridade
  }).some(([key, value]) => {
    if (key === 'filtroTipoCliente') return value !== 'todos';
    return value !== 'todas';
  });

  // Processar estatísticas por região e estado
  const processarEstatisticas = useMemo(() => {
    if (!dadosProcessados.length) return { regioes: [], estados: [] };

    const regioesMap = new Map<string, RegiaoEstatistica>();
    const estadosMap = new Map<string, EstadoEstatistica>();

    dadosProcessados.forEach((cliente: ClienteVolumetria) => {
      const estado = cliente.estado || 'NI';
      const regiao = getRegiaoByEstado(estado);

      // Estatísticas por região
      if (!regioesMap.has(regiao)) {
        regioesMap.set(regiao, {
          regiao,
          estados: REGIOES_BRASIL[regiao as keyof typeof REGIOES_BRASIL] || [],
          total_clientes: 0,
          volume_total: 0,
          clientes: [],
          cor_intensidade: 0
        });
      }

      const estatRegiao = regioesMap.get(regiao)!;
      estatRegiao.total_clientes++;
      estatRegiao.volume_total += cliente.volume_exames; // Valor real, sem correções
      estatRegiao.clientes.push(cliente);

      // Estatísticas por estado
      if (!estadosMap.has(estado)) {
        estadosMap.set(estado, {
          estado,
          regiao,
          total_clientes: 0,
          volume_total: 0,
          cidades: {}
        });
      }

      const estatEstado = estadosMap.get(estado)!;
      estatEstado.total_clientes++;
      estatEstado.volume_total += cliente.volume_exames; // Valor real, sem correções

      const cidade = cliente.cidade || 'Não informado';
      if (!estatEstado.cidades[cidade]) {
        estatEstado.cidades[cidade] = [];
      }
      estatEstado.cidades[cidade].push(cliente);
    });

    // Calcular intensidade de cor baseada no volume máximo
    const maxVolume = Math.max(...Array.from(regioesMap.values()).map(r => r.volume_total));
    regioesMap.forEach(regiao => {
      regiao.cor_intensidade = regiao.volume_total > 0 ? (regiao.volume_total / maxVolume) * 100 : 0;
    });

    return {
      regioes: Array.from(regioesMap.values()),
      estados: Array.from(estadosMap.values())
    };
  }, [dadosProcessados]);

  useEffect(() => {
    setRegioesEstatisticas(processarEstatisticas.regioes);
    setEstadosEstatisticas(processarEstatisticas.estados);
  }, [processarEstatisticas]);

  // Obter listas únicas para filtros a partir do contexto centralizado
  const modalidadesUnicas = [...new Set(contextData.detailedData?.map(v => v.MODALIDADE).filter(Boolean) || [])];
  const especialidadesUnicas = [...new Set(contextData.detailedData?.map(v => v.ESPECIALIDADE).filter(Boolean) || [])];
  const prioridadesUnicas = [...new Set(contextData.detailedData?.map(v => v.PRIORIDADE).filter(Boolean) || [])];
  const tiposClienteUnicos = [...new Set(clientesData?.map(c => c.tipo_cliente).filter(Boolean) || [])];


  // Usar dados filtrados apenas para exibição condicional, não para totais
  const totalFiltrado = {
    clientes: regioesEstatisticas.reduce((sum, r) => sum + r.total_clientes, 0),
    volume: regioesEstatisticas.reduce((sum, r) => sum + r.volume_total, 0)
  };

  const carregando = loadingClientes || contextData.loading;

  if (carregando) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mapa de Distribuição de Clientes</h1>
          <p className="text-gray-600 mt-1">Distribuição geográfica com dados reais de volumetria</p>
          <div className="mt-2">
            <p className="text-muted-foreground">Clientes Cadastrados: {clienteStats.total}</p>
            <p className="text-muted-foreground">CNPJs Únicos: {clienteStats.cnpjsUnicos}</p>
          </div>
        </div>
        <Button onClick={refetchClientes} disabled={carregando}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros de Análise
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo Cliente</label>
              <Select value={filtroTipoCliente} onValueChange={setFiltroTipoCliente}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="CO">CO - Consolidado</SelectItem>
                  <SelectItem value="NC">NC - Não Consolidado</SelectItem>
                  {tiposClienteUnicos.filter(tipo => tipo && !['CO', 'NC'].includes(tipo as string)).map(tipo => (
                    <SelectItem key={String(tipo)} value={String(tipo)}>{String(tipo)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Modalidade</label>
              <Select value={filtroModalidade} onValueChange={setFiltroModalidade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {modalidadesUnicas.map(modalidade => (
                    <SelectItem key={String(modalidade)} value={String(modalidade)}>{String(modalidade)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Especialidade</label>
              <Select value={filtroEspecialidade} onValueChange={setFiltroEspecialidade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {especialidadesUnicas.map(especialidade => (
                    <SelectItem key={String(especialidade)} value={String(especialidade)}>{String(especialidade)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Prioridade</label>
              <Select value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {prioridadesUnicas.map(prioridade => (
                    <SelectItem key={String(prioridade)} value={String(prioridade)}>{String(prioridade)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Visualização</label>
              <Select value={visualizacao} onValueChange={(v) => setVisualizacao(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regioes">Por Região</SelectItem>
                  <SelectItem value="estados">Por Estado</SelectItem>
                  <SelectItem value="cidades">Por Cidade</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo Geral */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Clientes</p>
                <p className="text-2xl font-bold">{totalGeralCorreto.clientes}</p>
                {temFiltrosAtivosDisplay && (
                  <p className="text-xs text-muted-foreground">Com filtros aplicados: {totalFiltrado.clientes}</p>
                )}
                {!temFiltrosAtivosDisplay && (
                  <p className="text-xs text-green-600">✓ Sem filtros aplicados</p>
                )}
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Volume Total de Laudos/Exames</p>
                <p className="text-2xl font-bold">{totalGeralCorreto.volume.toLocaleString()}</p>
                {temFiltrosAtivosDisplay && (
                  <p className="text-xs text-muted-foreground">Com filtros aplicados: {totalFiltrado.volume.toLocaleString()}</p>
                )}
                {!temFiltrosAtivosDisplay && (
                  <p className="text-xs text-green-600">✓ Sem filtros aplicados</p>
                )}
              </div>
              <BarChart3 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mapa de Calor por Regiões */}
      {visualizacao === 'regioes' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              Mapa de Calor - Distribuição por Região
               <Badge variant="outline" className="text-sm">
                 Total: {regioesEstatisticas.reduce((sum, r) => sum + r.volume_total, 0).toLocaleString()} exames
               </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 text-sm text-muted-foreground">
              Regiões ordenadas por volume de exames (maior para menor)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {regioesEstatisticas
                .sort((a, b) => b.volume_total - a.volume_total)
                .map((regiao, index) => {
                  const maxVolume = Math.max(...regioesEstatisticas.map(r => r.volume_total));
                  const corClasse = getCorIntensidade(regiao.volume_total, maxVolume);
                  
                  return (
                    <div key={regiao.regiao} className={`p-6 rounded-lg ${corClasse} transition-all hover:scale-105 cursor-pointer relative`}>
                      <div className="text-center">
                        <div className="absolute top-2 right-2">
                          <Badge variant="secondary" className="text-xs px-2 py-1">
                            #{index + 1}
                          </Badge>
                        </div>
                        <h3 className="font-bold text-lg">{regiao.regiao}</h3>
                        <div className="mt-3 space-y-1">
                          <p className="text-sm font-medium">{regiao.total_clientes} clientes</p>
                          <p className="text-sm font-bold">{regiao.volume_total.toLocaleString()} exames</p>
                          <Badge variant="outline" className="mt-2 text-xs">
                            {regiao.estados.length} estados
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {visualizacao === 'estados' && (
        <MapaPorEstado estados={estadosEstatisticas} />
      )}

      {/* Mapa de Calor por Cidades */}
      {visualizacao === 'cidades' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              Mapa de Calor - Distribuição por Cidade
               <Badge variant="outline" className="text-sm">
                 Total: {estadosEstatisticas.reduce((sum, e) => sum + e.volume_total, 0).toLocaleString()} exames
               </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 text-sm text-muted-foreground">
              Cidades agrupadas por estado, ordenadas por volume de exames
            </div>
            <div className="space-y-6">
              {estadosEstatisticas
                .filter(estado => estado.total_clientes > 0)
                .sort((a, b) => b.volume_total - a.volume_total)
                .map(estado => (
                  <div key={estado.estado} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg text-blue-600">
                        {estado.estado} - {estado.regiao}
                      </h3>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-600">
                          {estado.total_clientes} clientes | {estado.volume_total.toLocaleString()} exames
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {Object.keys(estado.cidades).length} cidades
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                      {Object.entries(estado.cidades)
                        .sort(([,a], [,b]) => {
                          const volumeA = a.reduce((sum, c) => sum + c.volume_exames, 0);
                          const volumeB = b.reduce((sum, c) => sum + c.volume_exames, 0);
                          return volumeB - volumeA;
                        })
                        .map(([cidade, clientesCidade], index) => {
                          const volumeCidade = clientesCidade.reduce((sum, c) => sum + c.volume_exames, 0);
                          const maxVolumeCidades = Math.max(...Object.values(estado.cidades).map(cidades => 
                            cidades.reduce((sum, c) => sum + c.volume_exames, 0)
                          ));
                          const corClasse = getCorIntensidade(volumeCidade, maxVolumeCidades);
                          
                          return (
                            <div key={`${estado.estado}-${cidade}`} className={`p-3 rounded-lg ${corClasse} transition-all hover:scale-105 cursor-pointer relative`}>
                              <div className="text-center">
                                <div className="absolute top-1 right-1">
                                  <Badge variant="secondary" className="text-xs px-1 py-0">
                                    #{index + 1}
                                  </Badge>
                                </div>
                                <h4 className="font-medium text-sm mb-1">{cidade}</h4>
                                <div className="space-y-1">
                                  <p className="text-xs">{clientesCidade.length} clientes</p>
                                  <p className="text-xs font-medium">{volumeCidade.toLocaleString()} exames</p>
                                </div>
                                {/* Lista dos clientes */}
                                <div className="mt-2 text-xs opacity-75">
                                  {clientesCidade.slice(0, 2).map(cliente => (
                                    <div key={cliente.id} className="truncate">
                                      {cliente.nome.split(' ')[0]}...
                                    </div>
                                  ))}
                                  {clientesCidade.length > 2 && (
                                    <div>+{clientesCidade.length - 2} mais</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}