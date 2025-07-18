import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import teleimagemlLogo from "@/assets/teleimagem-logo.jpg";

export function useLogomarca() {
  const [logoUrl, setLogoUrl] = useState<string>(teleimagemlLogo);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLogo = async () => {
      try {
        // Tentar carregar diferentes extensões
        const extensions = ['png', 'jpg', 'jpeg'];
        let foundLogo = false;

        for (const ext of extensions) {
          const fileName = `logomarca.${ext}`;
          const { data: { publicUrl } } = supabase.storage
            .from('logomarcas')
            .getPublicUrl(fileName);

          // Verificar se a imagem existe
          try {
            const response = await fetch(publicUrl, { method: 'HEAD' });
            if (response.ok) {
              setLogoUrl(publicUrl);
              foundLogo = true;
              break;
            }
          } catch {
            // Continuar para próxima extensão
          }
        }

        if (!foundLogo) {
          // Usar logo padrão se nenhuma foi encontrada
          setLogoUrl(teleimagemlLogo);
        }
      } catch (error) {
        console.error('Erro ao carregar logomarca:', error);
        setLogoUrl(teleimagemlLogo);
      } finally {
        setLoading(false);
      }
    };

    loadLogo();
  }, []);

  const refreshLogo = () => {
    setLoading(true);
    // Recarregar logo após um pequeno delay para dar tempo do upload
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  return {
    logoUrl,
    loading,
    refreshLogo
  };
}