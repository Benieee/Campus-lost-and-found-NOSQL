import { env } from '../config/env';
import { ITEM_CATEGORIES, ItemCategory } from '../constants/domain';
import { FoundItem } from '../models';
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

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'near', 'inside', 'outside', 'around',
  'have', 'has', 'had', 'was', 'were', 'been', 'are', 'can', 'you', 'your', 'please', 'help',
  'lost', 'left', 'found', 'item', 'items', 'my', 'mine', 'our', 'about', 'there', 'here',
  'yesterday', 'today', 'morning', 'afternoon', 'evening', 'night', 'last', 'week', 'days', 'ago',
  'did', 'does', 'someone', 'anyone', 'find', 'check', 'look', 'looking', 'search', 'think',
  'might', 'could', 'would', 'should', 'want', 'need', 'how', 'what', 'where', 'when', 'who'
]);

const CATEGORY_HINTS: Array<{ category: ItemCategory; keywords: string[] }> = [
  {
    category: 'Electronics',
    keywords: ['laptop', 'charger', 'adapter', 'phone', 'iphone', 'samsung', 'calculator', 'casio', 'usb', 'flash', 'earbuds', 'headphones', 'tablet', 'powerbank', 'mouse', 'cable']
  },
  {
    category: 'Documents & ID Cards',
    keywords: ['id', 'card', 'passport', 'permit', 'license', 'transcript', 'document', 'certificate', 'folder', 'envelope', 'exam', 'slip']
  },
  {
    category: 'Bags & Wallets',
    keywords: ['bag', 'backpack', 'wallet', 'purse', 'pouch', 'handbag', 'satchel', 'luggage', 'briefcase']
  },
  {
    category: 'Clothing',
    keywords: ['jacket', 'sweater', 'hoodie', 'coat', 'shirt', 'cap', 'hat', 'scarf', 'shoe', 'shoes', 'umbrella']
  },
  {
    category: 'Books & Stationery',
    keywords: ['book', 'textbook', 'notebook', 'bible', 'diary', 'pen', 'pencil', 'ruler', 'notes', 'binder']
  },
  {
    category: 'Accessories',
    keywords: ['bottle', 'flask', 'watch', 'wristwatch', 'glasses', 'spectacles', 'sunglasses', 'ring', 'bracelet', 'necklace', 'earring']
  },
  {
    category: 'Keys',
    keywords: ['key', 'keys', 'keychain', 'lanyard', 'padlock', 'fob']
  }
];

const LOCATION_KEYWORDS = [
  'library', 'science', 'ict', 'lab', 'dining', 'cafeteria', 'chapel', 'auditorium',
  'hostel', 'gate', 'security', 'dean', 'admin', 'administration', 'block', 'hall', 'walkway'
];

function extractTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
}

function detectCategory(text: string): ItemCategory | undefined {
  const lower = text.toLowerCase();
  for (const hint of CATEGORY_HINTS) {
    if (hint.keywords.some((kw) => new RegExp(`\\b${kw}s?\\b`, 'i').test(lower))) {
      return hint.category;
    }
  }
  return undefined;
}

function detectLocationHint(text: string): string | undefined {
  const lower = text.toLowerCase();
  return LOCATION_KEYWORDS.find((loc) => lower.includes(loc));
}

function detectDateWindow(text: string): { from?: Date; label?: string } {
  const lower = text.toLowerCase();
  const now = new Date();
  if (lower.includes('today')) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return { from: d, label: 'today' };
  }
  if (lower.includes('yesterday')) {
    const d = new Date(now);
    d.setDate(d.getDate() - 3);
    return { from: d, label: 'yesterday' };
  }
  if (lower.includes('last week') || lower.includes('this week') || lower.includes('few days')) {
    const d = new Date(now);
    d.setDate(d.getDate() - 10);
    return { from: d, label: 'recent days' };
  }
  return {};
}

/**
 * STRICT PUBLIC-ONLY SEARCH:
 * Projects ONLY non-sensitive public fields of active FoundItem records.
 * NEVER selects identifyingDetails, reporter, User, Claim, LostItem, or AuditLog.
 */
