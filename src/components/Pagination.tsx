import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
    if (totalPages <= 1) return null;

    const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 5;
        let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let end = Math.min(totalPages, start + maxVisible - 1);
        if (end - start < maxVisible - 1) {
            start = Math.max(1, end - maxVisible + 1);
        }
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        return pages;
    };

    const goToPage = (page: number) => {
        const clamped = Math.max(1, Math.min(page, totalPages));
        onPageChange(clamped);
    };

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.25rem',
                padding: '0.5rem 0',
                flexWrap: 'wrap',
            }}
        >
            {/* Botón Ir al principio (primera página) */}
            <button
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
                title="Ir al principio"
                style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #e2e8f0',
                    background: currentPage === 1 ? '#f1f5f9' : '#ffffff',
                    color: currentPage === 1 ? '#94a3b8' : '#1e293b',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem',
                    transition: 'background 0.15s',
                }}
            >
                &lt;&lt;
            </button>

            {/* Botón Anterior */}
            <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #e2e8f0',
                    background: currentPage === 1 ? '#f1f5f9' : '#ffffff',
                    color: currentPage === 1 ? '#94a3b8' : '#1e293b',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                }}
            >
                <ChevronLeft style={{ width: '0.875rem', height: '0.875rem' }} />
                Anterior
            </button>

            {/* Números de página */}
            {getPageNumbers().map((page) => (
                <button
                    key={page}
                    onClick={() => goToPage(page)}
                    style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.375rem',
                        border: '1px solid #e2e8f0',
                        background: page === currentPage ? '#0b3b4c' : '#ffffff',
                        color: page === currentPage ? '#ffffff' : '#1e293b',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: page === currentPage ? 600 : 400,
                        minWidth: '2rem',
                        transition: 'background 0.15s',
                    }}
                >
                    {page}
                </button>
            ))}

            {/* Botón Siguiente */}
            <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #e2e8f0',
                    background: currentPage === totalPages ? '#f1f5f9' : '#ffffff',
                    color: currentPage === totalPages ? '#94a3b8' : '#1e293b',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                }}
            >
                Siguiente
                <ChevronRight style={{ width: '0.875rem', height: '0.875rem' }} />
            </button>

            {/* Botón Ir al final (última página) */}
            <button
                onClick={() => goToPage(totalPages)}
                disabled={currentPage === totalPages}
                title="Ir al final"
                style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #e2e8f0',
                    background: currentPage === totalPages ? '#f1f5f9' : '#ffffff',
                    color: currentPage === totalPages ? '#94a3b8' : '#1e293b',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem',
                }}
            >
                &gt;&gt;
            </button>

            {/* Input para ir a página específica */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Ir a</span>
                <input
                    type="number"
                    min={1}
                    max={totalPages}
                    defaultValue={currentPage}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            const val = parseInt((e.target as HTMLInputElement).value);
                            if (!isNaN(val) && val >= 1 && val <= totalPages) {
                                goToPage(val);
                            }
                        }
                    }}
                    style={{
                        width: '3rem',
                        padding: '0.15rem 0.25rem',
                        borderRadius: '0.375rem',
                        border: '1px solid #e2e8f0',
                        fontSize: '0.75rem',
                        textAlign: 'center',
                        background: '#ffffff',
                    }}
                />
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>de {totalPages}</span>
            </div>
        </div>
    );
}
