export default function Home() {
  const pageStyle = { minHeight: '100vh', background: 'var(--bg)', padding: '4rem 1.5rem' }
  const containerStyle = { maxWidth: '640px', margin: '0 auto' }
  const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem', marginTop: '1rem' }
  const linkRowStyle = { display: 'flex', gap: '1rem', marginTop: '2rem', flexWrap: 'wrap' as const }
  const linkStyle = { padding: '0.6rem 1.1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }
  const badgeStyle = { display: 'inline-block', padding: '0.25rem 0.6rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--allowed)', fontFamily: 'var(--mono)', marginBottom: '1rem' }

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <span style={badgeStyle}>service status: operational</span>
        <h1>Keystone</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem', lineHeight: 1.6, fontSize: '0.95rem' }}>
          A multi tenant authentication and authorization service. Built to be infrastructure
          a separate application can depend on, with real tenant isolation, permission checks
          run fresh against the database on every request, and passwordless login through
          WebAuthn passkeys.
        </p>

        <div style={cardStyle}>
          <h3>What's actually working</h3>
          <ul style={{ marginTop: '0.75rem', paddingLeft: '1.2rem', color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.8 }}>
            <li>Email and password signup and login, with every attempt logged</li>
            <li>Passwordless login using device backed passkeys, verified cryptographically</li>
            <li>Rate limiting on login, tested against a real six attempt brute force simulation</li>
            <li>Permission checks scoped per tenant, checked fresh on every request</li>
            <li>A separate demo application authenticating entirely through this service</li>
          </ul>
        </div>

        <div style={linkRowStyle}>
          <a href="/webauthn-test" style={linkStyle}>Try WebAuthn</a>
          <a href="https://github.com/DivineTheProgrammer/keystone" style={linkStyle}>View source</a>
          <a href="https://github.com/DivineTheProgrammer/keystone/blob/main/THREAT_MODEL.md" style={linkStyle}>Threat model</a>
        </div>
      </div>
    </div>
  )
}
