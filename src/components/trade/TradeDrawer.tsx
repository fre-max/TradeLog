import { useEffect, useState, useMemo } from 'react'
import { useUIStore } from '@/store'
import { cn } from '@/lib/utils'
import { StepBlock } from './StepBlock'
import { supabase } from '@/lib/supabase'
import { useUpdateTrade } from '@/hooks/useTrades'
import { useQuickEntry } from '@/hooks/useQuickEntry'
import { ImageAnalysisUpload } from './ImageAnalysisUpload'
import { useBrouillonStore } from '@/store/brouillonStore'
import type { Brouillon } from '@/store/brouillonStore'
import { useQueryClient } from '@tanstack/react-query'
import { useTradeReasons, useSaveTradeReasons } from '@/hooks/useTradeReasons'
import { useTradeImages, useSaveTradeImages } from '@/hooks/useTradeImages'
import { TradeImageManager } from './TradeImageManager'
import type { TradeImage } from '@/types'
import { useParams } from 'react-router-dom'
import {
  buildStepPayloads,
  buildTradePayload,
  computeTradeStatus,
  extractStepIds,
  INITIAL_FORM_STATE,
  tradeToFormData,
  type EditStepIds,
  type FormDataState,
} from '@/lib/tradeForm'

export type { FormDataState }

