// React import not needed with JSX transform

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  return (
    <nav aria-label="Pagination" className="flex items-center space-x-2 mt-4">
      <button
        aria-label="Previous page"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="px-2 py-1 border rounded disabled:opacity-50"
      >
        Previous
      </button>
      {pages.map(p => (
        <button
          key={p}
          aria-current={p === currentPage ? 'page' : undefined}
          onClick={() => onPageChange(p)}
          className={`px-2 py-1 border rounded ${p === currentPage ? 'bg-blue-600 text-white' : ''}`}
        >
          {p}
        </button>
      ))}
      <button
        aria-label="Next page"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="px-2 py-1 border rounded disabled:opacity-50"
      >
        Next
      </button>
    </nav>
  );
}
