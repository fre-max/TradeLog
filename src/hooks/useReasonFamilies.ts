import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ReasonFamily, ReasonFamilyInsert } from '@/types'

const QUERY_KEY = ['reason_families'] as const

/**
 * Récupère la liste des familles de raisons (Entrée, TP, etc.)
 */
export function useReasonFamilies() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<ReasonFamily[]> => {
      const { data, error } = await supabase
        .from('reason_families')
        .select('*')
        .order('order', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) {
        console.error('❌ [useReasonFamilies] Erreur:', error)
        throw error
      }
      return data as ReasonFamily[]
    },
  })
}

/**
 * Crée une nouvelle famille
 */
export function useCreateReasonFamily() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (family: ReasonFamilyInsert) => {
      console.log('🚀 [useCreateReasonFamily] Création famille:', family.name)
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Utilisateur non connecté')

      const { data, error } = await supabase
        .from('reason_families')
        .insert({ ...family, user_id: user.id })
        .select()
        .single()

      if (error) throw error
      console.log('✅ [useCreateReasonFamily] Succès')
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

/**
 * Supprime une famille (supprimera en cascade les raisons associées)
 */
export function useDeleteReasonFamily() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      console.log('🚀 [useDeleteReasonFamily] Suppression:', id)
      const { error } = await supabase.from('reason_families').delete().eq('id', id)
      if (error) throw error
      console.log('✅ [useDeleteReasonFamily] Succès')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      // Il faut aussi invalider le catalogue car ses items ont été supprimés en cascade
      queryClient.invalidateQueries({ queryKey: ['reason_catalog'] })
    },
  })
}
