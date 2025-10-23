import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function CorrigirNomesCemvalenca() {
  const [loading, setLoading] = useState(false);

  const handleCorrigir = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('corrigir-nomes-cemvalenca', {
        body: { periodo: '2025-09' }
      });

      if (error) throw error;

      toast.success('Nomes CEMVALENCA corrigidos com sucesso!');
      console.log('Resultado:', data);
    } catch (error: any) {
      console.error('Erro ao corrigir nomes:', error);
      toast.error('Erro ao corrigir nomes: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-2">Corrigir Nomes CEMVALENCA</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Corrige os nomes dos clientes CEMVALENCA para bater com os cadastros
      </p>
      <Button onClick={handleCorrigir} disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Corrigir Nomes
      </Button>
    </Card>
  );
}
