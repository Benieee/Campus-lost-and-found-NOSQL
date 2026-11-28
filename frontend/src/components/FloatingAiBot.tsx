import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUp, Bot, ExternalLink, FileEdit, Minimize2, Sparkles } from 'lucide-react';
import { ApiError, assistantApi } from '../api/client';
import type { AssistantDraft, AssistantReply } from '../types';

interface CursorOrbProps {
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

/**
 * Renders lightweight inline bold (**text**) and line breaks cleanly without dangerouslySetInnerHTML.
 */
export function FormattedAssistantText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, lineIdx) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <React.Fragment key={lineIdx}>
            {parts.map((part, idx) =>
              part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
                <strong key={idx}>{part.slice(2, -2)}</strong>
              ) : (
                <React.Fragment key={idx}>{part}</React.Fragment>
              )
            )}
            {lineIdx < lines.length - 1 ? <br /> : null}
          </React.Fragment>
        );
      })}
    </>
  );
}

/**
 * Animated Bugema AI Bot Orb whose visor, pupils, and subtle 3D tilt smoothly follow the user's cursor.
 */
export function CursorTrackingBotOrb({ size = 'md', interactive = true }: CursorOrbProps) {
  const orbRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef({ dx: 0, dy: 0 });
  const currentRef = useRef({ dx: 0, dy: 0 });
  const [offset, setOffset] = useState({ dx: 0, dy: 0 });

  useEffect(() => {
    if (!interactive) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    const handlePointerMove = (e: PointerEvent) => {
      const el = orbRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const vx = e.clientX - cx;
      const vy = e.clientY - cy;
      const dist = Math.hypot(vx, vy) || 1;
      const strength = Math.min(1, dist / 240);
      targetRef.current = {
        dx: (vx / dist) * strength,
        dy: (vy / dist) * strength
      };
    };

    const handlePointerLeave = () => {
      targetRef.current = { dx: 0, dy: 0 };
    };

    let rafId = 0;
    const tick = () => {
      const cur = currentRef.current;
      const tgt = targetRef.current;
      cur.dx += (tgt.dx - cur.dx) * 0.14;
      cur.dy += (tgt.dy - cur.dy) * 0.14;
      setOffset({ dx: cur.dx, dy: cur.dy });
      rafId = window.requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('blur', handlePointerLeave);
    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('blur', handlePointerLeave);
      window.cancelAnimationFrame(rafId);
    };
  }, [interactive]);

  const maxEyeShift = size === 'lg' ? 10 : size === 'md' ? 7 : 5;
  const maxBodyShift = size === 'lg' ? 7 : 5;
  const eyeX = (offset.dx * maxEyeShift).toFixed(2);
  const eyeY = (offset.dy * maxEyeShift).toFixed(2);
  const bodyX = (offset.dx * maxBodyShift).toFixed(2);
  const bodyY = (offset.dy * maxBodyShift).toFixed(2);
  const rotY = (offset.dx * 16).toFixed(2);
  const rotX = (-offset.dy * 16).toFixed(2);

  return (
    <div
      ref={orbRef}
      className={`bu-ai-orb bu-ai-orb-${size} cursor-bot-orb`}
      style={{
        transform: `perspective(420px) translate3d(${bodyX}px, ${bodyY}px, 0) rotateX(${rotX}deg) rotateY(${rotY}deg)`
      }}
      aria-hidden="true"
    >
      <div className="bu-ai-orb-core" />
      <div className="bu-ai-orb-swirl" />
      <div
        className="bot-face-visor"
        style={{
          transform: `translate3d(${(Number(eyeX) * 0.45).toFixed(2)}px, ${(Number(eyeY) * 0.45).toFixed(2)}px, 0)`
        }}
      >
        <div
          className="bot-eyes-group"
          style={{
            transform: `translate3d(${eyeX}px, ${eyeY}px, 0)`
          }}
        >
          <span className="bot-eye">
            <span className="bot-pupil" />
          </span>
          <span className="bot-eye">
            <span className="bot-pupil" />
          </span>
        </div>
        <div className="bot-smile" />
      </div>
      <div className="bu-ai-orb-shine" />
    </div>
  );
}

interface MiniTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  statusText?: string;
  replyData?: AssistantReply;
}

