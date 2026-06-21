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
        .order('date_backtested', { ascending: false })

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
          const { error } = await supabase.from('steps').update(stepData).eq('id', id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('steps').insert(stepData)
          if (error) throw error
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

      // Déclencher la détection des news économiques après la mise à jour du trade
      if (fullTrade.date_backtested && fullTrade.entry_time && fullTrade.exit_time) {
        try {
          const session = await supabase.auth.getSession()
          const token = session.data.session?.access_token
          
          await supabase.functions.invoke('detect-news', {
            body: {
              trade_id: fullTrade.id,
              pair: fullTrade.pair,
              date: fullTrade.date_backtested,
              entry_time: fullTrade.entry_time,
              exit_time: fullTrade.exit_time,
            },
            headers: token ? { Authorization: `Bearer ${token}` } : undefined
          })
        } catch (newsErr) {
          console.error('❌ [useUpdateTrade] Erreur de détection des news :', newsErr)
        }
      }

      return fullTrade as TradeWithSteps
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}
