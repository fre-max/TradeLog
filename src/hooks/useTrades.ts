import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TradeInsert, TradeWithSteps } from '@/types'
import {
  buildStepPayloads,
  buildTradePayload,
  computeTradeStatus,
  type EditStepIds,
  type FormDataState,
} from '@/lib/tradeForm'

const QUERY_KEY = ['trades'] as const

// Fetch all trades with steps and images
export function useTrades() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<TradeWithSteps[]> => {
      const { data, error } = await supabase
        .from('trades')
        .select(`
          *,
          steps (
            *
          ),
          images: trade_images (*)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as TradeWithSteps[]
    },
  })
}

// Fetch single trade
export function useTrade(id: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, id],
    queryFn: async (): Promise<TradeWithSteps> => {
      const { data, error } = await supabase
        .from('trades')
        .select(`*, steps (*), images: trade_images (*)`)
        .eq('id', id)
        .single()

      if (error) throw error
      return data as TradeWithSteps
    },
    enabled: !!id,
  })
}

// Create trade
export function useCreateTrade() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (trade: TradeInsert) => {
      const { data, error } = await supabase
        .from('trades')
        .insert(trade)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

// Delete trade
export function useDeleteTrade() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('trades').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

// Synchronise les images d'une étape entre le formulaire et la base de données
// Supprime les images retirées et insère les nouvelles
async function synchroniserStepImages(
  stepId: string,
  imagesForm: { id: string; url: string; source: string; phase?: string }[]
) {
  // Déprécié : la gestion des images passe par trade_images directement
  console.log(`📡 [syncImages] Bypass de synchronisation des images pour le step : ${stepId}`);
  return;
}



interface UpdateTradeInput {
  tradeId: string
  formData: FormDataState
  stepIds: EditStepIds
  previousStatus: TradeWithSteps['status']
  preserveBiaisFields?: Record<string, unknown> | null
}

/** Met à jour un trade existant et ses étapes. */
export function useUpdateTrade() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      tradeId,
      formData,
      stepIds,
      previousStatus,
      preserveBiaisFields,
    }: UpdateTradeInput): Promise<TradeWithSteps> => {
      const status = computeTradeStatus(formData, previousStatus)
      const tradePayload = buildTradePayload(formData, status)

      console.log('📡 [useUpdateTrade] Mise à jour du trade principal en BDD...');
      const { data: updatedTrade, error: tradeError } = await supabase
        .from('trades')
        .update(tradePayload)
        .eq('id', tradeId)
        .select(`*, steps (*), images: trade_images (*)`)
        .single()

      if (tradeError || !updatedTrade) {
        throw tradeError || new Error('Erreur lors de la mise à jour du trade')
      }

      const steps = buildStepPayloads(tradeId, formData, stepIds, preserveBiaisFields)

      for (const step of steps) {
        const { id, ...stepData } = step
        if (id) {
          console.log(`📡 [useUpdateTrade] Upsert de l'étape : ${step.type} (${id})`);
          // On utilise upsert pour insérer si le step n'existait pas pour ce type de journal
          const { error } = await supabase
            .from('steps')
            .upsert({ id, ...stepData })
          if (error) throw error

          // Synchroniser les images de l'étape
          const stepType = step.type as 'biais' | 'poi' | 'entry' | 'result'
          const imagesKey = `${stepType}_images` as const
          const imagesForm = (formData as any)[imagesKey] || []
          await synchroniserStepImages(id, imagesForm)
        }
      }

      const { data: fullTrade, error: refetchError } = await supabase
        .from('trades')
        .select(`*, steps (*), images: trade_images (*)`)
        .eq('id', tradeId)
        .single()

      if (refetchError || !fullTrade) {
        throw refetchError || new Error('Erreur lors du rechargement du trade')
      }

      // Déclencher la détection des news économiques en arrière-plan après la mise à jour du trade (non bloquant)
      if (fullTrade.date_backtested && fullTrade.entry_time && fullTrade.exit_time) {
        console.log('📡 [useUpdateTrade] Déclenchement asynchrone de la détection des news...')
        
        supabase.auth.getSession().then(({ data: { session } }) => {
          const token = session?.access_token
          
          supabase.functions.invoke('detect-news', {
            body: {
              trade_id: fullTrade.id,
              pair: fullTrade.pair,
              date: fullTrade.date_backtested,
              entry_time: fullTrade.entry_time,
              exit_time: fullTrade.exit_time,
            },
            headers: token ? { Authorization: `Bearer ${token}` } : undefined
          })
          .then(() => {
            console.log('✅ [useUpdateTrade] Détection des news terminée en tâche de fond')
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
          })
          .catch((newsErr) => {
            console.error('❌ [useUpdateTrade] Échec de l\'appel asynchrone à detect-news :', newsErr)
          })
        })
      }

      return fullTrade as TradeWithSteps
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}
