export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        padding: '1rem 1.5rem',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem 1rem',
        borderTop: '1px solid var(--color-card-border)',
        backgroundColor: 'var(--color-card-bg)',
        flexShrink: 0,
        transition: 'background-color 0.25s ease, border-color 0.25s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)' }}>
          &copy; {year} sonder
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-gray-300)' }}>•</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)' }}>
          Todos los derechos reservados
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)' }}>Sígueme:</span>
        <a
          href="https://www.instagram.com/_jossrz/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'var(--color-primary)',
            textDecoration: 'none',
            fontSize: '0.75rem',
            fontWeight: 500,
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-warning)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-primary)')}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
          </svg>
          @_jossrz
        </a>
      </div>
    </footer>
  );
}