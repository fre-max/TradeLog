const fs = require('fs');
const path = require('path');

const filePath = path.join('c:\\Dev\\Jouranl de Trading\\src\\components\\backtest\\BacktestChart.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Ancien bloc à remplacer
const ancienBloc = `  // Expose la méthode de capture d'écran au composant parent (BacktestWorkspace)
  useImperativeHandle(ref, () => ({
    takeScreenshot: (): Promise<Blob | null> => {
      console.log('📸 [BacktestChart] ① DÉBUT takeScreenshot appelé');
      return new Promise((resolve) => {
        const chart = chartRef.current;
        console.log('📸 [BacktestChart] ② chartRef.current =', chart ? 'OK (instance présente)' : 'NULL ❌');
        if (!chart) {
          console.warn('⚠️ [BacktestChart] Graphique non disponible → resolve(null)');
          resolve(null);
          return;
        }

        // Légère pause pour s'assurer que le graphique a fini de rendre
        console.log('📸 [BacktestChart] ③ Attente 100ms avant capture...');
        setTimeout(() => {
          console.log('📸 [BacktestChart] ④ Appel chart.takeScreenshot() natif...');
          try {
            const chartCanvas = chart.takeScreenshot();
            console.log('📸 [BacktestChart] ⑤ chartCanvas =', chartCanvas ? \`OK (\${chartCanvas.width}×\${chartCanvas.height})\` : 'NULL ❌');
            if (!chartCanvas) {
              console.warn('⚠️ [BacktestChart] Échec capture native → resolve(null)');
              resolve(null);
              return;
            }

            console.log('📸 [BacktestChart] ⑥ Appel toBlob() pour convertir en JPEG...');
            chartCanvas.toBlob(
              (blob) => {
                console.log('📸 [BacktestChart] ⑦ toBlob callback → blob =', blob ? \`OK (\${blob.size} octets)\` : 'NULL ❌');
                if (blob) {
                  console.log('✅ [BacktestChart] ⑧ Screenshot SUCCÈS ! Taille :', blob.size, 'octets');
                  resolve(blob);
                } else {
                  console.warn('⚠️ [BacktestChart] toBlob a renvoyé null → resolve(null)');
                  resolve(null);
                }
              },
              'image/jpeg',
              0.85
            );
            console.log('📸 [BacktestChart] ⑦ toBlob() lancé, en attente du callback...');
          } catch (err) {
            console.error('❌ [BacktestChart] Exception lors de la capture :', err);
            resolve(null);
          }
        }, 100);
      });
    }
  }));`;

// Nouveau bloc fusionnant les deux canvas
const nouveauBloc = `  // Expose la méthode de capture d'écran au composant parent (BacktestWorkspace)
  // La capture fusionne le canvas natif lightweight-charts ET l'overlay HTML canvas
  // pour que la position (lignes Entrée/SL/TP) soit bien visible dans la capture.
  useImperativeHandle(ref, () => ({
    takeScreenshot: (): Promise<Blob | null> => {
      return new Promise((resolve) => {
        const chart = chartRef.current;
        if (!chart) {
          resolve(null);
          return;
        }

        // Légère pause pour que le graphique ET l'overlay aient fini de se rendre
        setTimeout(() => {
          try {
            // 1. Capture le canvas natif de lightweight-charts (bougies, axes, grille)
            const chartCanvas = chart.takeScreenshot();
            if (!chartCanvas) {
              resolve(null);
              return;
            }

            // 2. Récupérer l'overlay canvas (positions, lignes E/SL/TP custom)
            const overlayCanvas = overlayCanvasRef.current;

            // 3. Créer un canvas de fusion aux mêmes dimensions que le graphique
            const canvasFusion = document.createElement('canvas');
            canvasFusion.width = chartCanvas.width;
            canvasFusion.height = chartCanvas.height;
            const ctx = canvasFusion.getContext('2d');

            if (!ctx) {
              // Fallback si le contexte 2D n'est pas disponible : graphique seul
              chartCanvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
              return;
            }

            // 4. Dessiner d'abord le graphique (couche du bas)
            ctx.drawImage(chartCanvas, 0, 0);

            // 5. Dessiner l'overlay par-dessus (couche du haut = positions, lignes)
            // On redimensionne l'overlay pour qu'il corresponde aux dimensions du graphique
            if (overlayCanvas && overlayCanvas.width > 0 && overlayCanvas.height > 0) {
              ctx.drawImage(overlayCanvas, 0, 0, canvasFusion.width, canvasFusion.height);
            }

            // 6. Convertir le canvas fusionné en JPEG blob
            canvasFusion.toBlob(
              (blob) => resolve(blob),
              'image/jpeg',
              0.9
            );
          } catch (err) {
            console.error('Erreur lors de la capture fusionnée :', err);
            resolve(null);
          }
        }, 150);
      });
    }
  }));`;

if (!content.includes('📸 [BacktestChart] ① DÉBUT takeScreenshot appelé')) {
  console.error('❌ Marqueur non trouvé dans le fichier. Vérifiez le contenu.');
  process.exit(1);
}

const nouveauContenu = content.replace(ancienBloc, nouveauBloc);

if (nouveauContenu === content) {
  console.error('❌ Remplacement échoué : ancien bloc non trouvé exactement.');
  
  // Debug : trouver le bloc actuel
  const lignes = content.split('\n');
  const idx = lignes.findIndex(l => l.includes('DÉBUT takeScreenshot'));
  console.log('Lignes autour de la cible (', idx, ') :');
  console.log(lignes.slice(Math.max(0, idx-2), idx+5).map((l, i) => `${idx-2+i}: ${JSON.stringify(l)}`).join('\n'));
  process.exit(1);
}

fs.writeFileSync(filePath, nouveauContenu, 'utf8');
console.log('✅ BacktestChart.tsx patché avec succès — fusion des canvas activée.');
