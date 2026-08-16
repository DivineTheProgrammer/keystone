'use client'

import { useState } from 'react'
import { startRegistration, startAuthentication } from '@simplewebauthn/browser'

export default function WebAuthnTest() {
  const [userId, setUserId] = useState('f6a759df-3159-4615-b298-0c2216a00b0e')
  const [email, setEmail] = useState('testuser2@example.com')
  const [log, setLog] = useState<string[]>([])

  const addLog = function (msg: string) {
    setLog(function (prev) { return prev.concat([msg]) })
  }

  const handleRegister = async () => {
    addLog('Requesting registration options')
    try {
      const optionsRes = await fetch('/api/webauthn/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId, email: email }),
      })
      const options = await optionsRes.json()
      addLog('Options received, prompting device authenticator')

      const registrationResponse = await startRegistration({ optionsJSON: options })
      addLog('Device signed the challenge, verifying with server')

      const verifyRes = await fetch('/api/webauthn/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId, response: registrationResponse, deviceName: 'Test device' }),
      })
      const verifyData = await verifyRes.json()
      addLog('Server response: ' + JSON.stringify(verifyData))
    } catch (err: any) {
      addLog('Error: ' + (err.message || String(err)))
    }
  }

  const handleLogin = async () => {
    addLog('Requesting login options')
    try {
      const optionsRes = await fetch('/api/webauthn/login-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email }),
      })
      const optionsData = await optionsRes.json()

      if (optionsData.error) {
        addLog('Error: ' + optionsData.error)
        return
      }

      addLog('Options received, prompting device authenticator')

      const authResponse = await startAuthentication({ optionsJSON: optionsData.options })
      addLog('Device signed the challenge, verifying with server')

      const verifyRes = await fetch('/api/webauthn/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: optionsData.userId, response: authResponse }),
      })
      const verifyData = await verifyRes.json()
      addLog('Server response: ' + JSON.stringify(verifyData))
    } catch (err: any) {
      addLog('Error: ' + (err.message || String(err)))
    }
  }

  const pageStyle = { minHeight: '100vh', background: 'var(--bg)', padding: '3rem 1.5rem' }
  const containerStyle = { maxWidth: '600px', margin: '0 auto' }
  const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem' }
  const labelStyle = { display: 'block', marginBottom: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }
  const inputStyle = { width: '100%', padding: '0.6rem 0.75rem', color: 'var(--text-primary)', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.9rem', fontFamily: 'var(--mono)' }
  const buttonStyle = { padding: '0.65rem 1.1rem', backgroundColor: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }
  const secondaryButtonStyle = { ...buttonStyle, backgroundColor: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)' }

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <h1>WebAuthn Test</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.4rem', fontSize: '0.85rem' }}>Passwordless registration and login, verified against a real device authenticator.</p>

        <div style={{ ...cardStyle, marginTop: '1.5rem' }}>
          <div>
            <label style={labelStyle}>User ID</label>
            <input value={userId} onChange={function (e) { setUserId(e.target.value) }} style={inputStyle} />
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label style={labelStyle}>Email</label>
            <input value={email} onChange={function (e) { setEmail(e.target.value) }} style={inputStyle} />
          </div>

          <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
            <button onClick={handleRegister} style={buttonStyle}>Register Passkey</button>
            <button onClick={handleLogin} style={secondaryButtonStyle}>Login with Passkey</button>
          </div>
        </div>

        <div style={{ ...cardStyle, marginTop: '1.25rem' }}>
          <h3>Event Log</h3>
          <div style={{ marginTop: '0.75rem' }}>
            {log.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nothing yet</p>
            ) : (
              log.map(function (entry, i) {
                return (
                  <div key={i} style={{ fontFamily: 'var(--mono)', fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '0.4rem 0', borderBottom: i === log.length - 1 ? 'none' : '1px solid var(--border)' }}>
                    {entry}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
