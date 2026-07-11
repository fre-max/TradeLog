import { create } from 'zustand'
import type { Bougie } from '@/lib/chartDataHelper'

/**
 * Représente un trade simulé pendant la session de backtesting.
 */
export interface PositionSimulee {
  direction: 'long' | 'short';
  prixEntree: number;
  stopLoss: number;
  takeProfit: number;
  dateEntree: string | number;
  prixSortie?: number;
  dateSortie?: string | number;
  resultat?: 'win' | 'loss' | 'breakeven';
  pnl?: number; // Gain/Perte en pourcentage ou valeur relative
}

interface BacktestState {
  // Informations de session
  actif: string;
  donneesCompletes: Bougie[];
  indexCourant: number; // L'index de la dernière bougie visible sur le graphique
  
  // Contrôles du Replay
  estEnLecture: boolean;
  vitesseLecture: number; // Millisecondes par bougie
  
  // Position active et historique
  positionActive: PositionSimulee | null;
  historiqueSimule: PositionSimulee[];

  // Actions
  chargerDonnees: (donnees: Bougie[], nomActif: string) => void;
  avancerBougie: () => boolean; // Retourne true s'il y avait une bougie à avancer, false sinon
  revenirDebut: () => void;
  setEstEnLecture: (val: boolean) => void;
  setVitesseLecture: (ms: number) => void;
  ouvrirPosition: (direction: 'long' | 'short', prixEntree: number, stopLoss: number, takeProfit: number) => void;
  fermerPositionManuellement: () => void;
  supprimerTradeHistorique: (index: number) => void;
  reinitialiserSession: () => void;
}

