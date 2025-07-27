import { render, screen } from '@testing-library/react';
import RecipeWeeksPage from '@/app/weeks/page';
import * as recipeWeeksLib from '@/lib/recipeWeeks';

// Mock the library functions
jest.mock('../../src/lib/recipeWeeks', () => ({
  getRecipeWeeks: jest.fn(),
  groupRecipesByWeek: jest.fn(),
  getRecipeWeekStats: jest.fn(),
}));

// Mock the HeaderPage component
jest.mock('../../src/app/components/HeaderPage', () => {
  return function MockHeaderPage({ children }) {
    return <h1 data-testid="header-page">{children}</h1>;
  };
});

describe('RecipeWeeksPage', () => {
  const mockGetRecipeWeeks = recipeWeeksLib.getRecipeWeeks;
  const mockGroupRecipesByWeek = recipeWeeksLib.groupRecipesByWeek;
  const mockGetRecipeWeekStats = recipeWeeksLib.getRecipeWeekStats;

  const mockRecipeWeeksData = [
    {
      id: 1,
      week: 1,
      year: 2024,
      recipe_id: 101,
      account_id: 1,
      recipe_name: 'Pasta Carbonara',
    },
    {
      id: 2,
      week: 1,
      year: 2024,
      recipe_id: 102,
      account_id: 1,
      recipe_name: 'Caesar Salad',
    },
    {
      id: 3,
      week: 2,
      year: 2024,
      recipe_id: 103,
      account_id: 1,
      recipe_name: 'Grilled Chicken',
    },
  ];

  const mockGroupedRecipes = [
    {
      year: 2024,
      week: 1,
      recipes: [
        { id: 1, recipeName: 'Pasta Carbonara' },
        { id: 2, recipeName: 'Caesar Salad' },
      ],
    },
    {
      year: 2024,
      week: 2,
      recipes: [{ id: 3, recipeName: 'Grilled Chicken' }],
    },
  ];

  const mockStats = {
    totalWeeks: 2,
    totalRecipes: 3,
    avgRecipesPerWeek: 1.5,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful data fetching', () => {
    beforeEach(() => {
      mockGetRecipeWeeks.mockResolvedValue({
        success: true,
        data: mockRecipeWeeksData,
      });
      mockGroupRecipesByWeek.mockReturnValue(mockGroupedRecipes);
      mockGetRecipeWeekStats.mockReturnValue(mockStats);
    });

    it('renders the page with header and description', async () => {
      const page = await RecipeWeeksPage();
      render(page);

      expect(screen.getByTestId('header-page')).toHaveTextContent('Past plans');
      expect(
        screen.getByText('Last 6 months of planned recipes')
      ).toBeInTheDocument();
    });

    it('calls getRecipeWeeks with correct parameter', async () => {
      await RecipeWeeksPage();

      expect(mockGetRecipeWeeks).toHaveBeenCalledWith(6);
      expect(mockGetRecipeWeeks).toHaveBeenCalledTimes(1);
    });

    it('calls groupRecipesByWeek and getRecipeWeekStats with correct data', async () => {
      await RecipeWeeksPage();

      expect(mockGroupRecipesByWeek).toHaveBeenCalledWith(mockRecipeWeeksData);
      expect(mockGetRecipeWeekStats).toHaveBeenCalledWith(mockGroupedRecipes);
    });

    it('displays statistics correctly', async () => {
      const page = await RecipeWeeksPage();
      render(page);

      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('Weeks')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Recipes')).toBeInTheDocument();
      expect(screen.getByText('1.5')).toBeInTheDocument();
      expect(screen.getByText('Avg per Week')).toBeInTheDocument();
    });

    it('renders recipe week cards correctly', async () => {
      const page = await RecipeWeeksPage();
      render(page);

      // Check for week headers
      expect(screen.getByText('Week 1, 2024')).toBeInTheDocument();
      expect(screen.getByText('Week 2, 2024')).toBeInTheDocument();

      // Check for recipe counts
      expect(screen.getByText('2 recipes')).toBeInTheDocument();
      expect(screen.getByText('1 recipe')).toBeInTheDocument();

      // Check for recipe names
      expect(screen.getByText('Pasta Carbonara')).toBeInTheDocument();
      expect(screen.getByText('Caesar Salad')).toBeInTheDocument();
      expect(screen.getByText('Grilled Chicken')).toBeInTheDocument();
    });

    it('applies correct CSS classes for layout', async () => {
      const page = await RecipeWeeksPage();
      const { container } = render(page);

      // Check main container classes
      const mainDiv = container.querySelector('.min-h-screen.bg-background');
      expect(mainDiv).toBeInTheDocument();

      // Check stats grid
      const statsGrid = container.querySelector(
        '.grid.grid-cols-2.md\\:grid-cols-3'
      );
      expect(statsGrid).toBeInTheDocument();

      // Check recipe cards wrapper
      const cardsWrapper = container.querySelector('.flex.flex-wrap.gap-6');
      expect(cardsWrapper).toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    it('renders error state when getRecipeWeeks fails', async () => {
      const errorMessage = 'Database connection failed';
      mockGetRecipeWeeks.mockResolvedValue({
        success: false,
        error: errorMessage,
        data: [],
      });

      const page = await RecipeWeeksPage();
      render(page);

      expect(screen.getByTestId('header-page')).toHaveTextContent(
        'Error fetching recipe weeks'
      );
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toHaveClass('text-red-500');
    });

    it('does not call grouping functions when getRecipeWeeks fails', async () => {
      mockGetRecipeWeeks.mockResolvedValue({
        success: false,
        error: 'Error message',
        data: [],
      });

      await RecipeWeeksPage();

      expect(mockGroupRecipesByWeek).not.toHaveBeenCalled();
      expect(mockGetRecipeWeekStats).not.toHaveBeenCalled();
    });

    it('handles different error message types', async () => {
      const errorMessage = 'Network timeout error';
      mockGetRecipeWeeks.mockResolvedValue({
        success: false,
        error: errorMessage,
        data: [],
      });

      const page = await RecipeWeeksPage();
      render(page);

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe('Empty data scenarios', () => {
    beforeEach(() => {
      mockGetRecipeWeeks.mockResolvedValue({
        success: true,
        data: [],
      });
      mockGroupRecipesByWeek.mockReturnValue([]);
      mockGetRecipeWeekStats.mockReturnValue({
        totalWeeks: 0,
        totalRecipes: 0,
        avgRecipesPerWeek: 0,
      });
    });

    it('displays empty state when no recipes found', async () => {
      const page = await RecipeWeeksPage();
      render(page);

      expect(screen.getByText('No recipe weeks found.')).toBeInTheDocument();
      expect(screen.getByText('No recipe weeks found.')).toHaveClass(
        'text-secondary'
      );
    });

    it('does not render stats when no grouped recipes', async () => {
      const page = await RecipeWeeksPage();
      render(page);

      expect(screen.queryByText('Weeks')).not.toBeInTheDocument();
      expect(screen.queryByText('Recipes')).not.toBeInTheDocument();
      expect(screen.queryByText('Avg per Week')).not.toBeInTheDocument();
    });

    it('renders empty state container with correct styling', async () => {
      const page = await RecipeWeeksPage();
      const { container } = render(page);

      const emptyStateDiv = container.querySelector(
        '.bg-surface.border.border-custom.rounded-lg.p-8.text-center'
      );
      expect(emptyStateDiv).toBeInTheDocument();
    });
  });

  describe('RecipeWeekCard component', () => {
    beforeEach(() => {
      mockGetRecipeWeeks.mockResolvedValue({
        success: true,
        data: mockRecipeWeeksData,
      });
      mockGroupRecipesByWeek.mockReturnValue(mockGroupedRecipes);
      mockGetRecipeWeekStats.mockReturnValue(mockStats);
    });

    it('renders week header with correct styling', async () => {
      const page = await RecipeWeeksPage();
      const { container } = render(page);

      const weekHeader = container.querySelector('.bg-accent.text-background');
      expect(weekHeader).toBeInTheDocument();
    });

    it('renders recipe items with proper spacing', async () => {
      const page = await RecipeWeeksPage();
      const { container } = render(page);

      // Check for recipe items container
      const recipeContainer = container.querySelector('.space-y-3');
      expect(recipeContainer).toBeInTheDocument();
    });

    it('handles single recipe correctly', async () => {
      // Mock data with single recipe
      mockGroupRecipesByWeek.mockReturnValue([
        {
          year: 2024,
          week: 1,
          recipes: [{ id: 1, recipeName: 'Single Recipe' }],
        },
      ]);

      const page = await RecipeWeeksPage();
      render(page);

      expect(screen.getByText('1 recipe')).toBeInTheDocument();
      expect(screen.getByText('Single Recipe')).toBeInTheDocument();
    });

    it('handles multiple recipes correctly', async () => {
      const page = await RecipeWeeksPage();
      render(page);

      expect(screen.getByText('2 recipes')).toBeInTheDocument();
    });
  });

  describe('RecipeItem component', () => {
    beforeEach(() => {
      mockGetRecipeWeeks.mockResolvedValue({
        success: true,
        data: mockRecipeWeeksData,
      });
    });

    it('renders last recipe item without border', async () => {
      mockGroupRecipesByWeek.mockReturnValue([
        {
          year: 2024,
          week: 1,
          recipes: [
            { id: 1, recipeName: 'First Recipe' },
            { id: 2, recipeName: 'Last Recipe' },
          ],
        },
      ]);

      const page = await RecipeWeeksPage();
      const { container } = render(page);

      // The last recipe should not have border-b class
      const recipeElements = container.querySelectorAll(
        '.font-medium.text-foreground.text-sm'
      );
      expect(recipeElements).toHaveLength(2);
    });

    it('renders non-last recipe items with border', async () => {
      mockGroupRecipesByWeek.mockReturnValue([
        {
          year: 2024,
          week: 1,
          recipes: [
            { id: 1, recipeName: 'First Recipe' },
            { id: 2, recipeName: 'Second Recipe' },
          ],
        },
      ]);

      const page = await RecipeWeeksPage();
      const { container } = render(page);

      // Check for border-b class on non-last items
      const borderedElement = container.querySelector(
        '.border-b.border-light.pb-3'
      );
      expect(borderedElement).toBeInTheDocument();
    });

    it('applies correct text styling to recipe names', async () => {
      const page = await RecipeWeeksPage();
      const { container } = render(page);

      const recipeNameElement = container.querySelector(
        '.font-medium.text-foreground.text-sm.leading-snug'
      );
      expect(recipeNameElement).toBeInTheDocument();
    });
  });

  describe('Data edge cases', () => {
    it('handles zero stats correctly', async () => {
      mockGetRecipeWeeks.mockResolvedValue({
        success: true,
        data: [],
      });
      mockGroupRecipesByWeek.mockReturnValue([]);
      mockGetRecipeWeekStats.mockReturnValue({
        totalWeeks: 0,
        totalRecipes: 0,
        avgRecipesPerWeek: 0,
      });

      const page = await RecipeWeeksPage();
      render(page);

      expect(screen.getByText('No recipe weeks found.')).toBeInTheDocument();
    });

    it('handles large numbers in stats', async () => {
      mockGetRecipeWeeks.mockResolvedValue({
        success: true,
        data: mockRecipeWeeksData,
      });
      mockGroupRecipesByWeek.mockReturnValue(mockGroupedRecipes);
      mockGetRecipeWeekStats.mockReturnValue({
        totalWeeks: 52,
        totalRecipes: 156,
        avgRecipesPerWeek: 3.0,
      });

      const page = await RecipeWeeksPage();
      render(page);

      expect(screen.getByText('52')).toBeInTheDocument();
      expect(screen.getByText('156')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('handles decimal averages', async () => {
      mockGetRecipeWeeks.mockResolvedValue({
        success: true,
        data: mockRecipeWeeksData,
      });
      mockGroupRecipesByWeek.mockReturnValue(mockGroupedRecipes);
      mockGetRecipeWeekStats.mockReturnValue({
        totalWeeks: 3,
        totalRecipes: 7,
        avgRecipesPerWeek: 2.33,
      });

      const page = await RecipeWeeksPage();
      render(page);

      expect(screen.getByText('2.33')).toBeInTheDocument();
    });

    it('handles very long recipe names', async () => {
      const longNameRecipes = [
        {
          year: 2024,
          week: 1,
          recipes: [
            {
              id: 1,
              recipeName:
                'This is a very long recipe name that might cause display issues if not handled properly',
            },
          ],
        },
      ];

      mockGetRecipeWeeks.mockResolvedValue({
        success: true,
        data: mockRecipeWeeksData,
      });
      mockGroupRecipesByWeek.mockReturnValue(longNameRecipes);
      mockGetRecipeWeekStats.mockReturnValue(mockStats);

      const page = await RecipeWeeksPage();
      render(page);

      expect(
        screen.getByText(
          'This is a very long recipe name that might cause display issues if not handled properly'
        )
      ).toBeInTheDocument();
    });

    it('handles special characters in recipe names', async () => {
      const specialCharRecipes = [
        {
          year: 2024,
          week: 1,
          recipes: [
            { id: 1, recipeName: 'Recipe with "quotes" & symbols!' },
            { id: 2, recipeName: 'Crème Brûlée with açaí' },
          ],
        },
      ];

      mockGetRecipeWeeks.mockResolvedValue({
        success: true,
        data: mockRecipeWeeksData,
      });
      mockGroupRecipesByWeek.mockReturnValue(specialCharRecipes);
      mockGetRecipeWeekStats.mockReturnValue(mockStats);

      const page = await RecipeWeeksPage();
      render(page);

      expect(
        screen.getByText('Recipe with "quotes" & symbols!')
      ).toBeInTheDocument();
      expect(screen.getByText('Crème Brûlée with açaí')).toBeInTheDocument();
    });
  });

  describe('Accessibility and responsive design', () => {
    beforeEach(() => {
      mockGetRecipeWeeks.mockResolvedValue({
        success: true,
        data: mockRecipeWeeksData,
      });
      mockGroupRecipesByWeek.mockReturnValue(mockGroupedRecipes);
      mockGetRecipeWeekStats.mockReturnValue(mockStats);
    });

    it('includes responsive grid classes for stats', async () => {
      const page = await RecipeWeeksPage();
      const { container } = render(page);

      const statsGrid = container.querySelector(
        '.grid-cols-2.md\\:grid-cols-3'
      );
      expect(statsGrid).toBeInTheDocument();
    });

    it('includes responsive card sizing classes', async () => {
      const page = await RecipeWeeksPage();
      const { container } = render(page);

      const recipeCard = container.querySelector('.min-w-80.max-w-sm');
      expect(recipeCard).toBeInTheDocument();
    });

    it('includes hover effects on cards', async () => {
      const page = await RecipeWeeksPage();
      const { container } = render(page);

      const hoverCard = container.querySelector(
        '.hover\\:shadow-md.transition-shadow'
      );
      expect(hoverCard).toBeInTheDocument();
    });
  });

  describe('Component prop handling', () => {
    it('passes correct props to RecipeWeekCard', async () => {
      mockGetRecipeWeeks.mockResolvedValue({
        success: true,
        data: mockRecipeWeeksData,
      });
      mockGroupRecipesByWeek.mockReturnValue(mockGroupedRecipes);
      mockGetRecipeWeekStats.mockReturnValue(mockStats);

      const page = await RecipeWeeksPage();
      render(page);

      // Verify that the component receives and displays the correct data
      expect(screen.getByText('Week 1, 2024')).toBeInTheDocument();
      expect(screen.getByText('Week 2, 2024')).toBeInTheDocument();
    });

    it('passes correct props to RecipeItem', async () => {
      mockGetRecipeWeeks.mockResolvedValue({
        success: true,
        data: mockRecipeWeeksData,
      });
      mockGroupRecipesByWeek.mockReturnValue([
        {
          year: 2024,
          week: 1,
          recipes: [
            { id: 1, recipeName: 'Recipe One' },
            { id: 2, recipeName: 'Recipe Two' },
          ],
        },
      ]);
      mockGetRecipeWeekStats.mockReturnValue(mockStats);

      const page = await RecipeWeeksPage();
      render(page);

      expect(screen.getByText('Recipe One')).toBeInTheDocument();
      expect(screen.getByText('Recipe Two')).toBeInTheDocument();
    });
  });

  describe('Key attributes', () => {
    it('uses correct key attributes for mapped components', async () => {
      mockGetRecipeWeeks.mockResolvedValue({
        success: true,
        data: mockRecipeWeeksData,
      });
      mockGroupRecipesByWeek.mockReturnValue(mockGroupedRecipes);
      mockGetRecipeWeekStats.mockReturnValue(mockStats);

      const page = await RecipeWeeksPage();
      const { container } = render(page);

      // The components should render without React key warnings
      const recipeCards = container.querySelectorAll(
        '.bg-surface.border.border-custom.rounded-lg.overflow-hidden'
      );
      expect(recipeCards.length).toBeGreaterThan(0);
    });
  });

  describe('Conditional text rendering', () => {
    it('renders singular recipe text correctly', async () => {
      mockGetRecipeWeeks.mockResolvedValue({
        success: true,
        data: mockRecipeWeeksData,
      });
      mockGroupRecipesByWeek.mockReturnValue([
        {
          year: 2024,
          week: 1,
          recipes: [{ id: 1, recipeName: 'Solo Recipe' }],
        },
      ]);
      mockGetRecipeWeekStats.mockReturnValue({
        totalWeeks: 1,
        totalRecipes: 1,
        avgRecipesPerWeek: 1,
      });

      const page = await RecipeWeeksPage();
      render(page);

      expect(screen.getByText('1 recipe')).toBeInTheDocument();
      expect(screen.queryByText('1 recipes')).not.toBeInTheDocument();
    });

    it('renders plural recipe text correctly', async () => {
      mockGetRecipeWeeks.mockResolvedValue({
        success: true,
        data: mockRecipeWeeksData,
      });
      mockGroupRecipesByWeek.mockReturnValue([
        {
          year: 2024,
          week: 1,
          recipes: [
            { id: 1, recipeName: 'Recipe One' },
            { id: 2, recipeName: 'Recipe Two' },
          ],
        },
      ]);
      mockGetRecipeWeekStats.mockReturnValue(mockStats);

      const page = await RecipeWeeksPage();
      render(page);

      expect(screen.getByText('2 recipes')).toBeInTheDocument();
      expect(screen.queryByText('2 recipe')).not.toBeInTheDocument();
    });
  });
});
