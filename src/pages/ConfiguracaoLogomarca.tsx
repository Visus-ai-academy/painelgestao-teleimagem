import React, { useState } from 'react';
import { Upload, Image, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function ConfiguracaoLogomarca() {
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Erro",
        description: "Por favor, selecione apenas arquivos de imagem.",
        variant: "destructive"
      });
      return;
    }

    // Validar tamanho do arquivo (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Erro",
        description: "A imagem deve ter no máximo 5MB.",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    try {
      // Upload da logomarca para o storage
      const fileExt = file.name.split('.').pop();
      const fileName = `logomarca.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('logomarcas')
        .upload(fileName, file, {
          upsert: true // Substitui se já existir
        });

      if (error) {
        throw error;
      }

      // Obter URL pública da imagem
      const { data: { publicUrl } } = supabase.storage
        .from('logomarcas')
        .getPublicUrl(fileName);

      setLogoUrl(publicUrl);

      toast({
        title: "Sucesso",
        description: "Logomarca enviada com sucesso!",
        variant: "default"
      });

    } catch (error: any) {
      console.error('Erro no upload:', error);
      toast({
        title: "Erro",
        description: `Erro ao enviar logomarca: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    try {
      const { error } = await supabase.storage
        .from('logomarcas')
        .remove(['logomarca.jpg', 'logomarca.png', 'logomarca.jpeg']);

      if (error) {
        throw error;
      }

      setLogoUrl(null);
      toast({
        title: "Sucesso",
        description: "Logomarca removida com sucesso!",
      });

    } catch (error: any) {
      console.error('Erro ao remover:', error);
      toast({
        title: "Erro",
        description: `Erro ao remover logomarca: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  // Carregar logomarca existente ao inicializar
  React.useEffect(() => {
    const loadExistingLogo = async () => {
      try {
        const { data: { publicUrl } } = supabase.storage
          .from('logomarcas')
          .getPublicUrl('logomarca.jpg');
        
        // Verificar se a imagem existe
        const response = await fetch(publicUrl, { method: 'HEAD' });
        if (response.ok) {
          setLogoUrl(publicUrl);
        }
      } catch (error) {
        console.log('Nenhuma logomarca encontrada');
      }
    };

    loadExistingLogo();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuração da Logomarca</h1>
        <p className="text-muted-foreground">
          Gerencie a logomarca da empresa que aparecerá nos relatórios e documentos
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Logomarca da Empresa
          </CardTitle>
          <CardDescription>
            Faça upload da logomarca em formato JPG, PNG ou JPEG (máximo 5MB)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Visualização da logomarca atual */}
          {logoUrl && (
            <div className="border rounded-lg p-4 bg-muted/50">
              <h3 className="font-medium mb-2">Logomarca Atual</h3>
              <div className="flex items-center gap-4">
                <img 
                  src={logoUrl} 
                  alt="Logomarca atual" 
                  className="h-16 w-auto max-w-32 object-contain border rounded"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleRemoveLogo}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Remover
                </Button>
              </div>
            </div>
          )}

          {/* Upload de nova logomarca */}
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8">
            <div className="text-center space-y-4">
              <div className="mx-auto h-12 w-12 bg-muted rounded-lg flex items-center justify-center">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              
              <div>
                <h3 className="font-medium">Enviar Nova Logomarca</h3>
                <p className="text-sm text-muted-foreground">
                  Arraste um arquivo ou clique para selecionar
                </p>
              </div>

              <div className="flex justify-center">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <Button 
                    variant="outline" 
                    disabled={uploading}
                    className="gap-2"
                    asChild
                  >
                    <span>
                      {uploading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          Selecionar Arquivo
                        </>
                      )}
                    </span>
                  </Button>
                </label>
              </div>

              <div className="text-xs text-muted-foreground">
                Formatos aceitos: JPG, PNG, JPEG • Tamanho máximo: 5MB
              </div>
            </div>
          </div>

          {/* Instruções */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-2">
              <Check className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 mb-1">Dicas para melhor resultado:</p>
                <ul className="text-blue-700 space-y-1">
                  <li>• Use uma imagem com fundo transparente (PNG)</li>
                  <li>• Resolução recomendada: 300x100 pixels ou similar</li>
                  <li>• A logomarca aparecerá nos relatórios PDF gerados</li>
                  <li>• Para melhor qualidade, use imagens vetorizadas</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}