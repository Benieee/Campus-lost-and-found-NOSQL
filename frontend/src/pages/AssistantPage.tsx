import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowUp,
  Bot,
  Check,
  Copy,
  FileEdit,
  HelpCircle,
  MapPin,
  Search,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { ApiError, assistantApi } from '../api/client';
import { CursorTrackingBotOrb, FormattedAssistantText } from '../components/FloatingAiBot';
import { formatDate, StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import type { AssistantDraft, AssistantReply } from '../types';

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  statusText?: string;
  replyData?: AssistantReply;
}

const STARTER_CARDS = [
  {
    icon: Search,
    title: 'Search Naturally',
    desc: 'Describe a lost item in plain words or ask to see all recently found campus items.',
    prompt: 'Show me all recently found items currently held on campus'
  },
  {
    icon: FileEdit,
    title: 'Draft a Lost Report',
    desc: 'Generate a structured draft you can review before submitting.',
    prompt: 'Help me draft a lost report for my black backpack left near the library yesterday'
  },
  {
    icon: HelpCircle,
    title: 'Desks & Claim Guide',
    desc: 'Check Bugema holding desks, office hours, or prepare a private ownership explanation.',
    prompt: 'Where are the campus holding desks and how do I submit a claim?'
  }
];

export function AssistantPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [sending, setSending] = useState(false);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [staffContact, setStaffContact] = useState<{
    desk: string;
    hours: string;
    guidance: string;
  } | null>(null);

  const endRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    assistantApi
      .status()
      .then((res) => {
        setServiceUnavailable(!res.available);
        setStaffContact(res.staffContact);
      })
      .catch(() => {
        setServiceUnavailable(true);
      });

    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, sending]);

  const sendMessage = async (textToSend: string) => {
    const clean = textToSend.trim();
    if (!clean || sending) return;

    setError('');
    setInput('');
    const userTurnId = `u-${Date.now()}`;
    const botTurnId = `a-${Date.now() + 1}`;
    const priorHistory = turns
      .filter((t) => t.content.trim().length > 0)
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
            setServiceUnavailable(false);
            setStaffContact(replyData.staffContact);
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
      if (err instanceof ApiError && (err.status === 503 || err.code === 'AI_UNAVAILABLE')) {
        setServiceUnavailable(true);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Unable to reach the AI support assistant right now.');
      }
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const openDraftInLostForm = (draft: AssistantDraft) => {
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

  const copyDraft = async (draft: AssistantDraft, turnId: string) => {
    const text = Object.entries(draft.fields)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n\n');
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(turnId);
    window.setTimeout(() => setCopiedId(''), 2000);
  };

  const firstName = user ? user.fullName.split(' ')[0] : 'Student';

  return (
    <section className="page-section">
      <div className="container">
        <div className="ai-stage">
          {/* Glowing Animated Bugema AI Orb + Greeting */}
          <div className="ai-hero-center">
            <CursorTrackingBotOrb size="lg" />

            <div className="ai-greeting-sub">Hi, {firstName}</div>
            <h1 className="ai-greeting-title">How can I help today?</h1>
            <p className="ai-greeting-desc">
              Real-time AI Student Support Assistant — search publicly visible found items in plain
              language, browse live campus listings, check holding desks, or draft a report for your
              review.
            </p>
          </div>

          {serviceUnavailable && (
            <div className="alert alert-warning" role="alert" style={{ maxWidth: 820, margin: '0 auto 18px' }}>
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>AI Support Assistant is temporarily unavailable.</strong> Core reporting,
                found-item search, and claim submission remain fully available:{' '}
                <Link to="/found" style={{ textDecoration: 'underline', fontWeight: 700 }}>
                  Browse Found Items
                </Link>{' '}
                ·{' '}
                <Link to="/report-lost" style={{ textDecoration: 'underline', fontWeight: 700 }}>
                  Report Lost Item
                </Link>
              </div>
            </div>
          )}

          {error && !serviceUnavailable && (
            <div className="alert alert-error" role="alert" style={{ maxWidth: 820, margin: '0 auto 18px' }}>
              {error}
            </div>
          )}

          {/* Conversation Thread */}
          {turns.length > 0 && (
            <div className="ai-thread" aria-live="polite">
              {turns.map((turn) => (
                <div key={turn.id} className={`ai-msg ${turn.role === 'user' ? 'ai-msg-user' : 'ai-msg-bot'}`}>
                  {turn.role === 'assistant' && (
                    <div className="row-between" style={{ marginBottom: 8 }}>
                      <span className="badge badge-blue">
                        <Bot size={13} />{' '}
                        {turn.streaming ? 'Responding Live…' : 'AI-Generated Response'}
                      </span>
                      <span className="small" style={{ color: 'rgba(255,255,255,0.68)' }}>
                        Advisory only · Staff verify all claims
                      </span>
                    </div>
                  )}

                  <p style={{ margin: 0 }}>
                    {turn.content ? (
                      <>
                        <FormattedAssistantText text={turn.content} />
                        {turn.streaming ? (
                          <span aria-hidden="true" style={{ opacity: 0.75, marginLeft: 3 }}>
                            ▍
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span style={{ opacity: 0.78 }}>{turn.statusText || 'Thinking…'}</span>
                    )}
                  </p>

                  {/* Suggested public found-item listings */}
                  {turn.replyData && turn.replyData.suggestedListings.length > 0 && (
                    <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                      <div className="small" style={{ fontWeight: 700, color: '#fff6d6' }}>
                        <Sparkles size={14} style={{ verticalAlign: 'middle' }} /> Suggested Public Found
                        Listings (Suggestions Only — Staff Verification Required)
                      </div>
                      {turn.replyData.suggestedListings.map((listing) => (
                        <div key={listing.id} className="ai-suggestion-card">
                          <div className="row-between">
                            <strong>{listing.itemName}</strong>
                            <StatusBadge status={listing.status} />
                          </div>
                          <div className="small" style={{ color: 'rgba(255,255,255,0.82)', margin: '4px 0' }}>
                            {listing.description}
                          </div>
                          <div className="small" style={{ color: 'rgba(255,255,255,0.72)' }}>
                            <MapPin size={13} style={{ verticalAlign: 'middle' }} /> Found at{' '}
                            {listing.locationFound} · Held at {listing.holdingLocation} ·{' '}
                            {formatDate(listing.dateFound)}
                          </div>
                          <div className="small" style={{ color: '#fff6d6', marginTop: 4 }}>
                            {listing.matchReasons.join(' · ')}
                          </div>
                          <div className="row-gap" style={{ marginTop: 10 }}>
                            <Link to={listing.url} className="btn btn-white btn-sm">
                              Inspect Listing
                            </Link>
                            {user && (
                              <Link to={`/claims/new/${listing.id}`} className="btn btn-primary btn-sm">
                                Submit Ownership Claim
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reviewable Draft Card */}
                  {turn.replyData?.draft && (
                    <div className="ai-draft-card">
                      <div className="row-between" style={{ marginBottom: 8 }}>
                        <strong>{turn.replyData.draft.title}</strong>
                        <span className="badge badge-amber">Review Before Submitting</span>
                      </div>
                      <div style={{ display: 'grid', gap: 6 }} className="small">
                        {Object.entries(turn.replyData.draft.fields).map(([key, val]) => (
                          <div key={key}>
                            <strong style={{ textTransform: 'capitalize' }}>{key}:</strong> {val}
                          </div>
                        ))}
                      </div>
                      <p className="small" style={{ marginTop: 10, color: '#fff6d6' }}>
                        <ShieldAlert size={14} style={{ verticalAlign: 'middle' }} />{' '}
                        {turn.replyData.draft.privacyReminder}
                      </p>
                      <div className="row-gap" style={{ marginTop: 10 }}>
                        {turn.replyData.draft.type === 'lost_report' && (
                          <button
                            type="button"
                            className="btn btn-white btn-sm"
                            onClick={() => openDraftInLostForm(turn.replyData!.draft!)}
                          >
                            <FileEdit size={14} /> Review Draft in Lost Report Form
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-ghost-light btn-sm"
                          onClick={() => copyDraft(turn.replyData!.draft!, turn.id)}
                        >
                          {copiedId === turn.id ? <Check size={14} /> : <Copy size={14} />}
                          {copiedId === turn.id ? 'Copied' : 'Copy Draft'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Follow-up Question Chips — click to send immediately */}
                  {!turn.streaming && turn.replyData && turn.replyData.followUpQuestions.length > 0 && (
                    <div className="row-gap" style={{ marginTop: 12 }}>
                      {turn.replyData.followUpQuestions.map((q) => (
                        <button
                          key={q}
                          type="button"
                          className="ai-tool-pill"
                          disabled={sending}
                          onClick={() => void sendMessage(q)}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}

          {/* Sleek Prompt Box */}
          <form onSubmit={handleSubmit} className="ai-prompt-box">
            <div className="ai-prompt-banner">
              <ShieldAlert size={14} />
              <span>
                Real-time AI answers use public listings only — never share passwords or tokens
                here. Only staff can approve claims or release items.
              </span>
            </div>
            <label htmlFor="ai-chat-input" className="sr-only">
              Ask the AI student support assistant
            </label>
            <textarea
              id="ai-chat-input"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage(input);
                }
              }}
              placeholder='Ask me anything — e.g. "hi", "what has been found?", or "I lost my HP charger near ICT lab"…'
              disabled={sending || serviceUnavailable}
            />
            <div className="ai-prompt-footer">
              <div className="row-gap">
                <button
                  type="button"
                  className="ai-tool-pill"
                  onClick={() => void sendMessage('Show recently found items')}
                  disabled={sending || serviceUnavailable}
                >
                  Recent Found Items
                </button>
                <button
                  type="button"
                  className="ai-tool-pill"
                  onClick={() => void sendMessage('Where are the campus holding desks?')}
                  disabled={sending || serviceUnavailable}
                >
                  Holding Desks
                </button>
                <button
                  type="button"
                  className="ai-tool-pill"
                  onClick={() => void sendMessage('How do I report a lost item and submit a claim?')}
                  disabled={sending || serviceUnavailable}
                >
                  How to Claim
                </button>
              </div>
              <button
                type="submit"
                className="ai-send-btn"
                disabled={sending || serviceUnavailable || input.trim().length < 1}
                aria-label="Send message to AI assistant"
              >
                <ArrowUp size={18} />
              </button>
            </div>
          </form>

          {/* 3 Starter Suggestion Cards */}
          {turns.length === 0 && (
            <div className="ai-starter-grid">
              {STARTER_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.title}
                    type="button"
                    className="ai-starter-card"
                    onClick={() => void sendMessage(card.prompt)}
                    disabled={sending || serviceUnavailable}
                  >
                    <div className="ai-starter-head">
                      <Icon size={16} color="#f5b700" />
                      <strong>{card.title}</strong>
                    </div>
                    <p>{card.desc}</p>
                  </button>
                );
              })}
            </div>
          )}

          {/* Staff Contact Footer */}
          {staffContact && (
            <div className="ai-staff-footer">
              <strong>Need a claim decision or item pickup?</strong> Contact authorized campus staff at{' '}
              <span>{staffContact.desk}</span> ({staffContact.hours}). {staffContact.guidance}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
