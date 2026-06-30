import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TradeImage } from '@/types'

export function useTradeImages(tradeId: string | undefined) {
  return useQuery({
    queryKey: ['trade_images', tradeId],
    queryFn: async () => {
      if (!tradeId) return []
      const { data, error } = await supabase
        .from('trade_images')
        .select('*')
        .eq('trade_id', tradeId)
        
      if (error) throw error
      return data as TradeImage[]
    },
    enabled: !!tradeId
  })
}

export function useSaveTradeImages() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ tradeId, images }: { tradeId: string, images: Partial<TradeImage>[] }) => {
      console.log('🚀 [useSaveTradeImages] Sauvegarde des images pour le trade:', tradeId)
      
      // 1. Supprimer les anciennes images
      const { error: deleteError } = await supabase
        .from('trade_images')
        .delete()
        .eq('trade_id', tradeId)
        
      if (deleteError) throw deleteError
      
      // 2. Insérer les nouvelles
      if (images.length > 0) {
        const inserts = images.map(img => ({
          trade_id: tradeId,
          phase: img.phase!,
          context: img.context!,
          url: img.url!,
          source: img.source || 'upload',
          storage_path: img.storage_path || null
        }))
        
        const { error: insertError } = await supabase
          .from('trade_images')
          .insert(inserts)
          
        if (insertError) throw insertError
      }
      
      console.log('✅ [useSaveTradeImages] Images sauvegardées !')
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['trade_images', vars.tradeId] })
      queryClient.invalidateQueries({ queryKey: ['trades'] })
    }
  })
}
