import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useBacktestStore } from '@/store/backtestStore';
import { recupererDonneesBinance, parserCsvPrix } from '@/lib/chartDataHelper';
import { BacktestChart } from './BacktestChart';
import { useUIStore } from '@/store';
import type { PositionSimulee } from '@/store/backtestStore';

// ─── Définition de tous les outils de la barre latérale ───────────────────────
// Chaque outil correspond exactement au type string attendu par getToolRegistry().createDrawing()
// id: null = mode curseur (sélection/déplacement des dessins existants)
const OUTILS_TRACAGE = [
  { group: 'Curseur', items: [
    // L'outil souris (id=null) active le mode "Sélection" géré par le DrawingManager
    { id: null, label: 'CURSOR', title: 'Curseur — Sélectionner et déplacer les dessins (aucun tracé)' },
  ]},
  { group: 'Lignes', items: [
    { id: 'trend-line',       label: 'LINE',  title: 'Ligne de Tendance — 2 clics : point A puis point B' },
    { id: 'horizontal-line', label: 'H',     title: 'Ligne Horizontale — 1 clic : un seul point suffit' },
    { id: 'ray',             label: 'RAY',   title: 'Rayon — 2 clics : origine puis direction' },
    { id: 'extended-line',   label: 'EXT',   title: 'Ligne Étendue — 2 clics : s\'étend à l\'infini' },
    { id: 'vertical-line',   label: 'V',     title: 'Ligne Verticale — 1 clic : un seul point suffit' },
  ]},
  { group: 'Formes', items: [
    { id: 'rectangle',       label: 'RECT',  title: 'Rectangle / Zone POI — 2 clics : coin supérieur puis inférieur' },
  ]},
  { group: 'Fibonacci', items: [
    { id: 'fib-retracement', label: 'FIB',   title: 'Fibonacci Retracement — 2 clics : sommet puis creux (ou inverse)' },
  ]},
  { group: 'Trading', items: [
    { id: 'long-position',   label: 'LONG',  title: 'Position Long ▲ — 3 clics : 1. Entrée  2. Take Profit  3. Stop Loss' },
    { id: 'short-position',  label: 'SHORT', title: 'Position Short ▼ — 3 clics : 1. Entrée  2. Stop Loss  3. Take Profit' },
  ]},
];

// Timeframes disponibles pour l'API Binance
const TIMEFRAMES = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '1d', value: '1d' },
];

// Actifs disponibles (Crypto Binance — API publique gratuite)
const ACTIFS = [
  { label: 'BTC/USDT', value: 'BTCUSDT' },
  { label: 'ETH/USDT', value: 'ETHUSDT' },
  { label: 'SOL/USDT', value: 'SOLUSDT' },
  { label: 'BNB/USDT', value: 'BNBUSDT' },
  { label: 'XRP/USDT', value: 'XRPUSDT' },
];

// ─── Palettes de couleurs du Workspace selon le thème ─────────────────────────
// Miroir des couleurs TradingView (sombre / clair)
function getThemeClasses(theme: 'dark' | 'light') {
  const dark = theme === 'dark';
  return {
    bgWorkspace: dark ? 'bg-[#131722] text-[#b2b5be]' : 'bg-white text-[#131722]',
    bgHeader:    dark ? 'bg-[#1e222d] border-[#2a2e39]' : 'bg-[#f0f3fa] border-[#e0e3eb]',
    bgSidebar:   dark ? 'bg-[#1e222d] border-[#2a2e39]' : 'bg-[#f8f9fd] border-[#e0e3eb]',
    bgPanel:     dark ? 'bg-[#1e222d] border-[#2a2e39]' : 'bg-[#f8f9fd] border-[#e0e3eb]',
    textMuted:   dark ? 'text-[#787b86]' : 'text-[#434651]',
    textNormal:  dark ? 'text-[#d1d4dc]' : 'text-[#131722]',
    btnBase:     dark
      ? 'text-[#787b86] hover:bg-[#2a2e39] hover:text-[#d1d4dc]'
      : 'text-[#434651] hover:bg-[#e0e3eb] hover:text-[#131722]',
    btnActive:   'bg-[#2962ff] text-white shadow-md',
    separator:   dark ? 'bg-[#2a2e39]' : 'bg-[#e0e3eb]',
    select:      dark
      ? 'bg-[#2a2e39] text-[#d1d4dc]'
      : 'bg-white border border-[#e0e3eb] text-[#131722]',
    inputBg:     dark ? 'bg-[#131722]' : 'bg-white',
    divider:     dark ? 'divide-[#2a2e39]' : 'divide-[#e0e3eb]',
    border:      dark ? 'border-[#2a2e39]' : 'border-[#e0e3eb]',
    hoverRow:    dark ? 'hover:bg-[#131722]' : 'hover:bg-[#f0f3fa]',
    helpText:    dark ? 'text-[#4a4e5a]' : 'text-[#9598a1]',
    kbdBg:       dark ? 'bg-[#2a2e39]' : 'bg-[#e0e3eb]',
    errBg:       'bg-red-900/30 border-red-700/40 text-red-400',
  };
}

