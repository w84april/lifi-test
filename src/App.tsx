import { useState } from 'react'
import './App.css'
import YearnDepositForm from './components/YearnDepositForm'
import StakingDepositForm from './components/StakingDepositForm'
import YearnWithdrawForm from './components/YearnWithdrawForm'
import { ConnectButton } from '@rainbow-me/rainbowkit'

function App() {
  const [activeForm, setActiveForm] = useState<'yearn' | 'staking' | 'withdraw'>('yearn')

  return (
    <div className="app-container">
      <div className="header">
        <h1>LiFi Zap Interface</h1>
        <ConnectButton />
      </div>
      
      <div className="form-selector">
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
        <button 
          className={`tab-button ${activeForm === 'withdraw' ? 'active' : ''}`}
          onClick={() => setActiveForm('withdraw')}
        >
          Withdraw
        </button>
      </div>
      
      <div className="form-content">
        {activeForm === 'yearn' && <YearnDepositForm />}
        {activeForm === 'staking' && <StakingDepositForm />}
        {activeForm === 'withdraw' && <YearnWithdrawForm />}
      </div>
    </div>
  )
}

export default App
