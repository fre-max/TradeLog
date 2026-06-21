import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { GeminiAnalysis } from './useQuickEntry'

// ─── Types pour l'état interne du hook ───────────────────────────────────────

export type TelegramMode = 'standard' | 'analyse' | 'quick' | 'quick_fallback' | 'ping' | null

export interface TelegramPingResult {
  ok: boolean
  bot?: { id: number; username: string; name: string }
  webhook?: { active: boolean; url: string | null }
  queue?: { pendingUpdates: number; pendingPhotos: number }
  gemini?: { configured: boolean; model: string }
  error?: string
}

interface TelegramState {
  isLoading: boolean
  preview: string | null   // URL de l'image récupérée
  error: string | null
  mode: TelegramMode       // Mode détecté selon la caption du message
  analysis: GeminiAnalysis | null  // Données extraites par Gemini (si analyse ou quick)
}

/**
 * Hook pour interagir avec le bot Telegram.
 * Appelle /api/telegram et retourne l'image + le mode d'action selon la caption.
 *
 * Modes retournés selon la légende (caption) du message Telegram :
 * - 'quick' ou 'quick_fallback' → le trade a été créé / les données sont prêtes pour création
 * - 'analyse'  → les données Gemini sont prêtes pour pré-remplir le formulaire
 * - 'standard' → uniquement une URL d'image (pas d'analyse)
 * - null       → état initial avant tout appel
 * 
 * Exemple :
 * const { fetchLastMessage, isLoading, preview, mode, analysis } = useTelegram()
 * await fetchLastMessage()
 * if (mode === 'analyse') { /* pré-remplir le formulaire avec analysis *\/ }
 */
export function useTelegram() {
  const [state, setState] = useState<TelegramState>({
    isLoading: false,
    preview: null,
    error: null,
    mode: null,
    analysis: null,
  })

  // Appelle la fonction Edge Supabase telegram et met à jour l'état selon le mode retourné
  const fetchLastMessage = async (stepId?: string): Promise<TelegramState> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      console.log('📡 [useTelegram] Appel de la fonction Edge Supabase telegram...')

      const { data, error } = await supabase.functions.invoke('telegram', {
        body: stepId ? { step_id: stepId } : {}
      })

      if (error) {
        throw new Error(error.message || 'Erreur lors de l\\'appel à la fonction telegram')
      }

      console.log('✅ [useTelegram] Réponse reçue avec succès, mode :', data.mode)

      const nouvelEtat: TelegramState = {
        isLoading: false,
        preview: data.fileUrl || null,
        error: data.error || null,
        mode: data.mode || 'standard',
        analysis: data.analysis || null,
      }

      setState(nouvelEtat)
      return nouvelEtat

    } catch (err) {
      console.error('❌ [useTelegram] Erreur attrapée dans fetchLastMessage :', err)
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      const etatErreur: TelegramState = {
        isLoading: false,
        preview: null,
        error: message,
        mode: null,
        analysis: null,
      }
      setState(etatErreur)
      return etatErreur
    }
  }

  // Méthode de rétrocompatibilité : fetchLastImage (utilisé par ImageField.tsx)
  // Préserve l'ancien comportement en retournant { fileUrl, date }
  const fetchLastImage = async (stepId?: string) => {
    const etat = await fetchLastMessage(stepId)
    if (etat.preview) {
      return { fileUrl: etat.preview, date: Date.now() }
    }
    return null
  }

  // Réinitialiser l'état complet du hook
  const clearPreview = () => {
    setState({ isLoading: false, preview: null, error: null, mode: null, analysis: null })
  }

  // Teste la connexion au bot sans consommer de message ni appeler Gemini
  const testBotConnection = async (): Promise<TelegramPingResult> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const { data, error } = await supabase.functions.invoke('telegram', {
        body: { ping: true }
      })

      if (error || !data?.ok) {
        throw new Error(error?.message || data?.error || 'Erreur de connexion au bot')
      }

      setState((prev) => ({ ...prev, isLoading: false, error: null, mode: 'ping' }))
      return data as TelegramPingResult & { mode?: string }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      setState((prev) => ({ ...prev, isLoading: false, error: message }))
      return { ok: false, error: message }
    }
  }

  return {
    ...state,
    fetchLastMessage,
    fetchLastImage,  // Rétrocompatibilité avec ImageField.tsx
    testBotConnection,
    clearPreview,
  }
}
