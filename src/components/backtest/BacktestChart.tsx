import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  ColorType,
  CandlestickSeries,
  IChartApi,
  ISeriesApi,
  Time,
} from 'lightweight-charts';
import {
  DrawingManager,
  getToolRegistry,
} from 'lightweight-charts-drawing';
import { useBacktestStore } from '@/store/backtestStore';

// ─── Correspondance outil → nombre d'ancres et instructions ─────────────────
// Définit combien de clics sont nécessaires et ce qu'il faut expliquer à l'utilisateur.
// ⚠️ Pour les outils de position Long/Short, l'ordre des ancres attendu par la librairie
// de dessin est : [0] = Entrée, [1] = Stop Loss, [2] = Take Profit.
const CONFIG_OUTILS: Record<string, {
  ancres: 1 | 2 | 3;
  instructions: string[];   // Message pour chaque étape
  couleurPreview: string;   // Couleur du trait de prévisualisation
}> = {
  'horizontal-line': {
    ancres: 1,
    instructions: ['Cliquez sur le graphique pour poser la ligne horizontale'],
    couleurPreview: '#2962ff',
  },
  'vertical-line': {
    ancres: 1,
    instructions: ['Cliquez sur le graphique pour poser la ligne verticale'],
    couleurPreview: '#2962ff',
  },
  'trend-line': {
    ancres: 2,
    instructions: ['Point A : cliquez pour poser le début de la ligne', 'Point B : cliquez pour terminer la ligne'],
    couleurPreview: '#2962ff',
  },
  'ray': {
    ancres: 2,
    instructions: ['Origine du rayon : cliquez ici', 'Direction : cliquez pour fixer l\'angle'],
    couleurPreview: '#2962ff',
  },
  'extended-line': {
    ancres: 2,
    instructions: ['Point A : cliquez pour commencer', 'Point B : cliquez pour terminer (la ligne s\'étend à l\'infini)'],
    couleurPreview: '#2962ff',
  },
  'rectangle': {
    ancres: 2,
    instructions: ['Premier coin : cliquez pour commencer la zone', 'Coin opposé : cliquez pour fermer le rectangle'],
    couleurPreview: '#2962ff',
  },
  'fib-retracement': {
    ancres: 2,
    instructions: ['Sommet ou creux : cliquez ici', 'Bas ou haut opposé : cliquez pour tracer les niveaux Fibonacci'],
    couleurPreview: '#ff9800',
  },
  'long-position': {
    ancres: 3,
    instructions: [
      '① Entrée : cliquez pour poser le prix d\'entrée du Long',
      '② Stop Loss : cliquez pour poser le Stop Loss (en-dessous de l\'entrée)',
      '③ Take Profit : cliquez pour poser le Take Profit (au-dessus de l\'entrée)',
    ],
    couleurPreview: '#26a69a',
  },
  'short-position': {
    ancres: 3,
    instructions: [
      '① Entrée : cliquez pour poser le prix d\'entrée du Short',
      '② Stop Loss : cliquez pour poser le Stop Loss (au-dessus de l\'entrée)',
      '③ Take Profit : cliquez pour poser le Take Profit (en-dessous de l\'entrée)',
    ],
    couleurPreview: '#ef5350',
  },
};

interface BacktestChartProps {
  activeTool: string | null;
  height: number;
  theme: 'dark' | 'light';
}

// Palettes de couleurs par thème
const THEMES = {
  dark: { background: '#131722', text: '#b2b5be', grid: '#1e222d' },
  light: { background: '#ffffff', text: '#131722', grid: '#f0f3fa' },
};

/**
 * Composant principal du graphique de Backtesting.
 * 
 * Gestion de l'affichage interactif :
 * 1. Chaque clic sur le graphique est capturé manuellement.
 * 2. Les coordonnées sont converties en date/prix.
 * 3. Un canvas overlay transparent dessine la prévisualisation en temps réel (pointillés).
 * 4. P&L temps réel : Si un trade est actif, le chemin parcouru depuis le prix d'entrée
 *    est ombré en vert (gain) ou en rouge (perte) avec affichage du PnL en %.
 */
