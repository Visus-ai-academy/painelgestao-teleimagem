import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MapPin, Users, Building2, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";

interface Cliente {
  id: string;
  nome: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  status: string;
  ativo: boolean;
  contato?: string;
  telefone?: string;
  email?: string;
  cnpj?: string;
  volume_exames?: number;
  total_registros?: number;
}

interface ClienteComCoordenadas extends Cliente {
  lat?: number;
  lng?: number;
}

interface EstadoEstatistica {
  estado: string;
  total: number;
  volume_total: number;
  clientes: ClienteComCoordenadas[];
}

// Função para geocodificar endereços usando Nominatim (gratuito)
const geocodeAddress = async (endereco: string): Promise<{ lat: number; lng: number } | null> => {
  try {
    if (!endereco) return null;
    
    // Limpar e formatar o endereço
    const enderecoLimpo = endereco.replace(/[^\w\s,-]/g, '').trim();
    const query = encodeURIComponent(`${enderecoLimpo}, Brazil`);
    
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1&countrycodes=br`,
      {
        headers: {
          'User-Agent': 'TeleImagem-MapaClientes/1.0'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('Erro na geocodificação');
    }
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }
    
    return null;
  } catch (error) {
    console.error('Erro ao geocodificar endereço:', endereco, error);
    return null;
  }
};

// Coordenadas aproximadas dos estados brasileiros para fallback (apenas quando há clientes)
const coordenadasEstados: Record<string, { lat: number; lng: number }> = {
  'AC': { lat: -8.77, lng: -70.55 },
  'AL': { lat: -9.71, lng: -35.73 },
  'AP': { lat: 1.41, lng: -51.77 },
  'AM': { lat: -3.07, lng: -61.66 },
  'BA': { lat: -12.96, lng: -38.51 },
  'CE': { lat: -3.71, lng: -38.54 },
  'DF': { lat: -15.83, lng: -47.86 },
  'ES': { lat: -19.19, lng: -40.34 },
  'GO': { lat: -16.64, lng: -49.31 },
  'MA': { lat: -2.55, lng: -44.30 },
  'MT': { lat: -12.64, lng: -55.42 },
  'MS': { lat: -20.51, lng: -54.54 },
  'MG': { lat: -18.10, lng: -44.38 },
  'PA': { lat: -5.53, lng: -52.29 },
  'PB': { lat: -7.06, lng: -35.55 },
  'PR': { lat: -24.89, lng: -51.55 },
  'PE': { lat: -8.28, lng: -35.07 },
  'PI': { lat: -8.28, lng: -43.68 },
  'RJ': { lat: -22.84, lng: -43.15 },
  'RN': { lat: -5.22, lng: -36.52 },
  'RS': { lat: -30.01, lng: -51.22 },
  'RO': { lat: -11.22, lng: -62.80 },
  'RR': { lat: 1.89, lng: -61.22 },
  'SC': { lat: -27.33, lng: -49.44 },
  'SP': { lat: -23.55, lng: -46.64 },
  'SE': { lat: -10.90, lng: -37.07 },
  'TO': { lat: -10.25, lng: -48.25 },
};

// Função para determinar intensidade da cor baseada no volume e quantidade
const getHeatmapColor = (volume: number, clientCount: number, maxVolume: number, maxClientCount: number): string => {
  // Normalizar valores entre 0 e 1
  const volumeRatio = maxVolume > 0 ? volume / maxVolume : 0;
  const clientRatio = maxClientCount > 0 ? clientCount / maxClientCount : 0;
  
  // Combinar métricas para intensidade final (peso maior para volume)
  const intensity = (volumeRatio * 0.7 + clientRatio * 0.3);
  
  if (intensity >= 0.8) return '#8B0000'; // Vermelho escuro - altíssimo
  if (intensity >= 0.6) return '#DC143C'; // Vermelho - alto
  if (intensity >= 0.4) return '#FF6347'; // Vermelho claro - médio-alto
  if (intensity >= 0.2) return '#FFA500'; // Laranja - médio
  if (intensity > 0) return '#FFD700';    // Amarelo - baixo
  return '#90EE90'; // Verde claro - muito baixo
};

// Função para determinar tamanho baseado na densidade
const getHeatmapSize = (volume: number, clientCount: number, maxVolume: number, maxClientCount: number): number => {
  const volumeRatio = maxVolume > 0 ? volume / maxVolume : 0;
  const clientRatio = maxClientCount > 0 ? clientCount / maxClientCount : 0;
  const intensity = (volumeRatio * 0.7 + clientRatio * 0.3);
  
  // Tamanhos de 20px a 60px baseados na intensidade
  return Math.max(20, Math.min(60, 20 + (intensity * 40)));
};

// Componente de Mapa com visualização por volumetria
function MapaVolumetria({ clientes }: { clientes: ClienteComCoordenadas[] }) {
  // Filtrar apenas clientes com coordenadas válidas
  const clientesComCoordenadas = clientes.filter(c => c.lat && c.lng && c.cidade && c.estado);
  const clientesSemCoordenadas = clientes.filter(c => !c.lat || !c.lng || !c.cidade || !c.estado);
  
  // Agrupar clientes por cidade para criar o mapa de calor
  const cidadesMap = new Map<string, {
    clientes: ClienteComCoordenadas[];
    totalVolume: number;
    clientCount: number;
    lat: number;
    lng: number;
    cidade: string;
    estado: string;
  }>();
  
  clientesComCoordenadas.forEach(cliente => {
    const key = `${cliente.cidade}-${cliente.estado}`;
    
    if (!cidadesMap.has(key)) {
      cidadesMap.set(key, {
        clientes: [],
        totalVolume: 0,
        clientCount: 0,
        lat: cliente.lat!,
        lng: cliente.lng!,
        cidade: cliente.cidade!,
        estado: cliente.estado!
      });
    }
    
    const cidadeData = cidadesMap.get(key)!;
    cidadeData.clientes.push(cliente);
    cidadeData.totalVolume += cliente.volume_exames || 0;
    cidadeData.clientCount += 1;
  });
  
  const cidadesArray = Array.from(cidadesMap.values());
  const maxVolume = Math.max(...cidadesArray.map(c => c.totalVolume), 1);
  const maxClientCount = Math.max(...cidadesArray.map(c => c.clientCount), 1);
  
  if (clientesComCoordenadas.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-96 flex items-center justify-center bg-gray-100 rounded-lg">
          <div className="text-center">
            <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">Nenhum cliente localizado para exibir no mapa</p>
            <p className="text-sm text-gray-500 mt-2">
              {clientesSemCoordenadas.length} cliente(s) sem cidade/estado cadastrado
            </p>
          </div>
        </div>
        
        {/* Lista de clientes sem localização */}
        {clientesSemCoordenadas.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2">Clientes sem cidade/estado cadastrado:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {clientesSemCoordenadas.slice(0, 10).map(cliente => (
                <div key={cliente.id} className="text-sm text-yellow-700">
                  • {cliente.nome}
                </div>
              ))}
              {clientesSemCoordenadas.length > 10 && (
                <div className="text-sm text-yellow-600 col-span-full">
                  ... e mais {clientesSemCoordenadas.length - 10} clientes
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Encontrar centro do mapa baseado nas coordenadas das cidades reais
  const center = cidadesArray.reduce(
    (acc, cidade) => ({
      lat: acc.lat + cidade.lat,
      lng: acc.lng + cidade.lng
    }),
    { lat: 0, lng: 0 }
  );
  
  center.lat = center.lat / cidadesArray.length;
  center.lng = center.lng / cidadesArray.length;

  return (
    <div className="space-y-4">
      {/* Legenda do Mapa de Calor */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium mb-3">Mapa de Calor - Densidade e Volume de Exames</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <p className="font-medium">Intensidade da Cor:</p>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#8B0000' }}></div>
              <span>Altíssimo volume (≥80%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#DC143C' }}></div>
              <span>Alto volume (60-80%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#FF6347' }}></div>
              <span>Médio-alto (40-60%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#FFA500' }}></div>
              <span>Médio (20-40%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#FFD700' }}></div>
              <span>Baixo (1-20%)</span>
            </div>
          </div>
          <div className="space-y-2">
            <p className="font-medium">Tamanho do Círculo:</p>
            <p className="text-gray-600">Representa a densidade combinada de clientes e volume de exames na cidade</p>
            <p className="text-xs text-gray-500 mt-2">
              Volume máximo: {maxVolume.toLocaleString()} exames<br/>
              Máximo de clientes por cidade: {maxClientCount}
            </p>
          </div>
        </div>
      </div>

      {/* Grid de cidades por intensidade */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
        {cidadesArray
          .sort((a, b) => (b.totalVolume + b.clientCount * 100) - (a.totalVolume + a.clientCount * 100))
          .map((cidade, index) => {
            const color = getHeatmapColor(cidade.totalVolume, cidade.clientCount, maxVolume, maxClientCount);
            const size = getHeatmapSize(cidade.totalVolume, cidade.clientCount, maxVolume, maxClientCount);
            
            return (
              <div 
                key={`${cidade.cidade}-${cidade.estado}`} 
                className="flex items-center justify-between p-3 bg-white border rounded-lg hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="rounded-full border-2 border-white shadow-md"
                    style={{ 
                      backgroundColor: color,
                      width: Math.max(16, size / 3),
                      height: Math.max(16, size / 3)
                    }}
                  />
                  <div>
                    <p className="font-medium text-sm">{cidade.cidade}</p>
                    <p className="text-xs text-gray-500">{cidade.estado} • {cidade.clientCount} cliente(s)</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">{cidade.totalVolume.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">exames</p>
                </div>
              </div>
            );
          })}
      </div>

      {/* Mapa estático mostrando apenas as cidades com clientes */}
      <div className="h-96 rounded-lg overflow-hidden border relative">
        <div className="absolute top-2 left-2 bg-white/90 rounded px-2 py-1 text-xs font-medium z-10">
          Mapa de Calor: {cidadesArray.length} cidades • {clientesComCoordenadas.length} clientes
        </div>
        <iframe
          width="100%"
          height="100%"
          frameBorder="0"
          scrolling="no"
          marginHeight={0}
          marginWidth={0}
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${center.lng-8},${center.lat-8},${center.lng+8},${center.lat+8}&layer=mapnik&marker=${center.lat},${center.lng}`}
          style={{ border: 0 }}
          title="Mapa de Calor - Distribuição de Clientes por Volumetria"
        />
      </div>
    </div>
  );
}

