import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useBacktestStore } from '@/store/backtestStore';
import { recupererDonneesBinance, parserCsvPrix } from '@/lib/chartDataHelper';
import { BacktestChart } from './BacktestChart';
import { useUIStore } from '@/store';
import type { PositionSimulee } from '@/store/backtestStore';
import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/storage';

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
    { id: 'pos-long',  label: 'LONG',  title: 'Position Long ▲ — 3 clics : ① Entrée  ② Stop Loss  ③ Take Profit' },
    { id: 'pos-short', label: 'SHORT', title: 'Position Short ▼ — 3 clics : ① Entrée  ② Stop Loss  ③ Take Profit' },
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
  { label: '1w', value: '1w' },
  { label: '1M', value: '1M' },
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

  // Type de journal de destination choisi dans l'en-tête pour l'export des trades
  const [journalDest, setJournalDest] = useState<'global' | 'bias' | 'poi' | 'confirmation'>('global');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convertit le timeframe de Binance vers le format attendu par le journal
  const mapperTimeframe = (tf: string) => {
    switch (tf) {
      case '1m': return 'M1';
      case '5m': return 'M5';
      case '15m': return 'M15';
      case '30m': return 'M30';
      case '1h': return 'H1';
      case '4h': return 'H4';
      case '1d': return 'D1';
      case '1w': return 'W1';
      case '1M': return 'Monthly';
      default: return 'H1';
    }
  };

  // Référence pour appeler les méthodes de capture du graphique
  const chartRef = useRef<{ takeScreenshot: () => Promise<Blob | null> } | null>(null);
  // ID unique du trade en cours d'exportation pour afficher un spinner
  const [exportantTradeId, setExportantTradeId] = useState<string | null>(null);

  // Gère l'affichage du menu déroulant de capture d'écran
  const [menuCaptureOuvert, setMenuCaptureOuvert] = useState(false);
  // Indique si une capture d'écran manuelle est en cours d'upload
  const [capturantManuel, setCapturantManuel] = useState(false);
  // Référence pour le conteneur du menu (permet de détecter les clics extérieurs)
  const menuRef = useRef<HTMLDivElement>(null);
  // Référence pour le bouton de l'appareil photo
  const boutonRef = useRef<HTMLButtonElement>(null);
  // Position calculée à l'écran pour le menu déroulant fixe (évite l'overflow du header)
  const [positionMenu, setPositionMenu] = useState<{ top: number; right: number } | null>(null);

  // Détection de la largeur de la fenêtre pour la réactivité mobile
  const [largeurFenetre, setLargeurFenetre] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  useEffect(() => {
    // Met à jour la largeur de la fenêtre lors du redimensionnement
    const gererResize = () => setLargeurFenetre(window.innerWidth);
    window.addEventListener('resize', gererResize);
    return () => window.removeEventListener('resize', gererResize);
  }, []);

  // Ferme le menu déroulant de capture d'écran lorsqu'on clique à l'extérieur de celui-ci
  useEffect(() => {
    console.log('🔌 [Workspace] Effect ClicExtérieur : menuCaptureOuvert =', menuCaptureOuvert);
    const gererClicExterieur = (evenement: MouseEvent) => {
      console.log('🖱️ [Workspace] Clic détecté sur le document, cible :', evenement.target);
      if (menuRef.current) {
        const estInterieur = menuRef.current.contains(evenement.target as Node);
        console.log('🖱️ [Workspace] Clic à l\'intérieur du menu ?', estInterieur);
        if (!estInterieur) {
          console.log('❌ [Workspace] Clic extérieur détecté → Fermeture du menu');
          setMenuCaptureOuvert(false);
        }
      }
    };
    if (menuCaptureOuvert) {
      document.addEventListener('mousedown', gererClicExterieur);
    }
    return () => {
      console.log('🔌 [Workspace] Nettoyage Effect ClicExtérieur');
      document.removeEventListener('mousedown', gererClicExterieur);
    };
  }, [menuCaptureOuvert]);

  const estMobile = largeurFenetre < 768;

  // Hauteur du graphique : plus grande en plein écran, réduite à 350px sur mobile
  const hauteurGraphique = estPleinEcran
    ? window.innerHeight - 120
    : estMobile
      ? 350
      : 500;

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
  // Prend automatiquement une capture d'écran combinée (graphique + overlay)
  // et l'associe directement à l'étape correspondante du journal choisi.
  const exporterVersJournal = async (trade: PositionSimulee) => {
    const tradeUid = `${trade.dateEntree}-${trade.prixEntree}`;
    console.log('🚀 [Backtest] Début de l\'exportation du trade vers le journal :', journalDest);
    setExportantTradeId(tradeUid);

    let imageUrlPublic = '';
    try {
      if (chartRef.current) {
        const blob = await chartRef.current.takeScreenshot();
        if (blob) {
          console.log('📡 [Backtest] Upload de la capture d\'écran vers Supabase Storage...');
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Utilisateur non connecté');

          const path = `trade_images/${user.id}/${Date.now()}-backtest.jpg`;
          imageUrlPublic = await uploadImage(blob, path);
          console.log('✅ [Backtest] Capture d\'écran uploadée ! URL :', imageUrlPublic);
        }
      }
    } catch (err) {
      console.error('❌ [Backtest] Échec de la génération ou de l\'upload de la capture :', err);
      addToast('Impossible de générer ou d\'uploader la capture du graphique. Le trade sera pré-rempli sans image.', 'info');
    } finally {
      setExportantTradeId(null);
    }

    const dateTexte = typeof trade.dateEntree === 'number'
      ? new Date(trade.dateEntree * 1000).toISOString().split('T')[0]
      : String(trade.dateEntree).split('T')[0];

    const gain = Math.abs(trade.takeProfit - trade.prixEntree);
    const risque = Math.abs(trade.prixEntree - trade.stopLoss);
    const rr = risque > 0 ? (gain / risque).toFixed(2) : '1.00';
    const rrRealise = trade.resultat === 'win' ? rr : trade.resultat === 'loss' ? '-1.00' : '0';

    // Prépare l'image avec un ID unique pour le pré-remplissage
    const imageElement = imageUrlPublic ? {
      id: crypto.randomUUID(),
      url: imageUrlPublic,
      source: 'upload' as const,
      phase: 'avant' as const
    } : null;

    // Prépare l'objet de pré-remplissage selon le type de journal
    const localPrefill: any = {
      pair: actif !== 'Aucun actif' && actif ? actif : symbole,
      direction: trade.direction,
      date_backtested: dateTexte,
      result: trade.resultat,
      journal_type: journalDest,
    };

    // Adapte la configuration de l'export en fonction du journal sélectionné
    if (journalDest === 'global') {
      localPrefill.entry_price = trade.prixEntree.toFixed(5);
      localPrefill.entry_sl = trade.stopLoss.toFixed(5);
      localPrefill.entry_tp = trade.takeProfit.toFixed(5);
      localPrefill.rr_planned = rr;
      localPrefill.rr_realized = rrRealise;
      localPrefill.exit_type = trade.resultat === 'win' ? 'tp' : trade.resultat === 'loss' ? 'sl' : 'breakeven';
      localPrefill.entry_images = imageElement ? [imageElement] : [];
    } else if (journalDest === 'bias') {
      localPrefill.biais_timeframe = mapperTimeframe(timeframe);
      localPrefill.biais_direction = trade.direction === 'long' ? 'Haussier' : 'Baissier';
      localPrefill.biais_images = imageElement ? [imageElement] : [];
    } else if (journalDest === 'poi') {
      localPrefill.poi_timeframe = mapperTimeframe(timeframe);
      localPrefill.poi_images = imageElement ? [imageElement] : [];
      // On pré-remplit également les prix pour faciliter la saisie
      localPrefill.entry_price = trade.prixEntree.toFixed(5);
      localPrefill.entry_sl = trade.stopLoss.toFixed(5);
      localPrefill.entry_tp = trade.takeProfit.toFixed(5);
    } else if (journalDest === 'confirmation') {
      localPrefill.entry_timeframe = mapperTimeframe(timeframe);
      localPrefill.entry_price = trade.prixEntree.toFixed(5);
      localPrefill.entry_sl = trade.stopLoss.toFixed(5);
      localPrefill.entry_tp = trade.takeProfit.toFixed(5);
      localPrefill.rr_planned = rr;
      localPrefill.rr_realized = rrRealise;
      localPrefill.exit_type = trade.resultat === 'win' ? 'tp' : trade.resultat === 'loss' ? 'sl' : 'breakeven';
      localPrefill.entry_images = imageElement ? [imageElement] : [];
    }

    console.log('📡 [Backtest] Pré-remplissage du formulaire avec :', localPrefill);
    openNewTradeWithPrefill(localPrefill);
    addToast(`Formulaire du journal (${journalDest}) pré-rempli avec succès !`, 'success');
  };

  // ─── Capture manuelle à la volée ─────────────────────────────────────────────
  // Permet à l'utilisateur de prendre une capture d'écran du graphique à tout moment
  // et de l'associer directement à la bonne section (Biais, POI ou Entrée).
  // Cela permet par exemple d'enregistrer des analyses de Biais HTF au tout début du trade.
  const effectuerCaptureManuelle = async (cible: 'biais' | 'poi' | 'entry_avant' | 'entry_apres') => {
    console.log('🚀 [Workspace] ① effectuerCaptureManuelle démarrée, cible =', cible);
    setMenuCaptureOuvert(false);
    setCapturantManuel(true);

    let imageUrlPublic = '';
    try {
      console.log('🚀 [Workspace] ② chartRef.current =', chartRef.current ? 'OK' : 'NULL ❌');
      if (chartRef.current) {
        console.log('🚀 [Workspace] ③ Appel takeScreenshot()...');
        const blob = await chartRef.current.takeScreenshot();
        console.log('🚀 [Workspace] ④ blob =', blob ? `OK (${blob.size} octets)` : 'NULL ❌');
        if (blob) {
          console.log('🚀 [Workspace] ⑤ Récupération user Supabase...');
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          console.log('🚀 [Workspace] ⑥ user =', user?.id ?? 'NULL ❌', '| error =', userError);
          if (!user) throw new Error('Utilisateur non connecté');

          const path = `trade_images/${user.id}/${Date.now()}-backtest.jpg`;
          console.log('🚀 [Workspace] ⑦ Upload vers path :', path);
          imageUrlPublic = await uploadImage(blob, path);
          console.log('🚀 [Workspace] ⑧ Upload terminé ! URL :', imageUrlPublic);
        } else {
          console.warn('⚠️ [Workspace] blob null → on continue SANS image');
        }
      } else {
        console.warn('⚠️ [Workspace] chartRef.current NULL → pas de capture');
      }
    } catch (err) {
      console.error('❌ [Backtest] Échec de la capture manuelle :', err);
      addToast('Impossible de générer ou d\'uploader la capture.', 'error');
      setCapturantManuel(false);
      return;
    }

    setCapturantManuel(false);
    console.log('🚀 [Workspace] ⑨ Construction du prefillData...');

    // Initialisation du formulaire pré-rempli avec les champs de base requis
    const localPrefill: any = {
      pair: actif !== 'Aucun actif' ? actif : symbole,
      date_backtested: new Date().toISOString().split('T')[0],
      journal_type: 'global',
    };

    // Si une position est actuellement ouverte ou tracée, on l'utilise pour pré-remplir la direction et les prix
    if (positionActive) {
      localPrefill.direction = positionActive.direction;
      localPrefill.entry_price = positionActive.prixEntree.toFixed(5);
      localPrefill.entry_sl = positionActive.stopLoss.toFixed(5);
      localPrefill.entry_tp = positionActive.takeProfit.toFixed(5);
      
      const gain = Math.abs(positionActive.takeProfit - positionActive.prixEntree);
      const risque = Math.abs(positionActive.prixEntree - positionActive.stopLoss);
      localPrefill.rr_planned = risque > 0 ? (gain / risque).toFixed(2) : '1.00';
    }

    // Objet image conforme aux schémas d'images d'étapes
    const imageElement = {
      id: crypto.randomUUID(),
      url: imageUrlPublic,
      source: 'upload' as const,
      phase: (cible === 'entry_apres' ? 'apres' as const : 'avant' as const),
    };

    // Selon la cible choisie, on injecte l'image dans le bon tableau et configure le type de journal
    if (cible === 'biais') {
      localPrefill.journal_type = 'bias';
      localPrefill.biais_images = [imageElement];
    } else if (cible === 'poi') {
      localPrefill.journal_type = 'poi';
      localPrefill.poi_images = [imageElement];
    } else if (cible === 'entry_avant') {
      localPrefill.journal_type = 'confirmation';
      localPrefill.entry_images = [imageElement];
    } else if (cible === 'entry_apres') {
      localPrefill.journal_type = 'global';
      localPrefill.entry_images = [imageElement];
      if (positionActive?.prixSortie) {
        localPrefill.result = positionActive.resultat;
      }
    }

    console.log('🚀 [Workspace] ⑩ prefillData :', localPrefill);
    console.log('🚀 [Workspace] ⑪ Appel openNewTradeWithPrefill...');
    openNewTradeWithPrefill(localPrefill);
    console.log('🚀 [Workspace] ⑫ TERMINÉ ✅');
    addToast('Capture d\'écran chargée ! Complète les détails du trade.', 'success');
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
      <div className={`flex items-center gap-2 px-4 h-12 border-b flex-shrink-0 overflow-x-auto whitespace-nowrap scrollbar-none ${C.bgHeader}`}>

        {/* Sélection de l'actif */}
        <select
          value={symbole}
          onChange={(e) => setSymbole(e.target.value)}
          className={`flex-shrink-0 border-0 rounded px-2 py-1 text-[13px] font-semibold outline-none focus:ring-1 focus:ring-[#2962ff] cursor-pointer ${C.select}`}
        >
          {ACTIFS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>

        {/* Boutons Timeframe */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
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

        <div className={`flex-shrink-0 h-5 w-px ${C.separator}`} />

        {/* Sélection du journal de destination */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-[11px] ${C.textMuted}`}>Journal :</span>
          <select
            value={journalDest}
            onChange={(e) => setJournalDest(e.target.value as any)}
            className={`border-0 rounded px-2 py-1 text-[12px] font-semibold outline-none focus:ring-1 focus:ring-[#2962ff] cursor-pointer ${C.select}`}
            title="Journal de trading de destination pour l'exportation des trades"
          >
            <option value="global">📋 Global</option>
            <option value="bias">🎯 Biais</option>
            <option value="poi">🗺️ POI</option>
            <option value="confirmation">⚡ Confirmation</option>
          </select>
        </div>

        {/* Saisie du nombre de bougies à charger */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-[11px] ${C.textMuted}`}>Bougies :</span>
          <input
            type="number"
            value={limiteBougies}
            min={10}
            max={1000}
            onChange={(e) => {
              const val = Math.max(10, Math.min(1000, Number(e.target.value)));
              setLimiteBougies(val);
            }}
            className={`border-0 rounded px-2 py-1 text-[12px] font-semibold outline-none focus:ring-1 focus:ring-[#2962ff] w-16 text-center ${C.select}`}
            title="Nombre de bougies à charger (10 à 1000)"
          />
        </div>

        <button
          onClick={chargerBinance}
          disabled={chargement}
          className="flex-shrink-0 px-3 py-1 bg-[#2962ff] hover:bg-[#2979ff] text-white text-[12px] font-semibold rounded disabled:opacity-50 transition-colors"
        >
          {chargement ? '⌛' : 'Charger'}
        </button>

        <div className={`flex-shrink-0 h-5 w-px ${C.separator}`} />

        {/* Import CSV */}
        <input type="file" accept=".csv" ref={fileInputRef} onChange={gererCsv} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          className={`flex-shrink-0 px-3 py-1 text-[12px] font-medium rounded transition-colors flex items-center gap-1.5 ${C.btnBase}`}
        >
          📁 CSV
        </button>

        <div className="hidden md:block flex-1" />

        {/* Infos bougie courante */}
        {donneesCompletes.length > 0 && (
          <div className={`text-[12px] font-mono flex-shrink-0 whitespace-nowrap ${C.textMuted}`}>
            <span className={`font-semibold hidden sm:inline ${C.textNormal}`}>{actif}</span>
            <span className="sm:ml-2">Bougie {indexCourant + 1}/{donneesCompletes.length}</span>
          </div>
        )}

        <div className={`flex-shrink-0 h-5 w-px ${C.separator}`} />

        {/* ── Contrôles Replay ── */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setOutilActif(outilActif === 'replay-cut' ? null : 'replay-cut')}
            title="Mode Replay — Cliquer sur une bougie du graphique pour démarrer le backtest à partir de ce point"
            className={`w-8 h-8 flex items-center justify-center rounded text-sm transition-colors
              ${outilActif === 'replay-cut' ? C.btnActive : C.btnBase}`}
          >
            ✂️
          </button>

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

        <div className={`flex-shrink-0 h-5 w-px ${C.separator}`} />

        {/* ── Bouton Capture d'Écran Manuel ── */}
        <div ref={menuRef} className="relative flex-shrink-0">
          <button
            ref={boutonRef}
            onClick={(evenement) => {
              // Empêche la propagation du clic pour éviter que le listener global sur document
              // ne referme immédiatement le menu qui vient de s'ouvrir.
              evenement.stopPropagation();
              const rect = boutonRef.current?.getBoundingClientRect();
              if (rect) {
                // Calcule le positionnement fixed pour que le menu s'affiche
                // juste en dessous du bouton, par-dessus l'overflow du header.
                setPositionMenu({
                  top: rect.bottom + window.scrollY + 6,
                  right: window.innerWidth - rect.right - window.scrollX,
                });
              }
              console.log('📸 [Bouton] Clic détecté, bascule menu de', menuCaptureOuvert, 'à', !menuCaptureOuvert);
              setMenuCaptureOuvert(!menuCaptureOuvert);
            }}
            disabled={capturantManuel}
            title="Prendre une capture d'écran du graphique"
            className={`w-8 h-8 flex items-center justify-center rounded transition-colors text-base relative ${C.btnBase} ${menuCaptureOuvert ? 'bg-[#2a2e39] text-[#2962ff]' : ''}`}
          >
            {capturantManuel ? (
              <span className="w-4 h-4 border-2 border-[#2962ff]/20 border-t-[#2962ff] rounded-full animate-spin"></span>
            ) : (
              '📸'
            )}
          </button>

          {menuCaptureOuvert && (
            /* Menu déroulant - positionné en fixed pour outrepasser l'overflow-x-auto du header parent */
            <div 
              style={{
                position: 'fixed',
                top: positionMenu?.top ?? 0,
                right: positionMenu?.right ?? 0,
              }}
              className={`w-52 rounded-lg border shadow-xl z-[999] py-1.5 text-xs font-medium flex flex-col transition-all animate-fadeIn
                ${theme === 'dark' ? 'bg-[#1e222d] border-[#2a2e39] text-[#d1d4dc]' : 'bg-white border-[#e0e3eb] text-[#131722]'}`}
            >
              <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border-b ${theme === 'dark' ? 'text-[#787b86] border-[#2a2e39]' : 'text-[#9598a1] border-[#e0e3eb]'}`}>
                Où envoyer la capture ?
              </div>
              <button
                onClick={() => effectuerCaptureManuelle('biais')}
                className={`px-3 py-2 text-left transition-colors flex items-center gap-2 ${theme === 'dark' ? 'hover:bg-[#2a2e39]' : 'hover:bg-[#f0f3fa]'}`}
              >
                <span className="text-[14px]">🧭</span> Biais de Marché (Avant)
              </button>
              <button
                onClick={() => effectuerCaptureManuelle('poi')}
                className={`px-3 py-2 text-left transition-colors flex items-center gap-2 ${theme === 'dark' ? 'hover:bg-[#2a2e39]' : 'hover:bg-[#f0f3fa]'}`}
              >
                <span className="text-[14px]">🎯</span> Zone d'Intérêt POI (Avant)
              </button>
              <button
                onClick={() => effectuerCaptureManuelle('entry_avant')}
                className={`px-3 py-2 text-left transition-colors flex items-center gap-2 ${theme === 'dark' ? 'hover:bg-[#2a2e39]' : 'hover:bg-[#f0f3fa]'}`}
              >
                <span className="text-[14px]">⚡</span> Prise de Position (Avant)
              </button>
              <button
                onClick={() => effectuerCaptureManuelle('entry_apres')}
                className={`px-3 py-2 text-left transition-colors flex items-center gap-2 border-t ${theme === 'dark' ? 'hover:bg-[#2a2e39] border-[#2a2e39]' : 'hover:bg-[#f0f3fa] border-[#e0e3eb]'}`}
              >
                <span className="text-[14px]">🔴</span> Résultat / Sortie (Après)
              </button>
            </div>
          )}
        </div>

        <div className={`flex-shrink-0 h-5 w-px ${C.separator}`} />

        {/* ── Bouton Thème (Clair / Sombre) ── */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
          className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded transition-colors text-base ${C.btnBase}`}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        {/* ── Bouton Plein Écran ── */}
        <button
          onClick={() => setEstPleinEcran(!estPleinEcran)}
          title={estPleinEcran ? 'Quitter le plein écran (Esc)' : 'Plein écran'}
          className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded transition-colors text-base ${C.btnBase}`}
        >
          {estPleinEcran ? '⊡' : '⊞'}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* CORPS PRINCIPAL : Toolbar Gauche + Graphique + Panel Droit */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden">

        {/* ─── BARRE D'OUTILS DE TRACAGE (style TradingView) ─── */}
        {/* Horizontale et défilante sur mobile, verticale sur écran moyen (md) */}
        <div className={`w-full md:w-14 h-12 md:h-auto flex flex-row md:flex-col items-center p-1.5 md:pt-2 gap-1 md:gap-0.5 border-b md:border-b-0 md:border-r flex-shrink-0 overflow-x-auto md:overflow-y-auto scrollbar-none ${C.bgSidebar}`}>
          {OUTILS_TRACAGE.map((groupe) => (
            <React.Fragment key={groupe.group}>
              {groupe.items.map((outil) => {
                const estActif = outilActif === outil.id;
                return (
                  <button
                    key={String(outil.id)}
                    onClick={() => setOutilActif(estActif ? null : outil.id)}
                    title={outil.title}
                    className={`w-10 md:w-12 h-8 md:h-9 flex flex-col items-center justify-center rounded text-[9px] font-bold tracking-tight transition-all leading-tight px-0.5 flex-shrink-0
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
              <div className={`w-px md:w-8 h-6 md:h-px mx-1 md:mx-0 my-0 md:my-1 flex-shrink-0 ${C.separator}`} />
            </React.Fragment>
          ))}
        </div>

        {/* ─── GRAPHIQUE PRINCIPAL ─── */}
        <div className="flex-1 min-w-0 flex-shrink-0">
          {erreur && (
            <div className={`border-b text-xs px-4 py-2 ${C.errBg}`}>
              ⚠️ {erreur}
            </div>
          )}
          <BacktestChart
            ref={chartRef}
            activeTool={outilActif}
            onDrawingComplete={() => setOutilActif(null)}
            height={hauteurGraphique}
            theme={theme}
            timeframe={timeframe}
          />
        </div>

        {/* ─── PANEL DROIT : Position active + Historique ─── */}
        {/* Se place en-dessous du graphique sur mobile, et à sa droite sur écran moyen (md) */}
        <div className={`w-full md:w-[280px] flex flex-col border-t md:border-t-0 md:border-l flex-shrink-0 ${C.bgPanel}`}>

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
          <div className="flex-grow md:flex-1 md:overflow-y-auto">
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
                        {(() => {
                          const tradeUid = `${trade.dateEntree}-${trade.prixEntree}`;
                          const estEnExport = exportantTradeId === tradeUid;
                          return (
                            <button
                              onClick={() => exporterVersJournal(trade)}
                              disabled={exportantTradeId !== null}
                              className="flex-1 py-1.5 bg-[#2962ff] hover:bg-[#2979ff] text-white text-[10px] font-bold rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                            >
                              {estEnExport ? (
                                <>
                                  <span className="w-3.5 h-3.5 border border-white/20 border-t-white rounded-full animate-spin"></span>
                                  Capture du graphique...
                                </>
                              ) : (
                                journalDest === 'global' ? 'Enregistrer dans Global' :
                                journalDest === 'bias' ? 'Enregistrer dans Biais' :
                                journalDest === 'poi' ? 'Enregistrer dans POI' :
                                'Enregistrer dans Confirmation'
                              )}
                            </button>
                          );
                        })()}
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
