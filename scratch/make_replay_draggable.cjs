const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/backtest/BacktestWorkspace.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Normalisation des retours à la ligne
content = content.replace(/\r\n/g, '\n');

// 1. Ajouter les états pour le drag-and-drop du Dock de Replay
const targetStates = `  // Position du widget UT (timeframe) déplaçable par l'utilisateur
  const [utPos, setUtPos] = useState({ x: 80, y: 70 });
  const [isDraggingUt, setIsDraggingUt] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });`;

const replacementStates = `  // Position du widget UT (timeframe) déplaçable par l'utilisateur
  const [utPos, setUtPos] = useState({ x: 80, y: 70 });
  const [isDraggingUt, setIsDraggingUt] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Position du Dock de Replay déplaçable par l'utilisateur (initialisé en bas à droite)
  const [replayPos, setReplayPos] = useState({ x: window.innerWidth - 450, y: window.innerHeight - 100 });
  const [isDraggingReplay, setIsDraggingReplay] = useState(false);
  const dragOffsetReplayRef = useRef({ x: 0, y: 0 });

  // Repositionner le dock de replay de façon réactive en cas de redimensionnement de l'écran
  useEffect(() => {
    setReplayPos({
      x: window.innerWidth - 380,
      y: window.innerHeight - 110
    });
  }, [largeurFenetre]);

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

  // Met à jour la position du Dock de Replay
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
  console.log("✅ États de drag-and-drop du replay injectés");
} else {
  console.error("❌ États locaux UT introuvables !");
  process.exit(1);
}

// 2. Remettre le contrôleur de vitesse de Replay dans le Header
const targetHeaderSep = `        <div className={\`flex-shrink-0 h-5 w-px \${C.separator}\`} />

        {/* ── Bouton Capture d'Écran Manuel ── */}
        <div ref={menuRef}`;

const replacementHeaderSep = `        <div className={\`flex-shrink-0 h-5 w-px \${C.separator}\`} />

        {/* Sélecteur de vitesse de replay remis dans le header */}
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
        </div>

        <div className={\`flex-shrink-0 h-5 w-px \${C.separator}\`} />

        {/* ── Bouton Capture d'Écran Manuel ── */}
        <div ref={menuRef}`;

if (content.includes(targetHeaderSep)) {
  content = content.replace(targetHeaderSep, replacementHeaderSep);
  console.log("✅ Sélecteur de vitesse réinséré dans le header");
} else {
  console.error("❌ Séparateur header introuvable !");
  process.exit(1);
}

// 3. Modifier le DOCK FLOATING DE REPLAY pour le rendre déplaçable, enlever la vitesse et lui ajouter une poignée
const targetDock = `          {/* DOCK FLOATING DE REPLAY (En bas à droite pour accès tactile facile sur tablette) */}
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

const replacementDock = `          {/* DOCK FLOATING DE REPLAY (Déplaçable et facile d'accès tactile pour tablette) */}
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

if (content.includes(targetDock)) {
  content = content.replace(targetDock, replacementDock);
  console.log("✅ Dock de replay modifié (draggable + sans vitesse)");
} else {
  console.error("❌ Dock de replay introuvable !");
  process.exit(1);
}

// Ré-appliquer la normalisation CRLF
const finalContentCRLF = content.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, finalContentCRLF, 'utf8');
console.log("✅ Patch global appliqué avec succès !");
