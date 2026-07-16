const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/backtest/BacktestWorkspace.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Normalisation des retours à la ligne
content = content.replace(/\r\n/g, '\n');

// 1. Ajouter les états locaux de drag-and-drop pour l'UT
const targetStates = `  const fileInputRef = useRef<HTMLInputElement>(null);`;
const replacementStates = `  const fileInputRef = useRef<HTMLInputElement>(null);

  // Position du widget UT (timeframe) déplaçable par l'utilisateur
  const [utPos, setUtPos] = useState({ x: 80, y: 70 });
  const [isDraggingUt, setIsDraggingUt] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Gère le début du déplacement (support souris et tactile)
  const handleDragStart = (e) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setIsDraggingUt(true);
    dragOffsetRef.current = {
      x: clientX - utPos.x,
      y: clientY - utPos.y,
    };
  };

  // Met à jour la position pendant le drag
  useEffect(() => {
    if (!isDraggingUt) return;

    const handleMove = (e) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      // Limite le widget dans la fenêtre visible
      const nextX = Math.max(10, Math.min(clientX - dragOffsetRef.current.x, window.innerWidth - 350));
      const nextY = Math.max(60, Math.min(clientY - dragOffsetRef.current.y, window.innerHeight - 150));
      
      setUtPos({ x: nextX, y: nextY });
    };

    const handleEnd = () => {
      setIsDraggingUt(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: true });
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDraggingUt]);`;

if (content.includes(targetStates)) {
  content = content.replace(targetStates, replacementStates);
  console.log("✅ États de drag-and-drop injectés");
} else {
  console.error("❌ Impossible de trouver l'emplacement des états locaux !");
  process.exit(1);
}

// 2. Modifier la barre supérieure pour enlever l'UT et les boutons de replay
// La barre supérieure d'origine contient :
// {/* Boutons Timeframe */} ... et le séparateur
const targetTimeframes = `        {/* Boutons Timeframe */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={\`px-2.5 py-1 text-[12px] font-medium rounded transition-colors
                \${timeframe === tf.value ? C.btnActive : C.btnBase}\`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <div className={\`flex-shrink-0 h-5 w-px \${C.separator}\`} />`;

if (content.includes(targetTimeframes)) {
  content = content.replace(targetTimeframes, '');
  console.log("✅ Boutons Timeframe d'origine retirés de la barre supérieure");
} else {
  console.error("❌ Impossible de trouver les boutons Timeframe dans le header !");
  process.exit(1);
}

// Retirer aussi les boutons Replay de la barre supérieure d'origine
const targetReplayHeader = `        {/* ── Contrôles Replay ── */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setOutilActif(outilActif === 'replay-cut' ? null : 'replay-cut')}
            title="Mode Replay — Cliquer sur une bougie du graphique pour démarrer le backtest à partir de ce point"
            className={\`w-8 h-8 flex items-center justify-center rounded text-sm transition-colors
              \${outilActif === 'replay-cut' ? C.btnActive : C.btnBase}\`}
          >
            ✂️
          </button>

          <button onClick={revenirDebut} title="Retour au début"
            className={\`w-8 h-8 flex items-center justify-center rounded transition-colors text-sm \${C.btnBase}\`}>\u23ee</button>

          <button onClick={() => avancerBougie()} title="Bougie précédente"
            className={\`w-8 h-8 flex items-center justify-center rounded transition-colors text-sm \${C.btnBase}\`}>\u23ea</button>

          <button
            onClick={() => setEstEnLecture(!estEnLecture)}
            title={estEnLecture ? 'Pause (Espace)' : 'Lecture (Espace)'}
            className={\`w-9 h-8 flex items-center justify-center rounded text-sm font-bold transition-colors
              \${estEnLecture ? 'bg-[#ff9800] text-white hover:bg-[#f57c00]' : 'bg-[#26a69a] text-white hover:bg-[#00897b]'}\`}
          >
            {estEnLecture ? '⏸' : '▶'}
          </button>

          <button onClick={() => { setEstEnLecture(false); avancerBougie(); }} title="Bougie suivante (→)"
            className={\`w-8 h-8 flex items-center justify-center rounded transition-colors text-sm \${C.btnBase}\`}>\u23e9</button>

          <select
            value={vitesseLecture}
            onChange={(e) => setVitesseLecture(Number(e.target.value))}
            className={\`border-0 rounded px-2 py-1 text-[12px] outline-none cursor-pointer w-20 \${C.select}\`}
          >
            <option value="2000">×0.5</option>
            <option value="1000">×1</option>
            <option value="500">×2</option>
            <option value="200">×5</option>
            <option value="100">×10</option>
          </select>
        </div>

        <div className={\`flex-shrink-0 h-5 w-px \${C.separator}\`} />`;

if (content.includes(targetReplayHeader)) {
  content = content.replace(targetReplayHeader, '');
  console.log("✅ Contrôles Replay d'origine retirés de la barre supérieure");
} else {
  console.error("❌ Impossible de trouver les contrôles Replay dans le header !");
  process.exit(1);
}

