import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Trash2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export const LimparUploads = () => {
  const [loading, setLoading] = useState(false);

  const limparUploadsTravados = async () => {
    try {
      setLoading(true);
      
      // Chamar função para limpar uploads travados
      const { data, error } = await supabase.functions.invoke('limpar-uploads-travados');
      
      if (error) {
        throw error;
      }
      
      toast.success(`✅ ${data?.uploads_corrigidos || 0} uploads travados foram corrigidos`);
      
      // Recarregar a página para atualizar o status
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error: any) {
      console.error('Erro ao limpar uploads:', error);
      toast.error(`Erro ao limpar uploads: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          Limpar Uploads
        </CardTitle>
        <CardDescription>
          Remove uploads que ficaram travados no sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={limparUploadsTravados}
          disabled={loading}
          className="w-full"
          variant="destructive"
        >
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Limpando...
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar Uploads Travados
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};