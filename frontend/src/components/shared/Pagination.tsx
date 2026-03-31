import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  pages,
  total,
  limit,
  onPageChange,
}) => {
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
      <p className="text-sm text-slate-400 font-mono">
        {start}–{end} of {total} results
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-400 hover:text-slate-100 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        {Array.from({ length: Math.min(5, pages) }, (_, i) => {
          let pageNum: number;
          if (pages <= 5) pageNum = i + 1;
          else if (page <= 3) pageNum = i + 1;
          else if (page >= pages - 2) pageNum = pages - 4 + i;
          else pageNum = page - 2 + i;

          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`w-8 h-8 text-sm font-mono rounded transition-colors ${
                pageNum === page
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                  : "text-slate-400 hover:bg-slate-700 hover:text-slate-100"
              }`}
            >
              {pageNum}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          className="p-1.5 rounded hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-400 hover:text-slate-100 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};
