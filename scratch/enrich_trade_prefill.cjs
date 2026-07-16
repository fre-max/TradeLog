const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/backtest/BacktestWorkspace.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Normalisation des retours à la ligne
content = content.replace(/\r\n/g, '\n');

// Détecter si les fonctions d'aide sont déjà là, sinon les injecter avant initialiserPlanificationTrade
const helpers = `  // Calcule automatiquement la session de trading en fonction de l'heure UTC de la bougie d'entrée
  const detecterSession = (timestampUnix: number): string => {
    const date = new Date(timestampUnix * 1000);
    const heure = date.getUTCHours();
    // Session London : 07h00 - 12h00 UTC
    // Session New York : 12h00 - 20h00 UTC
    // Session Asian : 20h00 - 07h00 UTC
    if (heure >= 7 && heure < 12) return 'London';
    if (heure >= 12 && heure < 20) return 'New York';
    return 'Asian';
  };

  // Convertit un timestamp Unix en format d'heure HH:MM pour le formulaire
  const formaterHeure = (timestampUnix: number | undefined): string => {
    if (!timestampUnix) return '';
    const date = new Date(timestampUnix * 1000);
    const h = String(date.getUTCHours()).padStart(2, '0');
    const m = String(date.getUTCMinutes()).padStart(2, '0');
    return \`\${h}:\${m}\`;
  };

  // Propose une unité de temps (timeframe) logique et supérieure pour le POI
  const calculerPoiTimeframe = (tfBacktest: string): string => {
    switch (tfBacktest) {
      case '1m': return 'M15';
      case '3m': return 'M15';
      case '5m': return 'H1';
      case '15m': return 'H1';
      case '30m': return 'H4';
      case '1h': return 'H4';
      case '4h': return 'D1';
      case '1d': return 'W1';
      default: return 'H1';
    }
  };`;

// Remplacer initialiserPlanificationTrade avec la version enrichie et intelligente
const targetPlanif = `  const initialiserPlanificationTrade = useCallback(async (position: PositionSimulee) => {
    setInitialisantPlanification(true);
    // Capture automatique au moment de la pose de la position
    const imageAvant = await capturerGraphique('avant');

    const dateTexte = typeof position.dateEntree === 'number'
      ? new Date(position.dateEntree * 1000).toISOString().split('T')[0]
      : String(position.dateEntree).split('T')[0];

    const plannedDiff = Math.abs(position.takeProfit - position.prixEntree);
    const plannedRisk = Math.abs(position.prixEntree - position.stopLoss);
    const rrP = plannedRisk > 0 ? (plannedDiff / plannedRisk).toFixed(2) : '1.00';

    const imageAvant_obj = imageAvant ?? null;

    const timestampUnix = typeof position.dateEntree === 'number'
      ? position.dateEntree
      : Math.floor(new Date(position.dateEntree).getTime() / 1000);

    const contextReplay = {
      pair: actif !== 'Aucun actif' && actif ? actif : paireCloud,
      annee: anneeCloud,
      timeframe: timeframe,
      timestamp: timestampUnix,
    };

    const prefillObj = {
      pair: actif !== 'Aucun actif' && actif ? actif : paireCloud,
      direction: position.direction,
      date_backtested: dateTexte,
      result: 'win', // par défaut
      journal_type: journalDest,
      entry_price: position.prixEntree.toFixed(5),
      entry_sl: position.stopLoss.toFixed(5),
      entry_tp: position.takeProfit.toFixed(5),
      rr_planned: rrP,
      // Configuration des 3 sections d'avant-position
      biais_timeframe: mapperTimeframe(timeframe),
      biais_direction: position.direction === 'long' ? 'Haussier' : 'Baissier',
      biais_images: imageAvant_obj ? [imageAvant_obj] : [],
      poi_images: imageAvant_obj ? [imageAvant_obj] : [],
      entry_images: imageAvant_obj ? [imageAvant_obj] : [],
      backtest_context: contextReplay,
    };

    console.log("📡 [Backtest] Pré-remplissage Planification :", prefillObj);
    openNewTradeWithPrefill(prefillObj);

    setInitialisantPlanification(false);
  }, [actif, paireCloud, journalDest, timeframe, openNewTradeWithPrefill, capturerGraphique]);`;

