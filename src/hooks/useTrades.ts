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
            *,
            images: step_images (*)
          )
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
        .select(`*, steps (*, images: step_images (*))`)
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
  imagesForm: { id: string; url: string; source: string }[]
) {
  console.log(`📡 [syncImages] Synchronisation des images pour le step : ${stepId}`);
  
  // 1️⃣ Récupérer les images actuellement en base pour ce step
  const { data: dbImages, error: fetchErr } = await supabase
    .from('step_images')
    .select('id, url')
    .eq('step_id', stepId)

  if (fetchErr) {
    console.error('❌ [syncImages] Erreur lors de la récupération des images :', fetchErr)
    throw fetchErr
  }

  const dbUrls = new Set((dbImages || []).map((img) => img.url))
  const formUrls = new Set(imagesForm.map((img) => img.url))

  // Images à insérer (présentes dans le formulaire mais pas en base)
  const aInserer = imagesForm.filter((img) => !dbUrls.has(img.url))
  
  // Images à supprimer (présentes en base mais plus dans le formulaire)
  const aSupprimer = (dbImages || []).filter((img) => img.url && !formUrls.has(img.url))

  // 2️⃣ Insérer les nouvelles images
  if (aInserer.length > 0) {
    console.log(`📡 [syncImages] Insertion de ${aInserer.length} nouvelles images`);
    const { error: insertErr } = await supabase
      .from('step_images')
      .insert(
        aInserer.map((img) => ({
          step_id: stepId,
          url: img.url,
          source: img.source || 'upload',
        }))
      )
    if (insertErr) {
      console.error("❌ [syncImages] Erreur d'insertion d'images :", insertErr)
      throw insertErr
    }
  }

  // 3️⃣ Supprimer les images retirées
  if (aSupprimer.length > 0) {
    console.log(`📡 [syncImages] Suppression de ${aSupprimer.length} images obsolètes`);
    const ids = aSupprimer.map((img) => img.id)
    const { error: deleteErr } = await supabase
      .from('step_images')
      .delete()
      .in('id', ids)
    if (deleteErr) {
      console.error("❌ [syncImages] Erreur de suppression d'images :", deleteErr)
      throw deleteErr
    }
  }
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
        .select(`*, steps (*, images: step_images (*))`)
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
        .select(`*, steps (*, images: step_images (*))`)
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
