import { useState } from 'react'
import './App.css'
import YearnDepositForm from './components/YearnDepositForm'
import StakingDepositForm from './components/StakingDepositForm'
import TestBridgeForm from './components/TestBridgeForm'
import { ConnectButton } from '@rainbow-me/rainbowkit'

function App() {
  const [activeForm, setActiveForm] = useState<'test' | 'yearn' | 'staking'>('test')

  return (
    <div className="app-container">
      <div className="header">
        <h1>LiFi Zap Interface</h1>
        <ConnectButton />
      </div>
      
      <div className="form-selector">
        <button 
          className={`tab-button ${activeForm === 'test' ? 'active' : ''}`}
          onClick={() => setActiveForm('test')}
        >
          Test Bridge
        </button>
        <button 
          className={`tab-button ${activeForm === 'yearn' ? 'active' : ''}`}
          onClick={() => setActiveForm('yearn')}
        >
          Yearn Deposit
        </button>
        <button 
          className={`tab-button ${activeForm === 'staking' ? 'active' : ''}`}
          onClick={() => setActiveForm('staking')}
        >
          Staking Deposit
        </button>
      </div>
      
      <div className="form-content">
        {activeForm === 'test' && <TestBridgeForm />}
        {activeForm === 'yearn' && <YearnDepositForm />}
        {activeForm === 'staking' && <StakingDepositForm />}
      </div>
    </div>
  )
}

export default App
