const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/backtest/BacktestWorkspace.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Normalisation des retours à la ligne
content = content.replace(/\r\n/g, '\n');

// 1. Ajouter les états locaux de drag-and-drop pour l'UT et le Replay
const targetStates = `  const fileInputRef = useRef<HTMLInputElement>(null);`;
const replacementStates = `  const fileInputRef = useRef<HTMLInputElement>(null);

  // Position du widget UT (timeframe) déplaçable par l'utilisateur
  const [utPos, setUtPos] = useState({ x: 80, y: 70 });
  const [isDraggingUt, setIsDraggingUt] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Position du Dock de Replay déplaçable par l'utilisateur (initialisé en bas à droite)
  const [replayPos, setReplayPos] = useState({ x: window.innerWidth - 450, y: window.innerHeight - 100 });
  const [isDraggingReplay, setIsDraggingReplay] = useState(false);
  const dragOffsetReplayRef = useRef({ x: 0, y: 0 });

  // Repositionner les docks de façon réactive en cas de redimensionnement de l'écran
  useEffect(() => {
    setReplayPos({
      x: window.innerWidth - 380,
      y: window.innerHeight - 110
    });
  }, [largeurFenetre]);

  // Gère le début du déplacement (support souris et tactile)
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
    setIsDraggingUt(true);
    dragOffsetRef.current = {
      x: clientX - utPos.x,
      y: clientY - utPos.y,
    };
  };

  // Gère le début du déplacement du Dock de Replay
  const handleDragReplayStart = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
    setIsDraggingReplay(true);
    dragOffsetReplayRef.current = {
      x: clientX - replayPos.x,
      y: clientY - replayPos.y,
    };
  };

  // Met à jour la position de l'UT pendant le drag
  useEffect(() => {
    if (!isDraggingUt) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      
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
  }, [isDraggingUt]);

  // Met à jour la position du Dock de Replay pendant le drag
  useEffect(() => {
    if (!isDraggingReplay) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      
      const nextX = Math.max(10, Math.min(clientX - dragOffsetReplayRef.current.x, window.innerWidth - 300));
      const nextY = Math.max(60, Math.min(clientY - dragOffsetReplayRef.current.y, window.innerHeight - 100));
      
      setReplayPos({ x: nextX, y: nextY });
    };

    const handleEnd = () => {
      setIsDraggingReplay(false);
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
  }, [isDraggingReplay]);`;

if (content.includes(targetStates)) {
  content = content.replace(targetStates, replacementStates);
  console.log("✅ 1. États locaux de drag-and-drop injectés");
} else {
  console.error("❌ Impossible de trouver l'emplacement des états locaux !");
  process.exit(1);
}

// 2. Retirer les boutons Timeframe de la barre supérieure fixe
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
  console.log("✅ 2. Boutons Timeframe d'origine retirés du header");
} else {
  console.error("❌ Boutons Timeframe introuvables dans le header !");
  process.exit(1);
}

// 3. Modifier les contrôles de replay dans la barre supérieure pour n'y laisser QUE le sélecteur de vitesse
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
        </div>`;

const replacementReplayHeader = `        {/* Sélecteur de vitesse de replay remis dans le header */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={\`text-[11px] \${C.textMuted}\`}>Vitesse :</span>
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
        </div>`;

if (content.includes(targetReplayHeader)) {
  content = content.replace(targetReplayHeader, replacementReplayHeader);
  console.log("✅ 3. Replay header modifié pour ne garder que le sélecteur de vitesse");
} else {
  console.error("❌ Contrôles replay du header introuvables !");
  process.exit(1);
}

// 4. Injecter les widgets flottants (UT sélecteur déplaçable + Replay sélecteur déplaçable sans la vitesse)
const targetChartDiv = `        {/* ─── GRAPHIQUE PRINCIPAL ─── */}
        <div className="flex-1 min-w-0 flex-shrink-0">`;

const replacementChartDiv = `        {/* ─── GRAPHIQUE PRINCIPAL ─── */}
        <div className="flex-1 min-w-0 flex-shrink-0 relative">
          
          {/* WIDGET UT (Timeframe) flottant et déplaçable par l'utilisateur */}
          <div
            style={{
              position: 'absolute',
              left: \`\${utPos.x}px\`,
              top: \`\${utPos.y}px\`,
              zIndex: 100,
            }}
            className={\`flex items-center gap-1.5 p-1.5 rounded-lg border shadow-lg backdrop-blur-md select-none \${
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

          {/* DOCK FLOATING DE REPLAY (Déplaçable et facile d'accès tactile pour tablette, sans vitesse) */}
          <div
            style={{
              position: 'absolute',
              left: \`\${replayPos.x}px\`,
              top: \`\${replayPos.y}px\`,
              zIndex: 90,
            }}
            className={\`flex items-center gap-1.5 p-2 rounded-xl border shadow-2xl backdrop-blur-md select-none \${
              theme === 'dark' ? 'bg-[#1e222d]/90 border-[#2a2e39]' : 'bg-white/90 border-[#e0e3eb]'
            }\`}
          >
            {/* Poignée de drag */}
            <div
              onMouseDown={handleDragReplayStart}
              onTouchStart={handleDragReplayStart}
              className={\`cursor-grab active:cursor-grabbing px-1.5 py-1 text-xs select-none font-bold tracking-tight \${
                theme === 'dark' ? 'text-[#787b86]' : 'text-[#9598a1]'
              }\`}
              title="Maintenir pour déplacer les contrôles de Replay"
            >
              ⋮⋮
            </div>

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
          </div>`;

if (content.includes(targetChartDiv)) {
  content = content.replace(targetChartDiv, replacementChartDiv);
  console.log("✅ 4. Widgets flottants injectés par-dessus le graphique");
} else {
  console.error("❌ Impossible de trouver la div du graphique principal !");
  process.exit(1);
}

// Ré-appliquer la normalisation CRLF
const finalContentCRLF = content.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, finalContentCRLF, 'utf8');
console.log("✅ 5. Modifications terminées !");