async function searchPublicFoundListings(queryText: string): Promise<AssistantSuggestedListing[]> {
  const tokens = extractTokens(queryText);
  const category = detectCategory(queryText);
  const locHint = detectLocationHint(queryText);
  const dateWindow = detectDateWindow(queryText);

  const publicItems = await FoundItem.find({
    status: { $in: ['Stored', 'Claim Pending'] }
  })
    .select('_id itemName category description locationFound holdingLocation dateFound status')
    .sort({ dateFound: -1 })
    .limit(60)
    .lean();

  const scored = publicItems
    .map((item) => {
      let score = 0;
      const reasons: string[] = [];
      const haystack = `${item.itemName} ${item.description} ${item.category} ${item.locationFound}`.toLowerCase();

      if (category && item.category === category) {
        score += 35;
        reasons.push(`Matches category (${category})`);
      }

      if (locHint && item.locationFound.toLowerCase().includes(locHint)) {
        score += 25;
        reasons.push(`Found near ${item.locationFound}`);
      }

      const matchedWords = tokens.filter((t) => t.length >= 3 && haystack.includes(t));
      const uniqueMatched = [...new Set(matchedWords)];
      if (uniqueMatched.length > 0) {
        score += Math.min(40, uniqueMatched.length * 14);
        reasons.push(`Keywords: ${uniqueMatched.slice(0, 3).join(', ')}`);
      }

      if (dateWindow.from && new Date(item.dateFound) >= dateWindow.from) {
        score += 10;
        reasons.push('Found within your timeframe');
      }

      return { item, score, reasons };
    })
    .filter((entry) => entry.score >= 25)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  return scored.map(({ item, reasons }) => ({
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
  }));
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

function isDraftLostRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(draft|write|help me write|compose|prepare|create)\b.*\b(lost|report)\b/i.test(lower);
}

function isDraftClaimRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(draft|write|help me write|compose|prepare)\b.*\b(claim|ownership|explanation|proof)\b/i.test(lower);
}

function isHowToQuestion(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(how do i|how to|how can i|where do i|steps to|process for|check (?:my )?claim|track (?:my )?claim|collect|pickup|pick up)\b/i.test(
    lower
  );
}

