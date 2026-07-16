const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/backtest/BacktestWorkspace.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Normalisation des retours à la ligne
content = content.replace(/\r\n/g, '\n');

// 1. Remplacer les états de drag-and-drop et les effets associés
const targetSection = `  // Position du widget UT (timeframe) déplaçable par l'utilisateur
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

const replacementSection = `  // Positionnement dynamique des widgets par rapport au parent
  const [hasDraggedUt, setHasDraggedUt] = useState(false);
  const [utPos, setUtPos] = useState({ x: 80, y: 20 });
  const [isDraggingUt, setIsDraggingUt] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const [hasDraggedReplay, setHasDraggedReplay] = useState(false);
  const [replayPos, setReplayPos] = useState({ x: 0, y: 0 });
  const [isDraggingReplay, setIsDraggingReplay] = useState(false);
  const dragOffsetReplayRef = useRef({ x: 0, y: 0 });

  // Gère le début du déplacement (curseur & tactile)
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

    const handle = e.currentTarget as HTMLElement;
    const widget = handle.parentElement;
    if (!widget) return;

    const rect = widget.getBoundingClientRect();
    const parent = widget.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();

    // Position relative de départ
    const initialX = rect.left - parentRect.left;
    const initialY = rect.top - parentRect.top;

    setIsDraggingUt(true);
    setHasDraggedUt(true);
    setUtPos({ x: initialX, y: initialY });
    dragOffsetRef.current = {
      x: clientX - initialX,
      y: clientY - initialY,
    };
  };

  // Gère le début du déplacement du Dock de Replay
  const handleDragReplayStart = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

    const handle = e.currentTarget as HTMLElement;
    const widget = handle.parentElement;
    if (!widget) return;

    const rect = widget.getBoundingClientRect();
    const parent = widget.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();

    const initialX = rect.left - parentRect.left;
    const initialY = rect.top - parentRect.top;

    setIsDraggingReplay(true);
    setHasDraggedReplay(true);
    setReplayPos({ x: initialX, y: initialY });
    dragOffsetReplayRef.current = {
      x: clientX - initialX,
      y: clientY - initialY,
    };
  };

  // Met à jour la position de l'UT pendant le drag
  useEffect(() => {
    if (!isDraggingUt) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      
      const nextX = Math.max(10, Math.min(clientX - dragOffsetRef.current.x, window.innerWidth - 350));
      const nextY = Math.max(10, Math.min(clientY - dragOffsetRef.current.y, window.innerHeight - 150));
      
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
      const nextY = Math.max(10, Math.min(clientY - dragOffsetReplayRef.current.y, window.innerHeight - 100));
      
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

if (content.includes(targetSection)) {
  content = content.replace(targetSection, replacementSection);
  console.log("✅ États et effets de drag mis à jour");
} else {
  console.error("❌ Impossible de faire correspondre la section de drag d'origine !");
  process.exit(1);
}

// 2. Mettre à jour le style inline du widget UT et du dock Replay dans le JSX
const targetUTJSX = `          {/* WIDGET UT (Timeframe) flottant et déplaçable par l'utilisateur */}
          <div
            style={{
              position: 'absolute',
              left: \`\${utPos.x}px\`,
              top: \`\${utPos.y}px\`,
              zIndex: 100,
            }}`;

const replacementUTJSX = `          {/* WIDGET UT (Timeframe) flottant et déplaçable par l'utilisateur */}
          <div
            style={
              hasDraggedUt
                ? { position: 'absolute', left: \`\${utPos.x}px\`, top: \`\${utPos.y}px\`, zIndex: 100 }
                : { position: 'absolute', left: '80px', top: '20px', zIndex: 100 }
            }`;

if (content.includes(targetUTJSX)) {
  content = content.replace(targetUTJSX, replacementUTJSX);
  console.log("✅ Style du widget UT configuré en position relative initiale");
} else {
  console.error("❌ Widget UT JSX introuvable !");
  process.exit(1);
}

const targetReplayJSX = `          {/* DOCK FLOATING DE REPLAY (Déplaçable et facile d'accès tactile pour tablette, sans vitesse) */}
          <div
            style={{
              position: 'absolute',
              left: \`\${replayPos.x}px\`,
              top: \`\${replayPos.y}px\`,
              zIndex: 90,
            }}`;

const replacementReplayJSX = `          {/* DOCK FLOATING DE REPLAY (Déplaçable et facile d'accès tactile pour tablette, sans vitesse) */}
          <div
            style={
              hasDraggedReplay
                ? { position: 'absolute', left: \`\${replayPos.x}px\`, top: \`\${replayPos.y}px\`, zIndex: 90 }
                : { position: 'absolute', right: '24px', bottom: '24px', zIndex: 90 }
            }`;

if (content.includes(targetReplayJSX)) {
  content = content.replace(targetReplayJSX, replacementReplayJSX);
  console.log("✅ Style du Dock de Replay configuré en position relative initiale (bottom-right)");
} else {
  console.error("❌ Dock Replay JSX introuvable !");
  process.exit(1);
}

// Ré-appliquer la normalisation CRLF
const finalContentCRLF = content.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, finalContentCRLF, 'utf8');
console.log("✅ Modifications terminées avec succès !");