export function BacktestChart({ activeTool, height, theme }: BacktestChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const donneesCompletes = useBacktestStore((s) => s.donneesCompletes);
  const indexCourant = useBacktestStore((s) => s.indexCourant);
  const ouvrirPosition = useBacktestStore((s) => s.ouvrirPosition);
  const positionActive = useBacktestStore((s) => s.positionActive);

  // Références persistantes au graphique
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const managerRef = useRef<DrawingManager | null>(null);

  // État de l'outil en cours (ancres déjà posées + position souris)
  const [etapeActuelle, setEtapeActuelle] = useState(0);
  const ancresEnCoursRef = useRef<Array<{ time: any; price: number; px: number; py: number }>>([]);
  const sourisPixelRef = useRef<{ x: number; y: number } | null>(null);

  // ID du dessin sélectionné pour suppression
  const [idDessinSelectionne, setIdDessinSelectionne] = useState<string | null>(null);

  // Référence persistante pour éviter les fermetures obsolètes dans les callbacks d'événements
  const stateRef = useRef({
    activeTool,
    indexCourant,
    positionActive,
    donneesCompletes,
    theme,
  });

  useEffect(() => {
    stateRef.current = {
      activeTool,
      indexCourant,
      positionActive,
      donneesCompletes,
      theme,
    };
    redessinerOverlay();
  }, [activeTool, indexCourant, positionActive, donneesCompletes, theme]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Dessin complet de la prévisualisation et du P&L actif sur l'overlay ───
  const redessinerOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const {
      activeTool: currentTool,
      indexCourant: currentIndex,
      positionActive: currentPos,
      donneesCompletes: currentData,
    } = stateRef.current;

    const chart = chartRef.current;
    const series = seriesRef.current;

    if (!chart || !series) return;

    // 1️⃣ Affichage de l'ombrage dynamique P&L (style TradingView)
    if (currentPos && currentIndex < currentData.length) {
      const bougieEntreeTime = currentPos.dateEntree;
      const bougieActuelle = currentData[currentIndex];

      if (bougieActuelle) {
        // Conversion coordonnées
        const xEntry = chart.timeScale().timeToCoordinate(bougieEntreeTime as Time);
        const xCurrent = chart.timeScale().timeToCoordinate(bougieActuelle.time as Time);
        const yEntry = series.priceToCoordinate(currentPos.prixEntree);
        const yCurrent = series.priceToCoordinate(bougieActuelle.close);

        if (xEntry !== null && xCurrent !== null && yEntry !== null && yCurrent !== null) {
          const x = Math.min(xEntry, xCurrent);
          const width = Math.abs(xCurrent - xEntry);
          const y = Math.min(yEntry, yCurrent);
          const heightBox = Math.abs(yCurrent - yEntry);

          // Profit si le prix va dans le bon sens
          // Rappel : l'axe Y du canvas augmente vers le BAS (yCurrent < yEntry = hausse du prix)
          const estProfit = currentPos.direction === 'long'
            ? yCurrent < yEntry
            : yCurrent > yEntry;

          ctx.save();
          // Couleur de fond semi-transparente
          ctx.fillStyle = estProfit
            ? 'rgba(38, 166, 154, 0.25)' // Vert TradingView
            : 'rgba(239, 83, 80, 0.25)';  // Rouge TradingView
          ctx.fillRect(x, y, width, heightBox);

          // Ligne verticale de progression du prix
          ctx.strokeStyle = estProfit ? '#26a69a' : '#ef5350';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(xCurrent, yEntry);
          ctx.lineTo(xCurrent, yCurrent);
          ctx.stroke();

          // Calcul et affichage du PnL flottant en %
          const pnlPct = currentPos.direction === 'long'
            ? ((bougieActuelle.close - currentPos.prixEntree) / currentPos.prixEntree) * 100
            : ((currentPos.prixEntree - bougieActuelle.close) / currentPos.prixEntree) * 100;

          ctx.fillStyle = estProfit ? '#26a69a' : '#ef5350';
          ctx.font = 'bold 10px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(
            `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`,
            xCurrent,
            Math.min(yEntry, yCurrent) - 6
          );
          ctx.restore();
        }
      }
    }

    // 2️⃣ Dessin de la prévisualisation de l'outil en cours de tracé
    const config = currentTool ? CONFIG_OUTILS[currentTool] : null;
    const ancres = ancresEnCoursRef.current;
    const souris = sourisPixelRef.current;

    if (config && ancres.length > 0 && souris) {
      const couleur = config.couleurPreview;
      ctx.save();
      ctx.strokeStyle = couleur;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.globalAlpha = 0.8;

      // Points d'ancrage déjà posés
      ancres.forEach((ancre) => {
        ctx.beginPath();
        ctx.arc(ancre.px, ancre.py, 5, 0, Math.PI * 2);
        ctx.fillStyle = couleur;
        ctx.fill();
      });

      // Ligne élastique vers la souris
      if (ancres.length >= 1) {
        const derniere = ancres[ancres.length - 1];
        ctx.beginPath();
        ctx.moveTo(derniere.px, derniere.py);
        ctx.lineTo(souris.x, souris.y);
        ctx.stroke();
      }
      ctx.restore();
    }
  }, []);

  // ─── 1. Initialisation unique du graphique ─────────────────────────────────
  useEffect(() => {
    if (!chartContainerRef.current) return;
    console.log('🚀 [BacktestChart] Initialisation du graphique...');

    const couleurs = THEMES[theme] ?? THEMES.dark;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: couleurs.background },
        textColor: couleurs.text,
        fontFamily: 'Inter, Trebuchet MS, sans-serif',
        fontSize: 12,
      },
      width: chartContainerRef.current.clientWidth,
      height,
      grid: {
        vertLines: { color: couleurs.grid },
        horzLines: { color: couleurs.grid },
      },
      crosshair: {
        mode: 1,
        vertLine: { labelBackgroundColor: couleurs.background },
        horzLine: { labelBackgroundColor: couleurs.background },
      },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
    });
    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    seriesRef.current = series;

    const manager = new DrawingManager();
    manager.attach(chart, series as ISeriesApi<any>, chartContainerRef.current);
    managerRef.current = manager;

    // Événements de sélection du DrawingManager
    const desabonnerSelection = manager.on('drawing:selected', (event: any) => {
      setIdDessinSelectionne(event.drawingId ?? null);
    });
    const desabonnerDeselection = manager.on('drawing:deselected', () => {
      setIdDessinSelectionne(null);
    });
    const desabonnerSuppression = manager.on('drawing:removed', () => {
      setIdDessinSelectionne(null);
    });

    // Callback pour redessiner l'overlay lors des changements d'échelle / scroll
    const gererScale = () => {
      redessinerOverlay();
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(gererScale);

    const observateur = new ResizeObserver(() => {
      if (chartContainerRef.current && chartRef.current) {
        const largeur = chartContainerRef.current.clientWidth;
        chartRef.current.applyOptions({ width: largeur });
        if (overlayCanvasRef.current) overlayCanvasRef.current.width = largeur;
        redessinerOverlay();
      }
    });
    observateur.observe(chartContainerRef.current);

    return () => {
      desabonnerSelection();
      desabonnerDeselection();
      desabonnerSuppression();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(gererScale);
      manager.detach();
      chart.remove();
      observateur.disconnect();
      chartRef.current = null;
      seriesRef.current = null;
      managerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 5. Synchronisation des données du replay ───────────────────────────────
  useEffect(() => {
    if (!seriesRef.current || donneesCompletes.length === 0) return;
    const donneesVisibles = donneesCompletes
      .slice(0, indexCourant + 1)
      .map((b) => ({ ...b, time: b.time as Time }));
    seriesRef.current.setData(donneesVisibles);

    // Force le graphique à scroller en laissant une marge de 15 bougies sur la droite.
    // Ainsi, la bougie active reste en place et le graphique se décale proprement vers la gauche.
    if (chartRef.current) {
      chartRef.current.timeScale().scrollToPosition(15, false);
    }
  }, [donneesCompletes, indexCourant]);

  // ─── 2. Changement de thème ─────────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current) return;
    const couleurs = THEMES[theme];
    chartRef.current.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: couleurs.background },
        textColor: couleurs.text,
      },
      grid: { vertLines: { color: couleurs.grid }, horzLines: { color: couleurs.grid } },
    });
    redessinerOverlay();
  }, [theme, redessinerOverlay]);

  // ─── 3. Changement de hauteur ───────────────────────────────────────────────
  useEffect(() => {
    if (chartRef.current) chartRef.current.applyOptions({ height });
    if (overlayCanvasRef.current) overlayCanvasRef.current.height = height;
    redessinerOverlay();
  }, [height, redessinerOverlay]);

  // ─── 4. Suppression du dessin sélectionné ───────────────────────────────────
  useEffect(() => {
    const gererTouche = (e: KeyboardEvent) => {
      if (activeTool !== null) return;
      if (!idDessinSelectionne) return;
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      e.preventDefault();
      supprimerDessinSelectionne();
    };
    window.addEventListener('keydown', gererTouche);
    return () => window.removeEventListener('keydown', gererTouche);
  }, [activeTool, idDessinSelectionne]); // eslint-disable-line react-hooks/exhaustive-deps

  const supprimerDessinSelectionne = () => {
    const manager = managerRef.current;
    if (!manager || !idDessinSelectionne) return;
    manager.removeDrawing(idDessinSelectionne);
    setIdDessinSelectionne(null);
  };

  // ─── 5. Gestion des outils de tracé interactifs ─────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const manager = managerRef.current;
    const conteneur = chartContainerRef.current;
    const canvas = overlayCanvasRef.current;

    // Reset
    setEtapeActuelle(0);
    ancresEnCoursRef.current = [];
    sourisPixelRef.current = null;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }

    if (!activeTool || !chart || !series || !manager || !conteneur || !canvas) {
      if (conteneur) {
        conteneur.style.cursor = '';
        conteneur.style.touchAction = '';
      }
      return;
    }

    const config = CONFIG_OUTILS[activeTool];
    if (!config) return;

    conteneur.style.cursor = 'crosshair';
    conteneur.style.touchAction = 'none'; // Désactive le scroll de la page lors du tracé sur tablette

    const eventToAncre = (event: PointerEvent) => {
      const rect = conteneur.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const time = chart.timeScale().coordinateToTime(px);
      const price = series.coordinateToPrice(py);
      if (time === null || price === null) return null;
      return { time, price, px, py };
    };

    const gererMouvement = (event: PointerEvent) => {
      const rect = conteneur.getBoundingClientRect();
      sourisPixelRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      redessinerOverlay();
    };

    const gererClic = (event: PointerEvent) => {
      const ancre = eventToAncre(event);
      if (!ancre) return;

      ancresEnCoursRef.current.push(ancre);
      const nouvelleEtape = ancresEnCoursRef.current.length;
      setEtapeActuelle(nouvelleEtape);

      if (nouvelleEtape >= config.ancres) {
        const ancresFinales = ancresEnCoursRef.current.map((a) => ({ time: a.time, price: a.price }));
        const idUnique = `${activeTool}-${Date.now()}`;
        const dessin = getToolRegistry().createDrawing(activeTool, idUnique, ancresFinales, {}, {});

        if (dessin) {
          manager.addDrawing(dessin);

          // Si c'est une position, on l'enregistre dans le store de backtesting
          if (activeTool === 'long-position' || activeTool === 'short-position') {
            const direction = activeTool === 'long-position' ? 'long' as const : 'short' as const;
            // ⚠️ Alignement parfait avec la bibliothèque :
            // ancresFinales[0] = prix entrée, [1] = Stop Loss, [2] = Take Profit
            const prixEntree = ancresFinales[0].price;
            const prixSL = ancresFinales[1].price;
            const prixTP = ancresFinales[2].price;
            ouvrirPosition(direction, prixEntree, prixSL, prixTP);
          }
        }

        ancresEnCoursRef.current = [];
        setEtapeActuelle(0);
        sourisPixelRef.current = null;
        redessinerOverlay();
      }
    };

    // Utilisation de la phase de capture (true) et des PointerEvents pour unifier souris et tactile (tablette)
    conteneur.addEventListener('pointerdown', gererClic, true);
    conteneur.addEventListener('pointermove', gererMouvement, true);

    return () => {
      conteneur.removeEventListener('pointerdown', gererClic, true);
      conteneur.removeEventListener('pointermove', gererMouvement, true);
      conteneur.style.cursor = '';
      conteneur.style.touchAction = '';
      ancresEnCoursRef.current = [];
      sourisPixelRef.current = null;
      redessinerOverlay();
    };
  }, [activeTool, ouvrirPosition, redessinerOverlay]);

  const config = activeTool ? CONFIG_OUTILS[activeTool] : null;
  const messageInstruction = config
    ? config.instructions[Math.min(etapeActuelle, config.instructions.length - 1)]
    : null;
  const progresseAncres = config ? `${etapeActuelle}/${config.ancres}` : null;

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Barre de statut / instructions */}
      <div className={`flex items-center gap-3 px-4 py-2 text-[11px] border-b flex-shrink-0 transition-colors
        ${theme === 'dark' ? 'bg-[#1e222d] border-[#2a2e39] text-[#787b86]' : 'bg-[#f0f3fa] border-[#e0e3eb] text-[#434651]'}`}
      >
        {messageInstruction ? (
          <>
            <span className="font-bold text-[#2962ff] font-mono shrink-0">{progresseAncres}</span>
            <span className={`font-medium ${config?.couleurPreview === '#26a69a' ? 'text-[#26a69a]' : config?.couleurPreview === '#ef5350' ? 'text-[#ef5350]' : 'text-[#d1d4dc]'}`}>
              {messageInstruction}
            </span>
          </>
        ) : (
          <>
            <span className="opacity-50">↖</span>
            <span>
              {activeTool === null
                ? 'Mode Sélection — Cliquez sur un dessin pour le modifier/supprimer ou déplacer ses ancres'
                : 'Outil de dessin sélectionné — cliquez sur le graphique pour commencer'
              }
            </span>
          </>
        )}
        {activeTool && (
          <span className="ml-auto text-[10px] opacity-50">
            Appuyez sur <kbd className={`px-1 rounded text-[9px] ${theme === 'dark' ? 'bg-[#2a2e39]' : 'bg-[#e0e3eb]'}`}>Esc</kbd> pour annuler
          </span>
        )}
      </div>

      <div className="relative flex-1">
        <div ref={chartContainerRef} className="w-full h-full" />
        <canvas
          ref={overlayCanvasRef}
          width={chartContainerRef.current?.clientWidth ?? 800}
          height={height}
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 10 }}
        />

        {/* Bouton de suppression flottant */}
        {idDessinSelectionne && activeTool === null && (
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
            <button
              onClick={supprimerDessinSelectionne}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ef5350] hover:bg-[#e53935] text-white text-[11px] font-bold rounded shadow-lg transition-colors"
              title="Supprimer le dessin (Delete)"
            >
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
                <path d="M6 2a1 1 0 0 0-1 1v.5H3.5a.5.5 0 0 0 0 1H4v8a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-8h.5a.5.5 0 0 0 0-1H11V3a1 1 0 0 0-1-1H6zm1 1h2v.5H7V3zm-2 2h6v7.5H5V5z"/>
              </svg>
              Supprimer
            </button>
            <span className={`text-[9px] px-1.5 py-0.5 rounded
              ${theme === 'dark' ? 'bg-[#2a2e39] text-[#787b86]' : 'bg-[#e0e3eb] text-[#434651]'}`}>
              ou <kbd>Del</kbd>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