function buildLostReportDraft(message: string): AssistantDraft {
  const category = detectCategory(message) || 'Other';
  const locHint = detectLocationHint(message);
  const dateLost = message.toLowerCase().includes('yesterday')
    ? new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const tokens = extractTokens(message).slice(0, 5);
  const guessedName = tokens.length > 0 ? tokens.map((t) => t[0].toUpperCase() + t.slice(1)).join(' ') : 'Missing Campus Item';

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

async function tryExternalLlmEnhancement(
  userMessage: string,
  history: AssistantHistoryTurn[],
  publicMatches: AssistantSuggestedListing[],
  fallbackReply: string
): Promise<string> {
  if (!env.aiProviderApiKey) {
    return fallbackReply;
  }

  // Send ONLY minimal public listing summaries + current student question (never tokens, passwords, or private records)
  const safeCatalogSummary = publicMatches.map((m) => ({
    id: m.id,
    itemName: m.itemName,
    category: m.category,
    locationFound: m.locationFound,
    holdingLocation: m.holdingLocation,
    dateFound: m.dateFound.slice(0, 10),
    status: m.status,
    link: m.url
  }));

  const systemPrompt = [
    'You are the AI Student Support Assistant for the Bugema University Campus Lost and Found Management System.',
    'STRICT RULES:',
    '1. NEVER approve or reject claims, declare ownership, or authorize release of property. Direct claim decisions and item pickup to authorized campus staff.',
    '2. NEVER reveal or guess private student records, contact details, claim evidence, staff notes, or hidden item descriptions.',
    '3. Clearly label any found-item listings you mention as SUGGESTIONS ONLY requiring staff verification.',
    '4. Remind students to keep unique identifying marks private for staff verification.',
    '5. Keep answers concise, helpful, and friendly. Ask 1-2 brief follow-up questions if details are missing.',
    `Publicly visible matching listings (safe summaries only): ${JSON.stringify(safeCatalogSummary)}`
  ].join('\n');

  const safeHistory = history.slice(-4).map((turn) => ({
    role: turn.role,
    content: turn.content.slice(0, 500)
  }));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

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
        temperature: 0.3,
        max_tokens: 450,
        store: false,
        messages: [
          { role: 'system', content: systemPrompt },
          ...safeHistory,
          { role: 'user', content: userMessage.slice(0, 800) }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`AI provider returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('AI provider returned an empty response');
    }
    return content;
  } catch (err) {
    // Log operational error metadata ONLY — never log student conversation text or claim evidence
    const errMessage = err instanceof Error ? err.name : 'AIProviderError';
    if (!env.isTest) {
      console.error(`[AI Assistant Operational Error] ${errMessage}`);
    }
    throw new AppError(
      503,
      'The AI support assistant is temporarily unavailable. Core reporting, found-item search, and claim submission remain fully available.',
      'AI_UNAVAILABLE'
    );
  } finally {
    clearTimeout(timeout);
  }
}

export interface AssistantRunOptions {
  enabledOverride?: boolean;
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

  const trimmed = message.trim();

  // 1. Hard guardrail: never approve/reject claims, declare ownership, or change statuses
  if (isRestrictedDecisionRequest(trimmed)) {
    return {
      aiGenerated: true,
      providerMode: 'campus_assistant',
      reply:
        'I cannot approve or reject claims, confirm ownership, change item statuses, or authorize property release. Only authorized Bugema University campus staff can verify ownership and release items after reviewing your claim and ID in person. You can track your claim status under "My Submissions" or visit the holding desk listed on the item.',
      followUpQuestions: [
        'Would you like help drafting your private ownership explanation for staff review?',
        'Do you want steps on how to check your current claim status?'
      ],
      suggestedListings: [],
      staffContact: STAFF_CONTACT_INFO
    };
  }

  // 2. Hard guardrail: never disclose private records, contacts, claim evidence, staff notes, or hidden item descriptions
  if (isPrivateDataRequest(trimmed)) {
    return {
      aiGenerated: true,
      providerMode: 'campus_assistant',
      reply:
        'For student privacy and fraud prevention, I do not have access to private student profiles, phone numbers, emails, staff verification notes, claim evidence, or hidden identifying details on found items. Keeping sensitive marks private ensures only the rightful owner can verify an item with campus staff. If you need assistance with a specific claim or pickup, please contact authorized staff directly.',
      followUpQuestions: [
        'Would you like to search publicly visible found-item listings instead?',
        'Do you want help drafting a private ownership explanation to submit to staff?'
      ],
      suggestedListings: [],
      staffContact: STAFF_CONTACT_INFO
    };
  }

  // 3. Draft Lost-Item Report (student reviews & submits manually)
  if (isDraftLostRequest(trimmed)) {
    const matches = await searchPublicFoundListings(trimmed);
    const draft = buildLostReportDraft(trimmed);
    return {
      aiGenerated: true,
      providerMode: 'campus_assistant',
      reply:
        'I prepared a draft lost-item report for you to review and edit before submitting. Keep general details in the public description, and place unique marks (like serial numbers, stickers, or contents) only in the private Identifying Details field so staff can verify ownership.' +
        (matches.length > 0
          ? ` I also spotted ${matches.length} publicly visible found listing(s) below as suggestions — remember that staff verification is required before any release.`
          : ''),
      followUpQuestions: [
        'What exact campus building or room did you last see the item in?',
        'Are there any unique marks or contents you should add to the private identifying details?'
      ],
      suggestedListings: matches,
      draft,
      staffContact: STAFF_CONTACT_INFO
    };
  }

  // 4. Draft Private Ownership Explanation (student reviews & submits manually)
  if (isDraftClaimRequest(trimmed)) {
    const draft = buildOwnershipProofDraft(trimmed);
    return {
      aiGenerated: true,
      providerMode: 'campus_assistant',
      reply:
        'Here is a starter draft for your private ownership explanation. Please review it carefully and add specific details only the real owner would know before submitting your claim. Keep these sensitive details private — never post them in public descriptions.',
      followUpQuestions: [
        'Do you have a lost-item report you want to link when submitting the claim?',
        'Would you like to search publicly visible found items to locate the matching listing?'
      ],
      suggestedListings: [],
      draft,
      staffContact: STAFF_CONTACT_INFO
    };
  }

  // 5. How-to / procedural guidance
  const matches = await searchPublicFoundListings(trimmed);

  if (isHowToQuestion(trimmed) && matches.length === 0) {
    const lower = trimmed.toLowerCase();
    let reply = '';
    if (lower.includes('lost')) {
      reply =
        'To report a lost item: sign in to your student account, open "Report Lost" from the sidebar, enter the item name, category, a general public description, last-known location, and date/time lost. Place sensitive marks (serial numbers, stickers, hidden contents) in the private Identifying Details field so staff can verify ownership safely.';
    } else if (lower.includes('found')) {
      reply =
        'To report a found item: turn the item in at a campus holding desk (such as the Main Gate Security Desk or Main Library Desk), sign in, open "Report Found", enter a broad public description, and keep unique identifying marks inside the private Identifying Details field so fraudulent claims are prevented.';
    } else if (lower.includes('status') || lower.includes('track')) {
      reply =
        'To check your claim status: sign in and open "My Submissions" → "My Claims". You will see whether your claim is Pending, Under Review, Approved, or Rejected, along with any staff verification notes. For questions about a decision or item collection, please visit authorized campus staff.';
    } else if (lower.includes('claim') || lower.includes('collect') || lower.includes('pick')) {
      reply =
        'To submit a claim: browse "Found Items", open the matching listing, and click "Submit Ownership Claim". Explain when and where you lost the item and provide private identifying proof. Authorized staff will review your claim and contact you to verify your student ID before releasing the item.';
    } else {
      reply =
        'I can help you report a lost item, report a found item, search publicly visible found listings, draft a lost report or claim proof, or check how claims work. Remember to keep sensitive item details private for staff verification, and contact authorized staff for claim decisions or item collection.';
    }

    return {
      aiGenerated: true,
      providerMode: 'campus_assistant',
      reply,
      followUpQuestions: [
        'Would you like to describe a missing item so I can search public found listings?',
        'Would you like me to draft a lost-item report for you to review?'
      ],
      suggestedListings: [],
      staffContact: STAFF_CONTACT_INFO
    };
  }

  // 6. Natural-language search of publicly visible found listings
  const detectedCat = detectCategory(trimmed);
  const detectedLoc = detectLocationHint(trimmed);
  const followUps: string[] = [];
  if (!detectedCat) {
    followUps.push(`Which category best fits the item (e.g. ${ITEM_CATEGORIES.slice(0, 4).join(', ')})?`);
  }
  if (!detectedLoc) {
    followUps.push('Which campus building or area were you near when you last had it?');
  }
  if (!detectDateWindow(trimmed).label) {
    followUps.push('Roughly what date did you misplace it?');
  }

  const baseReply =
    matches.length > 0
      ? `I searched the publicly visible found-item listings and found ${matches.length} possible suggestion${matches.length === 1 ? '' : 's'} below. These are suggestions only — please inspect each listing carefully and submit an ownership claim with private identifying details so authorized campus staff can verify ownership before any release.`
      : 'I searched publicly visible found-item listings and did not see a close match yet. You can refine your search by telling me the item color, category, campus building, and approximate date, or I can help you draft a lost-item report to submit now (keeping sensitive identifying marks private for staff verification).';

  const finalReply = await tryExternalLlmEnhancement(trimmed, history, matches, baseReply);

  return {
    aiGenerated: true,
    providerMode: env.aiProviderApiKey ? 'external_llm' : 'campus_assistant',
    reply: finalReply,
    followUpQuestions: followUps.slice(0, 2),
    suggestedListings: matches,
    staffContact: STAFF_CONTACT_INFO
  };
}
