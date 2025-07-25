// __tests__/index.test.js
import { render, screen } from '@testing-library/react'
import Home from '@/app/page.tsx' // Adjust path as needed

describe('Home', () => {
  it('renders a heading', () => {
    render(<Home />)
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeInTheDocument()
  })
})