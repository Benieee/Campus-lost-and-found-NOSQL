import { env } from '../config/env';
import { ITEM_CATEGORIES, ItemCategory } from '../constants/domain';
import { FoundItem, Location } from '../models';
import { AppError } from '../utils/errors';

export const STAFF_CONTACT_INFO = {
  desk: 'Main Gate Security Desk & Dean of Students Office (Bugema University Campus)',
  hours: 'Monday–Friday, 8:00 AM – 5:00 PM (Security desk intake 24/7)',
  guidance:
    'Only authorized campus staff can verify ownership, decide on claims, or release stored property.'
};

export interface AssistantHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantSuggestedListing {
  id: string;
  itemName: string;
  category: ItemCategory;
  description: string;
  locationFound: string;
  holdingLocation: string;
  dateFound: string;
  status: string;
  url: string;
  matchReasons: string[];
  disclaimer: string;
}

export interface AssistantDraft {
  type: 'lost_report' | 'ownership_proof';
  title: string;
  fields: Record<string, string>;
  privacyReminder: string;
}

export interface AssistantReply {
  aiGenerated: true;
  providerMode: 'external_llm' | 'campus_assistant';
  reply: string;
  followUpQuestions: string[];
  suggestedListings: AssistantSuggestedListing[];
  draft?: AssistantDraft;
  staffContact: typeof STAFF_CONTACT_INFO;
}

export interface AssistantRunOptions {
  enabledOverride?: boolean;
}

export interface AssistantStreamCallbacks {
  onStatus?: (status: string) => void;
  onToken?: (token: string) => void;
}

interface PublicFoundSnapshot {
  _id: unknown;
  itemName: string;
  category: string;
  description: string;
  locationFound: string;
  holdingLocation: string;
  dateFound: Date | string;
  status: string;
}

interface PublicLocationSnapshot {
  name: string;
  code: string;
  buildingArea: string;
  isHoldingDesk: boolean;
  description: string;
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'near', 'inside', 'outside', 'around',
  'have', 'has', 'had', 'was', 'were', 'been', 'are', 'can', 'you', 'your', 'please', 'help',
  'lost', 'left', 'found', 'item', 'items', 'my', 'mine', 'our', 'about', 'there', 'here',
  'yesterday', 'today', 'morning', 'afternoon', 'evening', 'night', 'last', 'week', 'days', 'ago',
  'did', 'does', 'someone', 'anyone', 'find', 'check', 'look', 'looking', 'search', 'think',
  'might', 'could', 'would', 'should', 'want', 'need', 'how', 'what', 'where', 'when', 'who',
  'any', 'all', 'show', 'list', 'see', 'tell', 'some', 'been', 'into', 'onto', 'over', 'just',
  'really', 'very', 'also', 'still', 'maybe', 'hello', 'hey', 'thanks', 'thank', 'okay', 'yes'
]);

const CATEGORY_HINTS: Array<{ category: ItemCategory; keywords: string[] }> = [
  {
    category: 'Electronics',
    keywords: [
      'electronic', 'electronics', 'laptop', 'computer', 'pc', 'macbook', 'hp', 'dell', 'lenovo',
      'charger', 'adapter', 'phone', 'smartphone', 'iphone', 'samsung', 'tecno', 'infinix', 'itel',
      'calculator', 'casio', 'usb', 'flash', 'pendrive', 'earbuds', 'airpods', 'headphones',
      'earphones', 'tablet', 'ipad', 'powerbank', 'mouse', 'cable', 'hub', 'speaker', 'camera'
    ]
  },
  {
    category: 'Documents & ID Cards',
    keywords: [
      'id', 'card', 'student id', 'national id', 'passport', 'permit', 'license', 'transcript',
      'document', 'documents', 'certificate', 'folder', 'envelope', 'exam', 'slip', 'receipt',
      'paper', 'papers', 'badge', 'library card', 'atm', 'bank card'
    ]
  },
  {
    category: 'Bags & Wallets',
    keywords: [
      'bag', 'backpack', 'wallet', 'purse', 'pouch', 'handbag', 'satchel', 'luggage', 'briefcase',
      'knapsack', 'tote', 'suitcase', 'rucksack', 'bi-fold', 'bifold'
    ]
  },
  {
    category: 'Clothing',
    keywords: [
      'clothing', 'clothes', 'jacket', 'sweater', 'hoodie', 'coat', 'shirt', 'cap', 'hat', 'scarf',
      'shoe', 'shoes', 'sneaker', 'sneakers', 'umbrella', 'blazer', 'cardigan', 'jersey', 'trouser'
    ]
  },
  {
    category: 'Books & Stationery',
    keywords: [
      'book', 'books', 'textbook', 'notebook', 'bible', 'diary', 'pen', 'pencil', 'ruler', 'notes',
      'binder', 'stationery', 'novel', 'journal', 'workbook', 'dictionary'
    ]
  },
  {
    category: 'Accessories',
    keywords: [
      'accessory', 'accessories', 'bottle', 'flask', 'tumbler', 'watch', 'wristwatch', 'smartwatch',
      'glasses', 'spectacles', 'sunglasses', 'ring', 'bracelet', 'necklace', 'earring', 'belt', 'umbrella'
    ]
  },
  {
    category: 'Keys',
    keywords: ['key', 'keys', 'keychain', 'lanyard', 'padlock', 'fob', 'keyring', 'room key', 'hostel key']
  }
];

const LOCATION_KEYWORDS = [
  'library', 'science', 'ict', 'lab', 'dining', 'cafeteria', 'chapel', 'auditorium',
  'hostel', 'gate', 'security', 'dean', 'admin', 'administration', 'block', 'hall', 'walkway',
  'lecture', 'classroom', 'bench', 'courtyard', 'gazebo', 'entrance'
];

function extractTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
}

