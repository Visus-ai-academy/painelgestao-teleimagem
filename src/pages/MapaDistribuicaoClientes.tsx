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
  cidade?: string;
  estado?: string;
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

// Coordenadas aproximadas dos estados brasileiros para fallback
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

// Extrair cidade e estado do endereço
const parseEndereco = (endereco: string): { cidade?: string; estado?: string } => {
  if (!endereco) return {};
  
  const partes = endereco.split(',').map(p => p.trim());
  const ultimaParte = partes[partes.length - 1];
  
  // Procurar por padrões como "SP", "São Paulo", "São Paulo - SP", etc.
  const estadoMatch = ultimaParte.match(/\b([A-Z]{2})\b/);
  let estado = estadoMatch ? estadoMatch[1] : undefined;
  
  // Se não encontrou sigla, tentar nomes completos de estados
  if (!estado) {
    const estadosNomes: Record<string, string> = {
      'são paulo': 'SP', 'rio de janeiro': 'RJ', 'minas gerais': 'MG',
      'bahia': 'BA', 'paraná': 'PR', 'rio grande do sul': 'RS',
      'pernambuco': 'PE', 'ceará': 'CE', 'pará': 'PA', 'santa catarina': 'SC',
      'goiás': 'GO', 'maranhão': 'MA', 'paraíba': 'PB', 'mato grosso': 'MT',
      'espírito santo': 'ES', 'piauí': 'PI', 'alagoas': 'AL', 'distrito federal': 'DF'
    };
    
    for (const [nome, sigla] of Object.entries(estadosNomes)) {
      if (ultimaParte.toLowerCase().includes(nome)) {
        estado = sigla;
        break;
      }
    }
  }
  
  // Tentar extrair cidade
  let cidade: string | undefined;
  if (partes.length >= 2) {
    cidade = partes[partes.length - 2];
  } else if (partes.length === 1 && !estado) {
    cidade = partes[0];
  }
  
  return { cidade, estado };
};

// Função para determinar tamanho do marcador baseado no volume
const getMarkerSize = (volume: number, maxVolume: number): string => {
  if (maxVolume === 0) return 's';
  const ratio = volume / maxVolume;
  if (ratio >= 0.7) return 'l'; // Grande
  if (ratio >= 0.3) return 'm'; // Médio
  return 's'; // Pequeno
};

// Função para determinar cor baseada no volume
const getMarkerColor = (volume: number, maxVolume: number): string => {
  if (maxVolume === 0) return 'blue';
  const ratio = volume / maxVolume;
  if (ratio >= 0.7) return 'red'; // Alto volume - vermelho
  if (ratio >= 0.3) return 'orange'; // Médio volume - laranja
  return 'green'; // Baixo volume - verde
};