export default function MapaDistribuicaoClientes() {
  const [clientes, setClientes] = useState<ClienteComCoordenadas[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [estatisticas, setEstatisticas] = useState<EstadoEstatistica[]>([]);
  const [geocodificando, setGeocodificando] = useState(false);

  // Buscar clientes do banco de dados com volumetria
  const buscarClientes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Buscar clientes ativos com dados de volumetria
      const { data, error: supabaseError } = await supabase
        .from('clientes')
        .select(`
          id,
          nome,
          endereco,
          cidade,
          estado,
          status,
          ativo,
          contato,
          telefone,
          email,
          cnpj
        `)
        .eq('ativo', true);
      
      if (supabaseError) {
        throw supabaseError;
      }
      
      if (data) {
        // Buscar dados de volumetria separadamente
        const { data: volumetriaData } = await supabase
          .from('volumetria_mobilemed')
          .select('EMPRESA, VALORES')
          .not('EMPRESA', 'is', null);
        
        // Processar dados de volumetria por empresa
        const volumetriaMap = new Map<string, { volume: number; registros: number }>();
        volumetriaData?.forEach(item => {
          const empresa = item.EMPRESA as string;
          const valor = (item.VALORES as number) || 0;
          
          if (!volumetriaMap.has(empresa)) {
            volumetriaMap.set(empresa, { volume: 0, registros: 0 });
          }
          
          const current = volumetriaMap.get(empresa)!;
          current.volume += valor;
          current.registros += 1;
        });
        
        // Combinar dados de clientes com volumetria
        const clientesComVolumetria = data.map(cliente => ({
          ...cliente,
          volume_exames: volumetriaMap.get(cliente.nome)?.volume || 0,
          total_registros: volumetriaMap.get(cliente.nome)?.registros || 0
        }));
        
        setClientes(clientesComVolumetria);
        processarClientesComGeocodificacao(clientesComVolumetria);
      }
    } catch (err) {
      console.error('Erro ao buscar clientes:', err);
      setError('Erro ao carregar dados dos clientes');
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  // Processar clientes e geocodificar por cidade/estado (apenas para clientes com dados de localização)
  const processarClientesComGeocodificacao = async (clientesData: Cliente[]) => {
    setGeocodificando(true);
    
    // Filtrar apenas clientes que têm cidade e estado cadastrados
    const clientesComLocalizacao = clientesData.filter(cliente => 
      cliente.cidade && cliente.estado
    );
    
    if (clientesComLocalizacao.length === 0) {
      calcularEstatisticas(clientesData);
      setGeocodificando(false);
      return;
    }
    
    // Cache local para evitar geocodificação repetida
    const coordenadasCache = new Map<string, { lat: number; lng: number } | null>();
    const clientesComCoordenadas: ClienteComCoordenadas[] = [];
    
    // Processar em lotes para não sobrecarregar a API
    const BATCH_SIZE = 5;
    const batches = [];
    for (let i = 0; i < clientesComLocalizacao.length; i += BATCH_SIZE) {
      batches.push(clientesComLocalizacao.slice(i, i + BATCH_SIZE));
    }
    
    try {
      for (const batch of batches) {
        const promises = batch.map(async (cliente) => {
          try {
            let coordenadas: { lat: number; lng: number } | null = null;
            
            // Usar cidade e estado diretamente
            const cacheKey = `${cliente.cidade}-${cliente.estado}`;
            
            if (coordenadasCache.has(cacheKey)) {
              coordenadas = coordenadasCache.get(cacheKey);
            } else {
              // Tentar geocodificar por cidade e estado
              coordenadas = await geocodeAddress(`${cliente.cidade}, ${cliente.estado}, Brazil`);
              
              // Se não conseguir geocodificar a cidade, usar coordenadas do estado
              if (!coordenadas && cliente.estado && coordenadasEstados[cliente.estado]) {
                coordenadas = coordenadasEstados[cliente.estado];
              }
              
              coordenadasCache.set(cacheKey, coordenadas);
            }
            
            const clienteComCoordenadas: ClienteComCoordenadas = {
              ...cliente,
              lat: coordenadas?.lat,
              lng: coordenadas?.lng
            };
            
            return clienteComCoordenadas;
          } catch (error) {
            console.error(`Erro ao processar cliente ${cliente.nome}:`, error);
            return { ...cliente } as ClienteComCoordenadas;
          }
        });
        
        const resultados = await Promise.all(promises);
        clientesComCoordenadas.push(...resultados);
        
        // Pequena pausa entre lotes para não sobrecarregar a API
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      // Adicionar clientes sem localização
      const clientesSemLocalizacao = clientesData.filter(cliente => 
        !cliente.cidade || !cliente.estado
      );
      
      const todosClientes = [...clientesComCoordenadas, ...clientesSemLocalizacao];
      
      setClientes(todosClientes);
      calcularEstatisticas(todosClientes);
      
      const clientesLocalizados = clientesComCoordenadas.filter(c => c.lat && c.lng).length;
      
      toast.success(`Mapa atualizado! ${clientesLocalizados} de ${clientesComLocalizacao.length} clientes localizados.`);
    } catch (error) {
      console.error('Erro na geocodificação:', error);
      toast.error('Erro durante a geocodificação');
      calcularEstatisticas(clientesData);
    } finally {
      setGeocodificando(false);
    }
  };

  // Calcular estatísticas por estado
  const calcularEstatisticas = (clientesData: ClienteComCoordenadas[]) => {
    const estadosMap = new Map<string, {
      total: number;
      volume_total: number;
      clientes: ClienteComCoordenadas[];
    }>();

    clientesData.forEach(cliente => {
      const estado = cliente.estado || 'Indefinido';
      
      if (!estadosMap.has(estado)) {
        estadosMap.set(estado, {
          total: 0,
          volume_total: 0,
          clientes: []
        });
      }

      const estadoData = estadosMap.get(estado)!;
      estadoData.total += 1;
      estadoData.volume_total += cliente.volume_exames || 0;
      estadoData.clientes.push(cliente);
    });

    const estatisticasArray = Array.from(estadosMap.entries())
      .map(([estado, data]) => ({
        estado,
        total: data.total,
        volume_total: data.volume_total,
        clientes: data.clientes
      }))
      .sort((a, b) => b.volume_total - a.volume_total);

    setEstatisticas(estatisticasArray);
  };

  useEffect(() => {
    buscarClientes();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mapa de Distribuição de Clientes</h1>
            <p className="text-muted-foreground">Visualização geográfica da distribuição dos clientes por volumetria de exames</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Mapa de Calor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-96 flex items-center justify-center">
                  <Skeleton className="w-full h-full" />
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Estatísticas por Estado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mapa de Distribuição de Clientes</h1>
          <p className="text-muted-foreground">
            Visualização geográfica da distribuição dos clientes por volumetria de exames
          </p>
        </div>
        
        <Button 
          onClick={buscarClientes} 
          disabled={loading || geocodificando}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading || geocodificando ? 'animate-spin' : ''}`} />
          {geocodificando ? 'Atualizando...' : 'Atualizar'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Mapa de Calor
                {geocodificando && (
                  <Badge variant="secondary" className="ml-2">
                    Processando...
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MapaVolumetria clientes={clientes} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Estatísticas por Estado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {estatisticas.map((estado, index) => (
                  <div key={estado.estado} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{estado.estado}</Badge>
                      <div>
                        <p className="font-medium text-sm">{estado.total} cliente(s)</p>
                        <p className="text-xs text-gray-500">{estado.volume_total.toLocaleString()} exames</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">#{index + 1}</p>
                    </div>
                  </div>
                ))}
                
                {estatisticas.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum cliente encontrado</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Resumo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total de Clientes:</span>
                <span className="font-medium">{clientes.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Estados Ativos:</span>
                <span className="font-medium">{estatisticas.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Volume Total:</span>
                <span className="font-medium">
                  {estatisticas.reduce((acc, est) => acc + est.volume_total, 0).toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}