const replacementPlanif = helpers + `

  const initialiserPlanificationTrade = useCallback(async (position: PositionSimulee) => {
    setInitialisantPlanification(true);
    // Capture automatique au moment de la pose de la position
    const imageAvant = await capturerGraphique('avant');

    const dateTexte = typeof position.dateEntree === 'number'
      ? new Date(position.dateEntree * 1000).toISOString().split('T')[0]
      : String(position.dateEntree).split('T')[0];

    const plannedDiff = Math.abs(position.takeProfit - position.prixEntree);
    const plannedRisk = Math.abs(position.prixEntree - position.stopLoss);
    const rrP = plannedRisk > 0 ? (plannedDiff / plannedRisk).toFixed(2) : '1.00';

    const imageAvant_obj = imageAvant ?? null;

    const timestampUnix = typeof position.dateEntree === 'number'
      ? position.dateEntree
      : Math.floor(new Date(position.dateEntree).getTime() / 1000);

    const contextReplay = {
      pair: actif !== 'Aucun actif' && actif ? actif : paireCloud,
      annee: anneeCloud,
      timeframe: timeframe,
      timestamp: timestampUnix,
    };

    const prefillObj = {
      pair: actif !== 'Aucun actif' && actif ? actif : paireCloud,
      direction: position.direction,
      date_backtested: dateTexte,
      result: 'win' as const,
      journal_type: journalDest,
      entry_price: position.prixEntree.toFixed(5),
      entry_sl: position.stopLoss.toFixed(5),
      entry_tp: position.takeProfit.toFixed(5),
      rr_planned: rrP,
      
      // -- Enrichissements intelligents --
      session: detecterSession(timestampUnix),
      entry_time: formaterHeure(timestampUnix),
      duree_estimee_heures: position.dureeEstimeeHeures !== undefined ? String(position.dureeEstimeeHeures) : '',
      duree_estimee_bougies: position.dureeEstimeeBougies !== undefined ? String(position.dureeEstimeeBougies) : '',
      
      biais_timeframe: mapperTimeframe(timeframe),
      biais_direction: position.direction === 'long' ? 'Haussier' : 'Baissier',
      poi_timeframe: calculerPoiTimeframe(timeframe),
      poi_type: 'Order Block',
      entry_timeframe: mapperTimeframe(timeframe),

      // Configuration des 3 sections d'avant-position
      biais_images: imageAvant_obj ? [imageAvant_obj] : [],
      poi_images: imageAvant_obj ? [imageAvant_obj] : [],
      entry_images: imageAvant_obj ? [imageAvant_obj] : [],
      backtest_context: contextReplay,
    };

    console.log("📡 [Backtest] Pré-remplissage Planification :", prefillObj);
    openNewTradeWithPrefill(prefillObj);

    setInitialisantPlanification(false);
  }, [actif, paireCloud, journalDest, timeframe, openNewTradeWithPrefill, capturerGraphique]);`;

if (content.includes(targetPlanif)) {
  content = content.replace(targetPlanif, replacementPlanif);
  console.log("✅ Étape 1 Planification enrichie avec succès !");
} else {
  console.error("❌ Impossible d'enrichir l'Étape 1 !");
  process.exit(1);
}

// Remplacer initialiserResolutionTrade avec la version enrichie et intelligente
const targetResol = `  const initialiserResolutionTrade = useCallback(async (position: PositionSimulee) => {
    setInitialisantResolution(true);
    // Capture automatique à la clôture du trade
    const imageApres = await capturerGraphique('apres');

    const imageApres_obj = imageApres ?? null;

    const resultMapping = position.resultat === 'win' ? 'win' as const
      : position.resultat === 'loss' ? 'loss' as const
      : position.resultat === 'breakeven' ? 'breakeven' as const
      : 'missed' as const;

    const plannedDiff = Math.abs(position.takeProfit - position.prixEntree);
    const plannedRisk = Math.abs(position.prixEntree - position.stopLoss);
    const rrP = plannedRisk > 0 ? (plannedDiff / plannedRisk).toFixed(2) : '1.00';

    const realizedDiff = Math.abs((position.prixSortie || 0) - position.prixEntree);
    const rrR = plannedRisk > 0 ? (realizedDiff / plannedRisk).toFixed(2) : '0';

    const timestampUnix = typeof position.dateEntree === 'number'
      ? position.dateEntree
      : Math.floor(new Date(position.dateEntree).getTime() / 1000);

    const contextReplay = {
      pair: actif !== 'Aucun actif' && actif ? actif : paireCloud,
      annee: anneeCloud,
      timeframe: timeframe,
      timestamp: timestampUnix,
    };

    const prefillObj = {
      pair: actif !== 'Aucun actif' && actif ? actif : paireCloud,
      direction: position.direction,
      result: resultMapping,
      journal_type: journalDest,
      entry_price: position.prixEntree.toFixed(5),
      entry_sl: position.stopLoss.toFixed(5),
      entry_tp: position.takeProfit.toFixed(5),
      rr_planned: rrP,
      rr_realized: rrR,
      pnl: position.pnl !== undefined ? Number(position.pnl.toFixed(2)) : 0,
      duree_reelle_bougies: position.dureeReelleBougies !== undefined ? String(position.dureeReelleBougies) : '',
      entry_images: imageApres_obj ? [imageApres_obj] : [],
      backtest_context: contextReplay,
    };

    console.log("📡 [Backtest] Pré-remplissage Résolution :", prefillObj);
    openNewTradeWithPrefill(prefillObj);

    setInitialisantResolution(false);
  }, [actif, paireCloud, journalDest, openNewTradeWithPrefill, capturerGraphique]);`;

