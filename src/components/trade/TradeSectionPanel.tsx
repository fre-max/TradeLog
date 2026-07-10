import { useState } from 'react'
import { cn } from '@/lib/utils'
import { FieldGrid, Field, Input, Select } from '@/components/ui/FormHelper'
import { TradeReasonsAccordions } from './TradeReasonsAccordions'
import { ImageField } from '@/components/fields/ImageField'
import type { FormDataState } from '@/lib/tradeForm'
import type { SelectedTradeReason } from '@/hooks/useTradeReasons'

interface TradeSectionPanelProps {
  sectionKey: 'biais' | 'poi' | 'entry'
  title: string
  icon: string
  defaultOpen?: boolean
  formData: FormDataState
  setFormData: React.Dispatch<React.SetStateAction<FormDataState>>
  tradeId: string
  stepId: string
  selectedReasons: SelectedTradeReason[]
  setSelectedReasons: React.Dispatch<React.SetStateAction<SelectedTradeReason[]>>
}

/**
 * Panel représentant une section majeure du trade (Biais, POI ou Entrée).
 * Gère une organisation rigoureuse en deux colonnes/blocs : Avant Position et Après Dénouement.
 * Pas de notes libres : tout se fait via le catalogue ou les champs formulaires précis.
 *
 * Exemple d'utilisation :
 * <TradeSectionPanel
 *   sectionKey="biais"
 *   title="Biais HTF"
 *   icon="🧭"
 *   formData={formData}
 *   setFormData={setFormData}
 *   tradeId="uuid-trade"
 *   stepId="uuid-step-biais"
 *   selectedReasons={selectedReasons}
 *   setSelectedReasons={setSelectedReasons}
 * />
 */
