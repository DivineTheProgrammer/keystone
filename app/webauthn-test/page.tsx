'use client'

import { useState } from 'react'
import { startRegistration, startAuthentication } from '@simplewebauthn/browser'

export default function WebAuthnTest() {
  const [userId, setUserId] = useState('f6a759df-3159-4615-b298-0c2216a00b0e')
  const [email, setEmail] = useState('testuser2@example.com')
  const [log, setLog] = useState('')

  const addLog = function (msg: string) {
    setLog(function (prev) { return prev + msg + '\n\n' })
  }

  const handleRegister = async () => {
    addLog('Requesting registration options...')
    try {
      const optionsRes = await fetch('/api/webauthn/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId, email: email }),
      })
      const options = await optionsRes.json()
      addLog('Got options, prompting browser authenticator...')

      const registrationResponse = await startRegistration({ optionsJSON: options })
      addLog('Browser signed the challenge, verifying with server...')

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
    addLog('Requesting login options...')
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

      addLog('Got options, prompting browser authenticator...')

      const authResponse = await startAuthentication({ optionsJSON: optionsData.options })
      addLog('Browser signed the challenge, verifying with server...')

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

  const inputStyle = { width: '100%', padding: '0.5rem', marginTop: '0.25rem', color: 'black', backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '4px' }
  const buttonStyle = { padding: '0.6rem 1.2rem', backgroundColor: 'white', color: 'black', border: '1px solid #333', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }

  return (
    <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif', color: 'white', backgroundColor: '#0a0a0a', minHeight: '100vh' }}>
      <h1>WebAuthn Test</h1>

      <div style={{ marginTop: '1rem' }}>
        <label>User ID</label>
        <input value={userId} onChange={function (e) { setUserId(e.target.value) }} style={inputStyle} />
      </div>

      <div style={{ marginTop: '1rem' }}>
        <label>Email</label>
        <input value={email} onChange={function (e) { setEmail(e.target.value) }} style={inputStyle} />
      </div>

      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
        <button onClick={handleRegister} style={buttonStyle}>Register Passkey</button>
        <button onClick={handleLogin} style={buttonStyle}>Login with Passkey</button>
      </div>

      <pre style={{ marginTop: '1.5rem', background: '#1a1a1a', color: '#ddd', padding: '1rem', whiteSpace: 'pre-wrap', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid #333' }}>{log}</pre>
    </main>
  )
}
