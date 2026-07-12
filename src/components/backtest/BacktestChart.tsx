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
  LongPosition,
  ShortPosition,
  TrendLine,
  Rectangle,
  FibRetracement,
  HorizontalLine,
  VerticalLine,
  Ray,
  ExtendedLine,
  LongPositionPaneView,
  ShortPositionPaneView,
} from 'lightweight-charts-drawing';
import { useBacktestStore } from '@/store/backtestStore';

// ─── 🛠️ SEUILS DE DÉTECTION ET TACTILE (Hit Threshold) ──────────────────────
// Augmentation globale des seuils de détection à 30px (au lieu de 5px par défaut)
// pour simplifier la sélection des dessins avec de gros doigts sur tablette.
try {
  (LongPosition as any).HIT_THRESHOLD = 30;
  (ShortPosition as any).HIT_THRESHOLD = 30;
  (TrendLine as any).HIT_THRESHOLD = 30;
  (Rectangle as any).HIT_THRESHOLD = 30;
  (FibRetracement as any).HIT_THRESHOLD = 30;
  (HorizontalLine as any).HIT_THRESHOLD = 30;
  (VerticalLine as any).HIT_THRESHOLD = 30;
  (Ray as any).HIT_THRESHOLD = 30;
  (ExtendedLine as any).HIT_THRESHOLD = 30;
  console.log('✅ [BacktestChart] HIT_THRESHOLD augmenté à 30px pour le tactile.');
} catch (e) {
  console.warn('[BacktestChart] Impossible d\'augmenter HIT_THRESHOLD :', e);
}

// Helper pour tracer une ligne sur le canvas (comme le helper interne `b` de la lib)
function dessinerLigne(ctx: CanvasRenderingContext2D, p1: { x: number; y: number }, p2: { x: number; y: number }, pixelRatio: number) {
  ctx.beginPath();
  ctx.moveTo(p1.x * pixelRatio, p1.y * pixelRatio);
  ctx.lineTo(p2.x * pixelRatio, p2.y * pixelRatio);
  ctx.stroke();
}

