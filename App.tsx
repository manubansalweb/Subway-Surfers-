import React, { useState, useCallback, useRef, useEffect } from 'react';
import Game3D from './components/Game3D';
import { GameState, GameStats } from './types';
import { Play, RotateCcw, ArrowLeft, ArrowRight, ArrowUp, Volume2, VolumeX } from 'lucide-react';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('start');
  const [stats, setStats] = useState<GameStats>({ score: 0, speed: 0.5, distance: 0 });
  const [finalScore, setFinalScore] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  
  // Audio Refs
  const menuMusicRef = useRef<HTMLAudioElement>(null);
  const gameMusicRef = useRef<HTMLAudioElement>(null);
  
  // Refs to communicate with the game engine without re-rendering
  const gameActionRef = useRef<{
    moveLeft: () => void;
    moveRight: () => void;
    jump: () => void;
    startGame: () => void;
    resetGame: () => void;
  } | null>(null);

  // Audio Control Logic
  useEffect(() => {
    const menuAudio = menuMusicRef.current;
    const gameAudio = gameMusicRef.current;

    if (!menuAudio || !gameAudio) return;

    // Set volumes
    menuAudio.volume = 0.5;
    gameAudio.volume = 0.3;

    if (isMuted) {
      menuAudio.pause();
      gameAudio.pause();
      return;
    }

    const playAudio = async (audio: HTMLAudioElement) => {
        try {
            await audio.play();
        } catch (e) {
            console.warn("Audio play blocked:", e);
        }
    };

    if (gameState === 'playing') {
        menuAudio.pause();
        menuAudio.currentTime = 0;
        playAudio(gameAudio);
    } else {
        // Start or GameOver
        gameAudio.pause();
        gameAudio.currentTime = 0;
        playAudio(menuAudio);
    }

  }, [gameState, isMuted]);

  const toggleMute = () => setIsMuted(prev => !prev);

  const handleUpdateStats = useCallback((newStats: GameStats) => {
    setStats(newStats);
  }, []);

  const handleGameOver = useCallback((score: number) => {
    setGameState('gameover');
    setFinalScore(score);
  }, []);

  const startGame = () => {
    // Explicitly unlock audio context on user interaction if needed
    if (!isMuted && gameMusicRef.current) {
        gameMusicRef.current.play().catch(() => {});
    }
    setGameState('playing');
    setStats({ score: 0, speed: 0.5, distance: 0 });
    gameActionRef.current?.startGame();
  };

  const restartGame = () => {
    if (!isMuted && gameMusicRef.current) {
        gameMusicRef.current.play().catch(() => {});
    }
    setGameState('playing');
    setStats({ score: 0, speed: 0.5, distance: 0 });
    gameActionRef.current?.resetGame();
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-sky-300 select-none">
      {/* Audio Elements */}
      <audio ref={menuMusicRef} loop src="https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3" />
      <audio ref={gameMusicRef} loop src="https://cdn.pixabay.com/audio/2021/09/06/audio_403c625867.mp3" />

      {/* 3D Game Canvas */}
      <Game3D 
        onUpdateStats={handleUpdateStats} 
        onGameOver={handleGameOver}
        actionRef={gameActionRef}
      />

      {/* Mute Button - Always Visible */}
      <div className="absolute top-4 right-4 z-50">
        <button 
          onClick={toggleMute}
          className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10 shadow-lg hover:bg-black/60 active:scale-95 transition-all"
        >
          {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
        </button>
      </div>

      {/* Start Screen */}
      {gameState === 'start' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/70 text-white backdrop-blur-sm">
          <h1 className="text-5xl md:text-7xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 drop-shadow-lg text-center px-4">
            3D Racing
          </h1>
          <button 
            onClick={startGame}
            className="flex items-center gap-2 px-8 py-4 text-2xl font-bold text-white bg-gradient-to-r from-red-500 to-orange-500 rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-transform duration-200"
          >
            <Play fill="currentColor" /> Tap to Start
          </button>
          <p className="mt-8 text-gray-300 text-sm animate-pulse">
            Use Arrow Keys or On-Screen Controls
          </p>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'gameover' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 text-white backdrop-blur-sm animate-fadeIn">
          <h1 className="text-6xl font-bold mb-4 text-red-500 drop-shadow-md">Game Over</h1>
          <div className="flex flex-col items-center mb-8 bg-white/10 p-6 rounded-2xl border border-white/20">
            <p className="text-xl text-gray-300">Final Score</p>
            <p className="text-5xl font-mono font-bold text-yellow-400">{finalScore}</p>
          </div>
          <button 
            onClick={restartGame}
            className="flex items-center gap-2 px-8 py-4 text-2xl font-bold text-white bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-transform duration-200"
          >
            <RotateCcw /> Try Again
          </button>
        </div>
      )}

      {/* HUD (Heads-up Display) */}
      {(gameState === 'playing' || gameState === 'gameover') && (
        <>
          <div className="absolute top-4 left-4 z-20 bg-black/50 backdrop-blur-md text-white p-4 rounded-xl border border-white/10 shadow-lg">
            <div className="font-mono text-sm text-gray-400">SPEED</div>
            <div className="text-2xl font-bold text-cyan-400">{Math.round(stats.speed * 100)} <span className="text-sm text-gray-400 font-normal">km/h</span></div>
            <div className="mt-2 font-mono text-sm text-gray-400">DISTANCE</div>
            <div className="text-xl font-bold">{Math.round(stats.distance)} <span className="text-sm text-gray-400 font-normal">m</span></div>
          </div>

          <div className="absolute top-20 right-4 z-20 bg-black/50 backdrop-blur-md text-white p-4 rounded-xl border border-white/10 shadow-lg flex flex-col items-end">
             <div className="font-mono text-sm text-gray-400">COINS</div>
             <div className="text-3xl font-bold text-yellow-400 flex items-center gap-2">
               <div className="w-4 h-4 rounded-full bg-yellow-400 border-2 border-yellow-600 shadow-[0_0_10px_rgba(250,204,21,0.5)]"></div>
               {stats.score}
             </div>
          </div>
        </>
      )}

      {/* Controls (Visible on mobile/tablet or always for convenience) */}
      {gameState === 'playing' && (
        <div className="absolute bottom-8 left-0 right-0 z-20 flex justify-center items-end gap-12 px-4 pointer-events-none">
          <div className="pointer-events-auto flex gap-6">
            <button 
              className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center active:bg-white/40 active:scale-95 transition-all shadow-xl"
              onPointerDown={(e) => { e.preventDefault(); gameActionRef.current?.moveLeft(); }}
            >
              <ArrowLeft size={40} className="text-white drop-shadow-md" />
            </button>
            <button 
              className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center active:bg-white/40 active:scale-95 transition-all shadow-xl"
              onPointerDown={(e) => { e.preventDefault(); gameActionRef.current?.jump(); }}
            >
              <ArrowUp size={40} className="text-white drop-shadow-md" />
            </button>
            <button 
              className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center active:bg-white/40 active:scale-95 transition-all shadow-xl"
              onPointerDown={(e) => { e.preventDefault(); gameActionRef.current?.moveRight(); }}
            >
              <ArrowRight size={40} className="text-white drop-shadow-md" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}