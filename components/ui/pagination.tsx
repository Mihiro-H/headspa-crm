"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  return (
    <div className="flex items-center justify-center gap-3 text-sm text-neutral-600">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="flex h-9 items-center gap-1 rounded-md border border-neutral-300 px-3 disabled:opacity-40"
      >
        <ChevronLeft size={16} />
        前へ
      </button>
      <span>
        {page} / {Math.max(totalPages, 1)} ページ
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="flex h-9 items-center gap-1 rounded-md border border-neutral-300 px-3 disabled:opacity-40"
      >
        次へ
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
