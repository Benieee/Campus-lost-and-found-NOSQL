import React from 'react';
import type { ClaimStatus, FoundItemStatus, LostItemStatus } from '../types';

type AnyStatus = LostItemStatus | FoundItemStatus | ClaimStatus | string;

const STATUS_STYLE: Record<string, string> = {
  Missing: 'badge-amber',
  Matched: 'badge-purple',
  Claimed: 'badge-green',
  Closed: 'badge-slate',
  Stored: 'badge-blue',
  'Claim Pending': 'badge-amber',
  Returned: 'badge-green',
  Archived: 'badge-slate',
  Pending: 'badge-amber',
  'Under Review': 'badge-purple',
  Approved: 'badge-green',
  Rejected: 'badge-red'
};

export function StatusBadge({ status }: { status: AnyStatus }) {
  const cls = STATUS_STYLE[status] || 'badge-slate';
  return <span className={`badge ${cls}`}>{status}</span>;
}

export function formatDate(value?: string): string {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function formatDateTime(value?: string): string {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