function stemToken(token: string): string {
  if (token.length > 4 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.length > 3 && token.endsWith('es') && !token.endsWith('oes')) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

function detectCategory(text: string): ItemCategory | undefined {
  const lower = text.toLowerCase();
  for (const hint of CATEGORY_HINTS) {
    if (
      hint.keywords.some((kw) => {
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${escaped}s?\\b`, 'i').test(lower);
      })
    ) {
      return hint.category;
    }
  }
  return undefined;
}

function detectLocationHint(text: string): string | undefined {
  const lower = text.toLowerCase();
  return LOCATION_KEYWORDS.find((loc) => new RegExp(`\\b${loc}`, 'i').test(lower));
}

function detectDateWindow(text: string): { from?: Date; label?: string } {
  const lower = text.toLowerCase();
  const now = new Date();
  if (lower.includes('today') || lower.includes('this morning') || lower.includes('earlier')) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return { from: d, label: 'today' };
  }
  if (lower.includes('yesterday')) {
    const d = new Date(now);
    d.setDate(d.getDate() - 3);
    return { from: d, label: 'yesterday' };
  }
  if (lower.includes('last week') || lower.includes('this week') || lower.includes('few days') || lower.includes('recently')) {
    const d = new Date(now);
    d.setDate(d.getDate() - 10);
    return { from: d, label: 'recent days' };
  }
  return {};
}

function formatShortDate(dateInput: Date | string): string {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toSuggestedListing(item: PublicFoundSnapshot, reasons: string[]): AssistantSuggestedListing {
  return {
    id: String(item._id),
    itemName: item.itemName,
    category: item.category as ItemCategory,
    description: item.description,
    locationFound: item.locationFound,
    holdingLocation: item.holdingLocation,
    dateFound: new Date(item.dateFound).toISOString(),
    status: item.status,
    url: `/found/${String(item._id)}`,
    matchReasons: reasons,
    disclaimer: 'Suggested match only — authorized staff must verify ownership before release.'
  };
}

/**
 * STRICT PUBLIC-ONLY SNAPSHOT:
 * Selects ONLY non-sensitive public fields of active, non-hidden FoundItem records and active Locations.
 * NEVER selects identifyingDetails, reporter, User, Claim, LostItem, custodyHistory, or AuditLog.
 */
async function fetchPublicFoundCatalog(): Promise<PublicFoundSnapshot[]> {
  return FoundItem.find({
    status: { $in: ['Stored', 'Claim Pending'] },
    moderationStatus: { $nin: ['Hidden', 'Archived'] }
  })
    .select('_id itemName category description locationFound holdingLocation dateFound status')
    .sort({ dateFound: -1 })
    .limit(60)
    .lean();
}

async function fetchPublicLocations(): Promise<PublicLocationSnapshot[]> {
  return Location.find({ isActive: true })
    .select('name code buildingArea isHoldingDesk description')
    .sort({ isHoldingDesk: -1, name: 1 })
    .limit(30)
    .lean();
}

function scorePublicFoundListings(
  catalog: PublicFoundSnapshot[],
  queryText: string
): AssistantSuggestedListing[] {
  const tokens = extractTokens(queryText);
  const stemmedTokens = [...new Set(tokens.map(stemToken))];
  const category = detectCategory(queryText);
  const locHint = detectLocationHint(queryText);
  const dateWindow = detectDateWindow(queryText);

  if (tokens.length === 0 && !category && !locHint) {
    return [];
  }

  const scored = catalog
    .map((item) => {
      let score = 0;
      const reasons: string[] = [];
      const titleLower = item.itemName.toLowerCase();
      const haystack = `${item.itemName} ${item.description} ${item.category} ${item.locationFound} ${item.holdingLocation}`.toLowerCase();

      if (category && item.category === category) {
        score += 35;
        reasons.push(`Category: ${category}`);
      }

      if (locHint && `${item.locationFound} ${item.holdingLocation}`.toLowerCase().includes(locHint)) {
        score += 25;
        reasons.push(`Near ${item.locationFound}`);
      }

      const matchedWords = stemmedTokens.filter((t) => t.length >= 2 && haystack.includes(t));
      const uniqueMatched = [...new Set(matchedWords)];
      if (uniqueMatched.length > 0) {
        const titleHits = uniqueMatched.filter((t) => titleLower.includes(t)).length;
        score += Math.min(45, uniqueMatched.length * 14 + titleHits * 8);
        reasons.push(`Matches: ${uniqueMatched.slice(0, 3).join(', ')}`);
      }

      if (dateWindow.from && new Date(item.dateFound) >= dateWindow.from) {
        score += 8;
        if (reasons.length > 0) {
          reasons.push('Within your timeframe');
        }
      }

      return { item, score, reasons };
    })
    .filter((entry) => entry.score >= 22)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return scored.map(({ item, reasons }) => toSuggestedListing(item, reasons));
}

function isRestrictedDecisionRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(approve|reject|accept|deny|release|hand over|give me|confirm i am the owner|declare me the owner|change (?:the )?(?:claim|item) status|mark (?:my )?claim approved|authorize release)\b/i.test(
    lower
  );
}

function isPrivateDataRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(hidden|private|secret)\s+(?:detail|details|description|mark|marks|notes|proof|evidence|info)|serial number|student(?:'s|s)?\s+(?:phone|email|contact|profile|record|password)|other students?|staff notes|claim evidence|verification notes|reveal\s+(?:details|marks|contact|phone|email)\b/i.test(
    lower
  );
}

function isGreeting(text: string): boolean {
  const cleaned = text
    .toLowerCase()
    .replace(/[!.,?]+/g, '')
    .trim();
  return /^(hi+|hey+|hello+|yo|sup|hiya|howdy|greetings|good\s*(morning|afternoon|evening|day)|how\s+are\s+you(\s+doing)?|what'?s\s+up|hullo|helo)(\s+(there|bot|ai|assistant|friend|bugema))?$/i.test(
    cleaned
  );
}

function isThanksOrFarewell(text: string): 'thanks' | 'bye' | 'ack' | null {
  const cleaned = text
    .toLowerCase()
    .replace(/[!.,?]+/g, '')
    .trim();
  if (/^(thanks|thank\s+you|thx|ty|appreciate\s+it|much\s+appreciated|many\s+thanks)(\s+(so\s+much|a\s+lot|very\s+much|bot|ai))?$/i.test(cleaned)) {
    return 'thanks';
  }
  if (/^(bye|goodbye|see\s+ya|see\s+you|take\s+care|good\s+night|later)$/i.test(cleaned)) {
    return 'bye';
  }
  if (/^(ok|okay|alright|got\s+it|cool|nice|great|sure|awesome|understood|noted|perfect)$/i.test(cleaned)) {
    return 'ack';
  }
  return null;
}

function isCapabilityOrIdentityQuestion(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(who are you|what are you|what can you do|how can you help|what do you do|your name|introduce yourself|tell me about yourself)\b|^help$/i.test(
    lower
  );
}

function isBrowseListingsRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(what(?:'s| is| has been| was| were)?\s+(?:been\s+)?found|show\s+(?:me\s+)?(?:all\s+|recent\s+|latest\s+|available\s+)?(?:found\s+)?(?:items?|listings?)|list\s+(?:all\s+|recent\s+)?(?:found\s+)?items?|what\s+items?\s+(?:are|do you have)|anything\s+(?:been\s+)?found|recent\s+found|latest\s+found|browse\s+found|how\s+many\s+(?:found\s+)?items?|in\s+storage|currently\s+held)\b/i.test(
    lower
  );
}

function isDeskOrLocationQuestion(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(holding\s+desk|security\s+desk|dean\s+of\s+students|office\s+hours|opening\s+hours|when\s+(?:are|is)\s+(?:the\s+)?(?:desk|office|you)\s+open|where\s+(?:is|are)\s+(?:the\s+)?(?:lost\s+and\s+found|holding|security|pickup|collection|campus)\s*(?:desk|office|location|locations)?|contact\s+staff|campus\s+locations|where\s+do\s+i\s+(?:go|drop|turn|collect|pick\s*up))\b/i.test(
    lower
  );
}

function isFoundItemGuidanceRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(i\s+(?:just\s+)?found\s+(?:a|an|some|someone'?s)|picked\s+up\s+(?:a|an|someone'?s)|someone\s+left\s+(?:a|an|their)|turn\s+in\s+(?:a|an|an\s+item)|hand\s+in\s+(?:a|an))\b/i.test(
    lower
  );
}

function isDraftLostRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(draft|write|help me write|compose|prepare|create|fill)\b.*\b(lost|report)\b/i.test(lower);
}

function isDraftClaimRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(draft|write|help me write|compose|prepare)\b.*\b(claim|ownership|explanation|proof)\b/i.test(lower);
}

function isAccountOrPrivacyQuestion(text: string): 'account' | 'privacy' | 'edit' | 'policy' | null {
  const lower = text.toLowerCase();
  if (/\b(privacy|private|hidden\s+fields?|why\s+(?:are|is).*(?:hidden|private)|data\s+safe|safe\s+to\s+share)\b/i.test(lower)) {
    return 'privacy';
  }
  if (/\b(register|sign\s*up|create\s+account|log\s*in|login|sign\s*in|student\s+account|forgot\s+password|account)\b/i.test(lower)) {
    return 'account';
  }
  if (/\b(edit|update|delete|remove|withdraw|cancel|close)\s+(?:my\s+)?(?:lost\s+|found\s+)?(?:report|listing|post|submission)\b/i.test(lower)) {
    return 'edit';
  }
  if (/\b(unclaimed|overdue|how\s+long|keep\s+items|storage\s+period|policy|after\s+60\s+days|after\s+30\s+days)\b/i.test(lower)) {
    return 'policy';
  }
  return null;
}

function isHowToQuestion(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(how\s+do\s+i|how\s+to|how\s+can\s+i|where\s+do\s+i|steps\s+to|process\s+for|what\s+do\s+i\s+need\s+to|check\s+(?:my\s+)?claim|track\s+(?:my\s+)?claim|collect|pickup|pick\s+up|submit\s+(?:a\s+)?claim|file\s+(?:a\s+)?(?:report|claim))\b/i.test(
    lower
  );
}

function isAffirmativeFollowUp(text: string): boolean {
  const cleaned = text
    .toLowerCase()
    .replace(/[!.,?]+/g, '')
    .trim();
  return /^(yes|yeah|yep|sure|please|go\s+ahead|do\s+it|yes\s+please|draft\s+it|help\s+me\s+draft\s+it|ok\s+draft\s+it)$/i.test(
    cleaned
  );
}

function getPreviousUserContext(history: AssistantHistoryTurn[], currentMessage: string): string {
  const prevUserTurns = history
    .filter((t) => t.role === 'user' && t.content.trim().toLowerCase() !== currentMessage.trim().toLowerCase())
    .slice(-2)
    .map((t) => t.content.trim());
  return prevUserTurns.join(' ');
}

function getLastAssistantTurn(history: AssistantHistoryTurn[]): string {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].role === 'assistant') return history[i].content;
  }
  return '';
}

function buildLostReportDraft(message: string): AssistantDraft {
  const category = detectCategory(message) || 'Other';
  const locHint = detectLocationHint(message);
  const dateLost = message.toLowerCase().includes('yesterday')
    ? new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const tokens = extractTokens(message)
    .filter((t) => !['draft', 'report', 'write', 'compose', 'prepare', 'create', 'fill'].includes(t))
    .slice(0, 5);
  const guessedName =
    tokens.length > 0 ? tokens.map((t) => t[0].toUpperCase() + t.slice(1)).join(' ') : 'Missing Campus Item';

  return {
    type: 'lost_report',
    title: 'Draft Lost-Item Report (Review Before Submitting)',
    fields: {
      itemName: guessedName,
      category,
      description: `General public summary based on your message: ${message.trim().slice(0, 220)}. (Edit to keep only general appearance publicly visible.)`,
      identifyingDetails:
        '[Add private marks only you know — e.g., serial digits, stickers, scratches, or items inside. Keep this private for staff verification.]',
      lastKnownLocation: locHint ? `Near ${locHint[0].toUpperCase() + locHint.slice(1)}` : 'Specify campus building or room',
      dateLost,
      approximateTimeLost: 'Specify approximate time (e.g. 2:30 PM)'
    },
    privacyReminder:
      'Review and edit every field before submitting. Put serial numbers, ID digits, stickers, or hidden marks ONLY in the private Identifying Details field so staff can verify ownership safely.'
  };
}

function buildOwnershipProofDraft(message: string): AssistantDraft {
  return {
    type: 'ownership_proof',
    title: 'Draft Private Ownership Explanation (Review Before Submitting)',
    fields: {
      explanation: `I misplaced this item on campus (${message.trim().slice(0, 200)}). I noticed it was missing shortly afterward and am submitting this claim for verification by campus staff.`,
      identifyingProof:
        '[List 2–3 unique private details not shown publicly: e.g., exact brand/model, serial number suffix, stickers, lock-screen image, scratches, or contents inside.]'
    },
    privacyReminder:
      'Never share your private identifying proof publicly. Only enter it inside the protected Claim Submission form so authorized staff can compare it against intake records.'
  };
}

function buildLlmSystemPrompt(
  catalog: PublicFoundSnapshot[],
  locations: PublicLocationSnapshot[],
  matches: AssistantSuggestedListing[]
): string {
  const safeMatches = (matches.length > 0 ? matches : catalog.slice(0, 10).map((it) => toSuggestedListing(it, []))).map(
    (m) => ({
      itemName: m.itemName,
      category: m.category,
      description: m.description,
      locationFound: m.locationFound,
      holdingLocation: m.holdingLocation,
      dateFound: m.dateFound.slice(0, 10),
      status: m.status,
      link: m.url
    })
  );

  const safeHoldingDesks = locations
    .filter((l) => l.isHoldingDesk)
    .map((l) => `${l.name} (${l.buildingArea})`);

  return [
    'You are the Bugema AI Assistant — the real-time student support agent for the Bugema University Campus Lost & Found Management System.',
    'Respond naturally, directly, and specifically to whatever the user just asked — whether a greeting, a question about campus desks/policies, browsing found items, describing a lost/found item, or a follow-up.',
    'STRICT SECURITY & PRIVACY RULES:',
    '1. NEVER approve or reject claims, declare ownership, change item statuses, or authorize release of property. Only authorized Bugema campus staff can verify ownership and release stored items.',
    '2. NEVER reveal, fabricate, or guess private student records, phone numbers, emails, passwords, claim evidence, staff notes, or hidden identifying marks.',
    '3. Whenever you mention found items from the catalog below, clearly state they are SUGGESTIONS ONLY and require in-person staff verification before release.',
    '4. Remind students to keep unique identifying marks private for staff verification when filing reports or claims.',
    '5. Keep answers warm, clear, accurate, and concise (2–5 sentences unless listing items or steps).',
    `Current live public found items count: ${catalog.length}.`,
    `Active campus holding desks: ${safeHoldingDesks.length > 0 ? safeHoldingDesks.join('; ') : STAFF_CONTACT_INFO.desk}.`,
    `Staff hours: ${STAFF_CONTACT_INFO.hours}.`,
    `Publicly visible found listings (safe public summaries only): ${JSON.stringify(safeMatches)}`
  ].join('\n');
}

async function callExternalLlm(
  userMessage: string,
  history: AssistantHistoryTurn[],
  catalog: PublicFoundSnapshot[],
  locations: PublicLocationSnapshot[],
  matches: AssistantSuggestedListing[],
  streamCallbacks?: AssistantStreamCallbacks
): Promise<string | null> {
  if (!env.aiProviderApiKey) {
    return null;
  }

  const systemPrompt = buildLlmSystemPrompt(catalog, locations, matches);
  const safeHistory = history
    .filter((t) => t.content.trim().length > 0)
    .slice(-6)
    .map((turn) => ({
      role: turn.role,
      content: turn.content.slice(0, 500)
    }));

  const lastTurn = safeHistory[safeHistory.length - 1];
  const dedupedHistory =
    lastTurn && lastTurn.role === 'user' && lastTurn.content.trim() === userMessage.trim()
      ? safeHistory.slice(0, -1)
      : safeHistory;

  const shouldStream = Boolean(streamCallbacks?.onToken);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);

  try {
    const response = await fetch(`${env.aiProviderBaseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.aiProviderApiKey}`
      },
      body: JSON.stringify({
        model: env.aiProviderModel,
        temperature: 0.4,
        max_tokens: 450,
        stream: shouldStream,
        messages: [
          { role: 'system', content: systemPrompt },
          ...dedupedHistory,
          { role: 'user', content: userMessage.slice(0, 800) }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`AI provider returned HTTP ${response.status}`);
    }

    if (shouldStream && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              streamCallbacks?.onToken?.(delta);
            }
          } catch {
            // Ignore incomplete or non-JSON keepalive lines
          }
        }
      }

      const trimmed = fullText.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    return content || null;
  } catch (err) {
    const errName = err instanceof Error ? err.name : 'AIProviderError';
    if (!env.isTest) {
      console.error(`[AI Assistant Operational Fallback] ${errName}`);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

interface BuiltPlan {
  reply: string;
  followUpQuestions: string[];
  suggestedListings: AssistantSuggestedListing[];
  draft?: AssistantDraft;
  allowExternalLlm: boolean;
  statusLabel: string;
}

async function buildCampusAssistantPlan(
  message: string,
  history: AssistantHistoryTurn[]
): Promise<BuiltPlan> {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  // 1. Hard guardrail: never approve/reject claims, declare ownership, or change statuses
  if (isRestrictedDecisionRequest(trimmed)) {
    return {
      statusLabel: 'Reviewing campus verification policy…',
      allowExternalLlm: false,
      reply:
        'I cannot approve or reject claims, confirm ownership, change item statuses, or authorize property release. Only authorized Bugema University campus staff can verify ownership and release items after reviewing your claim and student ID in person. You can track your claim status under "My Submissions" or visit the holding desk listed on the item.',
      followUpQuestions: [
        'Draft a private ownership explanation for staff review',
        'How do I check my current claim status?'
      ],
      suggestedListings: []
    };
  }

  // 2. Hard guardrail: never disclose private records, contacts, claim evidence, staff notes, or hidden descriptions
  if (isPrivateDataRequest(trimmed)) {
    return {
      statusLabel: 'Checking privacy safeguards…',
      allowExternalLlm: false,
      reply:
        'For student privacy and fraud prevention, I do not have access to private student profiles, phone numbers, emails, staff verification notes, claim evidence, or hidden identifying details on found items. Keeping sensitive marks private ensures only the rightful owner can verify an item with campus staff. If you need help with a specific claim or pickup, please contact authorized staff directly.',
      followUpQuestions: [
        'Show publicly visible found items',
        'Help me draft a private ownership explanation'
      ],
      suggestedListings: []
    };
  }

  const [catalog, locations] = await Promise.all([fetchPublicFoundCatalog(), fetchPublicLocations()]);
  const holdingDesks = locations.filter((l) => l.isHoldingDesk);

  // 3. Greetings & conversational openers (NEVER pretend we ran an item search!)
  if (isGreeting(trimmed)) {
    const liveCountText =
      catalog.length > 0
        ? `There ${catalog.length === 1 ? 'is' : 'are'} currently **${catalog.length} publicly visible found item${catalog.length === 1 ? '' : 's'}** held across Bugema campus desks.`
        : 'All campus desks are ready to receive lost and found reports.';
    return {
      statusLabel: 'Connecting to Bugema AI Assistant…',
      allowExternalLlm: true,
      reply: `Hello! Welcome to the Bugema University Lost & Found AI Assistant. ${liveCountText}\n\nTell me what you're looking for (for example, "brown wallet near dining hall" or "HP charger"), ask to see what's currently in storage, or ask me to help draft a lost report or claim explanation.`,
      followUpQuestions: [
        'Show recently found items',
        'Where are the campus holding desks?',
        'How do I report a lost item?'
      ],
      suggestedListings: []
    };
  }

  // 4. Thanks / farewells / short acknowledgements
  const socialIntent = isThanksOrFarewell(trimmed);
  if (socialIntent === 'thanks') {
    return {
      statusLabel: 'Responding…',
      allowExternalLlm: true,
      reply:
        "You're very welcome! Let me know if you want to search another item, check a campus holding desk, or draft a lost-item report or ownership explanation. Hope you get everything sorted out quickly!",
      followUpQuestions: ['Show recently found items', 'How do I check my claim status?'],
      suggestedListings: []
    };
  }
  if (socialIntent === 'bye') {
    return {
      statusLabel: 'Responding…',
      allowExternalLlm: true,
      reply:
        'Goodbye! Feel free to come back anytime if you need to check newly turned-in campus items or need help with a report or claim.',
      followUpQuestions: ['Show recently found items'],
      suggestedListings: []
    };
  }
  if (socialIntent === 'ack') {
    return {
      statusLabel: 'Responding…',
      allowExternalLlm: true,
      reply:
        'Got it! Would you like me to search public found listings for a specific item, show what is currently held on campus, or help you draft a lost report?',
      followUpQuestions: [
        'Show recently found items',
        'Help me draft a lost report',
        'Where are the holding desks?'
      ],
      suggestedListings: []
    };
  }

  // 5. Capabilities / identity / "help"
  if (isCapabilityOrIdentityQuestion(trimmed)) {
    return {
      statusLabel: 'Loading assistant guide…',
      allowExternalLlm: true,
      reply:
        `I am the **Bugema Lost & Found AI Assistant**. Here is how I can help you in real time:\n• **Search live found items** — describe what you lost (color, brand, building, or date) and I will check all ${catalog.length} active public found listings.\n• **Browse what's in storage** — ask me to list recent found items or filter by building or category.\n• **Campus desks & hours** — find where to drop off or collect verified items.\n• **Draft reports & claims** — I can prepare a structured lost-item report or private ownership explanation for you to review before submitting.`,
      followUpQuestions: [
        'Show recently found items',
        'Where are the campus holding desks?',
        'Help me draft a lost report'
      ],
      suggestedListings: []
    };
  }

  // 6. Affirmative follow-up to a previous draft offer (uses conversation history!)
  const lastBotText = getLastAssistantTurn(history).toLowerCase();
  const prevUserText = getPreviousUserContext(history, trimmed);
  if (isAffirmativeFollowUp(trimmed) && prevUserText) {
    if (lastBotText.includes('ownership explanation') || lastBotText.includes('claim')) {
      const draft = buildOwnershipProofDraft(prevUserText);
      return {
        statusLabel: 'Preparing your ownership explanation draft…',
        allowExternalLlm: false,
        reply:
          'Sure! Based on our conversation, I prepared a private ownership explanation draft below. Review and add 2–3 unique private details only you would know before submitting your claim.',
        followUpQuestions: ['How do I check my claim status?', 'Show recently found items'],
        suggestedListings: [],
        draft
      };
    }
    if (lastBotText.includes('draft') || lastBotText.includes('lost-item report') || lastBotText.includes('lost report')) {
      const matches = scorePublicFoundListings(catalog, prevUserText);
      const draft = buildLostReportDraft(prevUserText);
      return {
        statusLabel: 'Preparing your lost-item report draft…',
        allowExternalLlm: false,
        reply:
          'Done! Using the details you shared earlier, I created a draft lost-item report below for you to review and edit before submitting. Keep unique marks strictly in the private Identifying Details field.',
        followUpQuestions: ['Where are the campus holding desks?', 'How do I submit a claim if it turns up?'],
        suggestedListings: matches,
        draft
      };
    }
  }

  // 7. Draft Lost-Item Report (student reviews & submits manually)
  if (isDraftLostRequest(trimmed)) {
    const contextText = extractTokens(trimmed).length <= 2 && prevUserText ? `${prevUserText} ${trimmed}` : trimmed;
    const matches = scorePublicFoundListings(catalog, contextText);
    const draft = buildLostReportDraft(contextText);
    return {
      statusLabel: 'Drafting lost-item report…',
      allowExternalLlm: false,
      reply:
        'I prepared a draft lost-item report for you to review and edit before submitting. Keep general details in the public description, and place unique marks (like serial numbers, stickers, or contents) only in the private Identifying Details field so staff can verify ownership.' +
        (matches.length > 0
          ? ` I also spotted ${matches.length} publicly visible found listing${matches.length === 1 ? '' : 's'} below as suggestions — remember that staff verification is required before any release.`
          : ''),
      followUpQuestions: [
        'Where are the campus holding desks?',
        'How does staff verification work?'
      ],
      suggestedListings: matches,
      draft
    };
  }

  // 8. Draft Private Ownership Explanation
  if (isDraftClaimRequest(trimmed)) {
    const contextText = extractTokens(trimmed).length <= 2 && prevUserText ? `${prevUserText} ${trimmed}` : trimmed;
    const draft = buildOwnershipProofDraft(contextText);
    return {
      statusLabel: 'Drafting ownership explanation…',
      allowExternalLlm: false,
      reply:
        'Here is a starter draft for your private ownership explanation. Please review it carefully and add specific details only the real owner would know before submitting your claim. Keep these sensitive details private — never post them in public descriptions.',
      followUpQuestions: [
        'Show recently found items',
        'How do I check my claim status?'
      ],
      suggestedListings: [],
      draft
    };
  }

  // 9. Campus holding desks, locations & office hours
  if (isDeskOrLocationQuestion(trimmed)) {
    const deskLines =
      holdingDesks.length > 0
        ? holdingDesks.map((d) => `• **${d.name}** (${d.buildingArea}) — ${d.description || 'Authorized holding point'}`).join('\n')
        : `• **${STAFF_CONTACT_INFO.desk}**`;

    return {
      statusLabel: 'Checking campus holding desks…',
      allowExternalLlm: true,
      reply: `Here are the active Bugema University campus holding desks where found property is stored and verified:\n${deskLines}\n\n**Hours:** ${STAFF_CONTACT_INFO.hours}. Bring your valid Student ID when visiting staff to verify ownership and collect an approved item.`,
      followUpQuestions: [
        'Show recently found items',
        'How do I submit an ownership claim?',
        'I found an item — what should I do?'
      ],
      suggestedListings: []
    };
  }

  // 10. Student found an item on campus
  if (isFoundItemGuidanceRequest(trimmed)) {
    const nearestDesks =
      holdingDesks.length > 0
        ? holdingDesks.slice(0, 3).map((d) => d.name).join(', ')
        : 'Main Gate Security Desk or Main Library Circulation Desk';
    return {
      statusLabel: 'Preparing found-item turn-in steps…',
      allowExternalLlm: true,
      reply:
        `Thank you for helping return campus property! Here is what to do:\n1. Drop the item off at an authorized holding desk (${nearestDesks}).\n2. Sign in and open **Report Found** to log the item's general appearance, category, where you found it, and the holding desk.\n3. Put unique marks (serial digits, names, stickers, or contents) ONLY in the private **Identifying Details** field — never in the public description — so staff can prevent fraudulent claims.`,
      followUpQuestions: [
        'Where are the campus holding desks?',
        'Why should identifying details stay private?'
      ],
      suggestedListings: []
    };
  }

  // 11. Browse / list all or filtered live found items
  if (isBrowseListingsRequest(trimmed)) {
    const requestedCat = detectCategory(trimmed);
    const requestedLoc = detectLocationHint(trimmed);

    const filtered = catalog.filter((item) => {
      const catOk = !requestedCat || item.category === requestedCat;
      const locOk =
        !requestedLoc ||
        `${item.locationFound} ${item.holdingLocation}`.toLowerCase().includes(requestedLoc);
      return catOk && locOk;
    });

    const listings = filtered
      .slice(0, 5)
      .map((item) =>
        toSuggestedListing(item, [
          `${item.category}`,
          `Found at ${item.locationFound} (${formatShortDate(item.dateFound)})`
        ])
      );

    if (listings.length === 0) {
      const scope = [requestedCat, requestedLoc ? `near ${requestedLoc}` : ''].filter(Boolean).join(' ');
      const availableCats = [...new Set(catalog.map((c) => c.category))].join(', ');
      return {
        statusLabel: 'Checking live public listings…',
        allowExternalLlm: true,
        reply:
          catalog.length > 0
            ? `I checked the live catalog and there are currently no publicly visible found items matching **${scope || 'that filter'}**. Right now there are ${catalog.length} active found items across: ${availableCats}. Would you like to see all recent items or draft a lost-item report?`
            : 'There are currently no active publicly visible found items in storage. You can submit a lost-item report so campus staff can alert you if a match is turned in.',
        followUpQuestions: [
          'Show all recently found items',
          'Help me draft a lost report'
        ],
        suggestedListings: []
      };
    }

    const summaryLines = listings
      .map(
        (it, idx) =>
          `${idx + 1}. **${it.itemName}** (${it.category}) — found at ${it.locationFound}, held at ${it.holdingLocation}`
      )
      .join('\n');

    return {
      statusLabel: 'Fetching live campus found items…',
      allowExternalLlm: true,
      reply: `Here ${listings.length === 1 ? 'is' : 'are'} ${listings.length} of ${filtered.length} currently active publicly visible found item${filtered.length === 1 ? '' : 's'}:\n${summaryLines}\n\nThese are public summaries only — open any listing below to inspect it and submit an ownership claim for staff verification.`,
      followUpQuestions: [
        'How do I submit an ownership claim?',
        'None of these match — draft a lost report'
      ],
      suggestedListings: listings
    };
  }

  // 12. Account, Privacy, Edit/Delete, or Overdue Policy questions
  const infoTopic = isAccountOrPrivacyQuestion(trimmed);
  if (infoTopic === 'privacy') {
    return {
      statusLabel: 'Checking privacy rules…',
      allowExternalLlm: true,
      reply:
        'To protect Bugema students from false claims and data leaks, public listings only show general appearance, category, campus area, and holding desk. Unique details (serial numbers, stickers, ID digits, contents inside bags/wallets) are kept strictly private for authorized staff verification, and student phone/email contacts are never exposed publicly.',
      followUpQuestions: ['How do I submit an ownership claim?', 'Show recently found items'],
      suggestedListings: []
    };
  }
  if (infoTopic === 'account') {
    return {
      statusLabel: 'Checking account help…',
      allowExternalLlm: true,
      reply:
        'Anyone can browse publicly visible found items and chat with me without signing in. To report a lost item, log a found item, or submit an ownership claim, click **Register** (with your Bugema Student ID, course, email, and phone) or **Sign In** from the top navigation bar.',
      followUpQuestions: ['How do I report a lost item?', 'Show recently found items'],
      suggestedListings: []
    };
  }
  if (infoTopic === 'edit') {
    return {
      statusLabel: 'Checking submission help…',
      allowExternalLlm: true,
      reply:
        'You can edit details or withdraw/close your own lost-item report anytime by signing in and opening **My Submissions**. Only authorized campus staff can mark an item as Claimed or Returned after in-person verification.',
      followUpQuestions: ['How do I check my claim status?', 'Where are the campus holding desks?'],
      suggestedListings: []
    };
  }
  if (infoTopic === 'policy') {
    return {
      statusLabel: 'Checking unclaimed property policy…',
      allowExternalLlm: true,
      reply:
        'Found items are safely stored at their listed Bugema campus holding desk. Items held for more than 30 days are flagged for overdue follow-up, and items remaining unclaimed beyond 60 days become eligible for university unclaimed-property policy review (extended hold, university store transfer, donation, or disposal) by authorized staff.',
      followUpQuestions: ['Show recently found items', 'Where are the campus holding desks?'],
      suggestedListings: []
    };
  }

  // 13. Run live search on current message (and combine with previous user turn if this is a short follow-up like a location/color!)
  let matches = scorePublicFoundListings(catalog, trimmed);
  let effectiveQuery = trimmed;
  if (matches.length === 0 && prevUserText && trimmed.split(/\s+/).length <= 6) {
    const combined = `${prevUserText} ${trimmed}`;
    const contextMatches = scorePublicFoundListings(catalog, combined);
    if (contextMatches.length > 0) {
      matches = contextMatches;
      effectiveQuery = combined;
    }
  }

  // 14. How-to / procedural questions (when not returning item search results)
  if (isHowToQuestion(trimmed) && matches.length === 0) {
    let reply = '';
    if (lower.includes('lost')) {
      reply =
        'To report a lost item: sign in to your student account, open **Report Lost** from the navigation bar, and enter the item name, category, a general public description, last-known location, and date/time lost. Place sensitive marks (serial numbers, stickers, hidden contents) ONLY in the private **Identifying Details** field so staff can verify ownership safely.';
    } else if (lower.includes('found')) {
      reply =
        'To report a found item: turn the item in at a campus holding desk (such as the Main Gate Security Desk or Main Library Circulation Desk), sign in, open **Report Found**, enter a broad public description, and keep unique identifying marks inside the private **Identifying Details** field.';
    } else if (lower.includes('status') || lower.includes('track')) {
      reply =
        'To check your claim status: sign in and open **My Submissions → My Claims**. You will see whether your claim is Pending, Under Review, Approved, or Rejected, along with any staff verification notes. For pickup or decision questions, visit authorized campus staff.';
    } else if (lower.includes('claim') || lower.includes('collect') || lower.includes('pick')) {
      reply =
        'To submit an ownership claim: browse **Found Items**, open the matching listing, and click **Submit Ownership Claim**. Explain when and where you lost the item and provide private identifying proof. Authorized staff will review your claim and verify your Student ID in person before releasing the item.';
    } else {
      reply =
        'I can help you search publicly visible found listings, report a lost or found item, draft a lost report or private ownership proof, or guide you to the right Bugema holding desk. What would you like to do first?';
    }

    return {
      statusLabel: 'Preparing step-by-step guidance…',
      allowExternalLlm: true,
      reply,
      followUpQuestions: [
        'Show recently found items',
        'Help me draft a lost report',
        'Where are the campus holding desks?'
      ],
      suggestedListings: []
    };
  }

  // 15. Natural-language search results OR intelligent response to whatever the user asked
  const detectedCat = detectCategory(effectiveQuery);
  const detectedLoc = detectLocationHint(effectiveQuery);
  const tokens = extractTokens(effectiveQuery);
  const looksLikeItemQuery = Boolean(
    detectedCat ||
      detectedLoc ||
      /\b(lost|missing|misplaced|forgot|left|dropped|looking for|find my|found my|where is my|black|blue|red|green|white|silver|brown|grey|gray|navy|gold|yellow|pink)\b/i.test(
        lower
      )
  );

  if (matches.length > 0) {
    const topNames = matches
      .slice(0, 3)
      .map((m) => `**${m.itemName}** (${m.locationFound})`)
      .join(', ');
    const followUps: string[] = [];
    if (!detectedLoc) {
      followUps.push('Which campus building were you near when you last had it?');
    }
    followUps.push('Help me draft a private ownership explanation');
    followUps.push('None of these match — draft a lost report');

    return {
      statusLabel: 'Searching live public found listings…',
      allowExternalLlm: true,
      reply: `I checked the live public found listings and found ${matches.length} possible suggestion${matches.length === 1 ? '' : 's'}: ${topNames}.\n\nThese are **suggestions only** — click a listing below to inspect its public details and submit an ownership claim with private identifying marks so authorized Bugema staff can verify ownership before release.`,
      followUpQuestions: followUps.slice(0, 2),
      suggestedListings: matches
    };
  }

  if (looksLikeItemQuery) {
    const querySummary =
      tokens.length > 0 ? `"${tokens.slice(0, 4).join(' ')}"` : detectedCat || 'that item';
    const followUps: string[] = [];
    if (!detectedCat) {
      followUps.push(`Which category fits best (${ITEM_CATEGORIES.slice(0, 4).join(', ')})?`);
    }
    if (!detectedLoc) {
      followUps.push('Which campus building or area were you near?');
    }
    followUps.push(`Draft a lost report for ${tokens.slice(0, 3).join(' ') || 'my item'}`);

    return {
      statusLabel: 'Searching live public found listings…',
      allowExternalLlm: true,
      reply: `I searched all ${catalog.length} publicly visible found listing${catalog.length === 1 ? '' : 's'} currently in storage and did not see a close match for ${querySummary} yet.\n\nTry adding the item's color, category, or campus building — or say **"yes, draft a lost report"** and I'll prepare one right now so staff can alert you if it gets turned in (remember to keep unique identifying marks private for verification).`,
      followUpQuestions: followUps.slice(0, 2),
      suggestedListings: []
    };
  }

  // 16. General / conversational question that isn't a specific item search
  return {
    statusLabel: 'Thinking…',
    allowExternalLlm: true,
    reply: `I'm the Bugema University Lost & Found AI Assistant, so I'm specifically set up to help with campus lost & found — searching the ${catalog.length} active public found item${catalog.length === 1 ? '' : 's'}, guiding you to campus holding desks, answering claim/reporting questions, and drafting lost reports or ownership proof.\n\nIf you're asking about a missing item or campus lost-and-found service, tell me a bit more (like the item name, building, or what you'd like to do) and I'll help right away!`,
    followUpQuestions: [
      'Show recently found items',
      'Where are the campus holding desks?',
      'How do I report a lost item?'
    ],
    suggestedListings: []
  };
}

export async function generateAssistantReply(
  message: string,
  history: AssistantHistoryTurn[] = [],
  options: AssistantRunOptions = {}
): Promise<AssistantReply> {
  const isEnabled = options.enabledOverride ?? env.aiAssistantEnabled;
  if (!isEnabled) {
    throw new AppError(
      503,
      'The AI support assistant is temporarily unavailable. You can still browse found items, submit a lost report, or file a claim directly.',
      'AI_UNAVAILABLE'
    );
  }

  const plan = await buildCampusAssistantPlan(message, history);

  let finalReply = plan.reply;
  let providerMode: 'external_llm' | 'campus_assistant' = 'campus_assistant';

  if (plan.allowExternalLlm && env.aiProviderApiKey) {
    const [catalog, locations] = await Promise.all([fetchPublicFoundCatalog(), fetchPublicLocations()]);
    const llmReply = await callExternalLlm(
      message.trim(),
      history,
      catalog,
      locations,
      plan.suggestedListings
    );
    if (llmReply) {
      finalReply = llmReply;
      providerMode = 'external_llm';
    }
  }

  return {
    aiGenerated: true,
    providerMode,
    reply: finalReply,
    followUpQuestions: plan.followUpQuestions,
    suggestedListings: plan.suggestedListings,
    ...(plan.draft ? { draft: plan.draft } : {}),
    staffContact: STAFF_CONTACT_INFO
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Real-time streaming generator:
 * - Emits immediate status update
 * - Streams live LLM tokens when AI_PROVIDER_API_KEY is configured
 * - Otherwise streams the dynamic campus-assistant reply smoothly in real-time word chunks
 * - Returns the complete structured AssistantReply payload for final metadata cards
 */
export async function streamAssistantReply(
  message: string,
  history: AssistantHistoryTurn[] = [],
  callbacks: AssistantStreamCallbacks = {},
  options: AssistantRunOptions = {}
): Promise<AssistantReply> {
  const isEnabled = options.enabledOverride ?? env.aiAssistantEnabled;
  if (!isEnabled) {
    throw new AppError(
      503,
      'The AI support assistant is temporarily unavailable. You can still browse found items, submit a lost report, or file a claim directly.',
      'AI_UNAVAILABLE'
    );
  }

  callbacks.onStatus?.('Thinking…');
  const plan = await buildCampusAssistantPlan(message, history);
  callbacks.onStatus?.(plan.statusLabel);

  let finalReply = plan.reply;
  let providerMode: 'external_llm' | 'campus_assistant' = 'campus_assistant';
  let alreadyStreamed = false;

  if (plan.allowExternalLlm && env.aiProviderApiKey) {
    const [catalog, locations] = await Promise.all([fetchPublicFoundCatalog(), fetchPublicLocations()]);
    const llmReply = await callExternalLlm(
      message.trim(),
      history,
      catalog,
      locations,
      plan.suggestedListings,
      {
        onToken: (tok) => {
          alreadyStreamed = true;
          callbacks.onToken?.(tok);
        }
      }
    );
    if (llmReply) {
      finalReply = llmReply;
      providerMode = 'external_llm';
    }
  }

  if (!alreadyStreamed && callbacks.onToken) {
    const chunks = finalReply.match(/\S+\s*|\n+/g) ?? [finalReply];
    for (const chunk of chunks) {
      callbacks.onToken(chunk);
      await sleep(16);
    }
  }

  return {
    aiGenerated: true,
    providerMode,
    reply: finalReply,
    followUpQuestions: plan.followUpQuestions,
    suggestedListings: plan.suggestedListings,
    ...(plan.draft ? { draft: plan.draft } : {}),
    staffContact: STAFF_CONTACT_INFO
  };
}
