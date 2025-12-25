"use client";
import React, { useEffect, useState } from 'react';
import supabase from '../lib/supabaseClient';

export default function AuthPanel({ onSuccess, onClose }: { onSuccess?: () => void; onClose?: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSessionUser(data?.session?.user ?? null);
    })();
    return () => { mounted = false; };
  }, []);

  const makeEmail = (u: string) => `${u}@duckduckjump.local`;

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError(null);
    if (!username || !password) {
      setError('Username and password are required');
      return;
    }
    setLoading(true);
    try {
      const uname = username.trim();

      if (isSignUp) {
        // check username availability
        const { data: existing, error: exErr } = await supabase.from('profiles').select('id').eq('username', uname).limit(1);
        if (exErr) throw exErr;
        if (existing && (existing as any).length) {
          setError('Username already taken');
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: makeEmail(uname),
          password,
        });
        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }

        const userId = (data?.user as any)?.id;
        if (userId) {
          const { error: insertErr } = await supabase.from('profiles').insert({ id: userId, username: uname });
          if (insertErr) {
            setError(insertErr.message || 'Failed to create profile');
            setLoading(false);
            return;
          }
        }

        onSuccess?.();
        onClose?.();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: makeEmail(uname), password });
        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }
        onSuccess?.();
        onClose?.();
      }
    } catch (err: any) {
      setError(err?.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
    onClose?.();
  }

  // Styled to match game's card vibe
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
      <div style={{ width: 'min(92vw,340px)', background: 'var(--panel)', padding: 18, borderRadius: 16, boxShadow: '0 18px 45px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <h3 style={{ margin: 0 }}>Sign {isSignUp ? 'Up' : 'In'}</h3>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Use a username and password to save your score</div>
          </div>
          <div>
            <button onClick={() => onClose?.()} style={{ background: 'transparent', border: 'none', fontSize: 18 }}>✕</button>
          </div>
        </div>

        {sessionUser ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 8 }}>Signed in as <strong>{sessionUser.email}</strong></div>
              <button className="small-btn" onClick={handleSignOut} disabled={loading}>Sign Out</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
              <div style={{ width: '100%', maxWidth: 260 }}>
                <input aria-label="username" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd' }} />
              </div>
              <div style={{ width: '100%', maxWidth: 260 }}>
                <input aria-label="password" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd' }} />
              </div>
              {error && <div style={{ color: 'red' }}>{error}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'center' }}>
                <button type="submit" className="primary" disabled={loading}>{isSignUp ? 'Sign Up' : 'Sign In'}</button>
                <button type="button" onClick={() => setIsSignUp((s) => !s)} style={{ background: 'transparent', border: '1px solid #ccc', padding: '10px 12px', borderRadius: 8 }}>{isSignUp ? 'Have an account? Sign In' : 'Create account'}</button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