/**
 * Workspace de Backtesting complet — reproduit l'environnement de TradingView Replay.
 * 
 * Fonctionnalités :
 *  - Graphique interactif avec outils de dessin (trend-line, rectangle, fib, positions...)
 *  - Replay bougie par bougie avec contrôles Play/Pause
 *  - Thème clair / sombre (style TradingView)
 *  - Mode plein écran (Esc pour quitter)
 *  - Importation CSV et chargement Binance
 *  - Export des trades simulés vers le Journal
 *  - Raccourcis clavier (Espace, →, Esc)
 */
export function BacktestWorkspace() {

  // ─── États locaux ────────────────────────────────────────────────────────────
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [outilActif, setOutilActif] = useState<string | null>(null);
  const [symbole, setSymbole] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1h');
  const [estPleinEcran, setEstPleinEcran] = useState(false);
  // Thème graphique : 'dark' (fond noir TradingView) ou 'light' (fond blanc TradingView)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  // Nombre de bougies à charger de l'API Binance (100 à 1000)
  const [limiteBougies, setLimiteBougies] = useState(500);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hauteur du graphique : plus grande en mode plein écran
  const hauteurGraphique = estPleinEcran ? window.innerHeight - 120 : 500;

  // Classes CSS calculées selon le thème courant
  const C = getThemeClasses(theme);

  // ─── Store de Backtesting (Zustand) ─────────────────────────────────────────
  const {
    actif,
    donneesCompletes,
    indexCourant,
    estEnLecture,
    vitesseLecture,
    positionActive,
    historiqueSimule,
    chargerDonnees,
    avancerBougie,
    revenirDebut,
    setEstEnLecture,
    setVitesseLecture,
    fermerPositionManuellement,
    supprimerTradeHistorique,
  } = useBacktestStore();

  const openNewTradeWithPrefill = useUIStore((s) => s.openNewTradeWithPrefill);
  const addToast = useUIStore((s) => s.addToast);

  // ─── Chargement des données Binance ─────────────────────────────────────────
  const chargerBinance = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const bougies = await recupererDonneesBinance(symbole, timeframe, limiteBougies);
      if (!bougies.length) throw new Error('Aucune donnée reçue de Binance.');
      chargerDonnees(bougies, symbole);
      addToast(`${symbole} (${timeframe}) — ${bougies.length} bougies chargées`, 'success');
    } catch (err: any) {
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  }, [symbole, timeframe, limiteBougies]);

  // Chargement automatique au changement d'actif, timeframe ou limite de bougies
  useEffect(() => {
    chargerBinance();
  }, [chargerBinance]);

  // ─── Boucle de lecture du Replay ─────────────────────────────────────────────
  useEffect(() => {
    if (!estEnLecture) return;
    const intervalle = setInterval(() => {
      const continuer = avancerBougie();
      if (!continuer) {
        clearInterval(intervalle);
        addToast('Replay terminé — fin des données disponibles.', 'info');
      }
    }, vitesseLecture);
    return () => clearInterval(intervalle);
  }, [estEnLecture, vitesseLecture, avancerBougie]);

  // ─── Raccourcis clavier ─────────────────────────────────────────────────────
  useEffect(() => {
    const gererTouche = (e: KeyboardEvent) => {
      // Espace : basculer Play/Pause (ne pas intercepter si focus sur input)
      if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        setEstEnLecture(!estEnLecture);
      }
      // Flèche droite : avancer d'une bougie
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        avancerBougie();
      }
      // Échap : quitter plein écran et revenir au curseur
      if (e.code === 'Escape') {
        setEstPleinEcran(false);
        setOutilActif(null);
      }
    };
    window.addEventListener('keydown', gererTouche);
    return () => window.removeEventListener('keydown', gererTouche);
  }, [estEnLecture, avancerBougie, setEstEnLecture]);

  // ─── Importation CSV ─────────────────────────────────────────────────────────
  const gererCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    const lecteur = new FileReader();
    lecteur.onload = (ev) => {
      try {
        const bougies = parserCsvPrix(ev.target?.result as string);
        chargerDonnees(bougies, fichier.name.replace(/\.[^.]+$/, ''));
        addToast(`CSV importé — ${bougies.length} bougies prêtes`, 'success');
      } catch (err: any) {
        addToast(err.message || 'Erreur lors de la lecture du CSV', 'error');
      }
    };
    lecteur.readAsText(fichier);
    e.target.value = '';
  };

  // ─── Export d'un trade simulé vers le formulaire du Journal ─────────────────
  const exporterVersJournal = (trade: PositionSimulee) => {
    const dateTexte = typeof trade.dateEntree === 'number'
      ? new Date(trade.dateEntree * 1000).toISOString().split('T')[0]
      : String(trade.dateEntree).split('T')[0];

    const gain = Math.abs(trade.takeProfit - trade.prixEntree);
    const risque = Math.abs(trade.prixEntree - trade.stopLoss);
    const rr = risque > 0 ? (gain / risque).toFixed(2) : '1.00';
    const rrRealise = trade.resultat === 'win' ? rr : trade.resultat === 'loss' ? '-1.00' : '0';

    openNewTradeWithPrefill({
      pair: actif,
      direction: trade.direction,
      date_backtested: dateTexte,
      entry_price: trade.prixEntree.toFixed(5),
      entry_sl: trade.stopLoss.toFixed(5),
      entry_tp: trade.takeProfit.toFixed(5),
      rr_planned: rr,
      rr_realized: rrRealise,
      result: trade.resultat,
      exit_type: trade.resultat === 'win' ? 'tp' : trade.resultat === 'loss' ? 'sl' : 'breakeven',
      journal_type: 'global',
    });

    addToast('Formulaire du Journal pré-rempli avec les données du backtest !', 'success');
  };

  // ─── Calcul du PnL flottant de la position active ────────────────────────────
  const prixActuel = donneesCompletes[indexCourant]?.close ?? 0;
  const pnlFlottant = positionActive
    ? positionActive.direction === 'long'
      ? ((prixActuel - positionActive.prixEntree) / positionActive.prixEntree) * 100
      : ((positionActive.prixEntree - prixActuel) / positionActive.prixEntree) * 100
    : null;

  // ─── Winrate de la session ────────────────────────────────────────────────────
  const wins = historiqueSimule.filter((t) => t.resultat === 'win').length;
  const winrate = historiqueSimule.length > 0 ? Math.round((wins / historiqueSimule.length) * 100) : 0;

  // ─── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className={`flex flex-col overflow-hidden transition-colors duration-200 ${C.bgWorkspace}
      ${estPleinEcran ? 'fixed inset-0 z-[200]' : 'flex-1'}`}
    >

      {/* ══════════════════════════════════════════════════════════ */}
      {/* BARRE SUPÉRIEURE — style TradingView Header               */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className={`flex items-center gap-2 px-4 h-12 border-b flex-shrink-0 ${C.bgHeader}`}>

        {/* Sélection de l'actif */}
        <select
          value={symbole}
          onChange={(e) => setSymbole(e.target.value)}
          className={`border-0 rounded px-2 py-1 text-[13px] font-semibold outline-none focus:ring-1 focus:ring-[#2962ff] cursor-pointer ${C.select}`}
        >
          {ACTIFS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>

        {/* Boutons Timeframe */}
        <div className="flex items-center gap-0.5">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={`px-2.5 py-1 text-[12px] font-medium rounded transition-colors
                ${timeframe === tf.value ? C.btnActive : C.btnBase}`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Sélection du nombre de bougies à charger */}
        <select
          value={limiteBougies}
          onChange={(e) => setLimiteBougies(Number(e.target.value))}
          className={`border-0 rounded px-2 py-1 text-[12px] font-medium outline-none focus:ring-1 focus:ring-[#2962ff] cursor-pointer ${C.select}`}
          title="Nombre de bougies à charger"
        >
          <option value="100">100 bougies</option>
          <option value="300">300 bougies</option>
          <option value="500">500 bougies</option>
          <option value="1000">1000 bougies</option>
        </select>

        <button
          onClick={chargerBinance}
          disabled={chargement}
          className="px-3 py-1 bg-[#2962ff] hover:bg-[#2979ff] text-white text-[12px] font-semibold rounded disabled:opacity-50 transition-colors"
        >
          {chargement ? '⌛' : 'Charger'}
        </button>

        <div className={`h-5 w-px ${C.separator}`} />

        {/* Import CSV */}
        <input type="file" accept=".csv" ref={fileInputRef} onChange={gererCsv} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          className={`px-3 py-1 text-[12px] font-medium rounded transition-colors flex items-center gap-1.5 ${C.btnBase}`}
        >
          📁 CSV
        </button>

        <div className="flex-1" />

        {/* Infos bougie courante */}
        {donneesCompletes.length > 0 && (
          <div className={`text-[12px] font-mono ${C.textMuted}`}>
            <span className={`font-semibold ${C.textNormal}`}>{actif}</span>
            <span className="ml-2">Bougie {indexCourant + 1}/{donneesCompletes.length}</span>
          </div>
        )}

        <div className={`h-5 w-px ${C.separator}`} />

        {/* ── Contrôles Replay ── */}
        <div className="flex items-center gap-1">
          <button onClick={revenirDebut} title="Retour au début"
            className={`w-8 h-8 flex items-center justify-center rounded transition-colors text-sm ${C.btnBase}`}>⏮</button>

          <button onClick={() => avancerBougie()} title="Bougie précédente"
            className={`w-8 h-8 flex items-center justify-center rounded transition-colors text-sm ${C.btnBase}`}>⏪</button>

          <button
            onClick={() => setEstEnLecture(!estEnLecture)}
            title={estEnLecture ? 'Pause (Espace)' : 'Lecture (Espace)'}
            className={`w-9 h-8 flex items-center justify-center rounded text-sm font-bold transition-colors
              ${estEnLecture ? 'bg-[#ff9800] text-white hover:bg-[#f57c00]' : 'bg-[#26a69a] text-white hover:bg-[#00897b]'}`}
          >
            {estEnLecture ? '⏸' : '▶'}
          </button>

          <button onClick={() => { setEstEnLecture(false); avancerBougie(); }} title="Bougie suivante (→)"
            className={`w-8 h-8 flex items-center justify-center rounded transition-colors text-sm ${C.btnBase}`}>⏩</button>

          <select
            value={vitesseLecture}
            onChange={(e) => setVitesseLecture(Number(e.target.value))}
            className={`border-0 rounded px-2 py-1 text-[12px] outline-none cursor-pointer w-20 ${C.select}`}
          >
            <option value="2000">×0.5</option>
            <option value="1000">×1</option>
            <option value="500">×2</option>
            <option value="200">×5</option>
            <option value="100">×10</option>
          </select>
        </div>

        <div className={`h-5 w-px ${C.separator}`} />

        {/* ── Bouton Thème (Clair / Sombre) ── */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors text-base ${C.btnBase}`}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        {/* ── Bouton Plein Écran ── */}
        <button
          onClick={() => setEstPleinEcran(!estPleinEcran)}
          title={estPleinEcran ? 'Quitter le plein écran (Esc)' : 'Plein écran'}
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors text-base ${C.btnBase}`}
        >
          {estPleinEcran ? '⊡' : '⊞'}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* CORPS PRINCIPAL : Toolbar Gauche + Graphique + Panel Droit */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ─── BARRE D'OUTILS VERTICALE GAUCHE (style TradingView) ─── */}
        <div className={`w-14 flex flex-col items-center pt-2 gap-0.5 border-r flex-shrink-0 overflow-y-auto ${C.bgSidebar}`}>
          {OUTILS_TRACAGE.map((groupe) => (
            <React.Fragment key={groupe.group}>
              {groupe.items.map((outil) => {
                const estActif = outilActif === outil.id;
                return (
                  <button
                    key={String(outil.id)}
                    onClick={() => setOutilActif(estActif ? null : outil.id)}
                    title={outil.title}
                    className={`w-12 h-9 flex flex-col items-center justify-center rounded text-[9px] font-bold tracking-tight transition-all leading-tight px-0.5
                      ${estActif ? C.btnActive : C.btnBase}`}
                  >
                    {/* Icône SVG pour le curseur, texte pour les autres */}
                    {outil.label === 'CURSOR' ? (
                      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
                        <path d="M2 1l12 6.5L9.5 9l-1 5.5L2 1z" />
                      </svg>
                    ) : (
                      <span className="text-[10px] font-bold">{outil.label}</span>
                    )}
                  </button>
                );
              })}
              <div className={`w-8 h-px my-1 ${C.separator}`} />
            </React.Fragment>
          ))}
        </div>

        {/* ─── GRAPHIQUE PRINCIPAL ─── */}
        <div className="flex-1 min-w-0">
          {erreur && (
            <div className={`border-b text-xs px-4 py-2 ${C.errBg}`}>
              ⚠️ {erreur}
            </div>
          )}
          <BacktestChart activeTool={outilActif} height={hauteurGraphique} theme={theme} />
        </div>

        {/* ─── PANEL DROIT : Position active + Historique ─── */}
        <div className={`w-[280px] flex flex-col border-l flex-shrink-0 ${C.bgPanel}`}>

          {/* Stats rapides de session */}
          <div className={`px-4 py-3 border-b flex items-center gap-4 text-[11px] ${C.border}`}>
            <div>
              <span className={C.textMuted}>Trades</span>
              <span className={`font-semibold ml-1.5 ${C.textNormal}`}>{historiqueSimule.length}</span>
            </div>
            <div>
              <span className={C.textMuted}>Winrate</span>
              <span className={`font-semibold ml-1.5 ${winrate >= 50 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>{winrate}%</span>
            </div>
            {pnlFlottant !== null && (
              <div className="ml-auto">
                <span className={C.textMuted}>PnL</span>
                <span className={`font-semibold font-mono ml-1 ${pnlFlottant >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}`}>
                  {pnlFlottant >= 0 ? '+' : ''}{pnlFlottant.toFixed(2)}%
                </span>
              </div>
            )}
          </div>

          {/* Position active */}
          {positionActive ? (
            <div className={`px-4 py-3 border-b space-y-2 ${C.border}`}>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase
                  ${positionActive.direction === 'long'
                    ? 'bg-[#26a69a]/20 text-[#26a69a] border border-[#26a69a]/30'
                    : 'bg-[#ef5350]/20 text-[#ef5350] border border-[#ef5350]/30'
                  }`}>
                  {positionActive.direction === 'long' ? '▲ LONG' : '▼ SHORT'}
                </span>
                <span className={`text-[10px] ${C.textMuted}`}>position active</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                <div className={`p-2 rounded ${C.inputBg}`}>
                  <div className={`text-[9px] uppercase mb-0.5 ${C.textMuted}`}>Entrée</div>
                  <div className={C.textNormal}>{positionActive.prixEntree.toFixed(5)}</div>
                </div>
                <div className={`p-2 rounded ${C.inputBg}`}>
                  <div className={`text-[9px] uppercase mb-0.5 ${C.textMuted}`}>Prix actuel</div>
                  <div className={pnlFlottant && pnlFlottant >= 0 ? 'text-[#26a69a]' : 'text-[#ef5350]'}>{prixActuel.toFixed(5)}</div>
                </div>
                <div className="bg-red-950/40 p-2 rounded border border-red-800/30">
                  <div className="text-red-400/70 text-[9px] uppercase mb-0.5">Stop Loss</div>
                  <div className="text-red-400">{positionActive.stopLoss.toFixed(5)}</div>
                </div>
                <div className="bg-emerald-950/40 p-2 rounded border border-emerald-800/30">
                  <div className="text-emerald-400/70 text-[9px] uppercase mb-0.5">Take Profit</div>
                  <div className="text-emerald-400">{positionActive.takeProfit.toFixed(5)}</div>
                </div>
              </div>

              <button
                onClick={fermerPositionManuellement}
                className="w-full py-2 bg-[#ef5350] hover:bg-[#e53935] text-white text-[11px] font-bold rounded transition-colors"
              >
                🔒 Clôturer la position
              </button>
            </div>
          ) : (
            <div className={`px-4 py-4 border-b text-[11px] text-center ${C.border} ${C.textMuted}`}>
              <div className="text-2xl mb-2">📈</div>
              <p className="leading-relaxed">
                Sélectionne <strong className="text-[#26a69a]">▲ Long</strong> ou <strong className="text-[#ef5350]">▼ Short</strong> dans la barre et clique 3× sur le graphique pour poser ta position.
              </p>
            </div>
          )}

          {/* Historique des trades simulés */}
          <div className="flex-1 overflow-y-auto">
            <div className={`px-4 py-2 border-b text-[10px] uppercase tracking-wider font-semibold ${C.border} ${C.textMuted}`}>
              Historique de session
            </div>

            {historiqueSimule.length === 0 ? (
              <div className={`flex items-center justify-center h-32 text-[11px] text-center px-4 ${C.textMuted}`}>
                Les trades fermés apparaîtront ici.
              </div>
            ) : (
              <div className={`space-y-0 divide-y ${C.divider}`}>
                {[...historiqueSimule].reverse().map((trade, idx) => {
                  const realIdx = historiqueSimule.length - 1 - idx;
                  return (
                    <div key={realIdx} className={`px-3 py-2.5 transition-colors ${C.hoverRow}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase
                          ${trade.direction === 'long' ? 'text-[#26a69a] bg-[#26a69a]/10' : 'text-[#ef5350] bg-[#ef5350]/10'}`}>
                          {trade.direction === 'long' ? '▲' : '▼'} {trade.direction.toUpperCase()}
                        </span>
                        <span className={`text-[11px] font-bold font-mono
                          ${trade.resultat === 'win' ? 'text-[#26a69a]' : trade.resultat === 'loss' ? 'text-[#ef5350]' : C.textMuted}`}>
                          {trade.pnl !== undefined ? `${trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}%` : '—'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => exporterVersJournal(trade)}
                          className="flex-1 py-1.5 bg-[#2962ff] hover:bg-[#2979ff] text-white text-[10px] font-bold rounded transition-colors"
                        >
                          Enregistrer dans le Journal
                        </button>
                        <button
                          onClick={() => supprimerTradeHistorique(realIdx)}
                          className={`w-7 h-7 flex items-center justify-center rounded transition-colors text-xs ${C.btnBase} hover:text-[#ef5350]`}
                        >✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Aide clavier */}
          <div className={`px-4 py-3 border-t text-[9px] space-y-0.5 ${C.border} ${C.helpText}`}>
            <div><kbd className={`px-1 rounded text-[9px] ${C.kbdBg}`}>Espace</kbd> Play / Pause</div>
            <div><kbd className={`px-1 rounded text-[9px] ${C.kbdBg}`}>→</kbd> Bougie suivante</div>
            <div><kbd className={`px-1 rounded text-[9px] ${C.kbdBg}`}>Esc</kbd> Quitter plein écran</div>
            {outilActif && (
              <div className="pt-1 text-[#2962ff] font-medium">
                ✏️ Outil actif — clique sur le graphique
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
