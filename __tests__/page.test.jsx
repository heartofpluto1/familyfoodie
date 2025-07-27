// __tests__/index.test.js
import { render, screen } from '@testing-library/react';
import Home from '@/app/page.tsx'; // Adjust path as needed

describe('Home', () => {
  it('renders without crashing', () => {
    render(<Home />);
  });

  it('renders the main element with correct structure', () => {
    render(<Home />);

    const mainElement = screen.getByRole('main');
    expect(mainElement).toBeInTheDocument();
  });

  it('contains an empty div element', () => {
    const { container } = render(<Home />);

    const mainElement = container.querySelector('main');
    const divElement = mainElement?.querySelector('div');

    expect(divElement).toBeInTheDocument();
    expect(divElement).toBeEmptyDOMElement();
  });

  it('renders only a main element with empty div', () => {
    render(<Home />);

    // Check that main element exists and is the primary container
    const mainElement = screen.getByRole('main');
    expect(mainElement).toBeInTheDocument();

    // Verify it's the only main element
    const allMains = screen.getAllByRole('main');
    expect(allMains).toHaveLength(1);

    // Verify there are no headings since the component doesn't have any
    const headings = screen.queryAllByRole('heading');
    expect(headings).toHaveLength(0);
  });
});
