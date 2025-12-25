"use client";
import React, { useEffect, useState, useRef } from 'react';
import { initGame } from '../lib/game';
import supabase from '../lib/supabaseClient';
import { getHighScore, updateHighScore } from '../lib/highScore';
import AuthPanel from './AuthPanel';

export default function GameShell() {
  const [user, setUser] = useState<any>(null);
  const [highScore, setHighScore] = useState<number | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const gameCleanupRef = useRef<() => void | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  // start the game on mount for both signed-in and anonymous users
  useEffect(() => {
    if (!gameCleanupRef.current) {
      gameCleanupRef.current = initGame();
    }
    return () => {
      if (gameCleanupRef.current) {
        gameCleanupRef.current();
        gameCleanupRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data?.session?.user ?? null;
      if (!mounted) return;
      setUser(sessionUser);
    }
    loadSession();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // when user logs in, fetch high score and update in-game behavior
    let mounted = true;
    async function startForUser() {
      if (!user) return;
      const score = await getHighScore(user.id);
      if (!mounted) return;
      setHighScore(score ?? 0);
      try {
        if ((window as any).adaptiveDino && (window as any).adaptiveDino.behavior) {
          (window as any).adaptiveDino.behavior.highScore = score ?? 0;
        }
      } catch (e) {}

      // observe game-over panel to detect final score and persist if needed
      const reflection = document.getElementById('reflection-panel');
      const finalScoreEl = document.getElementById('final-score');
      if (reflection && finalScoreEl) {
        const observer = new MutationObserver(async () => {
          const isVisible = reflection.classList.contains('visible');
          if (!isVisible) return;
          const text = finalScoreEl.textContent || '0';
          const scoreVal = parseInt(text, 10) || 0;
          try {
            const serverHigh = await getHighScore(user.id);
            const currentHigh = serverHigh ?? 0;
            if (scoreVal > currentHigh) {
              await updateHighScore(user.id, scoreVal);
              setHighScore(scoreVal);
              if ((window as any).adaptiveDino && (window as any).adaptiveDino.behavior) {
                (window as any).adaptiveDino.behavior.highScore = scoreVal;
              }
            }
          } catch (err) {
            console.warn('Failed to update high score', err);
          }
        });
        observer.observe(reflection, { attributes: true, attributeFilter: ['class'] });
        observerRef.current = observer;
      }
    }
    if (user) startForUser();
    return () => {
      mounted = false;
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [user]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setHighScore(null);
  }

  // helper to handle a post-auth flow: close modal and if reflection visible, try to save final score
  async function handleAuthSuccess() {
    setShowAuth(false);
    // after sign-in, supabase auth state will update and trigger the effect above which fetches high score
    // additionally, if game-over is visible and a final score exists, attempt to persist it
    const reflection = document.getElementById('reflection-panel');
    const finalScoreEl = document.getElementById('final-score');
    if (reflection && finalScoreEl) {
      const isVisible = reflection.classList.contains('visible');
      if (isVisible) {
        const { data } = await supabase.auth.getSession();
        const sessionUser = data?.session?.user ?? null;
        if (!sessionUser) return;
        const scoreVal = parseInt(finalScoreEl.textContent || '0', 10) || 0;
        const current = await getHighScore(sessionUser.id);
        if (scoreVal > (current ?? 0)) {
          try {
            await updateHighScore(sessionUser.id, scoreVal);
            setHighScore(scoreVal);
            if ((window as any).adaptiveDino && (window as any).adaptiveDino.behavior) {
              (window as any).adaptiveDino.behavior.highScore = scoreVal;
            }
          } catch (err) {
            console.warn('Failed to persist after auth', err);
          }
        }
      }
    }
  }

  return (
    <main id="game-shell">
      <canvas id="gameCanvas" />

      <div id="ui-overlay" className="visible">
        <div className="home-container">
          <div className="title-section">
            <h1>Duck Duck Jump!</h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--muted)', marginTop: 6 }}>High: {highScore ?? 0}</p>
          </div>
          <div id="color-picker" className="color-picker">
            <p>Choose your color:</p>
            <div className="colors">
              <button className="color-btn" data-color="#ff4b4b" style={{ background: '#ff4b4b' }} />
              <button className="color-btn" data-color="#ff9c42" style={{ background: '#ff9c42' }} />
              <button className="color-btn" data-color="#ffe241" style={{ background: '#ffe241' }} />
              <button className="color-btn" data-color="#3ddc97" style={{ background: '#3ddc97' }} />
              <button className="color-btn" data-color="#4b7bff" style={{ background: '#4b7bff' }} />
              <button className="color-btn" data-color="#9b4bff" style={{ background: '#9b4bff' }} />
            </div>
          </div>
          <div className="home-buttons">
            <button id="start-button" className="primary">Start Run</button>
            {user ? (
              <button onClick={handleSignOut} className="small-btn">Sign Out</button>
            ) : (
              <button onClick={() => setShowAuth(true)} className="small-btn">Sign In</button>
            )}
          </div>
          <div className="instructions-container">
            <p className="instructions"><strong>↑</strong> or <strong>Space</strong> to Jump and <strong>↓</strong> to Duck</p>
          </div>
        </div>
      </div>

      <div id="reflection-panel" className="hidden">
        <section className="panel">
          <button id="home-button" aria-label="Home" className="home-icon"> 
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 11.5L12 4l9 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 21V12h14v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <p className="label">Game Over</p>
          <p className="score" id="final-score">0</p>
          <p className="insight" id="insight-text">Practice a little more to see how your playstyle shifts.</p>
          <div className="home-buttons" style={{ marginTop: 6 }}>
            <button id="restart-button" className="primary">Play Again</button>
            {!user ? (
              <button onClick={() => setShowAuth(true)} className="small-btn">Sign In to Save Score</button>
            ) : null}
          </div>
        </section>
      </div>

      <button id="pause-button" className="pause-btn hidden">Pause</button>

      {showAuth && <AuthPanel onSuccess={handleAuthSuccess} onClose={() => setShowAuth(false)} />}
    </main>
  );
}