export function FloatingAiBot() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [turns, setTurns] = useState<MiniTurn[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hi! I am the Bugema Lost & Found AI Assistant. Ask me anything in real time — search publicly visible found items, see what is currently in storage, find campus holding desks, or draft a lost report or claim.'
    }
  ]);
  const endRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const hidden =
    location.pathname === '/assistant' ||
    location.pathname === '/login' ||
    location.pathname === '/register';

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [turns, open]);

  if (hidden) return null;

  const openDraftInLostForm = (draft: AssistantDraft) => {
    setOpen(false);
    navigate('/report-lost', {
      state: {
        aiDraft: {
          itemName: draft.fields.itemName || '',
          category: draft.fields.category || 'Other',
          description: draft.fields.description || '',
          identifyingDetails: '',
          lastKnownLocation: draft.fields.lastKnownLocation || '',
          dateLost: draft.fields.dateLost || new Date().toISOString().slice(0, 10),
          approximateTimeLost: draft.fields.approximateTimeLost || ''
        }
      }
    });
  };

  const sendMessage = async (rawText: string) => {
    const clean = rawText.trim();
    if (!clean || sending) return;

    setError('');
    setInput('');
    const userTurnId = `u-${Date.now()}`;
    const botTurnId = `a-${Date.now() + 1}`;
    const priorHistory = turns
      .filter((t) => t.id !== 'welcome' && t.content.trim().length > 0)
      .slice(-8)
      .map((t) => ({ role: t.role, content: t.content }));

    setTurns((prev) => [
      ...prev,
      { id: userTurnId, role: 'user', content: clean },
      { id: botTurnId, role: 'assistant', content: '', streaming: true, statusText: 'Thinking…' }
    ]);
    setSending(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await assistantApi.streamChat(
        { message: clean, history: priorHistory },
        {
          signal: controller.signal,
          onStatus: (statusText) => {
            setTurns((prev) =>
              prev.map((t) => (t.id === botTurnId ? { ...t, statusText } : t))
            );
          },
          onToken: (token) => {
            setTurns((prev) =>
              prev.map((t) =>
                t.id === botTurnId
                  ? { ...t, content: t.content + token, statusText: undefined }
                  : t
              )
            );
          },
          onDone: (replyData) => {
            setTurns((prev) =>
              prev.map((t) =>
                t.id === botTurnId
                  ? {
                      ...t,
                      content: replyData.reply,
                      streaming: false,
                      statusText: undefined,
                      replyData
                    }
                  : t
              )
            );
          }
        }
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setTurns((prev) => prev.filter((t) => t.id !== botTurnId || t.content.length > 0));
      if (err instanceof ApiError && err.status === 503) {
        setError('AI assistant is temporarily unavailable. Core search and reporting remain online.');
      } else {
        setError(err instanceof Error ? err.message : 'Unable to send message right now.');
      }
    } finally {
      setSending(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  return (
    <div className="floating-bot-root no-print">
      {open && (
        <div className="floating-bot-panel" role="dialog" aria-label="AI Student Support quick chat">
          <div className="floating-bot-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Bot size={18} color="#f5b700" />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Bugema AI Assistant</div>
                <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>
                  Real-time live · Public listings only
                </div>
              </div>
            </div>
            <div className="row-gap">
              <Link
                to="/assistant"
                className="btn btn-ghost-light btn-sm"
                style={{ padding: '5px 10px', minHeight: 30, fontSize: '0.75rem' }}
                onClick={() => setOpen(false)}
                title="Open full-screen AI workspace"
              >
                <ExternalLink size={13} /> Full view
              </Link>
              <button
                type="button"
                className="btn btn-ghost-light btn-sm"
                style={{ padding: '5px 8px', minHeight: 30 }}
                onClick={() => setOpen(false)}
                aria-label="Close AI chat"
              >
                <Minimize2 size={14} />
              </button>
            </div>
          </div>

          <div className="floating-bot-messages" aria-live="polite">
            {turns.map((turn, idx) => {
              const isLatestBot = turn.role === 'assistant' && idx === turns.length - 1;
              return (
                <div
                  key={turn.id}
                  className={`mini-msg ${turn.role === 'user' ? 'mini-msg-user' : 'mini-msg-bot'}`}
                >
                  <div>
                    {turn.content ? (
                      <>
                        <FormattedAssistantText text={turn.content} />
                        {turn.streaming ? (
                          <span aria-hidden="true" style={{ opacity: 0.7, marginLeft: 2 }}>
                            ▍
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span style={{ opacity: 0.72 }}>{turn.statusText || 'Thinking…'}</span>
                    )}
                  </div>

                  {turn.replyData && turn.replyData.suggestedListings.length > 0 && (
                    <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a67400' }}>
                        <Sparkles size={12} style={{ verticalAlign: 'middle' }} /> Suggestions (Staff verify):
                      </div>
                      {turn.replyData.suggestedListings.slice(0, 4).map((item) => (
                        <Link
                          key={item.id}
                          to={item.url}
                          className="mini-listing-link"
                          onClick={() => setOpen(false)}
                        >
                          <strong>{item.itemName}</strong>
                          <span>
                            {item.locationFound} · Held at {item.holdingLocation}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {turn.replyData?.draft && turn.replyData.draft.type === 'lost_report' && (
                    <div style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: '0.74rem', padding: '5px 10px', minHeight: 30 }}
                        onClick={() => openDraftInLostForm(turn.replyData!.draft!)}
                      >
                        <FileEdit size={13} /> Open Draft in Lost Form
                      </button>
                    </div>
                  )}

                  {isLatestBot &&
                    !turn.streaming &&
                    turn.replyData &&
                    turn.replyData.followUpQuestions.length > 0 && (
                      <div
                        style={{
                          marginTop: 9,
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 6
                        }}
                      >
                        {turn.replyData.followUpQuestions.slice(0, 3).map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => void sendMessage(q)}
                            disabled={sending}
                            style={{
                              border: '1px solid rgba(13, 71, 161, 0.22)',
                              background: 'rgba(13, 71, 161, 0.06)',
                              color: '#0d47a1',
                              borderRadius: 999,
                              padding: '4px 9px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              );
            })}
            {error && (
              <div className="alert alert-warning small" style={{ marginBottom: 0 }}>
                {error}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={handleSend} className="floating-bot-form">
            <label htmlFor="floating-bot-input" className="sr-only">
              Ask AI assistant
            </label>
            <input
              id="floating-bot-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Ask anything — e.g. "what was found?" or "lost keys"…'
              disabled={sending}
            />
            <button
              type="submit"
              className="ai-send-btn"
              style={{ width: 36, height: 36 }}
              disabled={sending || input.trim().length < 1}
              aria-label="Send message"
            >
              <ArrowUp size={16} />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        className="floating-bot-launcher"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={open ? 'Close Bugema AI Assistant' : 'Open Bugema AI Assistant'}
        title="Ask Bugema AI Assistant"
      >
        <CursorTrackingBotOrb size="md" />
        <span className="floating-bot-tooltip">{open ? 'Close AI' : 'Ask AI'}</span>
      </button>
    </div>
  );
}
