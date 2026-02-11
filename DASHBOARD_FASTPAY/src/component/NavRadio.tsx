import React from 'react'
import styled from 'styled-components'
import { SIDEBAR_TABS, isTabAllowedForAccess } from '@/lib/sidebar-tabs'

interface NavRadioProps {
  activeTab?: string
  onTabChange?: (tab: string) => void
  userAccessLevel?: number
}

export const NavRadio: React.FC<NavRadioProps> = ({
  activeTab,
  onTabChange,
  userAccessLevel,
}) => {
  const allowedTabs = SIDEBAR_TABS.filter(tab =>
    isTabAllowedForAccess(tab.key, userAccessLevel)
  )

  return (
    <StyledWrapper className="nav-tab-track">
      <div className="radio-input">
        {allowedTabs.map((tab, index) => {
          const Icon = tab.icon
          const isFirst = index === 0
          const isLast = index === allowedTabs.length - 1
          const isActive = activeTab === tab.key

          return (
            <label
              key={tab.key}
              htmlFor={`nav-${tab.key}`}
              className={`
                ${isFirst ? 'first' : ''} 
                ${isLast ? 'last' : ''}
                ${isActive ? 'active' : ''}
              `}
              data-tab={tab.key}
            >
              <Icon className="nav-icon" />
              <span className="nav-label">{tab.label}</span>
              <input
                type="radio"
                id={`nav-${tab.key}`}
                name="nav-radio"
                value={tab.key}
                checked={isActive}
                onChange={() => onTabChange?.(tab.key)}
              />
            </label>
          )
        })}
      </div>
    </StyledWrapper>
  )
}

