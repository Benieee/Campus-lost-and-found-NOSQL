import { FoundItem, IFoundItem, ILostItem, LostItem } from '../models';
import { serializeFoundItem, serializeLostItem, ViewerContext } from '../utils/serializers';

export const MATCH_DISCLAIMER =
  'Suggested match only. Physical verification by authorized campus staff is required before any item is released.';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'near', 'inside', 'outside',
  'left', 'lost', 'found', 'item', 'very', 'some', 'have', 'been', 'into', 'around'
]);

function tokenize(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
  return new Set(words);
}

function computeMatchScore(
  lost: Pick<ILostItem, 'itemName' | 'category' | 'description' | 'lastKnownLocation' | 'dateLost'>,
  found: Pick<IFoundItem, 'itemName' | 'category' | 'description' | 'locationFound' | 'dateFound'>
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (lost.category === found.category) {
    score += 40;
    reasons.push('Same category');
  }

  const lostLoc = lost.lastKnownLocation.toLowerCase().trim();
  const foundLoc = found.locationFound.toLowerCase().trim();
  if (lostLoc === foundLoc) {
    score += 25;
    reasons.push('Same campus location');
  } else {
    const lostLocTokens = tokenize(lostLoc);
    const foundLocTokens = tokenize(foundLoc);
    const locOverlap = [...lostLocTokens].filter((t) => foundLocTokens.has(t));
    if (locOverlap.length > 0) {
      score += 15;
      reasons.push('Nearby campus area');
    }
  }

  const lostTokens = tokenize(`${lost.itemName} ${lost.description}`);
  const foundTokens = tokenize(`${found.itemName} ${found.description}`);
  const sharedTokens = [...lostTokens].filter((token) => foundTokens.has(token));
  if (sharedTokens.length > 0) {
    const tokenScore = Math.min(25, sharedTokens.length * 8);
    score += tokenScore;
    reasons.push(`Matching keywords: ${sharedTokens.slice(0, 3).join(', ')}`);
  }

  const diffDays = (new Date(found.dateFound).getTime() - new Date(lost.dateLost).getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays >= -1 && diffDays <= 14) {
    score += 10;
    reasons.push('Compatible date range');
  }

  return { score: Math.min(score, 100), reasons };
}

export async function findSuggestedMatchesForLostItem(
  lostItem: ILostItem,
  viewer?: ViewerContext | null,
  limit = 5
) {
  const candidates = await FoundItem.find({
    status: { $in: ['Stored', 'Claim Pending'] }
  })
    .sort({ dateFound: -1 })
    .limit(100)
    .lean();

  const ranked = candidates
    .map((candidate) => {
      const { score, reasons } = computeMatchScore(lostItem, candidate);
      return { candidate, score, reasons };
    })
    .filter((entry) => entry.score >= 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => ({
      score: entry.score,
      reasons: entry.reasons,
      item: serializeFoundItem(entry.candidate, viewer)
    }));

  return {
    disclaimer: MATCH_DISCLAIMER,
    matches: ranked
  };
}

export async function findSuggestedMatchesForFoundItem(
  foundItem: IFoundItem,
  viewer?: ViewerContext | null,
  limit = 5
) {
  const candidates = await LostItem.find({
    status: { $in: ['Missing', 'Matched'] }
  })
    .sort({ dateLost: -1 })
    .limit(100)
    .lean();

  const ranked = candidates
    .map((candidate) => {
      const { score, reasons } = computeMatchScore(candidate, foundItem);
      return { candidate, score, reasons };
    })
    .filter((entry) => entry.score >= 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => ({
      score: entry.score,
      reasons: entry.reasons,
      item: serializeLostItem(entry.candidate, viewer)
    }));

  return {
    disclaimer: MATCH_DISCLAIMER,
    matches: ranked
  };
}

export async function getAdminSuggestedMatchPairs(viewer: ViewerContext, limit = 10) {
  const [lostItems, foundItems] = await Promise.all([
    LostItem.find({ status: { $in: ['Missing', 'Matched'] } })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    FoundItem.find({ status: { $in: ['Stored', 'Claim Pending'] } })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
  ]);

  const pairs: Array<{
    score: number;
    reasons: string[];
    lostItem: ReturnType<typeof serializeLostItem>;
    foundItem: ReturnType<typeof serializeFoundItem>;
  }> = [];

  for (const lost of lostItems) {
    for (const found of foundItems) {
      const { score, reasons } = computeMatchScore(lost, found);
      if (score >= 45) {
        pairs.push({
          score,
          reasons,
          lostItem: serializeLostItem(lost, viewer),
          foundItem: serializeFoundItem(found, viewer)
        });
      }
    }
  }

  pairs.sort((a, b) => b.score - a.score);
  return {
    disclaimer: MATCH_DISCLAIMER,
    matches: pairs.slice(0, limit)
  };
}