export function TradeDrawer() {
  const isNewTradeOpen = useUIStore((state) => state.isNewTradeOpen)
  const editingTrade = useUIStore((state) => state.editingTrade)
  const closeNewTrade = useUIStore((state) => state.closeNewTrade)
  const openDetail = useUIStore((state) => state.openDetail)
  const openEditTrade = useUIStore((state) => state.openEditTrade)
  const addToast = useUIStore((state) => state.addToast)

  const isEditMode = Boolean(editingTrade)
  const { mutateAsync: updateTrade, isPending: isUpdating } = useUpdateTrade()
  const { mutateAsync: creerQuickEntry, isPending: isCreatingQuick } = useQuickEntry()
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState<FormDataState>(INITIAL_FORM_STATE)
  const [stepIds, setStepIds] = useState<EditStepIds>({})
  const [selectedReasonIds, setSelectedReasonIds] = useState<string[]>([])
  const [tradeImages, setTradeImages] = useState<Partial<TradeImage>[]>([])
  const [saving, setSaving] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const [showImagesImport, setShowImagesImport] = useState(false)
  const [analysantIA, setAnalysantIA] = useState(false)
  const [showRappelDialog, setShowRappelDialog] = useState(false)

  // Extrait toutes les images actuellement insérées dans les différentes étapes du formulaire
  const toutesLesImages = useMemo(() => {
    return [
      ...(formData.biais_images || []),
      ...(formData.poi_images || []),
      ...(formData.entry_images || []),
      ...(formData.result_images || []),
    ]
  }, [formData.biais_images, formData.poi_images, formData.entry_images, formData.result_images])

  // Détermine si le trade possède toujours ses données par défaut
  const aDesDonneesParDefaut = useMemo(() => {
    return (
      formData.pair === INITIAL_FORM_STATE.pair &&
      formData.direction === INITIAL_FORM_STATE.direction &&
      formData.session === INITIAL_FORM_STATE.session &&
      formData.rr_planned === INITIAL_FORM_STATE.rr_planned &&
      formData.rr_realized === INITIAL_FORM_STATE.rr_realized &&
      formData.result === INITIAL_FORM_STATE.result
    )
  }, [formData])

  const brouillons = useBrouillonStore((state) => state.brouillons)
  const brouillonsImages = brouillons.filter(b => b.sections.images && b.sections.images.length > 0)

  const { mutateAsync: saveTradeReasons } = useSaveTradeReasons()
  const { mutateAsync: saveTradeImages } = useSaveTradeImages()

  // UUIDs générés côté client pour l'insertion des nouveaux trades et de leurs étapes
  const [tempIds, setTempIds] = useState(() => ({
    tradeId: crypto.randomUUID(),
    biais: crypto.randomUUID(),
    poi: crypto.randomUUID(),
    entry: crypto.randomUUID(),
    result: crypto.randomUUID(),
  }))
  const { type } = useParams<{ type: string }>()
  const currentJournalType = (type || 'global') as 'global' | 'bias' | 'poi' | 'confirmation'

  // Sélection dynamique des étapes du formulaire selon le type de journal choisi dans le formulaire
  const stepsAffichees = useMemo(() => {
    const typeJournal = formData.journal_type || 'global'
    
    if (typeJournal === 'bias') {
      return [
        { id: 'step-reasons', title: 'Raisons du Trade', type: 'reasons' as const },
        { id: 'step-1', title: 'Infos générales (Biais)', type: 'general' as const },
        { id: 'step-2', title: 'Biais HTF', type: 'biais' as const },
        { id: 'step-5', title: 'Résultat & Revue Biais', type: 'result' as const },
      ]
    }
    
    if (typeJournal === 'poi') {
      return [
        { id: 'step-reasons', title: 'Raisons du Trade', type: 'reasons' as const },
        { id: 'step-1', title: 'Infos générales (POI)', type: 'general' as const },
        { id: 'step-2', title: 'Biais (Contexte)', type: 'biais' as const },
        { id: 'step-3', title: 'POI / Zone', type: 'poi' as const },
        { id: 'step-5', title: 'Résultat POI', type: 'result' as const },
      ]
    }
    
    if (typeJournal === 'confirmation') {
      return [
        { id: 'step-reasons', title: 'Raisons du Trade', type: 'reasons' as const },
        { id: 'step-1', title: 'Infos générales (Confirmation)', type: 'general' as const },
        { id: 'step-3', title: 'Zone POI (Contexte)', type: 'poi' as const },
        { id: 'step-4', title: 'Entrée (Confirmation LTF)', type: 'entry' as const },
        { id: 'step-5', title: 'Résultat & Review', type: 'result' as const },
      ]
    }
    
    // Par défaut (global) : affichage de toutes les étapes
    return [
      { id: 'step-reasons', title: 'Raisons du Trade', type: 'reasons' as const },
      { id: 'step-1', title: 'Infos générales', type: 'general' as const },
      { id: 'step-2', title: 'Biais', type: 'biais' as const },
      { id: 'step-3', title: 'POI / Zone', type: 'poi' as const },
      { id: 'step-4', title: 'Entrée', type: 'entry' as const },
      { id: 'step-5', title: 'Résultat & Review', type: 'result' as const },
    ]
  }, [formData.journal_type])

  const { data: existingReasons } = useTradeReasons(isEditMode ? editingTrade?.id : undefined)
  const { data: existingImages } = useTradeImages(isEditMode ? editingTrade?.id : undefined)

  useEffect(() => {
    if (isEditMode) {
      if (existingReasons) setSelectedReasonIds(existingReasons)
      if (existingImages) setTradeImages(existingImages)
    }
  }, [existingReasons, existingImages, isEditMode])

  useEffect(() => {
    if (!isNewTradeOpen) return

    if (editingTrade) {
      setFormData(tradeToFormData(editingTrade))
      setStepIds(extractStepIds(editingTrade))
      setManualMode(true)
    } else {
      // Pour un nouveau trade, on initialise le type de journal sur celui de la page active
      setFormData({
        ...INITIAL_FORM_STATE,
        journal_type: currentJournalType,
      })
      setStepIds({})
      setSelectedReasonIds([])
      setTradeImages([])
      setManualMode(false)
    }
  }, [isNewTradeOpen, editingTrade, currentJournalType])

  const handleClose = () => {
    if (!saving && !isUpdating && !isCreatingQuick) {
      closeNewTrade()
    }
  }

  const resetAndClose = () => {
    setFormData(INITIAL_FORM_STATE)
    setStepIds({})
    setSelectedReasonIds([])
    setTradeImages([])
    setTempIds({
      tradeId: crypto.randomUUID(),
      biais: crypto.randomUUID(),
      poi: crypto.randomUUID(),
      entry: crypto.randomUUID(),
      result: crypto.randomUUID(),
    })
    closeNewTrade()
  }

  // Analyse une image sélectionnée dans le Drawer pour pré-remplir le formulaire
  const analyserImageSelectionnee = async (url: string) => {
    setAnalysantIA(true)
    console.log("🚀 [TradeDrawer] Lancement de l'analyse IA sur l'image :", url)
    try {
      const response = await supabase.functions.invoke('analyze', {
        body: {
          url,
          mode: 'setup'
        }
      })

      if (response.error) throw response.error

      const res = response.data
      console.log('✅ [TradeDrawer] Analyse IA terminée. Résultats :', res)

      // Remplir les champs du formulaire avec les données extraites
      setFormData((prev) => ({
        ...prev,
        pair: res.pair || prev.pair,
        direction: (res.direction || prev.direction) as 'long' | 'short',
        session: res.session || prev.session,
        entry_price: res.entry_price ? String(res.entry_price) : prev.entry_price,
        entry_sl: res.sl ? String(res.sl) : prev.entry_sl,
        entry_tp: res.tp ? String(res.tp) : prev.entry_tp,
        rr_planned: res.rr ? String(res.rr) : prev.rr_planned,
        rr_realized: res.rr_realized != null ? String(res.rr_realized) : prev.rr_realized,
        result: res.result || prev.result,
        exit_type: res.result === 'win' ? 'tp' : (res.result === 'loss' ? 'sl' : (res.result === 'breakeven' ? 'breakeven' : prev.exit_type)),
        biais_timeframe: res.timeframe || prev.biais_timeframe,
        poi_timeframe: res.timeframe || prev.poi_timeframe,
        entry_timeframe: res.timeframe || prev.entry_timeframe,
      }))

      addToast("Données du trade pré-remplies par l'IA !", "success")
    } catch (e: any) {
      console.error("❌ [TradeDrawer] Échec de l'analyse IA :", e)
      addToast(e.message || "Erreur lors de l'analyse par l'IA.", "error")
    } finally {
      setAnalysantIA(false)
    }
  }

  const handleSave = async (forceSave = false) => {
    // Si l'utilisateur enregistre un nouveau trade avec des valeurs par défaut alors qu'il a des captures non analysées
    if (!forceSave && !isEditMode && aDesDonneesParDefaut && toutesLesImages.length > 0) {
      console.log("⚠️ [TradeDrawer] Données par défaut détectées, affichage du rappel.")
      setShowRappelDialog(true)
      return
    }

    setShowRappelDialog(false)
    setSaving(true)

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Utilisateur non connecté ou session expirée')
      }

      if (isEditMode && editingTrade) {
        const biaisStep = editingTrade.steps.find((s) => s.type === 'biais')
        const preserveBiaisFields = (biaisStep?.fields ?? null) as Record<string, unknown> | null

        const updated = await updateTrade({
          tradeId: editingTrade.id,
          formData,
          stepIds,
          previousStatus: editingTrade.status,
          preserveBiaisFields,
        })

        // Sauvegarde des raisons dynamiques
        await saveTradeReasons({ tradeId: editingTrade.id, reasonIds: selectedReasonIds })
        // Sauvegarde des nouvelles images structurées
        await saveTradeImages({ tradeId: editingTrade.id, images: tradeImages })

        addToast('Trade mis à jour avec succès !', 'success')
        resetAndClose()
        openDetail(updated)
        return
      }

      const status = computeTradeStatus(formData, 'in_progress')
      const tradeData = {
        id: tempIds.tradeId,
        user_id: user.id,
        ...buildTradePayload(formData, status),
      }

      console.log('📡 [TradeDrawer] Insertion du nouveau trade en BDD (ID forcé) :', tempIds.tradeId)
      const { data: insertedTrade, error: tradeInsertError } = await supabase
        .from('trades')
        .insert(tradeData)
        .select()
        .single()

      if (tradeInsertError || !insertedTrade) {
        throw tradeInsertError || new Error("Erreur lors de la création du trade")
      }

      console.log('📡 [TradeDrawer] Construction et insertion des étapes avec IDs forcés')
      const stepsToInsert = buildStepPayloads(tempIds.tradeId, formData, {
        biais: tempIds.biais,
        poi: tempIds.poi,
        entry: tempIds.entry,
        result: tempIds.result,
      })

      const { error: stepsInsertError } = await supabase.from('steps').insert(stepsToInsert)
      if (stepsInsertError) throw stepsInsertError

      // Sauvegarde des raisons dynamiques
      await saveTradeReasons({ tradeId: tempIds.tradeId, reasonIds: selectedReasonIds })
      // Sauvegarde des images
      await saveTradeImages({ tradeId: tempIds.tradeId, images: tradeImages })

      await queryClient.invalidateQueries({ queryKey: ['trades'] })
      addToast('Le trade a été enregistré avec succès !', 'success')
      resetAndClose()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la sauvegarde'
      addToast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const enCours = saving || isUpdating || isCreatingQuick

  return (
    <>
      {isNewTradeOpen && (
        <div className="fixed inset-0 bg-black/70 z-[90]" onClick={handleClose} />
      )}

      <aside
        className={cn(
          'fixed top-0 right-0 h-full w-full md:w-[680px] bg-surface border-l border-border',
          'flex flex-col z-[100] transition-transform duration-300',
          isNewTradeOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-shrink-0">
          <button
            onClick={handleClose}
            disabled={enCours}
            className="md:hidden text-txt2 hover:text-txt text-lg leading-none disabled:opacity-50"
          >
            ←
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-txt font-semibold text-base tracking-tight">
              {isEditMode ? 'Modifier le trade' : 'Nouveau trade'}
            </h2>
            {isEditMode && editingTrade && (
              <p className="text-txt3 text-[12px] truncate">
                {editingTrade.pair} · {editingTrade.direction} · {editingTrade.date_backtested}
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            disabled={enCours}
            className="hidden md:block text-txt3 hover:text-txt text-xl leading-none disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!isEditMode && !manualMode ? (
            <ImageAnalysisUpload
              onAnalysisComplete={async ({ analysis, imageUrl }) => {
                try {
                  const res = await creerQuickEntry({ analysis, imageUrl })
                  openEditTrade(res.trade)
                  addToast('Graphique analysé et trade créé ! Complète les détails.', 'success')
                } catch (e: any) {
                  addToast(e.message || "Erreur lors de la création du trade par IA", 'error')
                }
              }}
              onManualMode={() => setManualMode(true)}
            />
          ) : (() => {
            const tradeIdActuel = isEditMode && editingTrade ? editingTrade.id : tempIds.tradeId
            const getStepId = (type: string) => {
              if (type === 'general' || type === 'reasons') return ''
              if (isEditMode) {
                return (stepIds as any)[type] || (tempIds as any)[type]
              }
              return (tempIds as any)[type]
            }

            return (
              <div className="flex flex-col">
                {stepsAffichees.map((step, index) => (
                  <StepBlock
                    key={step.id}
                    number={index + 1}
                    title={step.title}
                    type={step.type}
                    defaultOpen={index === 0}
                    formData={formData}
                    setFormData={setFormData}
                    tradeId={tradeIdActuel}
                    stepId={getStepId(step.type)}
                    selectedReasonIds={selectedReasonIds}
                    setSelectedReasonIds={setSelectedReasonIds}
                    tradeImages={tradeImages}
                  />
                ))}
              </div>
            )
          })()}
        </div>

        {(isEditMode || manualMode) && (
          <div className="flex flex-col border-t border-border flex-shrink-0 bg-surface">
            {/* Zone d'assistant IA rapide si des images existent dans le formulaire */}
            {toutesLesImages.length > 0 && (
              <div className="px-5 pt-3.5 pb-2.5 bg-bg/25 border-b border-border/40">
                <p className="text-[11px] text-txt3 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span>🔮 Assistant IA (Remplissage rapide) :</span>
                  {analysantIA && (
                    <span className="flex items-center gap-1.5 text-[10px] text-accent normal-case font-normal animate-pulse">
                      <span className="w-2.5 h-2.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      Analyse en cours...
                    </span>
                  )}
                </p>
                <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin">
                  {toutesLesImages.map((img, idx) => (
                    <button
                      key={img.id || idx}
                      type="button"
                      disabled={analysantIA}
                      onClick={() => analyserImageSelectionnee(img.url)}
                      className={cn(
                        "relative w-20 aspect-video rounded border border-border2 overflow-hidden hover:border-accent hover:scale-105 transition-all flex-shrink-0 bg-surface2 disabled:opacity-50",
                        analysantIA && "cursor-not-allowed"
                      )}
                      title="Cliquer pour lancer l'analyse Gemini Vision sur cette capture"
                    >
                      <img src={img.url} className="w-full h-full object-cover" alt="Capture à analyser" loading="lazy" />
                      <div className="absolute inset-0 bg-black/40 hover:bg-black/15 transition-colors flex items-center justify-center">
                        <span className="text-[9px] text-white font-bold">🔮 Analyser</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Boutons d'action principaux */}
            <div className="flex justify-end gap-2.5 px-5 py-4">
              <button
                onClick={() => {
                  if (!enCours) resetAndClose()
                }}
                disabled={enCours}
                className="px-4 py-2 border border-border2 rounded-md text-txt2 text-[13px] font-medium hover:bg-surface2 hover:text-txt transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={() => handleSave(false)}
                disabled={enCours}
                className="px-4 py-2 bg-accent text-white rounded-md text-[13px] font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {enCours ? 'Enregistrement...' : isEditMode ? 'Mettre à jour' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}

        {/* Dialogue de rappel anti-oubli */}
        {showRappelDialog && (
          <div className="absolute inset-0 bg-black/85 z-[150] flex items-center justify-center p-6 animate-fadeIn animate-duration-200">
            <div className="bg-surface border border-border rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
              <div className="text-center space-y-2">
                <span className="text-3xl">⚠️</span>
                <h3 className="text-txt font-semibold text-sm">Données non complétées</h3>
                <p className="text-txt3 text-xs leading-relaxed">
                  Tu t'apprêtes à enregistrer ce trade avec les valeurs par défaut. Souhaites-tu d'abord utiliser l'IA sur l'une de tes captures pour extraire automatiquement les données (paire, direction, R:R) ?
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] text-txt3 font-bold uppercase tracking-wider text-center">Choisir la capture à analyser :</p>
                <div className="flex gap-2 justify-center overflow-x-auto py-1 scrollbar-thin">
                  {toutesLesImages.map((img, idx) => (
                    <button
                      key={img.id || idx}
                      type="button"
                      onClick={() => {
                        setShowRappelDialog(false)
                        analyserImageSelectionnee(img.url)
                      }}
                      className="relative w-16 aspect-video rounded border border-border2 overflow-hidden hover:border-accent hover:scale-105 transition-all flex-shrink-0 bg-surface2"
                    >
                      <img src={img.url} className="w-full h-full object-cover" alt="Image" loading="lazy" />
                      <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                        <span className="text-[9px] text-white font-bold">🔮 Lancer</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  className="w-full py-2 bg-surface2 border border-border2 text-txt hover:bg-surface transition-colors rounded-md text-xs font-semibold text-center"
                >
                  💾 Enregistrer sans l'IA
                </button>
                <button
                  type="button"
                  onClick={() => setShowRappelDialog(false)}
                  className="w-full py-2 text-txt3 hover:text-txt hover:underline transition-colors text-xs text-center font-medium"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
