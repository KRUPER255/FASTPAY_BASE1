/**
 * Tests for Input component
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from './input'

describe('Input', () => {
  it('should render input element', () => {
    render(<Input />)
    const input = screen.getByRole('textbox')
    expect(input).toBeInTheDocument()
  })

  it('should render with placeholder', () => {
    render(<Input placeholder="Enter text" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
  })

  it('should handle value changes', async () => {
    const user = userEvent.setup()
    render(<Input />)
    
    const input = screen.getByRole('textbox') as HTMLInputElement
    await user.type(input, 'test value')
    
    expect(input.value).toBe('test value')
  })

  it('should apply custom className', () => {
    const { container } = render(<Input className="custom-input" />)
    const input = container.querySelector('input')
    expect(input).toHaveClass('custom-input')
  })

  it('should support different input types', () => {
    const { container: emailContainer } = render(<Input type="email" />)
    const emailInput = emailContainer.querySelector('input[type="email"]')
    expect(emailInput).toBeInTheDocument()

    const { container: passwordContainer } = render(<Input type="password" />)
    const passwordInput = passwordContainer.querySelector('input[type="password"]')
    expect(passwordInput).toBeInTheDocument()
  })

  it('should be disabled when disabled prop is set', () => {
    render(<Input disabled />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.disabled).toBe(true)
  })

  it('should forward ref', () => {
    const ref = { current: null as HTMLInputElement | null }
    render(<Input ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLInputElement)
  })

  it('should accept all standard input attributes', () => {
    render(
      <Input
        id="test-input"
        name="testName"
        required
        maxLength={10}
        autoComplete="off"
      />
    )
    
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.id).toBe('test-input')
    expect(input.name).toBe('testName')
    expect(input.required).toBe(true)
    expect(input.maxLength).toBe(10)
    expect(input.autocomplete).toBe('off')
  })
})