const replacementResol = `  const initialiserResolutionTrade = useCallback(async (position: PositionSimulee) => {
    setInitialisantResolution(true);
    // Capture automatique à la clôture du trade
    const imageApres = await capturerGraphique('apres');

    const imageApres_obj = imageApres ?? null;

    const resultMapping = position.resultat === 'win' ? 'win' as const
      : position.resultat === 'loss' ? 'loss' as const
      : position.resultat === 'breakeven' ? 'breakeven' as const
      : 'missed' as const;

    const plannedDiff = Math.abs(position.takeProfit - position.prixEntree);
    const plannedRisk = Math.abs(position.prixEntree - position.stopLoss);
    const rrP = plannedRisk > 0 ? (plannedDiff / plannedRisk).toFixed(2) : '1.00';

    const realizedDiff = Math.abs((position.prixSortie || 0) - position.prixEntree);
    const rrR = plannedRisk > 0 ? (realizedDiff / plannedRisk).toFixed(2) : '0';

    const timestampUnix = typeof position.dateEntree === 'number'
      ? position.dateEntree
      : Math.floor(new Date(position.dateEntree).getTime() / 1000);

    const timestampSortie = typeof position.dateSortie === 'number'
      ? position.dateSortie
      : position.dateSortie ? Math.floor(new Date(position.dateSortie).getTime() / 1000) : undefined;

    // Déterminer le type de sortie exact (TP, SL, ou Manuel)
    let exitType: 'tp' | 'sl' | 'manual' | 'breakeven' = 'manual';
    if (position.resultat === 'win') {
      exitType = 'tp';
    } else if (position.resultat === 'loss') {
      exitType = 'sl';
    } else if (position.resultat === 'breakeven') {
      exitType = 'breakeven';
    }

    const contextReplay = {
      pair: actif !== 'Aucun actif' && actif ? actif : paireCloud,
      annee: anneeCloud,
      timeframe: timeframe,
      timestamp: timestampUnix,
    };

    const prefillObj = {
      pair: actif !== 'Aucun actif' && actif ? actif : paireCloud,
      direction: position.direction,
      result: resultMapping,
      journal_type: journalDest,
      entry_price: position.prixEntree.toFixed(5),
      entry_sl: position.stopLoss.toFixed(5),
      entry_tp: position.takeProfit.toFixed(5),
      rr_planned: rrP,
      rr_realized: rrR,
      pnl: position.pnl !== undefined ? Number(position.pnl.toFixed(2)) : 0,
      duree_reelle_bougies: position.dureeReelleBougies !== undefined ? String(position.dureeReelleBougies) : '',
      
      // -- Enrichissements intelligents --
      session: detecterSession(timestampUnix),
      entry_time: formaterHeure(timestampUnix),
      exit_time: timestampSortie ? formaterHeure(timestampSortie) : '',
      exit_type: exitType,
      duree_estimee_heures: position.dureeEstimeeHeures !== undefined ? String(position.dureeEstimeeHeures) : '',
      duree_estimee_bougies: position.dureeEstimeeBougies !== undefined ? String(position.dureeEstimeeBougies) : '',
      
      biais_timeframe: mapperTimeframe(timeframe),
      poi_timeframe: calculerPoiTimeframe(timeframe),
      entry_timeframe: mapperTimeframe(timeframe),

      entry_images: imageApres_obj ? [imageApres_obj] : [],
      backtest_context: contextReplay,
    };

    console.log("📡 [Backtest] Pré-remplissage Résolution :", prefillObj);
    openNewTradeWithPrefill(prefillObj);

    setInitialisantResolution(false);
  }, [actif, paireCloud, journalDest, timeframe, openNewTradeWithPrefill, capturerGraphique]);`;

if (content.includes(targetResol)) {
  content = content.replace(targetResol, replacementResol);
  console.log("✅ Étape 2 Résolution enrichie avec succès !");
} else {
  console.error("❌ Impossible d'enrichir l'Étape 2 !");
  process.exit(1);
}

// Ré-appliquer la normalisation CRLF
const finalContentCRLF = content.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, finalContentCRLF, 'utf8');
console.log("✅ Script d'enrichissement intelligent complété !");
