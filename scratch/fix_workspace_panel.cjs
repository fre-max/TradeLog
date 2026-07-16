const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/backtest/BacktestWorkspace.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Normalisation des fins de lignes en LF pour simplifier la recherche de chaînes
content = content.replace(/\r\n/g, '\n');

// 1. Remplacement de la zone du header pour ajouter le bouton de clôture contextuelle
const targetHeaderSep = `        <div ref={menuRef} className="relative flex-shrink-0">
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
            className={\`w-8 h-8 flex items-center justify-center rounded transition-colors text-base relative \${C.btnBase} \${menuCaptureOuvert ? 'bg-[#2a2e39] text-[#2962ff]' : ''}\`}
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
              className={\`w-52 rounded-lg border shadow-xl z-[999] py-1.5 text-xs font-medium flex flex-col transition-all animate-fadeIn
                \${theme === 'dark' ? 'bg-[#1e222d] border-[#2a2e39] text-[#d1d4dc]' : 'bg-white border-[#e0e3eb] text-[#131722]'}\`}
            >
              <div className={\`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border-b \${theme === 'dark' ? 'text-[#787b86] border-[#2a2e39]' : 'text-[#9598a1] border-[#e0e3eb]'}\`}>
                Où envoyer la capture ?
              </div>
              <button
                onClick={() => effectuerCaptureManuelle('biais')}
                className={\`px-3 py-2 text-left transition-colors flex items-center gap-2 \${theme === 'dark' ? 'hover:bg-[#2a2e39]' : 'hover:bg-[#f0f3fa]'}\`}
              >
                <span className="text-[14px]">🧭</span> Biais de Marché (Avant)
              </button>
              <button
                onClick={() => effectuerCaptureManuelle('poi')}
                className={\`px-3 py-2 text-left transition-colors flex items-center gap-2 \${theme === 'dark' ? 'hover:bg-[#2a2e39]' : 'hover:bg-[#f0f3fa]'}\`}
              >
                <span className="text-[14px]">🎯</span> Zone d'Intérêt POI (Avant)
              </button>
              <button
                onClick={() => effectuerCaptureManuelle('entry_avant')}
                className={\`px-3 py-2 text-left transition-colors flex items-center gap-2 \${theme === 'dark' ? 'hover:bg-[#2a2e39]' : 'hover:bg-[#f0f3fa]'}\`}
              >
                <span className="text-[14px]">⚡</span> Prise de Position (Avant)
              </button>
              <button
                onClick={() => effectuerCaptureManuelle('entry_apres')}
                className={\`px-3 py-2 text-left transition-colors flex items-center gap-2 border-t \${theme === 'dark' ? 'hover:bg-[#2a2e39] border-[#2a2e39]' : 'hover:bg-[#f0f3fa] border-[#e0e3eb]'}\`}
              >
                <span className="text-[14px]">🔴</span> Résultat / Sortie (Après)
              </button>
            </div>
          )}
        </div>

        <div className={\`flex-shrink-0 h-5 w-px \${C.separator}\`} />`.replace(/\r\n/g, '\n');