// Componente de Mapa com visualização por volumetria
function MapaVolumetria({ clientes }: { clientes: ClienteComCoordenadas[] }) {
  const clientesComCoordenadas = clientes.filter(c => c.lat && c.lng);
  
  if (clientesComCoordenadas.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-center">
          <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Nenhum cliente localizado para exibir no mapa</p>
        </div>
      </div>
    );
  }

  // Encontrar volume máximo para escalar os marcadores
  const maxVolume = Math.max(...clientesComCoordenadas.map(c => c.volume_exames || 0));
  
  const center = clientesComCoordenadas.reduce(
    (acc, cliente) => ({
      lat: acc.lat + cliente.lat!,
      lng: acc.lng + cliente.lng!
    }),
    { lat: 0, lng: 0 }
  );
  
  center.lat = center.lat / clientesComCoordenadas.length;
  center.lng = center.lng / clientesComCoordenadas.length;

  return (
    <div className="space-y-4">
      {/* Legenda de Volumetria */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium mb-3">Volumetria de Exames - Escala Visual</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
              <div className="w-4 h-4 bg-red-600 rounded-full"></div>
            </div>
            <span>Alto Volume (≥70% do máximo)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-orange-500 rounded-full"></div>
            <span>Médio Volume (30-70%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span>Baixo Volume (&lt;30%)</span>
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-2">
          Volume máximo atual: {maxVolume.toLocaleString()} exames
        </p>
      </div>

      {/* Grid de clientes por volume */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
        {clientesComCoordenadas
          .sort((a, b) => (b.volume_exames || 0) - (a.volume_exames || 0))
          .map((cliente) => {
            const volume = cliente.volume_exames || 0;
            const color = getMarkerColor(volume, maxVolume);
            const size = getMarkerSize(volume, maxVolume);
            
            return (
              <div 
                key={cliente.id} 
                className="flex items-center justify-between p-2 bg-white border rounded hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center gap-2">
                  <div 
                    className={`w-${size === 'l' ? '6' : size === 'm' ? '5' : '4'} h-${size === 'l' ? '6' : size === 'm' ? '5' : '4'} rounded-full`}
                    style={{ backgroundColor: color === 'red' ? '#ef4444' : color === 'orange' ? '#f97316' : '#22c55e' }}
                  />
                  <div>
                    <p className="font-medium text-sm">{cliente.nome}</p>
                    <p className="text-xs text-gray-500">{cliente.estado}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">{volume.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">exames</p>
                </div>
              </div>
            );
          })}
      </div>

      {/* Mapa simplificado */}
      <div className="h-96 rounded-lg overflow-hidden border">
        <iframe
          width="100%"
          height="100%"
          frameBorder="0"
          scrolling="no"
          marginHeight={0}
          marginWidth={0}
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${center.lng-8},${center.lat-8},${center.lng+8},${center.lat+8}&layer=mapnik&marker=${center.lat},${center.lng}`}
          style={{ border: 0 }}
          title="Mapa de Clientes por Volumetria"
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
  const [clientesGeocodificados, setClientesGeocodificados] = useState<ClienteComCoordenadas[]>([]);
  const [geocodificacaoCompleta, setGeocodificacaoCompleta] = useState(false);

  // Buscar clientes do banco de dados com volumetria
  const buscarClientes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Buscar clientes ativos com dados de volumetria usando query manual
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
        
        // Só geocodificar se ainda não foi feito
        if (!geocodificacaoCompleta) {
          processarClientesComGeocodificacao(clientesComVolumetria);
        } else {
          // Use dados já geocodificados se disponíveis
          calcularEstatisticas(clientesGeocodificados.length > 0 ? clientesGeocodificados : clientesComVolumetria);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar clientes:', err);
      setError('Erro ao carregar dados dos clientes');
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  // Processar clientes e geocodificar endereços com otimizações de performance
  const processarClientesComGeocodificacao = async (clientesData: Cliente[]) => {
    setGeocodificando(true);
    
    // Cache local para evitar geocodificação repetida
    const coordenadasCache = new Map<string, { lat: number; lng: number } | null>();
    
    const clientesComCoordenadas: ClienteComCoordenadas[] = [];
    
    // Processar em lotes para não sobrecarregar a API
    const BATCH_SIZE = 5;
    const batches = [];
    for (let i = 0; i < clientesData.length; i += BATCH_SIZE) {
      batches.push(clientesData.slice(i, i + BATCH_SIZE));
    }
    
    for (const batch of batches) {
      const batchPromises = batch.map(async (cliente) => {
        const { cidade, estado } = parseEndereco(cliente.endereco || '');
        let coordenadas: { lat: number; lng: number } | null = null;
        
        // Criar chave única para cache
        const cacheKey = `${cliente.endereco || ''}-${cidade || ''}-${estado || ''}`;
        
        // Verificar cache primeiro
        if (coordenadasCache.has(cacheKey)) {
          coordenadas = coordenadasCache.get(cacheKey);
        } else if (cliente.endereco && cliente.endereco.trim() !== '') {
          try {
            // Geocodificar apenas se temos endereço válido
            coordenadas = await geocodeAddress(cliente.endereco);
            // Salvar no cache
            coordenadasCache.set(cacheKey, coordenadas);
          } catch (error) {
            console.warn(`Erro na geocodificação para ${cliente.nome}:`, error);
            coordenadasCache.set(cacheKey, null);
          }
        }
        
        // Fallback para coordenadas do estado
        if (!coordenadas && estado && coordenadasEstados[estado]) {
          coordenadas = coordenadasEstados[estado];
        }
        
        return {
          ...cliente,
          lat: coordenadas?.lat,
          lng: coordenadas?.lng,
          cidade,
          estado
        };
      });
      
      // Processar lote e aguardar conclusão
      const batchResults = await Promise.all(batchPromises);
      clientesComCoordenadas.push(...batchResults);
      
      // Pequena pausa entre lotes para não sobrecarregar
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    setClientes(clientesComCoordenadas);
    setClientesGeocodificados(clientesComCoordenadas);
    setGeocodificacaoCompleta(true);
    calcularEstatisticas(clientesComCoordenadas);
    setGeocodificando(false);
    
    toast.success(`Geocodificação concluída! ${clientesComCoordenadas.filter(c => c.lat && c.lng).length} clientes localizados.`);
  };

  // Calcular estatísticas por estado
  const calcularEstatisticas = (clientesData: ClienteComCoordenadas[]) => {
    const estadosMap = new Map<string, ClienteComCoordenadas[]>();
    
    clientesData.forEach(cliente => {
      if (cliente.estado) {
        if (!estadosMap.has(cliente.estado)) {
          estadosMap.set(cliente.estado, []);
        }
        estadosMap.get(cliente.estado)!.push(cliente);
      }
    });
    
    const stats: EstadoEstatistica[] = Array.from(estadosMap.entries())
      .map(([estado, clientes]) => ({
        estado,
        total: clientes.length,
        volume_total: clientes.reduce((acc, c) => acc + (c.volume_exames || 0), 0),
        clientes
      }))
      .sort((a, b) => b.volume_total - a.volume_total);
    
    setEstatisticas(stats);
  };

  // Abrir cliente no Google Maps
  const abrirNoGoogleMaps = (cliente: ClienteComCoordenadas) => {
    if (cliente.lat && cliente.lng) {
      const url = `https://www.google.com/maps/search/?api=1&query=${cliente.lat},${cliente.lng}`;
      window.open(url, '_blank');
    } else if (cliente.endereco) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cliente.endereco)}`;
      window.open(url, '_blank');
    }
  };

  // Forçar atualização manual
  const forcarAtualizacao = () => {
    setGeocodificacaoCompleta(false);
    setClientesGeocodificados([]);
    buscarClientes();
  };

  // Carregamento inicial apenas
  useEffect(() => {
    buscarClientes();
  }, []);

  const clientesComCoordenadas = clientes.filter(c => c.lat && c.lng);
  const clientesSemCoordenadas = clientes.filter(c => !c.lat || !c.lng);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mapa de Distribuição de Clientes</h1>
          <p className="text-gray-600 mt-1">Visualização geográfica dos clientes ativos</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>Carregando Mapa...</CardTitle>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-96 w-full" />
              </CardContent>
            </Card>
          </div>
          
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Estatísticas</CardTitle>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-48 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mapa de Distribuição de Clientes</h1>
          <p className="text-gray-600 mt-1">Visualização geográfica dos clientes ativos</p>
        </div>
        
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mapa de Distribuição de Clientes</h1>
          <p className="text-gray-600 mt-1">Visualização geográfica dos clientes ativos</p>
        </div>
        
        <div className="flex items-center gap-4">
          <Button 
            onClick={forcarAtualizacao}
            disabled={loading || geocodificando}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading || geocodificando ? 'animate-spin' : ''}`} />
            Atualizar Localização
          </Button>
          
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {geocodificando && (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Processando endereços...</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Alertas */}
      {clientesSemCoordenadas.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {clientesSemCoordenadas.length} cliente(s) não puderam ser localizados no mapa devido a endereços incompletos ou inválidos.
          </AlertDescription>
        </Alert>
      )}

      {/* Conteúdo Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Mapa */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-600" />
                Mapa por Volumetria de Exames
              </CardTitle>
            </CardHeader>
            <CardContent>
              {clientesComCoordenadas.length > 0 ? (
                <>
                  <MapaVolumetria clientes={clientesComCoordenadas} />
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-2">
                      💡 Para visualização interativa completa, clique nos clientes abaixo para abrir no Google Maps
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-96 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <MapPin className="h-16 w-16 text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">
                    Nenhum cliente localizado no mapa
                  </h3>
                  <p className="text-gray-500 mb-4 max-w-md">
                    Para visualizar os clientes no mapa, é necessário cadastrar os endereços, cidades e estados no formulário de clientes.
                  </p>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-700">
                      <strong>Dica:</strong> Vá para "Clientes → Cadastro" e preencha os campos de endereço, cidade e estado para que os clientes apareçam no mapa.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Estatísticas */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-green-600" />
                Resumo Geral
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{clientes.length}</div>
                  <div className="text-sm text-gray-600">Total de Clientes Ativos</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{clientesComCoordenadas.length}</div>
                  <div className="text-sm text-gray-600">Localizados no Mapa</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{estatisticas.length}</div>
                  <div className="text-sm text-gray-600">Estados com Clientes</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-purple-600" />
                Por Estado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {estatisticas.map((estado) => (
                  <div key={estado.estado} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div>
                      <span className="font-medium">{estado.estado}</span>
                      <div className="text-xs text-gray-600">
                        {estado.volume_total.toLocaleString()} exames
                      </div>
                    </div>
                    <Badge variant="secondary">{estado.total}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Legenda</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                  <span className="text-sm">Clientes Ativos</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                  <span className="text-sm">Clientes Inativos</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Lista de Clientes com Links para Maps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            Clientes Localizados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clientesComCoordenadas.map((cliente) => (
              <div key={cliente.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg">{cliente.nome}</h3>
                  <Badge variant={cliente.ativo ? "default" : "secondary"} className="text-xs">
                    {cliente.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                
                <div className="space-y-1 text-sm text-gray-600 mb-3">
                  {cliente.endereco && (
                    <p><strong>Endereço:</strong> {cliente.endereco}</p>
                  )}
                  {cliente.estado && (
                    <p><strong>Estado:</strong> {cliente.estado}</p>
                  )}
                  {cliente.telefone && (
                    <p><strong>Telefone:</strong> {cliente.telefone}</p>
                  )}
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => abrirNoGoogleMaps(cliente)}
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver no Google Maps
                </Button>
              </div>
            ))}
          </div>
          
          {clientesComCoordenadas.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum cliente foi localizado ainda.</p>
              <p className="text-sm">Verifique se os endereços estão completos no cadastro.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}