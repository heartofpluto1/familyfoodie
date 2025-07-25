import RootLayout, { metadata } from '@/app/layout';

describe('RootLayout', () => {
  it('returns JSX with correct structure', () => {
    const children = <div>Test</div>;
    const result = RootLayout({ children });
    
    expect(result.type).toBe('html');
    expect(result.props.lang).toBe('en');
  });
  
  it('exports correct metadata', () => {
    expect(metadata.title).toBe('Family Foodie');
    expect(metadata.description).toBe('Shift left on meal planning and shopping lists');
  });
});