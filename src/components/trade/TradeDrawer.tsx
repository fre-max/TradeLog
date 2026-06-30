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
import { useTradeReasons, useSaveTradeReasons, type SelectedTradeReason } from '@/hooks/useTradeReasons'
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
  // Les raisons sélectionnées : tableau d'objets { reason_id, variant_name }
  const [selectedReasons, setSelectedReasons] = useState<SelectedTradeReason[]>([])
  const [tradeImages, setTradeImages] = useState<Partial<TradeImage>[]>([])
  const [saving, setSaving] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const [showImagesImport, setShowImagesImport] = useState(false)

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
      if (existingReasons) setSelectedReasons(existingReasons)
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
      setSelectedReasons([])
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
    setSelectedReasons([])
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

  const handleSave = async () => {
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

        // Sauvegarde des raisons dynamiques avec leurs variantes
        await saveTradeReasons({ tradeId: editingTrade.id, reasons: selectedReasons })
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

      // Sauvegarde des raisons dynamiques avec leurs variantes
      await saveTradeReasons({ tradeId: tempIds.tradeId, reasons: selectedReasons })
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
                <div className="border-b border-border">
                  <div className="flex items-center justify-between px-5 pt-4 pb-2">
                    <h3 className="text-[13px] font-semibold text-txt uppercase tracking-wider">🖼️ Images (Avant/Après)</h3>
                    {brouillonsImages.length > 0 && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowImagesImport(!showImagesImport)}
                          className="text-[11px] px-2 py-1 bg-[#7c3aed]/10 text-[#7c3aed] border border-[#7c3aed]/25 rounded-md hover:bg-[#7c3aed]/20 transition-colors font-medium"
                        >
                          💾 Importer
                        </button>
                        {showImagesImport && (
                          <>
                            <div className="fixed inset-0 z-[5]" onClick={() => setShowImagesImport(false)} />
                            <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-xl z-[10] min-w-[160px] overflow-hidden">
                              <p className="text-txt3 text-[10px] px-3 py-1.5 border-b border-border uppercase tracking-wider">Choisir un brouillon</p>
                              {brouillonsImages.map((b) => (
                                <button
                                  key={b.id}
                                  type="button"
                                  onClick={() => {
                                    if (b.sections.images) setTradeImages(b.sections.images)
                                    setShowImagesImport(false)
                                  }}
                                  className="w-full text-left px-3 py-2 text-[12.5px] text-txt hover:bg-accent/8 transition-colors flex items-center gap-2"
                                >
                                  <span className="w-5 h-5 rounded-full bg-[#7c3aed]/15 text-[#7c3aed] flex items-center justify-center text-[10px] font-bold">{b.id}</span>
                                  Brouillon {b.id}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="p-5 pt-2">
                    <TradeImageManager images={tradeImages} onChange={setTradeImages} />
                  </div>
                </div>
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
                    selectedReasonIds={selectedReasons.map(r => r.reason_id)}
                    setSelectedReasonIds={(ids) => {
                      // Compatibilité : si on reçoit des IDs simples, on crée des objets
                      // Le vrai changement passe par TradeReasonsAccordions directement
                    }}
                    selectedReasons={selectedReasons}
                    setSelectedReasons={setSelectedReasons}
                    tradeImages={tradeImages}
                  />
                ))}
              </div>
            )
          })()}
        </div>

        {(isEditMode || manualMode) && (
          <div className="flex justify-end gap-2.5 px-5 py-4 border-t border-border flex-shrink-0">
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
              onClick={handleSave}
              disabled={enCours}
              className="px-4 py-2 bg-accent text-white rounded-md text-[13px] font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {enCours ? 'Enregistrement...' : isEditMode ? 'Mettre à jour' : 'Enregistrer'}
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
