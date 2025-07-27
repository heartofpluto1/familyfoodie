import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import HeaderPage from '@/app/components/HeaderPage'; // Adjust path as needed

// Mock the Next.js font
jest.mock('next/font/google', () => ({
  Crimson_Text: () => ({ className: 'mocked-font' }),
}));

describe('HeaderPage', () => {
  it('renders text content', () => {
    render(<HeaderPage>Hello World</HeaderPage>);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('renders as h2 element', () => {
    render(<HeaderPage>Test</HeaderPage>);
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('has correct CSS classes', () => {
    render(<HeaderPage>Test</HeaderPage>);
    const header = screen.getByRole('heading');
    expect(header).toHaveClass(
      'text-3xl',
      'font-bold',
      'text-foreground',
      'mb-2'
    );
  });
});
