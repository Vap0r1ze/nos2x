import browser from 'webextension-polyfill'
import React, {useState, useCallback, useEffect} from 'react'
import {render} from 'react-dom'
import {generateSecretKey, nip19} from 'nostr-tools'
import {decrypt, encrypt} from 'nostr-tools/nip49'
import QRCode from 'react-qr-code'
import {hexToBytes, bytesToHex} from '@noble/hashes/utils'

import {removePermissions} from './common'

function Options() {
  let [privKey, setPrivKey] = useState('')
  let [password, setPassword] = useState('')
  let [passwordDecrypt, setPasswordDecrypt] = useState('')
  let [confirmPassword, setConfirmPassword] = useState('')
  let [passwordMatch, setPasswordMatch] = useState(true)
  let [errorMessage, setErrorMessage] = useState('')
  let [successMessage, setSuccessMessage] = useState('')
  let [logNOption, setLogNOption] = useState('')
  let [securityByteOption, setSecurityByteOption] = useState('')
  let [relays, setRelays] = useState([])
  let [newRelayURL, setNewRelayURL] = useState('')
  let [policies, setPermissions] = useState([])
  let [protocolHandler, setProtocolHandler] = useState('https://njump.me/{raw}')
  let [hidingPrivateKey, hidePrivateKey] = useState(true)
  let [showNotifications, setNotifications] = useState(false)
  let [messages, setMessages] = useState([])
  let [handleNostrLinks, setHandleNostrLinks] = useState(false)
  let [showProtocolHandlerHelp, setShowProtocolHandlerHelp] = useState(false)
  let [unsavedChanges, setUnsavedChanges] = useState([])

  const showMessage = useCallback(msg => {
    messages.push(msg)
    setMessages(messages)
    setTimeout(() => setMessages([]), 3000)
  })

  useEffect(() => {
    setLogNOption('1')
    setSecurityByteOption('0x00')

    browser.storage.local
      .get(['private_key', 'relays', 'protocol_handler', 'notifications'])
      .then(results => {
        if (results.private_key) {
          let prvKey = results.private_key
          setPrivKey(
            prvKey.startsWith('ncryptsec')
              ? results.private_key
              : nip19.nsecEncode(hexToBytes(prvKey))
          )
        }
        if (results.relays) {
          let relaysList = []
          for (let url in results.relays) {
            relaysList.push({
              url,
              policy: results.relays[url]
            })
          }
          setRelays(relaysList)
        }
        if (results.protocol_handler) {
          setProtocolHandler(results.protocol_handler)
          setHandleNostrLinks(true)
          setShowProtocolHandlerHelp(false)
        }
        if (results.notifications) {
          setNotifications(true)
        }
      })
  }, [])

  useEffect(() => {
    loadPermissions()
  }, [])

  async function loadPermissions() {
    let {policies = {}} = await browser.storage.local.get('policies')
    let list = []

    Object.entries(policies).forEach(([host, accepts]) => {
      Object.entries(accepts).forEach(([accept, types]) => {
        Object.entries(types).forEach(([type, {conditions, created_at}]) => {
          list.push({
            host,
            type,
            accept,
            conditions,
            created_at
          })
        })
      })
    })

    setPermissions(list)
  }

  // Generate LOG_N options from 1 to 16
  const logN_options = []
  for (let i = 1; i <= 16; i++) {
    logN_options.push(
      <option key={i} value={i}>
        {i}
      </option>
    )
  }

  // Generate KEY_SECURITY_BYTE options from 0x00 to 0x02
  const securityByte_options = []
  for (let i = 0; i <= 2; i++) {
    securityByte_options.push(
      <option key={i} value={'0x0' + i}>
        0x0{i}
      </option>
    )
  }

  return (
    <>
      <h1 style={{fontSize: '25px', marginBlockEnd: '0px'}}>nos2x</h1>
      <p style={{marginBlockStart: '0px'}}>nostr signer extension</p>
      <h2 style={{marginBlockStart: '20px', marginBlockEnd: '5px'}}>options</h2>
      <div
        style={{
          marginBottom: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          width: 'fit-content'
        }}
      >
        <div>
          <div>private key:&nbsp;</div>
          <div
            style={{
              marginLeft: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{display: 'flex', gap: '10px'}}>
              <input
                type={hidingPrivateKey ? 'password' : 'text'}
                style={{width: '600px'}}
                value={privKey}
                onChange={handleKeyChange}
              />
              {privKey === '' && <button onClick={generate}>generate</button>}
              {privKey && hidingPrivateKey && (
                <button onClick={() => hidePrivateKey(false)}>show key</button>
              )}
              {privKey && !hidingPrivateKey && (
                <button onClick={() => hidePrivateKey(true)}>hide key</button>
              )}
            </div>
            {privKey && !isKeyValid() && (
              <div style={{color: 'red'}}>private key is invalid!</div>
            )}
            {!hidingPrivateKey && isKeyValid() && (
              <div
                style={{
                  height: 'auto',
                  maxWidth: 256,
                  width: '100%',
                  marginTop: '5px'
                }}
              >
                <QRCode
                  size={256}
                  style={{height: 'auto', maxWidth: '100%', width: '100%'}}
                  value={privKey.toUpperCase()}
                  viewBox={`0 0 256 256`}
                />
              </div>
            )}
          </div>
        </div>
        <div>
          <div>password:&nbsp;</div>
          <div
            style={{
              marginLeft: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{display: 'flex', gap: '10px'}}>
              {!privKey.startsWith('ncryptsec') ? (
                <>
                  <input
                    type="password"
                    value={password}
                    onChange={handlePasswordChange}
                    style={{width: '150px'}}
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={handleConfirmPasswordChange}
                    style={{width: '150px'}}
                  />
                  <select onChange={handleLogNChange} style={{width: '100px'}}>
                    {logN_options}
                  </select>
                  <select
                    onChange={handleSecurityBytesChange}
                    style={{width: '100px'}}
                  >
                    {securityByte_options}
                  </select>
                  <button
                    onClick={encryptPrivateKey}
                    disabled={!password || !confirmPassword || !passwordMatch}
                  >
                    encrypt key
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="password"
                    value={passwordDecrypt}
                    onChange={handlePasswordDecryptChange}
                    style={{width: '600px'}}
                  />
                  <button onClick={decryptPrivateKey}>decrypt key</button>
                </>
              )}
            </div>

            {!passwordMatch && (
              <div style={{color: 'red'}}>passwords do not match!</div>
            )}
            {successMessage && (
              <div style={{color: 'green'}}>{successMessage}</div>
            )}
            {errorMessage && <div style={{color: 'red'}}>{errorMessage}</div>}
          </div>
        </div>
        <div>
          <div>preferred relays:</div>
          <div
            style={{
              marginLeft: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1px'
            }}
          >
            {relays.map(({url, policy}, i) => (
              <div
                key={i}
                style={{display: 'flex', alignItems: 'center', gap: '15px'}}
              >
                <input
                  style={{width: '400px'}}
                  value={url}
                  onChange={changeRelayURL.bind(null, i)}
                />
                <div style={{display: 'flex', gap: '5px'}}>
                  <label style={{display: 'flex', alignItems: 'center'}}>
                    read
                    <input
                      type="checkbox"
                      checked={policy.read}
                      onChange={toggleRelayPolicy.bind(null, i, 'read')}
                    />
                  </label>
                  <label style={{display: 'flex', alignItems: 'center'}}>
                    write
                    <input
                      type="checkbox"
                      checked={policy.write}
                      onChange={toggleRelayPolicy.bind(null, i, 'write')}
                    />
                  </label>
                </div>
                <button onClick={removeRelay.bind(null, i)}>remove</button>
              </div>
            ))}
            <div style={{display: 'flex', gap: '10px', marginTop: '5px'}}>
              <input
                style={{width: '400px'}}
                value={newRelayURL}
                onChange={e => setNewRelayURL(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') addNewRelay()
                }}
              />
              <button disabled={!newRelayURL} onClick={addNewRelay}>
                add relay
              </button>
            </div>
          </div>
        </div>
        <div>
          <label style={{display: 'flex', alignItems: 'center'}}>
            <div>
              handle{' '}
              <span style={{padding: '2px', background: 'silver'}}>nostr:</span>{' '}
              links:
            </div>
            <input
              type="checkbox"
              checked={handleNostrLinks}
              onChange={changeHandleNostrLinks}
            />
          </label>
          <div style={{marginLeft: '10px'}}>
            {handleNostrLinks && (
              <div>
                <div style={{display: 'flex'}}>
                  <input
                    placeholder="url template"
                    value={protocolHandler}
                    onChange={handleChangeProtocolHandler}
                    style={{width: '680px', maxWidth: '90%'}}
                  />
                  {!showProtocolHandlerHelp && (
                    <button onClick={changeShowProtocolHandlerHelp}>?</button>
                  )}
                </div>
                {showProtocolHandlerHelp && (
                  <pre>{`
    {raw} = anything after the colon, i.e. the full nip19 bech32 string
    {hex} = hex pubkey for npub or nprofile, hex event id for note or nevent
    {p_or_e} = "p" for npub or nprofile, "e" for note or nevent
    {u_or_n} = "u" for npub or nprofile, "n" for note or nevent
    {relay0} = first relay in a nprofile or nevent
    {relay1} = second relay in a nprofile or nevent
    {relay2} = third relay in a nprofile or nevent
    {hrp} = human-readable prefix of the nip19 string

    examples:
      - https://njump.me/{raw}
      - https://snort.social/{raw}
      - https://nostr.band/{raw}
                `}</pre>
                )}
              </div>
            )}
          </div>
        </div>
        <label style={{display: 'flex', alignItems: 'center'}}>
          show notifications when permissions are used:
          <input
            type="checkbox"
            checked={showNotifications}
            onChange={handleNotifications}
          />
        </label>
        <button
          disabled={!unsavedChanges.length}
          onClick={saveChanges}
          style={{padding: '5px 20px'}}
        >
          save
        </button>
        <div style={{fontSize: '120%'}}>
          {messages.map((message, i) => (
            <div key={i}>{message}</div>
          ))}
        </div>
      </div>
      <div>
        <h2>permissions</h2>
        {!!policies.length && (
          <table>
            <thead>
              <tr>
                <th>domain</th>
                <th>permission</th>
                <th>answer</th>
                <th>conditions</th>
                <th>since</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {policies.map(({host, type, accept, conditions, created_at}) => (
                <tr key={host + type + accept + JSON.stringify(conditions)}>
                  <td>{host}</td>
                  <td>{type}</td>
                  <td>{accept === 'true' ? 'allow' : 'deny'}</td>
                  <td>
                    {conditions.kinds
                      ? `kinds: ${Object.keys(conditions.kinds).join(', ')}`
                      : 'always'}
                  </td>
                  <td>
                    {new Date(created_at * 1000)
                      .toISOString()
                      .split('.')[0]
                      .split('T')
                      .join(' ')}
                  </td>
                  <td>
                    <button
                      onClick={handleRevoke}
                      data-host={host}
                      data-accept={accept}
                      data-type={type}
                    >
                      revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!policies.length && (
          <div style={{marginTop: '5px'}}>
            no permissions have been granted yet
          </div>
        )}
      </div>
    </>
  )

  async function handleKeyChange(e) {
    let key = e.target.value.toLowerCase().trim()
    setPrivKey(key)
    addUnsavedChanges('private_key')
  }

  async function generate() {
    setPrivKey(nip19.nsecEncode(generateSecretKey()))
    addUnsavedChanges('private_key')
  }

  async function encryptPrivateKey() {
    try {
      let {type, data} = nip19.decode(privKey)
      let encrypted = encrypt(data, password, logNOption, securityByteOption)
      setPrivKey(encrypted)
      await browser.storage.local.set({
        private_key: encrypted
      })

      setSuccessMessage('encryption successful!')
      setTimeout(() => {
        setSuccessMessage('')
      }, 3000)
      setErrorMessage('')
    } catch (e) {
      setErrorMessage('something is going wrong. please try again.')
      setTimeout(() => {
        setErrorMessage('')
      }, 3000)
      setSuccessMessage('')
    }
  }

  async function decryptPrivateKey() {
    try {
      let decrypted = decrypt(privKey, passwordDecrypt)
      setPrivKey(nip19.nsecEncode(decrypted))
      await browser.storage.local.set({
        private_key: bytesToHex(decrypted)
      })
      setSuccessMessage('decryption successful!')
      setTimeout(() => {
        setSuccessMessage('')
      }, 3000)
      setErrorMessage('')
    } catch (e) {
      setErrorMessage('incorrect password. please try again.')
      setTimeout(() => {
        setErrorMessage('')
      }, 3000)
      setSuccessMessage('')
    }
  }

  async function handleLogNChange(event) {
    setLogNOption(event.target.value)
  }

  async function handleSecurityBytesChange(event) {
    setSecurityByteOption(event.target.value)
  }

  async function handlePasswordChange(event) {
    const newPassword = event.target.value
    setPassword(newPassword)
    // Check if the confirm password matches the new password
    setPasswordMatch(newPassword === confirmPassword)
  }

  async function handlePasswordDecryptChange(event) {
    setPasswordDecrypt(event.target.value)
  }

  async function handleConfirmPasswordChange(event) {
    const newConfirmPassword = event.target.value
    setConfirmPassword(newConfirmPassword)
    // Check if the confirm password matches the password
    setPasswordMatch(password === newConfirmPassword)
  }

  async function saveKey() {
    if (!isKeyValid()) {
      showMessage('PRIVATE KEY IS INVALID! did not save private key.')
      return
    }
    let hexOrEmptyKey = privKey
    try {
      let {type, data} = nip19.decode(privKey)
      if (type === 'nsec') hexOrEmptyKey = bytesToHex(data)
    } catch (_) {}
    await browser.storage.local.set({
      private_key: hexOrEmptyKey
    })
    if (hexOrEmptyKey !== '') {
      setPrivKey(nip19.nsecEncode(hexToBytes(hexOrEmptyKey)))
    }
    showMessage('saved private key!')
  }

  function isKeyValid() {
    if (privKey === '') return true
    if (privKey.startsWith('ncryptsec')) return true
    if (privKey.match(/^[a-f0-9]{64}$/)) return true
    try {
      if (nip19.decode(privKey).type === 'nsec') return true
    } catch (_) {}
    return false
  }

  function changeRelayURL(i, ev) {
    setRelays([
      ...relays.slice(0, i),
      {url: ev.target.value, policy: relays[i].policy},
      ...relays.slice(i + 1)
    ])
    addUnsavedChanges('relays')
  }

  function toggleRelayPolicy(i, cat) {
    setRelays([
      ...relays.slice(0, i),
      {
        url: relays[i].url,
        policy: {...relays[i].policy, [cat]: !relays[i].policy[cat]}
      },
      ...relays.slice(i + 1)
    ])
    addUnsavedChanges('relays')
  }

  function removeRelay(i) {
    setRelays([...relays.slice(0, i), ...relays.slice(i + 1)])
    addUnsavedChanges('relays')
  }

  function addNewRelay() {
    if (newRelayURL.trim() === '') return
    relays.push({
      url: newRelayURL,
      policy: {read: true, write: true}
    })
    setRelays(relays)
    addUnsavedChanges('relays')
    setNewRelayURL('')
  }

  async function handleRevoke(e) {
    let {host, accept, type} = e.target.dataset
    if (
      window.confirm(
        `revoke all ${
          accept === 'true' ? 'accept' : 'deny'
        } ${type} policies from ${host}?`
      )
    ) {
      await removePermissions(host, accept, type)
      showMessage('removed policies')
      loadPermissions()
    }
  }

  function handleNotifications() {
    setNotifications(!showNotifications)
    addUnsavedChanges('notifications')
    if (!showNotifications) requestBrowserNotificationPermissions()
  }

  async function requestBrowserNotificationPermissions() {
    let granted = await browser.permissions.request({
      permissions: ['notifications']
    })
    if (!granted) setNotifications(false)
  }

  async function saveNotifications() {
    await browser.storage.local.set({notifications: showNotifications})
    showMessage('saved notifications!')
  }

  async function saveRelays() {
    await browser.storage.local.set({
      relays: Object.fromEntries(
        relays
          .filter(({url}) => url.trim() !== '')
          .map(({url, policy}) => [url.trim(), policy])
      )
    })
    showMessage('saved relays!')
  }

  function changeShowProtocolHandlerHelp() {
    setShowProtocolHandlerHelp(true)
  }

  function changeHandleNostrLinks() {
    if (handleNostrLinks) {
      setProtocolHandler('')
      addUnsavedChanges('protocol_handler')
    } else setShowProtocolHandlerHelp(true)
    setHandleNostrLinks(!handleNostrLinks)
  }

  function handleChangeProtocolHandler(e) {
    setProtocolHandler(e.target.value)
    addUnsavedChanges('protocol_handler')
  }

  async function saveNostrProtocolHandlerSettings() {
    await browser.storage.local.set({protocol_handler: protocolHandler})
    showMessage('saved protocol handler!')
  }

  function addUnsavedChanges(section) {
    if (!unsavedChanges.find(s => s === section)) {
      unsavedChanges.push(section)
      setUnsavedChanges(unsavedChanges)
    }
  }

  async function saveChanges() {
    for (let section of unsavedChanges) {
      switch (section) {
        case 'private_key':
          await saveKey()
          break
        case 'relays':
          await saveRelays()
          break
        case 'protocol_handler':
          await saveNostrProtocolHandlerSettings()
          break
        case 'notifications':
          await saveNotifications()
          break
      }
    }
    setUnsavedChanges([])
  }
}

render(<Options />, document.getElementById('main'))