export function TradeSectionPanel({
  sectionKey,
  title,
  icon,
  defaultOpen = false,
  formData,
  setFormData,
  tradeId,
  stepId,
  selectedReasons,
  setSelectedReasons,
}: TradeSectionPanelProps) {
  const [open, setOpen] = useState(defaultOpen)

  // Clé d'images correspondante dans formData (ex: biais_images)
  const imagesKey = `${sectionKey}_images` as const
  const stepImages = (formData as any)[imagesKey] || []

  // Filtre les images d'autres étapes pour permettre la réutilisation
  const toutesLesEtapes = ['biais', 'poi', 'entry']
  const imagesReutilisables = toutesLesEtapes
    .filter((t) => t !== sectionKey)
    .flatMap((t) => (formData as any)[`${t}_images`] || [])
    .filter((img: any, idx: number, self: any[]) => 
      self.findIndex((i) => i.url === img.url) === idx &&
      !stepImages.some((stepImg: any) => stepImg.url === img.url)
    )

  // Met à jour un champ formulaire simple
  const updateField = (key: keyof FormDataState, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  // Ajoute une capture d'écran
  const handleAddImage = (phase: 'avant' | 'apres', url: string) => {
    const nouvelleImage = {
      id: crypto.randomUUID(),
      url,
      source: url.includes('telegram') ? ('telegram' as const) : ('upload' as const),
      phase,
    }
    setFormData((prev: any) => ({
      ...prev,
      [imagesKey]: [...(prev[imagesKey] || []), nouvelleImage],
    }))
  }

  // Supprime une capture d'écran
  const handleRemoveImage = (id: string) => {
    setFormData((prev: any) => ({
      ...prev,
      [imagesKey]: (prev[imagesKey] || []).filter((img: any) => img.id !== id),
    }))
  }

  return (
    <div className="border border-border2 rounded-xl overflow-hidden bg-surface mb-3 transition-all">
      {/* ─── Header Toggle Section ──────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-surface2 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[16px] leading-none">{icon}</span>
          <span className="text-[13.5px] font-bold text-txt">{title}</span>
          <span className="text-[10px] text-txt3 uppercase tracking-wider font-semibold">
            {sectionKey === 'entry' ? 'Exécution' : 'Analyse'}
          </span>
        </div>
        <span className={cn('text-txt3 text-[10px] transition-transform duration-200', open && 'rotate-180')}>
          ▼
        </span>
      </button>

      {/* ─── Contenu Déroulable ─────────────────────────────── */}
      {open && (
        <div className="p-5 bg-surface2 border-t border-border2 space-y-6 animate-slideDown">
          
          {/* ──────────────────────────────────────────────────────── */}
          {/* 🟢 PHASE 1 : AVANT LA POSITION                          */}
          {/* ──────────────────────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border/40 pb-2">
              <span className="text-emerald-500 text-xs">🟢</span>
              <h3 className="text-xs font-bold text-txt uppercase tracking-wider">Planification (Avant Position)</h3>
            </div>

            {/* Champs spécifiques selon le type de section */}
            {sectionKey === 'biais' && (
              <FieldGrid>
                <Field label="Timeframe du Biais">
                  <Select
                    value={formData.biais_timeframe}
                    onChange={(e) => updateField('biais_timeframe', e.target.value)}
                  >
                    {/* Monthly et W1 ajoutés pour les analyses sur grands timeframes */}
                    {['Monthly', 'W1', 'D1', 'H4', 'H1', 'M30', 'M15'].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Orientation du Biais">
                  <Select
                    value={formData.biais_direction}
                    onChange={(e) => updateField('biais_direction', e.target.value)}
                  >
                    <option value="Haussier">🐂 Haussier (Bullish)</option>
                    <option value="Baissier">🐻 Baissier (Bearish)</option>
                    <option value="Neutre">⚖️ Neutre (Ranging)</option>
                  </Select>
                </Field>
              </FieldGrid>
            )}

            {sectionKey === 'poi' && (
              <FieldGrid>
                <Field label="Timeframe du POI">
                  <Select
                    value={formData.poi_timeframe}
                    onChange={(e) => updateField('poi_timeframe', e.target.value)}
                  >
                    {['D1', 'H4', 'H1', 'M30', 'M15', 'M5'].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Type de Zone / POI">
                  <Select
                    value={formData.poi_type}
                    onChange={(e) => updateField('poi_type', e.target.value)}
                  >
                    {['Order Block', 'FVG / Inbalance', 'Liquidity Pool', 'S&R / Support', 'Breaker Block', 'Autre'].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </Select>
                </Field>
              </FieldGrid>
            )}

            {sectionKey === 'entry' && (
              <div className="space-y-3">
                <FieldGrid>
                  <Field label="Timeframe d'Entrée">
                    <Select
                      value={formData.entry_timeframe}
                      onChange={(e) => updateField('entry_timeframe', e.target.value)}
                    >
                      {/* H1, H4 et D1 ajoutés pour les confirmations sur grands timeframes */}
                      {['D1', 'H4', 'H1', 'M30', 'M15', 'M5', 'M3', 'M1'].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Setup / Modèle d'Entrée">
                    <Input
                      type="text"
                      placeholder="Ex: CHoCH, BOS, Flip..."
                      value={formData.entry_setup}
                      onChange={(e) => updateField('entry_setup', e.target.value)}
                    />
                  </Field>
                </FieldGrid>

                <FieldGrid>
                  <Field label="Prix d'Entrée">
                    <Input
                      type="number"
                      step="0.00001"
                      placeholder="0.00000"
                      value={formData.entry_price}
                      onChange={(e) => updateField('entry_price', e.target.value)}
                    />
                  </Field>
                  <Field label="Stop Loss (SL)">
                    <Input
                      type="number"
                      step="0.00001"
                      placeholder="0.00000"
                      value={formData.entry_sl}
                      onChange={(e) => updateField('entry_sl', e.target.value)}
                    />
                  </Field>
                </FieldGrid>

                <FieldGrid>
                  <Field label="Take Profit (TP)">
                    <Input
                      type="number"
                      step="0.00001"
                      placeholder="0.00000"
                      value={formData.entry_tp}
                      onChange={(e) => updateField('entry_tp', e.target.value)}
                    />
                  </Field>
                  <Field label="Trailing Stop (Pips)">
                    <Input
                      type="text"
                      placeholder="Ex: 15 pips"
                      value={formData.entry_trailing}
                      onChange={(e) => updateField('entry_trailing', e.target.value)}
                    />
                  </Field>
                </FieldGrid>
              </div>
            )}

            {/* Catalogue de Raisons - Avant */}
            <div className="space-y-1">
              <label className="text-txt3 text-[10px] font-bold uppercase tracking-wider">Concepts Validés (Avant)</label>
              <TradeReasonsAccordions
                selectedReasonIds={selectedReasons.map((r) => r.reason_id)}
                onChange={(ids) => {
                  // Met à jour les IDs
                }}
                selectedReasons={selectedReasons}
                onChangeReasons={setSelectedReasons}
                familySlug={`${sectionKey}_avant`}
              />
            </div>

            {/* Captures d'Écran - Avant */}
            <div className="space-y-2">
              <label className="text-txt3 text-[10px] font-bold uppercase tracking-wider block">Captures Graphiques (Avant)</label>
              <StepImagePanel
                phase="avant"
                tradeId={tradeId}
                stepId={stepId}
                images={stepImages}
                onAddImage={handleAddImage}
                onRemoveImage={handleRemoveImage}
                imagesReutilisables={imagesReutilisables}
              />
            </div>
          </div>

          {/* ──────────────────────────────────────────────────────── */}
          {/* 🔴 PHASE 2 : APRÈS LE DÉNOUEMENT                         */}
          {/* ──────────────────────────────────────────────────────── */}
          <div className="space-y-4 pt-4 border-t border-border/40">
            <div className="flex items-center gap-2 border-b border-border/40 pb-2">
              <span className="text-loss text-xs">🔴</span>
              <h3 className="text-xs font-bold text-txt uppercase tracking-wider">Déroulement (Après Dénouement)</h3>
            </div>

            {/* Catalogue de Raisons - Après */}
            <div className="space-y-1">
              <label className="text-txt3 text-[10px] font-bold uppercase tracking-wider">Observations / Comportement (Après)</label>
              <TradeReasonsAccordions
                selectedReasonIds={selectedReasons.map((r) => r.reason_id)}
                onChange={(ids) => {
                  // Met à jour les IDs
                }}
                selectedReasons={selectedReasons}
                onChangeReasons={setSelectedReasons}
                familySlug={`${sectionKey}_apres`}
              />
            </div>

            {/* Captures d'Écran - Après */}
            <div className="space-y-2">
              <label className="text-txt3 text-[10px] font-bold uppercase tracking-wider block">Captures Réelles / Résultats (Après)</label>
              <StepImagePanel
                phase="apres"
                tradeId={tradeId}
                stepId={stepId}
                images={stepImages}
                onAddImage={handleAddImage}
                onRemoveImage={handleRemoveImage}
                imagesReutilisables={imagesReutilisables}
              />
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

interface StepImagePanelProps {
  phase: 'avant' | 'apres'
  tradeId: string
  stepId: string
  images: any[]
  onAddImage: (phase: 'avant' | 'apres', url: string) => void
  onRemoveImage: (id: string) => void
  imagesReutilisables?: any[]
}

// Sous-composant pour afficher la galerie et les uploads d'images par phase
function StepImagePanel({
  phase,
  tradeId,
  stepId,
  images,
  onAddImage,
  onRemoveImage,
  imagesReutilisables,
}: StepImagePanelProps) {
  const imagesFiltrees = images.filter((img) => img.phase === phase)

  return (
    <div className="p-3.5 bg-surface2 border border-border2 rounded-lg space-y-3">
      {/* Galerie Miniature */}
      {imagesFiltrees.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {imagesFiltrees.map((img) => (
            <div key={img.id} className="relative group aspect-video rounded-md overflow-hidden border border-border bg-surface2">
              <img src={img.url} className="w-full h-full object-cover" alt="Capture d'écran" loading="lazy" />
              <button
                type="button"
                onClick={() => onRemoveImage(img.id)}
                className="absolute top-1.5 right-1.5 bg-loss text-white rounded-full w-4.5 h-4.5 flex items-center justify-center text-[9px] font-bold hover:scale-110 shadow-md transition-transform"
                title="Supprimer la capture"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Zone Upload Fichier */}
      {tradeId && stepId ? (
        <div className="space-y-3">
          <ImageField
            tradeId={tradeId}
            stepId={stepId}
            onUpload={(url) => onAddImage(phase, url)}
          />

          {/* Réutilisation d'images */}
          {imagesReutilisables && imagesReutilisables.length > 0 && (
            <div className="pt-2 border-t border-border/10">
              <p className="text-[10px] text-txt3 font-semibold uppercase tracking-wider mb-1.5">
                🔗 Lier une capture existante de ce trade :
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
                {imagesReutilisables.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => onAddImage(phase, img.url)}
                    className="relative w-[65px] aspect-video rounded border border-border2 overflow-hidden hover:border-accent hover:scale-105 transition-all flex-shrink-0 bg-surface"
                    title="Cliquer pour lier cette capture"
                  >
                    <img src={img.url} className="w-full h-full object-cover" alt="Miniature" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-txt3 italic">Sauvegarde en cours...</p>
      )}
    </div>
  )
}