const StyledWrapper = styled.div`
  .radio-input {
    display: flex;
    gap: 8px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.12);
  }

  .radio-input input {
    opacity: 0;
    position: absolute;
    pointer-events: none;
  }

  .radio-input label {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    cursor: pointer;
    background: linear-gradient(to bottom, #3b4252, #2e3440);
    transition: all 0.3s ease;
    font-weight: 600;
    font-size: 13px;
    color: #d8dee9;
    border-right: 1px solid rgba(0, 0, 0, 0.2);
  }

  .radio-input label:last-child {
    border-right: none;
  }

  .radio-input label .nav-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    transition: transform 0.2s ease, color 0.2s ease;
  }

  .radio-input label.active .nav-icon,
  .radio-input label:has(input:checked) .nav-icon {
    transform: scale(1.2);
    color: currentColor;
  }

  .radio-input label .nav-label {
    white-space: nowrap;
  }

  /* First tab (Dashboard) - Blue theme */
  .radio-input label[data-tab="overview"].active,
  .radio-input label[data-tab="overview"]:has(input:checked) {
    box-shadow:
      0 0 5px rgb(26, 123, 208) inset,
      0 4px 12px rgba(0, 47, 255, 0.3),
      0 0 12px rgba(1, 14, 89, 0.3) inset;
    background: linear-gradient(150deg, #4c566a, #5e81ac);
    color: #eceff4;
  }

  .radio-input label[data-tab="overview"]:hover {
    box-shadow:
      0 0 6px rgba(26, 123, 208, 0.6) inset,
      0 4px 14px rgba(0, 47, 255, 0.4);
    background: linear-gradient(150deg, #4c566a, #5e81ac);
  }

  /* Device tab - Green theme */
  .radio-input label[data-tab="devices"].active,
  .radio-input label[data-tab="devices"]:has(input:checked) {
    box-shadow:
      0 0 5px #2ecc71 inset,
      0 4px 12px rgba(46, 204, 113, 0.3),
      0 0 12px rgba(22, 128, 76, 0.3) inset;
    background: linear-gradient(150deg, #4c566a, #a3be8c);
    color: #eceff4;
  }

  .radio-input label[data-tab="devices"]:hover {
    box-shadow:
      0 0 6px rgba(46, 204, 113, 0.6) inset,
      0 4px 14px rgba(39, 174, 96, 0.4);
  }

  /* Bank Cards tab - Gold/Orange theme */
  .radio-input label[data-tab="bank-cards"].active,
  .radio-input label[data-tab="bank-cards"]:has(input:checked) {
    box-shadow:
      0 0 5px #f0a500 inset,
      0 4px 12px rgba(240, 165, 0, 0.3),
      0 0 12px rgba(180, 120, 0, 0.3) inset;
    background: linear-gradient(150deg, #4c566a, #d08770);
    color: #eceff4;
  }

  .radio-input label[data-tab="bank-cards"]:hover {
    box-shadow:
      0 0 6px rgba(240, 165, 0, 0.6) inset,
      0 4px 14px rgba(208, 135, 112, 0.4);
  }

  /* Telegram tab - Telegram blue theme */
  .radio-input label[data-tab="telegram-bots"].active,
  .radio-input label[data-tab="telegram-bots"]:has(input:checked) {
    box-shadow:
      0 0 5px #0088cc inset,
      0 4px 12px rgba(0, 136, 204, 0.3),
      0 0 12px rgba(0, 100, 150, 0.3) inset;
    background: linear-gradient(150deg, #4c566a, #88c0d0);
    color: #eceff4;
  }

  .radio-input label[data-tab="telegram-bots"]:hover {
    box-shadow:
      0 0 6px rgba(0, 136, 204, 0.6) inset,
      0 4px 14px rgba(136, 192, 208, 0.4);
  }

  /* Utilities tab - Purple theme */
  .radio-input label[data-tab="utilities"].active,
  .radio-input label[data-tab="utilities"]:has(input:checked) {
    box-shadow:
      0 0 5px #9b59b6 inset,
      0 4px 12px rgba(155, 89, 182, 0.3),
      0 0 12px rgba(105, 39, 105, 0.3) inset;
    background: linear-gradient(150deg, #4c566a, #b48ead);
    color: #eceff4;
  }

  .radio-input label[data-tab="utilities"]:hover {
    box-shadow:
      0 0 6px rgba(155, 89, 182, 0.6) inset,
      0 4px 14px rgba(142, 68, 173, 0.4);
  }

  /* Failures tab - Red theme */
  .radio-input label[data-tab="activation-failures"].active,
  .radio-input label[data-tab="activation-failures"]:has(input:checked) {
    box-shadow:
      0 0 5px #bf616a inset,
      0 4px 12px rgba(191, 97, 106, 0.3),
      0 0 12px rgba(150, 60, 70, 0.3) inset;
    background: linear-gradient(150deg, #4c566a, #bf616a);
    color: #eceff4;
  }

  .radio-input label[data-tab="activation-failures"]:hover {
    box-shadow:
      0 0 6px rgba(191, 97, 106, 0.6) inset,
      0 4px 14px rgba(191, 97, 106, 0.4);
  }

  /* Activity tab - Cyan theme */
  .radio-input label[data-tab="activity-logs"].active,
  .radio-input label[data-tab="activity-logs"]:has(input:checked) {
    box-shadow:
      0 0 5px #81a1c1 inset,
      0 4px 12px rgba(129, 161, 193, 0.3),
      0 0 12px rgba(80, 120, 160, 0.3) inset;
    background: linear-gradient(150deg, #4c566a, #81a1c1);
    color: #eceff4;
  }

  .radio-input label[data-tab="activity-logs"]:hover {
    box-shadow:
      0 0 6px rgba(129, 161, 193, 0.6) inset,
      0 4px 14px rgba(129, 161, 193, 0.4);
  }

  /* API tab - Dark blue theme */
  .radio-input label[data-tab="api"].active,
  .radio-input label[data-tab="api"]:has(input:checked) {
    box-shadow:
      0 0 5px #5e81ac inset,
      0 4px 12px rgba(94, 129, 172, 0.3),
      0 0 12px rgba(60, 90, 130, 0.3) inset;
    background: linear-gradient(150deg, #4c566a, #5e81ac);
    color: #eceff4;
  }

  .radio-input label[data-tab="api"]:hover {
    box-shadow:
      0 0 6px rgba(94, 129, 172, 0.6) inset,
      0 4px 14px rgba(94, 129, 172, 0.4);
  }

  /* Default hover state for all tabs */
  .radio-input label:hover {
    background: linear-gradient(to bottom, #434c5e, #3b4252);
    color: #eceff4;
  }

  /* Border radius for first and last */
  .radio-input label.first {
    border-radius: 16px 0 0 16px;
  }

  .radio-input label.last {
    border-radius: 0 16px 16px 0;
  }

  /* Responsive: hide labels on smaller screens */
  @media (max-width: 1200px) {
    .radio-input label .nav-label {
      display: none;
    }
    
    .radio-input label {
      padding: 10px 12px;
    }
  }

  @media (max-width: 768px) {
    .radio-input {
      border-radius: 12px;
    }
    
    .radio-input label {
      padding: 8px 10px;
    }
    
    .radio-input label .nav-icon {
      width: 14px;
      height: 14px;
    }
    
    .radio-input label.first {
      border-radius: 12px 0 0 12px;
    }

    .radio-input label.last {
      border-radius: 0 12px 12px 0;
    }
  }
`

export default NavRadio
