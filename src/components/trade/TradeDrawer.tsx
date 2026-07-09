import { useEffect, useState, useMemo } from 'react'
import { useUIStore } from '@/store'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useUpdateTrade } from '@/hooks/useTrades'
import { useQuickEntry } from '@/hooks/useQuickEntry'
import { ImageAnalysisUpload } from './ImageAnalysisUpload'
import { useQueryClient } from '@tanstack/react-query'
import { useTradeReasons, useSaveTradeReasons, type SelectedTradeReason } from '@/hooks/useTradeReasons'
import { useTradeImages, useSaveTradeImages } from '@/hooks/useTradeImages'
import { TradeTypeSelector } from './TradeTypeSelector'
import { GlobalInfosPanel } from './GlobalInfosPanel'
import { TradeSectionPanel } from './TradeSectionPanel'
import { IAAnalysisPanel } from './IAAnalysisPanel'
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

  // États du formulaire
  const [formData, setFormData] = useState<FormDataState>(INITIAL_FORM_STATE)
  const [stepIds, setStepIds] = useState<EditStepIds>({})
  const [selectedReasons, setSelectedReasons] = useState<SelectedTradeReason[]>([])
  const [saving, setSaving] = useState(false)

  // Contrôles de navigation et d'étapes dans le Drawer
  const [manualMode, setManualMode] = useState(false)
  const [selectedStartType, setSelectedStartType] = useState<'bias' | 'poi' | 'confirmation' | null>(null)
  const [analysantIA, setAnalysantIA] = useState(false)
  const [globalInfosParDefaut, setGlobalInfosParDefaut] = useState(true)
  const [showRappelDialog, setShowRappelDialog] = useState(false)

  // UUIDs temporaires pour la création d'un nouveau trade et de ses étapes
  const [tempIds, setTempIds] = useState(() => ({
    tradeId: crypto.randomUUID(),
    biais: crypto.randomUUID(),
    poi: crypto.randomUUID(),
    entry: crypto.randomUUID(),
    result: crypto.randomUUID(),
  }))

  const { data: existingReasons } = useTradeReasons(isEditMode ? editingTrade?.id : undefined)
  const { data: existingImages } = useTradeImages(isEditMode ? editingTrade?.id : undefined)

  const { mutateAsync: saveTradeReasons } = useSaveTradeReasons()
  const { mutateAsync: saveTradeImages } = useSaveTradeImages()

  // Extrait toutes les images insérées dans les différentes étapes
  const toutesLesImages = useMemo(() => {
    return [
      ...(formData.biais_images || []).map(img => ({ ...img, phase: img.phase as 'avant' | 'apres' })),
      ...(formData.poi_images || []).map(img => ({ ...img, phase: img.phase as 'avant' | 'apres' })),
      ...(formData.entry_images || []).map(img => ({ ...img, phase: img.phase as 'avant' | 'apres' })),
    ]
  }, [formData.biais_images, formData.poi_images, formData.entry_images])

  // Synchronise les données si on édite un trade existant
  useEffect(() => {
    if (isEditMode) {
      if (existingReasons) setSelectedReasons(existingReasons)
      if (existingImages) {
        setFormData(tradeToFormData(editingTrade!, existingImages))
      } else {
        setFormData(tradeToFormData(editingTrade!))
      }
      setStepIds(extractStepIds(editingTrade!))
      setManualMode(true)
      setSelectedStartType('bias') // Par défaut
    }
  }, [existingReasons, existingImages, isEditMode, editingTrade])

  // Réinitialise l'état à l'ouverture pour un nouveau trade
  useEffect(() => {
    if (!isNewTradeOpen) return

    if (!editingTrade) {
      setFormData(INITIAL_FORM_STATE)
      setStepIds({})
      setSelectedReasons([])
      setManualMode(false)
      setSelectedStartType(null)
      setTempIds({
        tradeId: crypto.randomUUID(),
        biais: crypto.randomUUID(),
        poi: crypto.randomUUID(),
        entry: crypto.randomUUID(),
        result: crypto.randomUUID(),
      })
    }
  }, [isNewTradeOpen, editingTrade])

  const handleClose = () => {
    if (!saving && !isUpdating && !isCreatingQuick && !analysantIA) {
      closeNewTrade()
    }
  }

  const resetAndClose = () => {
    setFormData(INITIAL_FORM_STATE)
    setStepIds({})
    setSelectedReasons([])
    setSelectedStartType(null)
    setManualMode(false)
    closeNewTrade()
  }

  // Appelle l'Edge Function d'analyse IA pour pré-remplir le formulaire
  const analyserImageSelectionnee = async (url: string) => {
    setAnalysantIA(true)
    console.log("🚀 [TradeDrawer] Lancement de l'analyse IA sur l'image :", url)
    try {
      const response = await supabase.functions.invoke(`analyze?url=${encodeURIComponent(url)}&mode=setup`, {
        method: 'GET'
      })

      if (response.error) throw response.error

      const res = response.data
      console.log('✅ [TradeDrawer] Analyse IA terminée. Résultats :', res)

      // Injecte les données récoltées par l'IA dans les infos globales du formulaire
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
    // Garde-fou : rappel si les données globales n'ont pas été remplies / restent par défaut
    if (!forceSave && globalInfosParDefaut) {
      console.log("⚠️ [TradeDrawer] Infos globales par défaut détectées. Affichage du rappel.")
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

      const tradeIdActuel = isEditMode && editingTrade ? editingTrade.id : tempIds.tradeId

      // 1️⃣ Sauvegarde ou création du Trade
      if (isEditMode && editingTrade) {
        const biaisStep = editingTrade.steps.find((s) => s.type === 'biais')
        const preserveBiaisFields = (biaisStep?.fields ?? null) as Record<string, unknown> | null

        await updateTrade({
          tradeId: editingTrade.id,
          formData,
          stepIds,
          previousStatus: editingTrade.status,
          preserveBiaisFields,
        })
      } else {
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

        // Insertion des étapes
        console.log('📡 [TradeDrawer] Insertion des étapes pour le nouveau trade')
        const stepsToInsert = buildStepPayloads(tempIds.tradeId, formData, {
          biais: tempIds.biais,
          poi: tempIds.poi,
          entry: tempIds.entry,
          result: tempIds.result,
        })

        const { error: stepsInsertError } = await supabase.from('steps').insert(stepsToInsert)
        if (stepsInsertError) throw stepsInsertError
      }

      // 2️⃣ Sauvegarde des raisons techniques dans la table de jointure trade_reasons
      console.log('📡 [TradeDrawer] Sauvegarde des raisons techniques')
      await saveTradeReasons({ tradeId: tradeIdActuel, reasons: selectedReasons })

      // 3️⃣ Sauvegarde des captures d'écran structurées dans la table trade_images
      console.log('📡 [TradeDrawer] Sauvegarde des images structurées')
      const imagesPourSauvegarde = [
        ...(formData.biais_images || []).map((img) => ({
          id: img.id,
          trade_id: tradeIdActuel,
          url: img.url,
          source: img.source,
          phase: img.phase,
          context: 'superieur' as const,
        })),
        ...(formData.poi_images || []).map((img) => ({
          id: img.id,
          trade_id: tradeIdActuel,
          url: img.url,
          source: img.source,
          phase: img.phase,
          context: 'intermediaire' as const,
        })),
        ...(formData.entry_images || []).map((img) => ({
          id: img.id,
          trade_id: tradeIdActuel,
          url: img.url,
          source: img.source,
          phase: img.phase,
          context: 'inferieur' as const,
        })),
      ]
      await saveTradeImages({ tradeId: tradeIdActuel, images: imagesPourSauvegarde })

      await queryClient.invalidateQueries({ queryKey: ['trades'] })
      addToast(isEditMode ? 'Trade mis à jour avec succès !' : 'Le trade a été enregistré avec succès !', 'success')
      
      if (isEditMode && editingTrade) {
        // Recharge le trade complet et réouvre le détail
        const { data: updatedTrade } = await supabase
          .from('trades')
          .select('*, steps(*, step_images(*))')
          .eq('id', editingTrade.id)
          .single()
        if (updatedTrade) openDetail(updatedTrade as any)
      }

      resetAndClose()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la sauvegarde'
      addToast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const enCours = saving || isUpdating || isCreatingQuick || analysantIA

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
        {/* En-tête */}
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
                {editingTrade.pair} · {editingTrade.direction.toUpperCase()} · {editingTrade.date_backtested}
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

        {/* Zone de contenu principale scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* Phase 0A : Drag/Drop d'images initial (Quick entry) */}
          {!isEditMode && !manualMode && (
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
          )}

          {/* Phase 0B : Sélection du point d'entrée du journal */}
          {!isEditMode && manualMode && !selectedStartType && (
            <TradeTypeSelector onSelect={(type) => setSelectedStartType(type)} />
          )}

          {/* Phase 1 : Formulaire principal structuré */}
          {manualMode && selectedStartType && (
            <div className="space-y-4">
              
              {/* Garde-fou visuel (Bannière d'avertissement) */}
              {globalInfosParDefaut && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-500 text-xs flex items-center gap-2">
                  <span>⚠️</span>
                  <span>Les informations globales du trade (Paire, Session, R:R...) semblent être par défaut. Pense à les modifier ou utilise l'assistant IA ci-dessous.</span>
                </div>
              )}

              {/* 1. Informations Globales (Masqué par défaut) */}
              <GlobalInfosPanel
                formData={formData}
                setFormData={setFormData}
                onDefaultStatusChange={(isDef) => setGlobalInfosParDefaut(isDef)}
              />

              {/* 2. Les 3 Panels de section (Biais, POI, Entrée) */}
              <TradeSectionPanel
                sectionKey="biais"
                title="Biais de Marché"
                icon="🧭"
                defaultOpen={selectedStartType === 'bias'}
                formData={formData}
                setFormData={setFormData}
                tradeId={isEditMode && editingTrade ? editingTrade.id : tempIds.tradeId}
                stepId={isEditMode && stepIds.biais ? stepIds.biais : tempIds.biais}
                selectedReasons={selectedReasons}
                setSelectedReasons={setSelectedReasons}
              />

              <TradeSectionPanel
                sectionKey="poi"
                title="Point d'Intérêt (POI)"
                icon="🎯"
                defaultOpen={selectedStartType === 'poi'}
                formData={formData}
                setFormData={setFormData}
                tradeId={isEditMode && editingTrade ? editingTrade.id : tempIds.tradeId}
                stepId={isEditMode && stepIds.poi ? stepIds.poi : tempIds.poi}
                selectedReasons={selectedReasons}
                setSelectedReasons={setSelectedReasons}
              />

              <TradeSectionPanel
                sectionKey="entry"
                title="Prise de Position & Entrée"
                icon="⚡"
                defaultOpen={selectedStartType === 'confirmation'}
                formData={formData}
                setFormData={setFormData}
                tradeId={isEditMode && editingTrade ? editingTrade.id : tempIds.tradeId}
                stepId={isEditMode && stepIds.entry ? stepIds.entry : tempIds.entry}
                selectedReasons={selectedReasons}
                setSelectedReasons={setSelectedReasons}
              />

              {/* 3. Assistant IA (Remplissage rapide si des images existent) */}
              <IAAnalysisPanel
                images={toutesLesImages}
                analysantIA={analysantIA}
                onAnalyze={analyserImageSelectionnee}
              />

            </div>
          )}
        </div>

        {/* Barre d'action inférieure (si le formulaire est actif) */}
        {(isEditMode || (manualMode && selectedStartType)) && (
          <div className="flex justify-end gap-3 px-5 py-4 border-t border-border flex-shrink-0 bg-surface">
            <button
              onClick={resetAndClose}
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
              {saving ? 'Enregistrement...' : isEditMode ? 'Mettre à jour' : 'Enregistrer'}
            </button>
          </div>
        )}

        {/* Dialogue de rappel anti-oubli (garde-fou) */}
        {showRappelDialog && (
          <div className="absolute inset-0 bg-black/85 z-[150] flex items-center justify-center p-6 animate-fadeIn animate-duration-200">
            <div className="bg-surface border border-border rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
              <div className="text-center space-y-2">
                <span className="text-3xl">⚠️</span>
                <h3 className="text-txt font-semibold text-sm">Données non modifiées</h3>
                <p className="text-txt3 text-xs leading-relaxed">
                  Tu t'apprêtes à enregistrer ce trade avec les informations globales par défaut. Es-tu sûr de vouloir continuer ou souhaites-tu d'abord les modifier ?
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  className="w-full py-2 bg-accent text-white hover:bg-accent/90 transition-colors rounded-md text-xs font-semibold text-center"
                >
                  💾 Enregistrer quand même
                </button>
                <button
                  type="button"
                  onClick={() => setShowRappelDialog(false)}
                  className="w-full py-2 bg-surface2 border border-border2 text-txt hover:bg-surface transition-colors rounded-md text-xs font-semibold text-center"
                >
                  Modifier les informations
                </button>
              </div>
            </div>
          </div>
        )}

      </aside>
    </>
  )
}