// 3. Modifier la div du GRAPHIQUE PRINCIPAL pour la rendre 'relative' et y injecter les widgets flottants
const targetChartDiv = `        {/* ─── GRAPHIQUE PRINCIPAL ─── */}
        <div className="flex-1 min-w-0 flex-shrink-0">`;

const replacementChartDiv = `        {/* ─── GRAPHIQUE PRINCIPAL ─── */}
        <div className="flex-1 min-w-0 flex-shrink-0 relative">
          
          {/* Widget UT (Timeframe) flottant et déplaçable */}
          <div
            style={{
              position: 'absolute',
              left: \`\${utPos.x}px\`,
              top: \`\${utPos.y}px\`,
              zIndex: 100,
            }}
            className={\`flex items-center gap-1.5 p-1.5 rounded-lg border shadow-lg backdrop-blur-md transition-all select-none \${
              theme === 'dark' ? 'bg-[#1e222d]/85 border-[#2a2e39]/90' : 'bg-white/85 border-[#e0e3eb]/90'
            }\`}
          >
            {/* Poignée de drag */}
            <div
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
              className={\`cursor-grab active:cursor-grabbing px-1 text-xs select-none font-bold tracking-tight \${
                theme === 'dark' ? 'text-[#787b86]' : 'text-[#9598a1]'
              }\`}
              title="Maintenir pour déplacer le sélecteur d'UT"
            >
              ⋮⋮
            </div>
            
            {/* Boutons d'UT */}
            <div className="flex items-center gap-0.5">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.value}
                  onClick={() => setTimeframe(tf.value)}
                  className={\`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors \${
                    timeframe === tf.value ? C.btnActive : C.btnBase
                  }\`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>

          {/* DOCK FLOATING DE REPLAY (En bas à droite pour accès tactile facile sur tablette) */}
          <div
            style={{
              position: 'absolute',
              bottom: '24px',
              right: '24px',
              zIndex: 90,
            }}
            className={\`flex items-center gap-1.5 p-2 rounded-xl border shadow-2xl backdrop-blur-md transition-all select-none \${
              theme === 'dark' ? 'bg-[#1e222d]/90 border-[#2a2e39]' : 'bg-white/90 border-[#e0e3eb]'
            }\`}
          >
            {/* Mode Replay / Découpe ✂️ */}
            <button
              onClick={() => setOutilActif(outilActif === 'replay-cut' ? null : 'replay-cut')}
              title="Mode Replay — Cliquer sur une bougie pour démarrer"
              className={\`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors \${
                outilActif === 'replay-cut' ? C.btnActive : C.btnBase
              }\`}
            >
              ✂️
            </button>

            <div className={\`w-px h-5 \${C.separator}\`} />

            {/* ⏮ Retour au début */}
            <button
              onClick={revenirDebut}
              title="Retour au début"
              className={\`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors \${C.btnBase}\`}
            >
              ⏮
            </button>

            {/* ⏪ Reculer/Bougie précédente */}
            <button
              onClick={() => avancerBougie()}
              title="Bougie précédente"
              className={\`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors \${C.btnBase}\`}
            >
              ⏪
            </button>

            {/* ▶ / ⏸ Play / Pause */}
            <button
              onClick={() => setEstEnLecture(!estEnLecture)}
              title={estEnLecture ? 'Pause (Espace)' : 'Lecture (Espace)'}
              className={\`w-9 h-8 flex items-center justify-center rounded-lg text-sm font-bold transition-all \${
                estEnLecture ? 'bg-[#ff9800] text-white hover:bg-[#f57c00]' : 'bg-[#26a69a] text-white hover:bg-[#00897b]'
              }\`}
            >
              {estEnLecture ? '⏸' : '▶'}
            </button>

            {/* ⏩ Avancer / Bougie suivante */}
            <button
              onClick={() => {
                setEstEnLecture(false);
                avancerBougie();
              }}
              title="Bougie suivante (→)"
              className={\`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors \${C.btnBase}\`}
            >
              ⏩
            </button>

            <div className={\`w-px h-5 \${C.separator}\`} />

            {/* Vitesse */}
            <select
              value={vitesseLecture}
              onChange={(e) => setVitesseLecture(Number(e.target.value))}
              className={\`border-0 rounded-lg px-2 py-1 text-[11px] font-bold outline-none cursor-pointer w-18 \${C.select}\`}
              title="Vitesse du replay"
            >
              <option value="2000">×0.5</option>
              <option value="1000">×1</option>
              <option value="500">×2</option>
              <option value="200">×5</option>
              <option value="100">×10</option>
            </select>
          </div>`;

if (content.includes(targetChartDiv)) {
  content = content.replace(targetChartDiv, replacementChartDiv);
  console.log("✅ Widgets flottants UT et Replay injectés par-dessus le graphique");
} else {
  console.error("❌ Impossible de trouver la div du graphique principal !");
  process.exit(1);
}

// Conversion des retours à la ligne en CRLF (standard Windows pour ce projet)
const finalContentCRLF = content.replace(/\n/g, '\r\n');

fs.writeFileSync(filePath, finalContentCRLF, 'utf8');
console.log("✅ BacktestWorkspace.tsx patché avec succès !");