// ─── 🐒 MONKEYPATCHING DES RENDERERS LONG & SHORT POSITION ──────────────────
// Remplace le code de rendu par défaut des positions pour lire une 4ème ancre (index 3)
// si elle est définie, afin de pouvoir élargir horizontalement la position par glissement (Drag).
const patcherRenduPosition = (PaneViewClass: any) => {
  try {
    const instanceFactice = new PaneViewClass({
      isValid: () => false,
      options: { visible: false },
      anchors: [],
      positionOptions: {},
      getPositionInfo: () => ({
        entry: 0,
        stopLoss: 0,
        takeProfit: 0,
        risk: 0,
        reward: 0,
        riskRewardRatio: 0,
        riskPercent: 0,
        rewardPercent: 0
      }),
    });
    const renderer = instanceFactice.renderer();
    if (!renderer) return;

    const proto = Object.getPrototypeOf(renderer);
    if (proto && typeof proto.drawImpl === 'function') {
      proto.drawImpl = function (i: any) {
        const { context: t, horizontalPixelRatio: s } = i;
        const e = s;
        const n = this._drawing.getViewport();
        if (!n || !this._drawing.options.visible || !this._drawing.isValid()) return;
        const o = this._drawing.anchors;
        const r = this._drawing.anchorToPixel(o[0], n);
        const a = this._drawing.anchorToPixel(o[1], n);
        const c = this._drawing.anchorToPixel(o[2], n);
        if (!r || !a || !c) return;

        const l = this._drawing.positionOptions;
        const h = this._drawing.getPositionInfo();

        // ⚠️ Notre modification majeure :
        // Si une 4ème ancre est présente, sa coordonnée X sert de largeur (en pixels)
        let d = 200; // Largeur par défaut originale
        if (o.length >= 4) {
          const pixelEnd = this._drawing.anchorToPixel(o[3], n);
          if (pixelEnd) {
            d = Math.max(30, pixelEnd.x - r.x);
          }
        }

        const estLong = this._drawing.type === "long-position";

        t.save();

        // 1️⃣ Zone de Stop Loss (Rouge transparent)
        t.fillStyle = "rgba(239, 83, 80, 0.25)";
        const f = Math.min(r.y, a.y);
        const g = Math.abs(a.y - r.y);
        t.fillRect(r.x * e, f * e, d * e, g * e);
        t.strokeStyle = "#ef5350";
        t.lineWidth = 1 * e;
        t.strokeRect(r.x * e, f * e, d * e, g * e);

        // 2️⃣ Zone de Take Profit (Vert transparent)
        t.fillStyle = "rgba(38, 166, 154, 0.25)";
        const _ = Math.min(r.y, c.y);
        const y = Math.abs(c.y - r.y);
        t.fillRect(r.x * e, _ * e, d * e, y * e);
        t.strokeStyle = "#26a69a";
        t.lineWidth = 1 * e;
        t.strokeRect(r.x * e, _ * e, d * e, y * e);

        // 3️⃣ Ligne de prix d'entrée (Bleu)
        t.strokeStyle = "#2196F3";
        t.lineWidth = 2 * e;
        dessinerLigne(t, { x: r.x, y: r.y }, { x: r.x + d, y: r.y }, e);

        // 4️⃣ Ligne de Stop Loss (Rouge pointillé)
        t.strokeStyle = "#ef5350";
        t.lineWidth = 1.5 * e;
        t.setLineDash([5 * e, 3 * e]);
        dessinerLigne(t, { x: r.x, y: a.y }, { x: r.x + d, y: a.y }, e);

        // 5️⃣ Ligne de Take Profit (Vert continu)
        t.strokeStyle = "#26a69a";
        t.lineWidth = 1.5 * e;
        t.setLineDash([]);
        dessinerLigne(t, { x: r.x, y: c.y }, { x: r.x + d, y: c.y }, e);

        // 6️⃣ Libellés textuels sur la droite
        const xText = 11;
        t.font = `${xText * e}px sans-serif`;
        t.textAlign = "left";
        t.textBaseline = "middle";
        const w = r.x + d + 5;

        t.fillStyle = "#2196F3";
        let textEntry = "Entrée";
        if (l.showPrices) textEntry += `: $${h.entry.toFixed(2)}`;
        t.fillText(textEntry, w * e, r.y * e);

        t.fillStyle = "#ef5350";
        let textSL = "SL";
        if (l.showPrices) textSL += `: $${h.stopLoss.toFixed(2)}`;
        if (l.showPercentage) textSL += ` (-${h.riskPercent.toFixed(2)}%)`;
        t.fillText(textSL, w * e, a.y * e);

        t.fillStyle = "#26a69a";
        let textTP = "TP";
        if (l.showPrices) textTP += `: $${h.takeProfit.toFixed(2)}`;
        if (l.showPercentage) textTP += ` (+${h.rewardPercent.toFixed(2)}%)`;
        t.fillText(textTP, w * e, c.y * e);

        if (l.showRiskReward) {
          t.fillStyle = "#ffffff";
          const rrText = `R:R = 1:${h.riskRewardRatio.toFixed(2)}`;
          const middleY = (r.y + c.y) / 2;
          t.fillText(rrText, (r.x + 10) * e, middleY * e);
        }

        // Tag LONG / SHORT
        t.fillStyle = estLong ? "#26a69a" : "#ef5350";
        t.font = `bold ${13 * e}px sans-serif`;
        t.fillText(estLong ? "LONG" : "SHORT", (r.x + 10) * e, (r.y - 15) * e);

        // 7️⃣ Points d'ancrage (handles de glissement)
        const state = this._drawing.state;
        if (state === "selected" || state === "editing") {
          const points = this._drawing.getControlPoints(n);
          t.fillStyle = "#ffffff";
          t.strokeStyle = "#2196F3";
          t.lineWidth = 2 * e;

          for (const pt of points) {
            let py = pt.y;
            // Pour l'ancre d'élargissement (index 3), on la verrouille visuellement sur la ligne d'entrée bleue
            if (pt.index === 3) {
              py = r.y;
            }
            t.beginPath();
            t.arc(pt.x * e, py * e, 6 * e, 0, Math.PI * 2); // Cercles légèrement plus grands (6)
            t.fill();
            t.stroke();
          }
        }

        t.restore();
      };
    }
  } catch (err) {
    console.error('Erreur lors du monkeypatching de la classe de rendu :', err);
  }
};

