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
  indexEntree: number;           // Index de la bougie d'entrée (pour calculer la durée réelle)
  dureeEstimeeHeures?: number;   // Estimation du trader en heures
  dureeEstimeeBougies?: number;  // Conversion de l'estimation en nombre de bougies avant TP
  dureeEstimeeLargeur?: number;  // Largeur visuelle du bloc de trade en bougies
  prixSortie?: number;
  dateSortie?: string | number;
  indexSortie?: number;          // Index de la bougie de sortie
  dureeReelleBougies?: number;   // Calculé automatiquement à la clôture
  resultat?: 'win' | 'loss' | 'breakeven';
  pnl?: number;
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
  ouvrirPosition: (
    direction: 'long' | 'short',
    prixEntree: number,
    stopLoss: number,
    takeProfit: number,
    dureeEstimeeHeures?: number,
    dureeEstimeeBougies?: number,
    dureeEstimeeLargeur?: number
  ) => void;
  modifierPositionActive: (updates: Partial<PositionSimulee>) => void;
  fermerPositionManuellement: () => void;
  supprimerTradeHistorique: (index: number) => void;
  reinitialiserSession: () => void;
  couperReplayAIndex: (index: number) => void;
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

      // Si le trade s'est fermé sur cette bougie, on calcule la durée réelle et on archive
      if (positionMiseAJour.prixSortie) {
        if (Math.abs(positionMiseAJour.pnl || 0) < 0.05) {
          positionMiseAJour.resultat = 'breakeven';
        }
        // Calcul automatique de la durée réelle en bougies
        positionMiseAJour.indexSortie = prochainIndex;
        positionMiseAJour.dureeReelleBougies = prochainIndex - positionMiseAJour.indexEntree;
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

  ouvrirPosition: (direction, prixEntree, stopLoss, takeProfit, dureeEstimeeHeures, dureeEstimeeBougies, dureeEstimeeLargeur) => {
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
      indexEntree: indexCourant,
      dureeEstimeeHeures,
      dureeEstimeeBougies,
      dureeEstimeeLargeur: dureeEstimeeLargeur || 30, // Largeur par défaut de 30 bougies
    };

    console.log(`📈 [Backtest Store] Ouverture d'une position ${direction} à ${prixEntree}`);
    set({ positionActive: nouvellePosition });
  },

  modifierPositionActive: (updates) => {
    const { positionActive } = get();
    if (!positionActive) return;
    set({
      positionActive: {
        ...positionActive,
        ...updates
      }
    });
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
      indexSortie: indexCourant,
      dureeReelleBougies: indexCourant - positionActive.indexEntree,
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
  },

  // Repositionne le début du replay à un index donné, nettoyant la session en cours
  // Exemple d'utilisation : couperReplayAIndex(250)
  couperReplayAIndex: (index) => {
    const { donneesCompletes } = get();
    const indexValide = Math.max(0, Math.min(index, donneesCompletes.length - 1));
    console.log(`✂️ [Backtest Store] Replay positionné à la bougie index ${indexValide}`);
    set({
      indexCourant: indexValide,
      estEnLecture: false,
      positionActive: null,
      historiqueSimule: [],
    });
  }
}));
