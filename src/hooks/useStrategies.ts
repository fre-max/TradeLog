import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Strategy, StrategyInsert } from '@/types'

const QUERY_KEY = ['strategies'] as const

// Récupérer toutes les stratégies de l'utilisateur
export function useStrategies() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<Strategy[]> => {
      const { data, error } = await supabase
        .from('strategies')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Strategy[]
    },
  })
}

// Créer une nouvelle stratégie
export function useCreateStrategy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (strategy: StrategyInsert) => {
      // Vérifier si l'utilisateur est connecté
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Utilisateur non connecté')

      const { data, error } = await supabase
        .from('strategies')
        .insert({ ...strategy, user_id: user.id })
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

// Mettre à jour une stratégie
export function useUpdateStrategy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Strategy> & { id: string }) => {
      const { data, error } = await supabase
        .from('strategies')
        .update(updates)
        .eq('id', id)
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

// Supprimer une stratégie
export function useDeleteStrategy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('strategies').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      // On invalide aussi les trades car certains pourraient être liés à cette stratégie (bien qu'on utilise "on delete set null")
      queryClient.invalidateQueries({ queryKey: ['trades'] })
    },
  })
}
