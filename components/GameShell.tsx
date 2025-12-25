"use client";
import React, { useEffect } from 'react';
import { initGame } from '../lib/game';

export default function GameShell(): JSX.Element {
  useEffect(() => {
    const cleanup = initGame();
    return () => cleanup();
  }, []);

  return (
    <main id="game-shell">
      <canvas id="gameCanvas" />

      <div id="ui-overlay" className="visible">
        <div className="home-container">
          <div className="title-section">
            <h1>Duck Duck Jump!</h1>
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
          <button id="start-button" className="primary">Start Run</button>
          <div className="instructions-container">
            <p className="instructions"><strong>↑</strong> or <strong>Space</strong> to Jump and <strong>↓</strong> to Duck</p>
          </div>
        </div>
      </div>

      <div id="reflection-panel" className="hidden">
        <section className="panel">
          <p className="label">Game Over</p>
          <p className="score" id="final-score">0</p>
          <p className="insight" id="insight-text">Practice a little more to see how your playstyle shifts.</p>
          <button id="restart-button" className="primary">Restart</button>
          <button id="home-button" className="primary">Home</button>
        </section>
      </div>

      <button id="pause-button" className="pause-btn hidden">Pause</button>
    </main>
  );
}