export const useBacktestStore = create<BacktestState>((set, get) => ({
  actif: 'Aucun actif',
  donneesCompletes: [],
  indexCourant: 0,
  estEnLecture: false,
  vitesseLecture: 1000, // Par défaut : 1 bougie par seconde
  positionActive: null,
  historiqueSimule: [],

  // Initialise la session avec de nouvelles données
  // Par défaut, on affiche les 150 premières bougies pour donner du contexte au trader
  chargerDonnees: (donnees, nomActif) => {
    console.log(`🚀 [Backtest Store] Chargement de ${donnees.length} bougies pour ${nomActif}`);
    const indexInitial = Math.min(150, donnees.length - 1);
    set({
      actif: nomActif,
      donneesCompletes: donnees,
      indexCourant: indexInitial,
      estEnLecture: false,
      positionActive: null,
      historiqueSimule: [],
    });
  },

  // Fait avancer le replay d'une bougie et vérifie si la position active est touchée (SL/TP)
  avancerBougie: () => {
    const { indexCourant, donneesCompletes, positionActive, historiqueSimule } = get();
    
    // Vérification : reste-t-il des bougies à afficher ?
    if (indexCourant >= donneesCompletes.length - 1) {
      set({ estEnLecture: false });
      return false;
    }

    const prochainIndex = indexCourant + 1;
    const bougie = donneesCompletes[prochainIndex];

    let positionMiseAJour: PositionSimulee | null = positionActive ? { ...positionActive } : null;
    let historiqueMisAJour = [...historiqueSimule];

    // Si une position est ouverte, on vérifie si la bougie actuelle touche le SL ou le TP
    if (positionMiseAJour && !positionMiseAJour.prixSortie) {
      const { direction, stopLoss, takeProfit, prixEntree } = positionMiseAJour;
      const { high, low } = bougie;

      if (direction === 'long') {
        // Scénario LONG :
        // 1. Touche le Stop Loss
        if (low <= stopLoss) {
          console.log(`❌ [Backtest Store] Stop Loss touché à ${stopLoss} !`);
          positionMiseAJour.prixSortie = stopLoss;
          positionMiseAJour.dateSortie = bougie.time;
          positionMiseAJour.resultat = 'loss';
          positionMiseAJour.pnl = ((stopLoss - prixEntree) / prixEntree) * 100;
        }
        // 2. Touche le Take Profit (si le SL n'a pas été touché d'abord)
        else if (high >= takeProfit) {
          console.log(`🎯 [Backtest Store] Take Profit touché à ${takeProfit} !`);
          positionMiseAJour.prixSortie = takeProfit;
          positionMiseAJour.dateSortie = bougie.time;
          positionMiseAJour.resultat = 'win';
          positionMiseAJour.pnl = ((takeProfit - prixEntree) / prixEntree) * 100;
        }
      } else {
        // Scénario SHORT :
        // 1. Touche le Stop Loss (hausse du prix)
        if (high >= stopLoss) {
          console.log(`❌ [Backtest Store] Stop Loss touché à ${stopLoss} !`);
          positionMiseAJour.prixSortie = stopLoss;
          positionMiseAJour.dateSortie = bougie.time;
          positionMiseAJour.resultat = 'loss';
          positionMiseAJour.pnl = ((prixEntree - stopLoss) / prixEntree) * 100;
        }
        // 2. Touche le Take Profit (baisse du prix)
        else if (low <= takeProfit) {
          console.log(`🎯 [Backtest Store] Take Profit touché à ${takeProfit} !`);
          positionMiseAJour.prixSortie = takeProfit;
          positionMiseAJour.dateSortie = bougie.time;
          positionMiseAJour.resultat = 'win';
          positionMiseAJour.pnl = ((prixEntree - takeProfit) / prixEntree) * 100;
        }
      }

      // Si le trade s'est fermé sur cette bougie, on l'ajoute à l'historique de la session
      if (positionMiseAJour.prixSortie) {
        // Calcul du résultat final (breakeven si pnl est quasi nul)
        if (Math.abs(positionMiseAJour.pnl || 0) < 0.05) {
          positionMiseAJour.resultat = 'breakeven';
        }
        historiqueMisAJour.push(positionMiseAJour);
        positionMiseAJour = null;
      }
    }

    set({
      indexCourant: prochainIndex,
      positionActive: positionMiseAJour,
      historiqueSimule: historiqueMisAJour,
    });
    return true;
  },

  // Revient à l'état initial (les 150 premières bougies) pour recommencer
  revenirDebut: () => {
    const { donneesCompletes } = get();
    if (donneesCompletes.length === 0) return;
    
    set({
      indexCourant: Math.min(150, donneesCompletes.length - 1),
      estEnLecture: false,
      positionActive: null,
      historiqueSimule: [],
    });
  },

  setEstEnLecture: (val) => set({ estEnLecture: val }),
  setVitesseLecture: (ms) => set({ vitesseLecture: ms }),

  // Ouvre une nouvelle position de simulation
  ouvrirPosition: (direction, prixEntree, stopLoss, takeProfit) => {
    const { donneesCompletes, indexCourant, positionActive } = get();
    if (positionActive) {
      console.warn('⚠️ [Backtest Store] Une position est déjà ouverte.');
      return;
    }

    const bougieActuelle = donneesCompletes[indexCourant];
    const nouvellePosition: PositionSimulee = {
      direction,
      prixEntree,
      stopLoss,
      takeProfit,
      dateEntree: bougieActuelle.time,
    };

    console.log(`📈 [Backtest Store] Ouverture d'une position ${direction} à ${prixEntree}`);
    set({ positionActive: nouvellePosition });
  },

  // Fermeture manuelle de la position au prix actuel du marché
  fermerPositionManuellement: () => {
    const { positionActive, donneesCompletes, indexCourant, historiqueSimule } = get();
    if (!positionActive) return;

    const bougieActuelle = donneesCompletes[indexCourant];
    const prixSortie = bougieActuelle.close;

    const pnlCalculé = positionActive.direction === 'long' 
      ? ((prixSortie - positionActive.prixEntree) / positionActive.prixEntree) * 100
      : ((positionActive.prixEntree - prixSortie) / positionActive.prixEntree) * 100;

    const positionCloturee: PositionSimulee = {
      ...positionActive,
      prixSortie,
      dateSortie: bougieActuelle.time,
      pnl: pnlCalculé,
      resultat: pnlCalculé > 0.05 
        ? 'win' 
        : pnlCalculé < -0.05 
          ? 'loss' 
          : 'breakeven',
    };

    console.log(`🔒 [Backtest Store] Fermeture manuelle de la position à ${prixSortie}`);
    set({
      positionActive: null,
      historiqueSimule: [...historiqueSimule, positionCloturee],
    });
  },

  supprimerTradeHistorique: (index) => {
    set((state) => ({
      historiqueSimule: state.historiqueSimule.filter((_, i) => i !== index),
    }));
  },

  reinitialiserSession: () => {
    set({
      actif: 'Aucun actif',
      donneesCompletes: [],
      indexCourant: 0,
      estEnLecture: false,
      positionActive: null,
      historiqueSimule: [],
    });
  }
}));
