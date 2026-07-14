/**
 * Structure de données pour une bougie (OHLC) compatible avec TradingView Lightweight Charts
 */
export interface Bougie {
  time: number | string; // Date au format YYYY-MM-DD ou Timestamp UNIX en secondes
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * Récupère les données historiques réelles de Binance (API publique gratuite)
 * 
 * Exemple :
 * const btc = await recupererDonneesBinance('BTCUSDT', '1h');
 */
export async function recupererDonneesBinance(symbole: string, intervalle: string = '1h', limite: number = 500): Promise<Bougie[]> {
  console.log(`📡 [Binance API] Récupération de ${limite} bougies pour ${symbole} (${intervalle})...`);
  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbole}&interval=${intervalle}&limit=${limite}`;
    const reponse = await fetch(url);
    if (!reponse.ok) throw new Error(`Erreur API Binance: ${reponse.statusText}`);

    const rawData = await reponse.json();
    console.log(`✅ [Binance API] ${rawData.length} bougies récupérées.`);

    // Conversion du format brut Binance vers notre interface Bougie
    return rawData.map((ligne: any) => ({
      time: Math.floor(ligne[0] / 1000), // Conversion du timestamp ms en secondes
      open: parseFloat(ligne[1]),
      high: parseFloat(ligne[2]),
      low: parseFloat(ligne[3]),
      close: parseFloat(ligne[4])
    }));
  } catch (erreur) {
    console.error(`❌ [Binance API] Impossible de charger les données:`, erreur);
    throw erreur;
  }
}

/**
 * Analyse et convertit le contenu textuel d'un fichier CSV en liste de bougies.
 * Supporte les séparateurs de type virgule (,) et point-virgule (;).
 * 
 * Exemple :
 * const bougies = parserCsvPrix("Date,Open,High,Low,Close\n2026-07-01,10,12,9,11");
 */
export function parserCsvPrix(contenuTextuel: string): Bougie[] {
  console.log('🚀 [CSV Parser] Début de l\'analyse du fichier CSV...');

  // 1️⃣ Découpage par ligne et nettoyage
  const lignes = contenuTextuel.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lignes.length < 2) {
    throw new Error("Le fichier CSV doit contenir au moins une ligne d'en-tête et une ligne de données.");
  }

  // 2️⃣ Détection du séparateur (virgule ou point-virgule)
  const enteteRaw = lignes[0];
  const separateur = enteteRaw.includes(';') ? ';' : ',';
  const colonnesEntete = enteteRaw.split(separateur).map(c => c.trim().toLowerCase());
  console.log(`📡 [CSV Parser] Séparateur détecté : "${separateur}". En-têtes :`, colonnesEntete);

  // 3️⃣ Recherche des indices des colonnes requises (insensible à la casse)
  const indexDate = colonnesEntete.findIndex(c => c.includes('date') || c.includes('time') || c.includes('timestamp') || c.includes('heure'));
  const indexOpen = colonnesEntete.findIndex(c => c === 'open' || c === 'o' || c === 'ouvert' || c === 'ouverture');
  const indexHigh = colonnesEntete.findIndex(c => c === 'high' || c === 'h' || c === 'haut' || c === 'maximum');
  const indexLow = colonnesEntete.findIndex(c => c === 'low' || c === 'l' || c === 'bas' || c === 'minimum');
  const indexClose = colonnesEntete.findIndex(c => c === 'close' || c === 'c' || c === 'cloture' || c === 'fermeture');

  if (indexDate === -1 || indexOpen === -1 || indexHigh === -1 || indexLow === -1 || indexClose === -1) {
    throw new Error(
      "En-tête CSV invalide. Les colonnes requises doivent être identifiables (ex: Date, Open, High, Low, Close)."
    );
  }

  const resultats: Bougie[] = [];

  // 4️⃣ Parcours des lignes de données
  for (let i = 1; i < lignes.length; i++) {
    const valeurs = lignes[i].split(separateur).map(v => v.trim());
    if (valeurs.length < colonnesEntete.length) continue; // Ligne incomplète

    try {
      // Analyse de la date ou heure
      const dateBrute = valeurs[indexDate];
      let dateTimestamp: number | string;

      // Essayer de parser la date
      const timestampMs = Date.parse(dateBrute);
      if (isNaN(timestampMs)) {
        // Si ce n'est pas un format standard ISO, essayer de parser un format simple YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateBrute)) {
          dateTimestamp = dateBrute;
        } else {
          // Si le format n'est pas reconnu, ignorer cette ligne
          console.warn(`⚠️ [CSV Parser] Ligne ${i + 1} ignorée : Format de date non pris en compte (${dateBrute})`);
          continue;
        }
      } else {
        // Conversion du timestamp millisecondes en secondes pour lightweight-charts
        dateTimestamp = Math.floor(timestampMs / 1000);
      }

      // Analyse des prix (conversion en nombre et gestion de la virgule comme séparateur décimal)
      const open = parseFloat(valeurs[indexOpen].replace(',', '.'));
      const high = parseFloat(valeurs[indexHigh].replace(',', '.'));
      const low = parseFloat(valeurs[indexLow].replace(',', '.'));
      const close = parseFloat(valeurs[indexClose].replace(',', '.'));

      if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) {
        continue;
      }

      resultats.push({
        time: dateTimestamp,
        open,
        high,
        low,
        close
      });
    } catch (err) {
      console.warn(`⚠️ [CSV Parser] Erreur lors de l'analyse de la ligne ${i + 1}:`, err);
    }
  }

  if (resultats.length === 0) {
    throw new Error("Aucune ligne de données valide n'a pu être lue du fichier CSV.");
  }

  // 5️⃣ Dédoublonnage et tri chronologique
  // TradingView Lightweight Charts requiert que les dates soient triées par ordre croissant
  // et qu'il n'y ait pas de doublons temporels.
  console.log(`📡 [CSV Parser] Tri chronologique et dédoublonnage de ${resultats.length} bougies...`);

  const bougiesTriees = resultats.sort((a, b) => {
    const tempsA = typeof a.time === 'number' ? a.time : Date.parse(a.time);
    const tempsB = typeof b.time === 'number' ? b.time : Date.parse(b.time);
    return tempsA - tempsB;
  });

  const bougiesFinales: Bougie[] = [];
  const setTempsDetectes = new Set<string | number>();

  for (const b of bougiesTriees) {
    if (!setTempsDetectes.has(b.time)) {
      setTempsDetectes.add(b.time);
      bougiesFinales.push(b);
    }
  }

  console.log(`✅ [CSV Parser] Analyse terminée. ${bougiesFinales.length} bougies prêtes pour le graphique.`);
  return bougiesFinales;
}
