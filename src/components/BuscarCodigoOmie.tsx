import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Search, Copy, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ClienteOmie {
  codigo_omie: number;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  email?: string;
  cidade?: string;
  estado?: string;
}

interface BuscarCodigoOmieProps {
  onCodigoEncontrado?: (codigo: number, cliente: ClienteOmie) => void;
}

export function BuscarCodigoOmie({ onCodigoEncontrado }: BuscarCodigoOmieProps) {
  const [cnpj, setCnpj] = useState("");
  const [nomeCliente, setNomeCliente] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<{
    sucesso: boolean;
    cliente_encontrado?: ClienteOmie;
    erro?: string;
    clientes_referencia?: any[];
  } | null>(null);

  const buscarNoOmie = async () => {
    if (!cnpj && !nomeCliente) {
      toast.error("Informe o CNPJ ou o nome do cliente");
      return;
    }

    setBuscando(true);
    setResultado(null);

    try {
      const { data, error } = await supabase.functions.invoke('buscar-codigo-cliente-omie', {
        body: {
          cnpj: cnpj || undefined,
          nome_cliente: nomeCliente || undefined
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      setResultado(data);

      if (data.sucesso && data.cliente_encontrado) {
        toast.success(`Cliente encontrado: ${data.cliente_encontrado.razao_social}`);
        onCodigoEncontrado?.(data.cliente_encontrado.codigo_omie, data.cliente_encontrado);
      } else {
        toast.warning("Cliente não encontrado no OMIE");
      }

    } catch (error) {
      console.error('Erro ao buscar cliente no OMIE:', error);
      toast.error(`Erro ao buscar no OMIE: ${error.message}`);
      setResultado({
        sucesso: false,
        erro: error.message
      });
    } finally {
      setBuscando(false);
    }
  };

  const copiarCodigo = (codigo: number) => {
    navigator.clipboard.writeText(codigo.toString());
    toast.success("Código copiado para a área de transferência");
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="w-5 h-5" />
          Buscar Código OMIE
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">CNPJ do Cliente</label>
            <Input
              placeholder="00.000.000/0000-00"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Nome do Cliente</label>
            <Input
              placeholder="Razão social ou nome fantasia"
              value={nomeCliente}
              onChange={(e) => setNomeCliente(e.target.value)}
            />
          </div>
        </div>

        <Button 
          onClick={buscarNoOmie} 
          disabled={buscando || (!cnpj && !nomeCliente)}
          className="w-full"
        >
          {buscando ? "Buscando..." : "Buscar no OMIE"}
        </Button>

        {resultado && (
          <div className="space-y-4">
            {resultado.sucesso && resultado.cliente_encontrado ? (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <AlertDescription>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-green-800">Cliente encontrado!</span>
                      <Badge variant="outline" className="bg-white">
                        Código: {resultado.cliente_encontrado.codigo_omie}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="ml-2 h-4 w-4 p-0"
                          onClick={() => copiarCodigo(resultado.cliente_encontrado!.codigo_omie)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div>
                        <strong>Razão Social:</strong> {resultado.cliente_encontrado.razao_social}
                      </div>
                      {resultado.cliente_encontrado.nome_fantasia && (
                        <div>
                          <strong>Nome Fantasia:</strong> {resultado.cliente_encontrado.nome_fantasia}
                        </div>
                      )}
                      <div>
                        <strong>CNPJ:</strong> {resultado.cliente_encontrado.cnpj}
                      </div>
                      {resultado.cliente_encontrado.cidade && (
                        <div>
                          <strong>Cidade:</strong> {resultado.cliente_encontrado.cidade}/{resultado.cliente_encontrado.estado}
                        </div>
                      )}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertDescription>
                  <div className="space-y-2">
                    <div className="font-semibold">Cliente não encontrado</div>
                    <div className="text-sm">{resultado.erro}</div>
                    
                    {resultado.clientes_referencia && resultado.clientes_referencia.length > 0 && (
                      <div className="mt-3">
                        <div className="text-sm font-medium mb-2">Primeiros clientes cadastrados no OMIE:</div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {resultado.clientes_referencia.map((cliente, index) => (
                            <div key={index} className="text-xs bg-white/50 p-2 rounded border">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-medium">{cliente.razao_social}</div>
                                  {cliente.nome_fantasia && (
                                    <div className="text-gray-600">{cliente.nome_fantasia}</div>
                                  )}
                                  <div className="text-gray-500">{cliente.cnpj}</div>
                                </div>
                                <Badge variant="outline" className="ml-2">
                                  {cliente.codigo}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}