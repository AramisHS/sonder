export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer style={{
      padding: '0.75rem 1.5rem',
      textAlign: 'center',
      fontSize: '0.75rem',
      color: '#94a3b8',
      borderTop: '1px solid #e2e8f0',
      background: '#ffffff',
    }}>
      &copy; {year} sonder — Todo tu negocio en movimiento
    </footer>
  );
}