const replacementHeaderSep = `        <div ref={menuRef} className="relative flex-shrink-0">
          <button
            ref={boutonRef}
            onClick={(evenement) => {
              evenement.stopPropagation();
              const rect = boutonRef.current?.getBoundingClientRect();
              if (rect) {
                setPositionMenu({
                  top: rect.bottom + window.scrollY + 6,
                  right: window.innerWidth - rect.right - window.scrollX,
                });
              }
              setMenuCaptureOuvert(!menuCaptureOuvert);
            }}
            disabled={capturantManuel}
            title="Prendre une capture d'écran du graphique"
            className={\`w-8 h-8 flex items-center justify-center rounded transition-colors text-base relative \${C.btnBase} \${menuCaptureOuvert ? 'bg-[#2a2e39] text-[#2962ff]' : ''}\`}
          >
            {capturantManuel ? (
              <span className="w-4 h-4 border-2 border-[#2962ff]/20 border-t-[#2962ff] rounded-full animate-spin"></span>
            ) : (
              '📸'
            )}
          </button>

          {menuCaptureOuvert && (
            <div 
              style={{
                position: 'fixed',
                top: positionMenu?.top ?? 0,
                right: positionMenu?.right ?? 0,
              }}
              className={\`w-52 rounded-lg border shadow-xl z-[999] py-1.5 text-xs font-medium flex flex-col transition-all animate-fadeIn
                \${theme === 'dark' ? 'bg-[#1e222d] border-[#2a2e39] text-[#d1d4dc]' : 'bg-white border-[#e0e3eb] text-[#131722]'}\`}
            >
              <div className={\`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border-b \${theme === 'dark' ? 'text-[#787b86] border-[#2a2e39]' : 'text-[#9598a1] border-[#e0e3eb]'}\`}>
                Où envoyer la capture ?
              </div>
              <button
                onClick={() => effectuerCaptureManuelle('biais')}
                className={\`px-3 py-2 text-left transition-colors flex items-center gap-2 \${theme === 'dark' ? 'hover:bg-[#2a2e39]' : 'hover:bg-[#f0f3fa]'}\`}
              >
                <span className="text-[14px]">🧭</span> Biais de Marché (Avant)
              </button>
              <button
                onClick={() => effectuerCaptureManuelle('poi')}
                className={\`px-3 py-2 text-left transition-colors flex items-center gap-2 \${theme === 'dark' ? 'hover:bg-[#2a2e39]' : 'hover:bg-[#f0f3fa]'}\`}
              >
                <span className="text-[14px]">🎯</span> Zone d'Intérêt POI (Avant)
              </button>
              <button
                onClick={() => effectuerCaptureManuelle('entry_avant')}
                className={\`px-3 py-2 text-left transition-colors flex items-center gap-2 \${theme === 'dark' ? 'hover:bg-[#2a2e39]' : 'hover:bg-[#f0f3fa]'}\`}
              >
                <span className="text-[14px]">⚡</span> Prise de Position (Avant)
              </button>
              <button
                onClick={() => effectuerCaptureManuelle('entry_apres')}
                className={\`px-3 py-2 text-left transition-colors flex items-center gap-2 border-t \${theme === 'dark' ? 'hover:bg-[#2a2e39] border-[#2a2e39]' : 'hover:bg-[#f0f3fa] border-[#e0e3eb]'}\`}
              >
                <span className="text-[14px]">🔴</span> Résultat / Sortie (Après)
              </button>
            </div>
          )}
        </div>

        {/* Bouton de clôture manuelle contextuel de la position active */}
        {positionActive && (
          <>
            <div className={\`flex-shrink-0 h-5 w-px \${C.separator}\`} />
            <button
              onClick={fermerPositionManuellement}
              className="flex-shrink-0 px-3 h-8 bg-[#ef5350] hover:bg-[#e53935] text-white text-[11px] font-bold rounded shadow-sm transition-colors flex items-center gap-1.5"
              title="Clôturer manuellement la position active"
            >
              🔒 Clôturer ({pnlFlottant !== null ? \`\${pnlFlottant >= 0 ? '+' : ''}\${pnlFlottant.toFixed(2)}%\` : 'Active'})
            </button>
          </>
        )}

        <div className={\`flex-shrink-0 h-5 w-px \${C.separator}\`} />`.replace(/\r\n/g, '\n');

let contentHeaderUpdated = content;

// Vérifier et remplacer le header
if (content.includes(targetHeaderSep)) {
  contentHeaderUpdated = content.replace(targetHeaderSep, replacementHeaderSep);
  console.log("✅ Remplacement du header OK");
} else {
  console.error("❌ Target header non trouvé dans le fichier !");
  process.exit(1);
}

// 2. Remplacer tout le bloc de droite
const debutAncienBlocDroit = `        {/* ─── PANEL DROIT : Position active + Historique OU TradeDrawer Inline ─── */}`;

const indexDebut = contentHeaderUpdated.indexOf(debutAncienBlocDroit);
if (indexDebut === -1) {
  console.error("Impossible de trouver le début de l'ancien bloc droit !");
  process.exit(1);
}

// Trouver la fin du fichier en recherchant les derniers caractères typiques de fin de render
const finFichierPattern = /;\s*}\s*$/;
const matchFin = contentHeaderUpdated.match(finFichierPattern);
if (!matchFin) {
  console.error("Impossible de faire matcher la regex de fin de fichier !");
  process.exit(1);
}

const indexFin = contentHeaderUpdated.lastIndexOf(matchFin[0]);

// Remplacer la portion de code du panel droit
const nouveauBlocDroit = `        {/* ─── PANEL DROIT : Uniquement affiché pour l'écriture/détail du TradeDrawer ─── */}
        {/* L'historique et les statistiques passives ont été supprimés pour maximiser l'espace du graphique */}
        {(isNewTradeOpen || initialisantPlanification || initialisantResolution) && (
          <div className="w-full md:w-[420px] flex flex-col border-t md:border-t-0 md:border-l flex-shrink-0 transition-all duration-300 bg-surface">
            {initialisantPlanification || initialisantResolution ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-3 text-center bg-surface">
                <span className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></span>
                <p className="text-xs font-semibold text-txt">
                  {initialisantPlanification 
                    ? "Planification : capture automatique du graphique..." 
                    : "Résolution : capture automatique de clôture..."}
                </p>
                <p className="text-[10px] text-txt3">Veuillez patienter pendant l'upload...</p>
              </div>
            ) : (
              <TradeDrawer isInline={true} backtestMode={true} onCaptureGraphique={capturerGraphique} />
            )}
          </div>
        )}`;

const finalContent = contentHeaderUpdated.substring(0, indexDebut) + nouveauBlocDroit + '\n      </div>\n    </div>\n  );\n}';

// Conversion des retours à la ligne en CRLF (standard Windows pour ce projet)
const finalContentCRLF = finalContent.replace(/\n/g, '\r\n');

fs.writeFileSync(filePath, finalContentCRLF, 'utf8');
console.log("✅ BacktestWorkspace.tsx patché avec succès pour masquer le panel droit et ajouter le bouton Clôturer contextuel");
