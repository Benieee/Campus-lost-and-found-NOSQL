import {
  BookOpen,
  Briefcase,
  CreditCard,
  KeyRound,
  Laptop,
  Package,
  Shirt,
  Watch
} from 'lucide-react';
import { resolveMediaUrl } from '../api/client';
import type { ItemCategory } from '../types';

const CATEGORY_THEME: Record<
  ItemCategory,
  { bg: string; color: string; Icon: typeof Package }
> = {
  Electronics: {
    bg: 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)',
    color: '#1d4ed8',
    Icon: Laptop
  },
  'Documents & ID Cards': {
    bg: 'linear-gradient(135deg, #e0e7ff 0%, #eef2ff 100%)',
    color: '#4338ca',
    Icon: CreditCard
  },
  'Bags & Wallets': {
    bg: 'linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)',
    color: '#b45309',
    Icon: Briefcase
  },
  Clothing: {
    bg: 'linear-gradient(135deg, #fce7f3 0%, #fdf2f8 100%)',
    color: '#be185d',
    Icon: Shirt
  },
  'Books & Stationery': {
    bg: 'linear-gradient(135deg, #dcfce7 0%, #f0fdf4 100%)',
    color: '#15803d',
    Icon: BookOpen
  },
  Accessories: {
    bg: 'linear-gradient(135deg, #f3e8ff 0%, #faf5ff 100%)',
    color: '#7e22ce',
    Icon: Watch
  },
  Keys: {
    bg: 'linear-gradient(135deg, #ffedd5 0%, #fff7ed 100%)',
    color: '#c2410c',
    Icon: KeyRound
  },
  Other: {
    bg: 'linear-gradient(135deg, #e2e8f0 0%, #f8fafc 100%)',
    color: '#334155',
    Icon: Package
  }
};

export function ItemThumbnail({
  imageUrl,
  itemName,
  category
}: {
  imageUrl?: string;
  itemName: string;
  category: ItemCategory;
}) {
  const theme = CATEGORY_THEME[category] || CATEGORY_THEME.Other;
  const Icon = theme.Icon;

  if (imageUrl) {
    return (
      <div className="item-thumb" style={{ background: '#f1f5f9' }}>
        <img src={resolveMediaUrl(imageUrl)} alt={itemName} loading="lazy" />
      </div>
    );
  }

  return (
    <div className="item-thumb" style={{ background: theme.bg, color: theme.color }}>
      <div className="item-thumb-icon" aria-hidden="true">
        <Icon size={26} color={theme.color} />
      </div>
      <span className="item-thumb-caption">{category}</span>
    </div>
  );
}

export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className="items-grid" aria-busy="true" aria-label="Loading items">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="skeleton-card">
          <div className="skeleton-block" style={{ height: 158, borderRadius: 0 }} />
          <div style={{ padding: 16, display: 'grid', gap: 10 }}>
            <div className="skeleton-block" style={{ height: 18, width: '45%' }} />
            <div className="skeleton-block" style={{ height: 22, width: '80%' }} />
            <div className="skeleton-block" style={{ height: 14, width: '95%' }} />
            <div className="skeleton-block" style={{ height: 14, width: '65%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
