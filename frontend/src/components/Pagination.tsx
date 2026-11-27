import React from 'react';
import type { PaginationMeta } from '../types';

interface PaginationProps {
  pagination: PaginationMeta;
  onPageChange: (nextPage: number) => void;
}

export function Pagination({ pagination, onPageChange }: PaginationProps) {
  if (pagination.total === 0) return null;

  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="muted small">
        Showing page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> (
        {pagination.total} total record{pagination.total === 1 ? '' : 's'})
      </span>
      <div className="row-gap">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={pagination.page <= 1}
          onClick={() => onPageChange(pagination.page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => onPageChange(pagination.page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
