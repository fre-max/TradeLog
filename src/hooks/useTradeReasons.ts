import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * Récupère les IDs des raisons associées à un trade spécifique
 */
export function useTradeReasons(tradeId: string | undefined) {
  return useQuery({
    queryKey: ['trade_reasons', tradeId],
    queryFn: async () => {
      if (!tradeId) return []
      const { data, error } = await supabase
        .from('trade_reasons')
        .select('reason_id')
        .eq('trade_id', tradeId)
        
      if (error) throw error
      return data.map(d => d.reason_id) as string[]
    },
    enabled: !!tradeId
  })
}

/**
 * Sauvegarde les raisons pour un trade (remplace les existantes)
 */
export function useSaveTradeReasons() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ tradeId, reasonIds }: { tradeId: string, reasonIds: string[] }) => {
      console.log('🚀 [useSaveTradeReasons] Sauvegarde pour le trade:', tradeId)
      
      // 1. Supprimer les anciennes raisons pour ce trade
      const { error: deleteError } = await supabase
        .from('trade_reasons')
        .delete()
        .eq('trade_id', tradeId)
        
      if (deleteError) throw deleteError
      
      // 2. Insérer les nouvelles raisons si la liste n'est pas vide
      if (reasonIds.length > 0) {
        const inserts = reasonIds.map(reason_id => ({
          trade_id: tradeId,
          reason_id
        }))
        
        const { error: insertError } = await supabase
          .from('trade_reasons')
          .insert(inserts)
          
        if (insertError) throw insertError
      }
      
      console.log('✅ [useSaveTradeReasons] Raisons sauvegardées !')
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trade_reasons', variables.tradeId] })
      queryClient.invalidateQueries({ queryKey: ['trades'] }) // Pour rafraîchir les stats si besoin
    }
  })
}
