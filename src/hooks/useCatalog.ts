import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ReasonCatalogItem, ReasonCatalogInsert, ReasonVariantInsert } from '@/types'

const QUERY_KEY = ['reason_catalog'] as const

/**
 * Hook pour récupérer la liste complète des raisons techniques avec leurs variantes.
 * Les données appartiennent à l'utilisateur connecté.
 * 
 * Exemple :
 * const { data: raisons, isLoading } = useCatalog();
 * if (raisons) console.log(raisons[0].title); // "Wyckoff candle"
 */
export function useCatalog() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<ReasonCatalogItem[]> => {
      // Récupère les raisons triées par date de création, avec leurs variantes
      const { data, error } = await supabase
        .from('reason_catalog')
        .select(`
          *,
          variants: reason_variants (*)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ [useCatalog] Erreur lors de la récupération du catalogue:', error)
        throw error
      }
      return data as ReasonCatalogItem[]
    },
  })
}

interface CreateCatalogItemInput {
  item: ReasonCatalogInsert
  variants: Omit<ReasonVariantInsert, 'reason_id'>[]
}

/**
 * Hook pour créer une nouvelle raison technique dans le catalogue avec ses variantes associées.
 * 
 * Exemple :
 * const createMutation = useCreateCatalogItem();
 * await createMutation.mutateAsync({
 *   item: { title: 'Wyckoff candle', description: 'Pattern de retournement', type: 'entry' },
 *   variants: [{ name: 'mineur', image_url: '...' }, { name: 'moyen', image_url: '...' }]
 * });
 */
export function useCreateCatalogItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ item, variants }: CreateCatalogItemInput) => {
      console.log('🚀 [useCreateCatalogItem] Début de la création');

      // 1️⃣ Récupération de l'utilisateur connecté
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Utilisateur non connecté')

      // 2️⃣ Insertion de l'item principal
      const { data: insertedItem, error: itemError } = await supabase
        .from('reason_catalog')
        .insert({
          ...item,
          user_id: user.id,
        })
        .select()
        .single()

      if (itemError || !insertedItem) {
        console.error('❌ [useCreateCatalogItem] Erreur lors de l\'insertion de l\'item:', itemError)
        throw itemError || new Error('Impossible de créer l\'item principal')
      }

      // 3️⃣ Insertion des variantes reliées à l'item principal (si définies)
      if (variants.length > 0) {
        const variantsToInsert = variants.map((v) => ({
          ...v,
          reason_id: insertedItem.id,
        }))

        const { error: variantsError } = await supabase
          .from('reason_variants')
          .insert(variantsToInsert)

        if (variantsError) {
          console.error('❌ [useCreateCatalogItem] Erreur lors de l\'insertion des variantes:', variantsError)
          throw variantsError
        }
      }

      console.log('✅ [useCreateCatalogItem] Succès !');
      return insertedItem
    },
    onSuccess: () => {
      // Invalide le cache pour recharger la liste des raisons
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

interface UpdateCatalogItemInput {
  id: string
  item: Partial<ReasonCatalogInsert>
  variants: Omit<ReasonVariantInsert, 'reason_id'>[]
}

/**
 * Hook pour modifier une raison technique existante et ses variantes.
 * Simplifié en supprimant puis réinsérant les variantes de manière linéaire.
 * 
 * Exemple :
 * const updateMutation = useUpdateCatalogItem();
 * await updateMutation.mutateAsync({
 *   id: 'uuid-raison',
 *   item: { title: 'Wyckoff candle modifié' },
 *   variants: [{ name: 'moyen', image_url: '...' }]
 * });
 */
export function useUpdateCatalogItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, item, variants }: UpdateCatalogItemInput) => {
      console.log('🚀 [useUpdateCatalogItem] Début de la mise à jour de l\'item:', id);

      // 1️⃣ Mise à jour de l'item principal
      const { data: updatedItem, error: itemError } = await supabase
        .from('reason_catalog')
        .update(item)
        .eq('id', id)
        .select()
        .single()

      if (itemError) {
        console.error('❌ [useUpdateCatalogItem] Erreur lors de la modification de l\'item:', itemError)
        throw itemError
      }

      // 2️⃣ Mise à jour des variantes par ré-insertion (Nettoyer puis Recréer)
      // Cela évite de gérer des diffs d'ID complexes
      const { error: deleteError } = await supabase
        .from('reason_variants')
        .delete()
        .eq('reason_id', id)

      if (deleteError) {
        console.error('❌ [useUpdateCatalogItem] Erreur lors de la suppression des anciennes variantes:', deleteError)
        throw deleteError
      }

      if (variants.length > 0) {
        const variantsToInsert = variants.map((v) => ({
          ...v,
          reason_id: id,
        }))

        const { error: insertError } = await supabase
          .from('reason_variants')
          .insert(variantsToInsert)

        if (insertError) {
          console.error('❌ [useUpdateCatalogItem] Erreur lors de la ré-insertion des variantes:', insertError)
          throw insertError
        }
      }

      console.log('✅ [useUpdateCatalogItem] Succès de la mise à jour !');
      return updatedItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

/**
 * Hook pour supprimer un concept technique du catalogue.
 * La suppression en cascade de Supabase nettoie les variantes.
 * 
 * Exemple :
 * const deleteMutation = useDeleteCatalogItem();
 * await deleteMutation.mutateAsync('uuid-raison');
 */
export function useDeleteCatalogItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      console.log('🚀 [useDeleteCatalogItem] Suppression de l\'item:', id);
      const { error } = await supabase
        .from('reason_catalog')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('❌ [useDeleteCatalogItem] Erreur lors de la suppression:', error)
        throw error
      }
      console.log('✅ [useDeleteCatalogItem] Supprimé avec succès');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}
