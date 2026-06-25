import { useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { useTradeStats, type StatsGroupe } from '@/hooks/useTradeStats'
import { useTrades } from '@/hooks/useTrades'
import { useCatalog } from '@/hooks/useCatalog'
import type { TradeWithSteps, ReasonCatalogItem } from '@/types'
import { Skeleton, SkeletonLine } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

// ─── Onglets de breakdown ─────────────────────────────────
const BREAKDOWN_TABS = [
  { key: 'paire', label: 'Par Paire' },
  { key: 'session', label: 'Par Session' },
  { key: 'setup', label: 'Par Setup' },
  { key: 'emotion', label: 'Par Émotion' },
  { key: 'reasons', label: '📊 Efficience Raisons (Catalogue)' },
] as const

type BreakdownKey = (typeof BREAKDOWN_TABS)[number]['key']

// Traduction des types du catalogue
const TYPE_LABELS: Record<string, string> = {
  biais: 'Biais',
  poi: 'POI / Zone',
  entry: 'Entrée',
  sl: 'Stop Loss',
  tp: 'Take Profit',
  trailing: 'Trailing Stop',
  confirmation: 'Confirmation',
}

// ─── Page Statistiques ────────────────────────────────────
// Affiche les métriques globales + breakdowns par catégorie
// Utilise useTradeStats() pour les calculs

export default function Stats() {
  const { globales, parPaire, parSession, parSetup, parEmotion, isLoading } = useTradeStats()
  const { data: trades = [], isLoading: tradesLoading } = useTrades()
  const { data: catalogItems = [], isLoading: catalogLoading } = useCatalog()
  const [activeTab, setActiveTab] = useState<BreakdownKey>('paire')

  // Sélectionner les données du breakdown actif
  const breakdownData: Record<Exclude<BreakdownKey, 'reasons'>, StatsGroupe[]> = {
    paire: parPaire,
    session: parSession,
    setup: parSetup,
    emotion: parEmotion,
  }
  const donneesActives = activeTab !== 'reasons' ? breakdownData[activeTab] : []

  // ─── Calcul de l'Efficience des Raisons du Catalogue ────────────────
  const calculerEfficienceRaisons = () => {
    const statsMap = new Map<string, {
      title: string
      variant: string
      type: string
      count: number
      wins: number
      losses: number
      be: number
      rrSum: number
    }>()

    trades.forEach((trade: TradeWithSteps) => {
      const reasonsDuTrade: { reason_id: string; variant_name: string }[] = []

      trade.steps.forEach((step: any) => {
        const fields = (step.fields ?? {}) as Record<string, any>
        if (step.type === 'biais' || step.type === 'poi') {
          const list = fields.catalog_reasons ?? []
          if (Array.isArray(list)) {
            list.forEach((r: any) => {
              if (r.reason_id) reasonsDuTrade.push(r)
            })
          }
        } else if (step.type === 'entry') {
          const cat = fields.catalog_reasons ?? {}
          if (cat && typeof cat === 'object') {
            Object.values(cat).forEach((list: any) => {
              if (Array.isArray(list)) {
                list.forEach((r: any) => {
                  if (r.reason_id) reasonsDuTrade.push(r)
                })
              }
            })
          }
        }
      })

      // Dédupliquer les concepts identiques sur un même trade
      const clesUniques = new Set<string>()
      const uniqueReasons: typeof reasonsDuTrade = []
      reasonsDuTrade.forEach((r: any) => {
        const cle = `${r.reason_id}-${r.variant_name}`
        if (!clesUniques.has(cle)) {
          clesUniques.add(cle)
          uniqueReasons.push(r)
        }
      })

      // Remplir la map
      uniqueReasons.forEach((r: any) => {
        const catalogItem = catalogItems.find((item: ReasonCatalogItem) => item.id === r.reason_id)
        if (!catalogItem) return

        const cle = `${r.reason_id}-${r.variant_name}`
        const exist = statsMap.get(cle) ?? {
          title: catalogItem.title,
          variant: r.variant_name,
          type: catalogItem.type,
          count: 0,
          wins: 0,
          losses: 0,
          be: 0,
          rrSum: 0,
        }

        exist.count += 1
        if (trade.result === 'win') exist.wins += 1
        else if (trade.result === 'loss') exist.losses += 1
        else if (trade.result === 'breakeven') exist.be += 1

        if (trade.rr_realized != null) {
          exist.rrSum += trade.rr_realized
        }

        statsMap.set(cle, exist)
      })
    })

    return Array.from(statsMap.values()).map((s) => {
      const winRate = s.count > 0 ? Math.round((s.wins / s.count) * 100) : 0
      const expectancy = s.count > 0 ? parseFloat((s.rrSum / s.count).toFixed(2)) : 0
      return {
        ...s,
        winRate,
        expectancy,
      }
    }).sort((a, b) => b.count - a.count)
  }

  // ─── Calcul de l'analyse des confluences multiples (Combinaisons de 2 raisons) ───
  const calculerCombinaisonsEfficience = () => {
    const combinaisonsMap = new Map<string, {
      nomA: string
      nomB: string
      count: number
      wins: number
      losses: number
      be: number
      rrSum: number
    }>()

    trades.forEach((trade: TradeWithSteps) => {
      const reasonsDuTrade: string[] = []

      trade.steps.forEach((step: any) => {
        const fields = (step.fields ?? {}) as Record<string, any>
        if (step.type === 'biais' || step.type === 'poi') {
          const list = fields.catalog_reasons ?? []
          if (Array.isArray(list)) {
            list.forEach((r: any) => {
              if (r.reason_id) {
                const item = catalogItems.find((ci: ReasonCatalogItem) => ci.id === r.reason_id)
                if (item) reasonsDuTrade.push(`${item.title} (${r.variant_name})`)
              }
            })
          }
        } else if (step.type === 'entry') {
          const cat = fields.catalog_reasons ?? {}
          if (cat && typeof cat === 'object') {
            Object.values(cat).forEach((list: any) => {
              if (Array.isArray(list)) {
                list.forEach((r: any) => {
                  if (r.reason_id) {
                    const item = catalogItems.find((ci: ReasonCatalogItem) => ci.id === r.reason_id)
                    if (item) reasonsDuTrade.push(`${item.title} (${r.variant_name})`)
                  }
                })
              }
            })
          }
        }
      })

      const uniqueNames = Array.from(new Set(reasonsDuTrade)).sort()

      for (let i = 0; i < uniqueNames.length; i++) {
        for (let j = i + 1; j < uniqueNames.length; j++) {
          const nomA = uniqueNames[i]
          const nomB = uniqueNames[j]
          const cle = `${nomA} + ${nomB}`

          const exist = combinaisonsMap.get(cle) ?? {
            nomA,
            nomB,
            count: 0,
            wins: 0,
            losses: 0,
            be: 0,
            rrSum: 0,
          }

          exist.count += 1
          if (trade.result === 'win') exist.wins += 1
          else if (trade.result === 'loss') exist.losses += 1
          else if (trade.result === 'breakeven') exist.be += 1

          if (trade.rr_realized != null) {
            exist.rrSum += trade.rr_realized
          }

          combinaisonsMap.set(cle, exist)
        }
      }
    })

    return Array.from(combinaisonsMap.entries())
      .map(([cle, data]) => {
        const winRate = data.count > 0 ? Math.round((data.wins / data.count) * 100) : 0
        const expectancy = data.count > 0 ? parseFloat((data.rrSum / data.count).toFixed(2)) : 0
        return {
          combinaison: cle,
          ...data,
          winRate,
          expectancy,
        }
      })
      .filter((c) => c.count >= 2)
      .sort((a, b) => b.count - a.count)
  }

  const effRaisons = activeTab === 'reasons' ? calculerEfficienceRaisons() : []
  const effCombinaisons = activeTab === 'reasons' ? calculerCombinaisonsEfficience() : []
  const chargementCatalogue = tradesLoading || catalogLoading

  return (
    <AppLayout title="Statistiques">
      <div className="flex-1 overflow-y-auto p-4 md:p-6">

        {/* ─── Section 1 : Métriques globales ──────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <MetricCard
            label="Win Rate"
            value={isLoading ? null : `${globales.winRate}%`}
            icon="🎯"
            color={globales.winRate >= 50 ? 'text-win' : 'text-loss'}
          />
          <MetricCard
            label="Expectancy"
            value={isLoading ? null : `${globales.expectancy > 0 ? '+' : ''}${globales.expectancy}R`}
            icon="📈"
            color={globales.expectancy >= 0 ? 'text-win' : 'text-loss'}
          />
          <MetricCard
            label="Moy. R:R"
            value={isLoading ? null : `${globales.moyenneRR}R`}
            icon="⚖️"
            color="text-accent"
          />
          <MetricCard
            label="Total Trades"
            value={isLoading ? null : String(globales.totalTrades)}
            icon="📋"
            subtitle={
              isLoading
                ? undefined
                : `${globales.totalWins}W / ${globales.totalLosses}L / ${globales.totalBE}BE`
            }
          />
        </div>

        {/* ─── Section 2 : Breakdowns ──────────────────────── */}
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {/* Onglets */}
          <div className="flex border-b border-border overflow-x-auto">
            {BREAKDOWN_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-4 py-3 text-[13px] font-medium whitespace-nowrap border-b-2 transition-colors',
                  activeTab === tab.key
                    ? 'text-accent border-accent'
                    : 'text-txt2 border-transparent hover:text-txt hover:bg-surface2'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tableau de breakdown ou Écran d'analyse du Catalogue */}
          {activeTab !== 'reasons' ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2.5 text-left text-[11.5px] font-medium text-txt3 uppercase tracking-wider">Nom</th>
                    <th className="px-4 py-2.5 text-left text-[11.5px] font-medium text-txt3 uppercase tracking-wider">Trades</th>
                    <th className="px-4 py-2.5 text-left text-[11.5px] font-medium text-txt3 uppercase tracking-wider">Wins</th>
                    <th className="px-4 py-2.5 text-left text-[11.5px] font-medium text-txt3 uppercase tracking-wider">Losses</th>
                    <th className="px-4 py-2.5 text-left text-[11.5px] font-medium text-txt3 uppercase tracking-wider">Win Rate</th>
                    <th className="px-4 py-2.5 text-left text-[11.5px] font-medium text-txt3 uppercase tracking-wider">Avg R:R</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Skeleton pendant le chargement */}
                  {isLoading && [1, 2, 3, 4].map((i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="px-4 py-3"><SkeletonLine width="w-20" /></td>
                      <td className="px-4 py-3"><SkeletonLine width="w-8" /></td>
                      <td className="px-4 py-3"><SkeletonLine width="w-8" /></td>
                      <td className="px-4 py-3"><SkeletonLine width="w-8" /></td>
                      <td className="px-4 py-3"><SkeletonLine width="w-12" /></td>
                      <td className="px-4 py-3"><SkeletonLine width="w-12" /></td>
                    </tr>
                  ))}

                  {/* Données réelles */}
                  {!isLoading && donneesActives.map((groupe) => (
                    <tr key={groupe.nom} className="border-b border-border hover:bg-surface2 transition-colors">
                      <td className="px-4 py-3 text-[13.5px] text-txt font-medium">{groupe.nom}</td>
                      <td className="px-4 py-3 text-[13.5px] text-txt2">{groupe.totalTrades}</td>
                      <td className="px-4 py-3 text-[13.5px] text-win">{groupe.wins}</td>
                      <td className="px-4 py-3 text-[13.5px] text-loss">{groupe.losses}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'text-[13.5px] font-medium',
                            groupe.winRate >= 50 ? 'text-win' : 'text-loss'
                          )}>
                            {groupe.winRate}%
                          </span>
                          <div className="w-16 h-1.5 bg-bg rounded-full overflow-hidden hidden md:block">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                groupe.winRate >= 50 ? 'bg-win' : 'bg-loss'
                              )}
                              style={{ width: `${groupe.winRate}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13.5px] text-accent font-medium">
                        {groupe.moyenneRR > 0 ? '+' : ''}{groupe.moyenneRR}R
                      </td>
                    </tr>
                  ))}

                  {/* Aucune donnée */}
                  {!isLoading && donneesActives.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-txt3 text-sm">
                        Aucune donnée disponible — ajoutez des trades pour voir les statistiques
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* 📊 ÉCRAN D'ANALYSE D'EFFICIENCE DU CATALOGUE TECHNIQUE */
            <div className="p-4 md:p-6 space-y-6 bg-surface">
              
              {/* 📖 CARTE D'EXPLICATIONS PÉDAGOGIQUES (Pour guider l'user) */}
              <div className="bg-accent/5 border border-accent/15 rounded-xl p-5">
                <h4 className="text-accent text-[13.5px] font-semibold flex items-center gap-2">
                  <span>ℹ️</span> Comment fonctionne l'analyse d'efficience ?
                </h4>
                <p className="text-txt2 text-[12.5px] mt-2 leading-relaxed">
                  Cette section extrait et croise les concepts de ton **catalogue technique** associés à tes trades fermés pour isoler scientifiquement ce qui fonctionne.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-3.5 border-t border-border">
                  <div>
                    <span className="text-[10px] font-bold text-txt3 uppercase tracking-wider block">1. Extraction</span>
                    <span className="text-txt text-xs mt-1 block">Récupération des tags rattachés à chaque étape du trade (Biais, POI, SL, Entrée).</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-txt3 uppercase tracking-wider block">2. Efficience unitaire</span>
                    <span className="text-txt text-xs mt-1 block">Calcul individuel du Win Rate et du R:R moyen réalisé pour chaque variante technique.</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-txt3 uppercase tracking-wider block">3. Confluences multiples</span>
                    <span className="text-txt text-xs mt-1 block">Analyse des paires de concepts se produisant sur un même trade pour mesurer leur synergie.</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-txt3 uppercase tracking-wider block">4. Stratégie</span>
                    <span className="text-txt text-xs mt-1 block">Identification des configurations optimales à reproduire et des facteurs à éviter.</span>
                  </div>
                </div>
              </div>

              {/* Loader */}
              {chargementCatalogue && (
                <div className="py-12 text-center text-txt3 text-xs animate-pulse">
                  Calcul des confluences et extraction statistique...
                </div>
              )}

              {/* Aucun trade rattaché */}
              {!chargementCatalogue && effRaisons.length === 0 && (
                <div className="py-12 text-center text-txt3 text-xs">
                  Aucun concept technique du catalogue n'a encore été associé à tes trades.<br />
                  <span className="block mt-1 text-[11px]">Édite un trade du journal et associe-y des concepts du catalogue pour commencer à collecter des statistiques.</span>
                </div>
              )}

              {!chargementCatalogue && effRaisons.length > 0 && (
                <div className="space-y-6">
                  {/* 🚀 INSIGHTS (Meilleures confluences / Facteurs de perte) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Points forts */}
                    <div className="bg-win/5 border border-win/15 rounded-xl p-4.5">
                      <h5 className="text-win text-xs font-semibold flex items-center gap-1.5 uppercase tracking-wide">
                        🔥 Confluences Fortes (Taux {'>'}= 50%)
                      </h5>
                      <div className="mt-3 space-y-2">
                        {effRaisons.filter(r => r.winRate >= 50).slice(0, 3).map((r, i) => (
                          <div key={i} className="flex justify-between items-center text-xs">
                            <span className="text-txt font-medium">{r.title} <span className="text-txt3 text-[10px] uppercase font-bold bg-bg px-1 rounded">{r.variant}</span></span>
                            <span className="text-win font-semibold">{r.winRate}% WR ({r.count} Tr.)</span>
                          </div>
                        ))}
                        {effRaisons.filter(r => r.winRate >= 50).length === 0 && (
                          <span className="text-txt3 text-xs block italic">Aucune donnée significative trouvée pour le moment.</span>
                        )}
                      </div>
                    </div>

                    {/* Points faibles */}
                    <div className="bg-loss/5 border border-loss/15 rounded-xl p-4.5">
                      <h5 className="text-loss text-xs font-semibold flex items-center gap-1.5 uppercase tracking-wide">
                        ⚠️ Facteurs de Perte (Taux {'<'} 50%)
                      </h5>
                      <div className="mt-3 space-y-2">
                        {effRaisons.filter(r => r.winRate < 50).slice(0, 3).map((r, i) => (
                          <div key={i} className="flex justify-between items-center text-xs">
                            <span className="text-txt font-medium">{r.title} <span className="text-txt3 text-[10px] uppercase font-bold bg-bg px-1 rounded">{r.variant}</span></span>
                            <span className="text-loss font-semibold">{r.winRate}% WR ({r.count} Tr.)</span>
                          </div>
                        ))}
                        {effRaisons.filter(r => r.winRate < 50).length === 0 && (
                          <span className="text-txt3 text-xs block italic">Aucun signal de perte critique récurrent détecté. Félicitations !</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* TABLEAU DES STATISTIQUES UNITAIRES */}
                  <div>
                    <h5 className="text-txt text-xs font-semibold uppercase tracking-wider mb-3">
                      Efficience individuelle par concept
                    </h5>
                    <div className="overflow-x-auto border border-border/80 rounded-lg">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b border-border bg-surface2/30">
                            <th className="px-4 py-2 text-left text-[11px] font-bold text-txt3 uppercase">Concept</th>
                            <th className="px-4 py-2 text-left text-[11px] font-bold text-txt3 uppercase">Variante</th>
                            <th className="px-4 py-2 text-left text-[11px] font-bold text-txt3 uppercase">Usage</th>
                            <th className="px-4 py-2 text-left text-[11px] font-bold text-txt3 uppercase">Trades (W/L/BE)</th>
                            <th className="px-4 py-2 text-left text-[11px] font-bold text-txt3 uppercase">Win Rate</th>
                            <th className="px-4 py-2 text-left text-[11px] font-bold text-txt3 uppercase">Espérance R:R</th>
                          </tr>
                        </thead>
                        <tbody>
                          {effRaisons.map((r, idx) => (
                            <tr key={idx} className="border-b border-border/40 hover:bg-surface2/40 transition-colors">
                              <td className="px-4 py-2.5 text-xs text-txt font-medium">
                                <span className="text-txt3 text-[9px] uppercase font-bold mr-1.5 px-1 bg-border rounded">
                                  {TYPE_LABELS[r.type] || r.type}
                                </span>
                                {r.title}
                              </td>
                              <td className="px-4 py-2.5 text-xs text-txt2 font-semibold uppercase">{r.variant}</td>
                              <td className="px-4 py-2.5 text-xs text-txt3">{r.count} fois</td>
                              <td className="px-4 py-2.5 text-xs text-txt2">
                                <span className="text-win">{r.wins}W</span> / <span className="text-loss">{r.losses}L</span> / <span className="text-be">{r.be}BE</span>
                              </td>
                              <td className="px-4 py-2.5 text-xs font-bold">
                                <span className={r.winRate >= 50 ? 'text-win' : 'text-loss'}>{r.winRate}%</span>
                              </td>
                              <td className="px-4 py-2.5 text-xs font-bold text-accent">
                                {r.expectancy > 0 ? '+' : ''}{r.expectancy}R
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ANALYSE DES COMBINAISONS (CONFLUENCES MULTIPLES) */}
                  {effCombinaisons.length > 0 && (
                    <div className="pt-4 border-t border-border">
                      <h5 className="text-txt text-xs font-semibold uppercase tracking-wider mb-2.5">
                        Multi-Confluences (Synergies de 2 concepts)
                      </h5>
                      <p className="text-txt3 text-[11px] mb-3">
                        Cette table montre comment se comportent les trades lorsque deux concepts précis sont validés simultanément. (Min. 2 occurrences requis)
                      </p>
                      <div className="overflow-x-auto border border-border/80 rounded-lg">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b border-border bg-surface2/30">
                              <th className="px-4 py-2 text-left text-[11px] font-bold text-txt3 uppercase">Synergie</th>
                              <th className="px-4 py-2 text-left text-[11px] font-bold text-txt3 uppercase">Usage</th>
                              <th className="px-4 py-2 text-left text-[11px] font-bold text-txt3 uppercase">Trades (W/L/BE)</th>
                              <th className="px-4 py-2 text-left text-[11px] font-bold text-txt3 uppercase">Win Rate</th>
                              <th className="px-4 py-2 text-left text-[11px] font-bold text-txt3 uppercase">Espérance R:R</th>
                            </tr>
                          </thead>
                          <tbody>
                            {effCombinaisons.map((c, idx) => (
                              <tr key={idx} className="border-b border-border/40 hover:bg-surface2/40 transition-colors">
                                <td className="px-4 py-2.5 text-xs text-txt font-medium flex flex-wrap gap-1">
                                  <span className="text-accent bg-accent/5 px-2 py-0.5 rounded border border-accent/20">{c.nomA}</span>
                                  <span className="text-txt3 text-[10px] self-center">+</span>
                                  <span className="text-accent bg-accent/5 px-2 py-0.5 rounded border border-accent/20">{c.nomB}</span>
                                </td>
                                <td className="px-4 py-2.5 text-xs text-txt3">{c.count} fois</td>
                                <td className="px-4 py-2.5 text-xs text-txt2">
                                  <span className="text-win">{c.wins}W</span> / <span className="text-loss">{c.losses}L</span> / <span className="text-be">{c.be}BE</span>
                                </td>
                                <td className="px-4 py-2.5 text-xs font-bold">
                                  <span className={c.winRate >= 50 ? 'text-win' : 'text-loss'}>{c.winRate}%</span>
                                </td>
                                <td className="px-4 py-2.5 text-xs font-bold text-accent">
                                  {c.expectancy > 0 ? '+' : ''}{c.expectancy}R
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

// ─── Carte de métrique ────────────────────────────────────
// Affiche une métrique clé (win rate, expectancy, etc.)
// Avec skeleton si value est null

interface MetricCardProps {
  label: string
  value: string | null
  icon: string
  color?: string
  subtitle?: string
}

function MetricCard({ label, value, icon, color, subtitle }: MetricCardProps) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-2">
      {/* Header avec icône */}
      <div className="flex items-center justify-between">
        <span className="text-txt3 text-[11.5px] font-medium uppercase tracking-wider">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>

      {/* Valeur principale */}
      {value === null ? (
        <Skeleton className="w-20 h-7" />
      ) : (
        <span className={cn('text-2xl font-bold tracking-tight', color ?? 'text-txt')}>
          {value}
        </span>
      )}

      {/* Sous-texte optionnel */}
      {subtitle && (
        <span className="text-txt3 text-[11.5px]">{subtitle}</span>
      )}
    </div>
  )
}