// Application automatique du patch
patcherRenduPosition(LongPositionPaneView);
patcherRenduPosition(ShortPositionPaneView);


// ─── CONFIGURATION OUTILS DESSIN ─────────────────────────────────────────────
const CONFIG_OUTILS: Record<string, {
  ancres: 1 | 2 | 3;
  instructions: string[];
  couleurPreview: string;
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

const THEMES = {
  dark: { background: '#131722', text: '#b2b5be', grid: '#1e222d' },
  light: { background: '#ffffff', text: '#131722', grid: '#f0f3fa' },
};

export function BacktestChart({ activeTool, height, theme }: BacktestChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const donneesCompletes = useBacktestStore((s) => s.donneesCompletes);
  const indexCourant = useBacktestStore((s) => s.indexCourant);
  const ouvrirPosition = useBacktestStore((s) => s.ouvrirPosition);
  const positionActive = useBacktestStore((s) => s.positionActive);

  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const managerRef = useRef<DrawingManager | null>(null);

  const [etapeActuelle, setEtapeActuelle] = useState(0);
  const ancresEnCoursRef = useRef<Array<{ time: any; price: number; px: number; py: number }>>([]);
  const sourisPixelRef = useRef<{ x: number; y: number } | null>(null);
  const [idDessinSelectionne, setIdDessinSelectionne] = useState<string | null>(null);

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

    // 1️⃣ Ombrage dynamique du P&L actif
    if (currentPos && currentIndex < currentData.length) {
      const bougieEntreeTime = currentPos.dateEntree;
      const bougieActuelle = currentData[currentIndex];

      if (bougieActuelle) {
        const xEntry = chart.timeScale().timeToCoordinate(bougieEntreeTime as Time);
        const xCurrent = chart.timeScale().timeToCoordinate(bougieActuelle.time as Time);
        const yEntry = series.priceToCoordinate(currentPos.prixEntree);
        const yCurrent = series.priceToCoordinate(bougieActuelle.close);

        if (xEntry !== null && xCurrent !== null && yEntry !== null && yCurrent !== null) {
          const x = Math.min(xEntry, xCurrent);
          const width = Math.abs(xCurrent - xEntry);
          const y = Math.min(yEntry, yCurrent);
          const heightBox = Math.abs(yCurrent - yEntry);

          const estProfit = currentPos.direction === 'long'
            ? yCurrent < yEntry
            : yCurrent > yEntry;

          ctx.save();
          ctx.fillStyle = estProfit ? 'rgba(38, 166, 154, 0.25)' : 'rgba(239, 83, 80, 0.25)';
          ctx.fillRect(x, y, width, heightBox);

          ctx.strokeStyle = estProfit ? '#26a69a' : '#ef5350';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(xCurrent, yEntry);
          ctx.lineTo(xCurrent, yCurrent);
          ctx.stroke();

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

    // 2️⃣ Dessin preview outil de tracé
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

      ancres.forEach((ancre) => {
        ctx.beginPath();
        ctx.arc(ancre.px, ancre.py, 5, 0, Math.PI * 2);
        ctx.fillStyle = couleur;
        ctx.fill();
      });

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

  // ─── Initialisation unique ──────────────────────────────────────────────────
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

    // Abonnements DrawingManager
    const desabonnerSelection = manager.on('drawing:selected', (event: any) => {
      setIdDessinSelectionne(event.drawingId ?? null);
    });
    const desabonnerDeselection = manager.on('drawing:deselected', () => {
      setIdDessinSelectionne(null);
    });
    const desabonnerSuppression = manager.on('drawing:removed', () => {
      setIdDessinSelectionne(null);
    });

    const gererScale = () => {
      redessinerOverlay();
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(gererScale);

    // ─── 📱 ROUTAGE TACTILE / TABLETTE ─────────────────────────────────────
    // Transfert des événements Pointer tactiles directement vers le DrawingManager
    // pour permettre de déplacer les dessins et les ancres du bout du doigt.
    const conteneur = chartContainerRef.current;
    
    const gererPointerDownTactile = (e: PointerEvent) => {
      // Uniquement si aucun outil de dessin n'est sélectionné et que c'est du tactile
      if (stateRef.current.activeTool === null && e.pointerType === 'touch') {
        (manager as any).handleMouseDown(e);
      }
    };
    const gererPointerMoveTactile = (e: PointerEvent) => {
      if (stateRef.current.activeTool === null && e.pointerType === 'touch') {
        (manager as any).handleMouseMove(e);
      }
    };
    const gererPointerUpTactile = (e: PointerEvent) => {
      if (stateRef.current.activeTool === null && e.pointerType === 'touch') {
        (manager as any).handleMouseUp(e);
      }
    };

    conteneur.addEventListener('pointerdown', gererPointerDownTactile, true);
    conteneur.addEventListener('pointermove', gererPointerMoveTactile, true);
    conteneur.addEventListener('pointerup', gererPointerUpTactile, true);

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
      
      conteneur.removeEventListener('pointerdown', gererPointerDownTactile, true);
      conteneur.removeEventListener('pointermove', gererPointerMoveTactile, true);
      conteneur.removeEventListener('pointerup', gererPointerUpTactile, true);
      
      manager.detach();
      chart.remove();
      observateur.disconnect();
      chartRef.current = null;
      seriesRef.current = null;
      managerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Thème
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

  // Hauteur
  useEffect(() => {
    if (chartRef.current) chartRef.current.applyOptions({ height });
    if (overlayCanvasRef.current) overlayCanvasRef.current.height = height;
    redessinerOverlay();
  }, [height, redessinerOverlay]);

  // Suppression clavier
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

  // Replay data sync
  useEffect(() => {
    if (!seriesRef.current || donneesCompletes.length === 0) return;
    const donneesVisibles = donneesCompletes
      .slice(0, indexCourant + 1)
      .map((b) => ({ ...b, time: b.time as Time }));
    seriesRef.current.setData(donneesVisibles);

    if (chartRef.current) {
      chartRef.current.timeScale().scrollToPosition(15, false);
    }
  }, [donneesCompletes, indexCourant]);

  // Gestion tracé interactif
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const manager = managerRef.current;
    const conteneur = chartContainerRef.current;
    const canvas = overlayCanvasRef.current;

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
    conteneur.style.touchAction = 'none';

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
        
        // ⚠️ Notre modification majeure :
        // Pour les positions Long/Short, on rajoute automatiquement une 4ème ancre (index 3)
        // placée 15 bougies plus loin, qui servira de poignée d'élargissement horizontale (Drag handle).
        if (activeTool === 'long-position' || activeTool === 'short-position') {
          const indexFutur = Math.min(indexCourant + 15, donneesCompletes.length - 1);
          const tempsFutur = donneesCompletes[indexFutur]?.time ?? ancresFinales[0].time;
          ancresFinales.push({ time: tempsFutur, price: ancresFinales[0].price });
        }

        const idUnique = `${activeTool}-${Date.now()}`;
        const dessin = getToolRegistry().createDrawing(activeTool, idUnique, ancresFinales, {}, {});

        if (dessin) {
          manager.addDrawing(dessin);

          if (activeTool === 'long-position' || activeTool === 'short-position') {
            const direction = activeTool === 'long-position' ? 'long' as const : 'short' as const;
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
  }, [activeTool, indexCourant, donneesCompletes, ouvrirPosition, redessinerOverlay]);

  const config = activeTool ? CONFIG_OUTILS[activeTool] : null;
  const messageInstruction = config
    ? config.instructions[Math.min(etapeActuelle, config.instructions.length - 1)]
    : null;
  const progresseAncres = config ? `${etapeActuelle}/${config.ancres}` : null;

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Barre de statut */}
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
                ? 'Mode Sélection — Touchez/cliquez un dessin pour le modifier ou le faire glisser'
                : 'Outil de dessin sélectionné — cliquez/touchez le graphique pour commencer'
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
