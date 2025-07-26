import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import HeaderLogo from '@/app/components/HeaderLogo' // Adjust path as needed

// Mock Next.js Link component
jest.mock('next/link', () => {
  return function MockLink({ children, href, className }) {
    return (
      <a href={href} className={className} data-testid={`link-${href}`}>
        {children}
      </a>
    )
  }
})

// Mock Next.js font
jest.mock('next/font/google', () => ({
  Crimson_Text: jest.fn(() => ({
    className: 'mocked-crimson-text-font',
  })),
}))

describe('HeaderLogo Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<HeaderLogo />)
    })

    it('renders as semantic header element', () => {
      render(<HeaderLogo />)
      
      const headerElement = screen.getByRole('banner')
      expect(headerElement).toBeInTheDocument()
      expect(headerElement.tagName).toBe('HEADER')
    })

    it('has correct CSS classes on header element', () => {
      render(<HeaderLogo />)
      
      const headerElement = screen.getByRole('banner')
      expect(headerElement).toHaveClass(
        'bg-surface',
        'border-b',
        'border-custom'
      )
    })
  })

  describe('Title Section', () => {
    it('renders the main title correctly', () => {
      render(<HeaderLogo />)
      
      const title = screen.getByRole('heading', { level: 1 })
      expect(title).toHaveTextContent('Family Foodie')
      expect(title).toBeInTheDocument()
    })

    it('applies correct font classes to title', () => {
      render(<HeaderLogo />)
      
      const title = screen.getByRole('heading', { level: 1 })
      expect(title).toHaveClass(
        'mocked-crimson-text-font',
        'font-bold',
        'text-4xl',
        'md:text-5xl',
        'text-foreground',
        'mb-2',
        'tracking-wide'
      )
    })

    it('renders the subtitle correctly', () => {
      render(<HeaderLogo />)
      
      const subtitle = screen.getByText('What the fork is for dinner?')
      expect(subtitle).toBeInTheDocument()
      expect(subtitle.tagName).toBe('P')
    })

    it('applies correct CSS classes to subtitle', () => {
      render(<HeaderLogo />)
      
      const subtitle = screen.getByText('What the fork is for dinner?')
      expect(subtitle).toHaveClass(
        'text-lg',
        'text-muted',
        'font-light',
        'italic'
      )
    })

    it('has correct container structure', () => {
      const { container } = render(<HeaderLogo />)
      
      const containerDiv = container.querySelector('.container')
      expect(containerDiv).toBeInTheDocument()
      expect(containerDiv).toHaveClass(
        'container',
        'mx-auto',
        'px-4',
        'py-6'
      )
      
      const titleSection = container.querySelector('.text-center')
      expect(titleSection).toBeInTheDocument()
    })
  })

  describe('Navigation Section', () => {
    it('renders navigation element', () => {
      render(<HeaderLogo />)
      
      const nav = screen.getByRole('navigation')
      expect(nav).toBeInTheDocument()
    })

    it('applies correct CSS classes to navigation', () => {
      render(<HeaderLogo />)
      
      const nav = screen.getByRole('navigation')
      expect(nav).toHaveClass('flex', 'justify-center', 'mt-4')
    })

    it('has correct navigation container structure', () => {
      const { container } = render(<HeaderLogo />)
      
      const navContainer = container.querySelector('nav .flex.space-x-8')
      expect(navContainer).toBeInTheDocument()
      expect(navContainer).toHaveClass('flex', 'space-x-8')
    })
  })

  describe('Navigation Links', () => {
    it('renders Home link with correct attributes', () => {
      render(<HeaderLogo />)
      
      const homeLink = screen.getByTestId('link-/')
      expect(homeLink).toBeInTheDocument()
      expect(homeLink).toHaveAttribute('href', '/')
      expect(homeLink).toHaveTextContent('Home')
    })

    it('renders Shopping list link with correct attributes', () => {
      render(<HeaderLogo />)
      
      const shoppingLink = screen.getByTestId('link-/shopping')
      expect(shoppingLink).toBeInTheDocument()
      expect(shoppingLink).toHaveAttribute('href', '/shopping')
      expect(shoppingLink).toHaveTextContent('Shopping list')
    })

    it('renders Past plans link with correct attributes', () => {
      render(<HeaderLogo />)
      
      const pastPlansLink = screen.getByTestId('link-/weeks')
      expect(pastPlansLink).toBeInTheDocument()
      expect(pastPlansLink).toHaveAttribute('href', '/weeks')
      expect(pastPlansLink).toHaveTextContent('Past plans')
    })

    it('applies correct CSS classes to all navigation links', () => {
      render(<HeaderLogo />)
      
      const expectedClasses = [
        'text-secondary',
        'hover:text-foreground',
        'transition-colors',
        'font-medium',
        'underline-offset-4',
        'hover:underline'
      ]
      
      const homeLink = screen.getByTestId('link-/')
      const shoppingLink = screen.getByTestId('link-/shopping')
      const pastPlansLink = screen.getByTestId('link-/weeks')
      
      expectedClasses.forEach(className => {
        expect(homeLink).toHaveClass(className)
        expect(shoppingLink).toHaveClass(className)
        expect(pastPlansLink).toHaveClass(className)
      })
    })

    it('renders exactly three navigation links', () => {
      render(<HeaderLogo />)
      
      const allLinks = screen.getAllByRole('link')
      expect(allLinks).toHaveLength(3)
    })

    it('renders links in correct order', () => {
      render(<HeaderLogo />)
      
      const allLinks = screen.getAllByRole('link')
      expect(allLinks[0]).toHaveTextContent('Home')
      expect(allLinks[1]).toHaveTextContent('Shopping list')
      expect(allLinks[2]).toHaveTextContent('Past plans')
    })
  })

  describe('Accessibility', () => {
    it('has semantic HTML structure', () => {
      render(<HeaderLogo />)
      
      // Check for semantic elements
      expect(screen.getByRole('banner')).toBeInTheDocument() // header
      expect(screen.getByRole('navigation')).toBeInTheDocument() // nav
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument() // h1
    })

    it('has accessible link text', () => {
      render(<HeaderLogo />)
      
      const homeLink = screen.getByRole('link', { name: 'Home' })
      const shoppingLink = screen.getByRole('link', { name: 'Shopping list' })
      const pastPlansLink = screen.getByRole('link', { name: 'Past plans' })
      
      expect(homeLink).toBeInTheDocument()
      expect(shoppingLink).toBeInTheDocument()
      expect(pastPlansLink).toBeInTheDocument()
    })
  })

  describe('Layout and Styling', () => {
    it('applies responsive text sizing classes', () => {
      render(<HeaderLogo />)
      
      const title = screen.getByRole('heading', { level: 1 })
      expect(title).toHaveClass('text-4xl', 'md:text-5xl')
    })

    it('has correct spacing and layout classes', () => {
      const { container } = render(<HeaderLogo />)
      
      // Check container spacing
      const containerDiv = container.querySelector('.container')
      expect(containerDiv).toHaveClass('px-4', 'py-6')
      
      // Check title section centering
      const titleSection = container.querySelector('.text-center')
      expect(titleSection).toBeInTheDocument()
      
      // Check navigation centering and spacing
      const nav = screen.getByRole('navigation')
      expect(nav).toHaveClass('flex', 'justify-center', 'mt-4')
    })

    it('applies hover and transition classes to links', () => {
      render(<HeaderLogo />)
      
      const links = screen.getAllByRole('link')
      
      links.forEach(link => {
        expect(link).toHaveClass(
          'hover:text-foreground',
          'transition-colors',
          'hover:underline'
        )
      })
    })
  })

  describe('Content Verification', () => {
    it('contains expected text content', () => {
      render(<HeaderLogo />)
      
      expect(screen.getByText('Family Foodie')).toBeInTheDocument()
      expect(screen.getByText('What the fork is for dinner?')).toBeInTheDocument()
      expect(screen.getByText('Home')).toBeInTheDocument()
      expect(screen.getByText('Shopping list')).toBeInTheDocument()
      expect(screen.getByText('Past plans')).toBeInTheDocument()
    })

    it('matches snapshot', () => {
      const { container } = render(<HeaderLogo />)
      expect(container.firstChild).toMatchSnapshot()
    })
  })

  describe('Integration Tests', () => {
    it('works properly when rendered multiple times', () => {
      const { unmount } = render(<HeaderLogo />)
      expect(screen.getByText('Family Foodie')).toBeInTheDocument()
      
      unmount()
      
      render(<HeaderLogo />)
      expect(screen.getByText('Family Foodie')).toBeInTheDocument()
    })

    it('maintains component structure integrity', () => {
      render(<HeaderLogo />)
      
      // Verify complete component hierarchy exists
      const header = screen.getByRole('banner')
      const container = header.querySelector('.container')
      const titleSection = container.querySelector('.text-center')
      const nav = screen.getByRole('navigation')
      const navContainer = nav.querySelector('.flex.space-x-8')
      
      expect(header).toContainElement(container)
      expect(container).toContainElement(titleSection)
      expect(container).toContainElement(nav)
      expect(nav).toContainElement(navContainer)
    })
  })
})