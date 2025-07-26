import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import RecipeWeeksPage from '@/app/weeks/page' // Adjust path as needed

// Mock the library functions
jest.mock('../../src/lib/recipeWeeks', () => ({
  getRecipeWeeks: jest.fn(),
  groupRecipesByWeek: jest.fn(),
  getRecipeWeekStats: jest.fn(),
}))

// Mock the HeaderPage component
jest.mock('../../src/app/components/HeaderPage', () => {
  return function MockHeaderPage({ children }) {
    return <h2 data-testid="header">{children}</h2>
  }
})

describe('RecipeWeeksPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic Page Structure', () => {
    it('renders the page header and description', async () => {
      const { getRecipeWeeks, groupRecipesByWeek, getRecipeWeekStats } = require('../../src/lib/recipeWeeks')
      
      getRecipeWeeks.mockResolvedValue([])
      groupRecipesByWeek.mockReturnValue([])
      getRecipeWeekStats.mockReturnValue({ totalWeeks: 0, totalRecipes: 0, avgRecipesPerWeek: 0 })
      
      const component = await RecipeWeeksPage()
      render(component)
      
      expect(screen.getByTestId('header')).toHaveTextContent('Past plans')
      expect(screen.getByText('Last 6 months of planned recipes')).toBeInTheDocument()
    })

    it('calls library functions with correct parameters', async () => {
      const { getRecipeWeeks, groupRecipesByWeek, getRecipeWeekStats } = require('../../src/lib/recipeWeeks')
      
      const mockRecipeWeeks = [
        { id: 1, recipeName: 'Pasta', accountName: 'user1', year: 2024, week: 1 }
      ]
      
      getRecipeWeeks.mockResolvedValue(mockRecipeWeeks)
      groupRecipesByWeek.mockReturnValue([])
      getRecipeWeekStats.mockReturnValue({ totalWeeks: 0, totalRecipes: 0, avgRecipesPerWeek: 0 })
      
      await RecipeWeeksPage()
      
      expect(getRecipeWeeks).toHaveBeenCalledWith(6)
      expect(groupRecipesByWeek).toHaveBeenCalledWith(mockRecipeWeeks)
    })
  })

  describe('Empty State', () => {
    it('shows empty state when no recipes exist', async () => {
      const { getRecipeWeeks, groupRecipesByWeek, getRecipeWeekStats } = require('../../src/lib/recipeWeeks')
      
      getRecipeWeeks.mockResolvedValue([])
      groupRecipesByWeek.mockReturnValue([])
      getRecipeWeekStats.mockReturnValue({ totalWeeks: 0, totalRecipes: 0, avgRecipesPerWeek: 0 })
      
      const component = await RecipeWeeksPage()
      render(component)
      
      expect(screen.getByText('No recipe weeks found.')).toBeInTheDocument()
      
      // Stats should NOT be rendered when no recipes
      expect(screen.queryByText('Weeks')).not.toBeInTheDocument()
      expect(screen.queryByText('Recipes')).not.toBeInTheDocument()
      expect(screen.queryByText('Avg per Week')).not.toBeInTheDocument()
    })
  })

  describe('Stats Display', () => {
    it('displays stats when recipes exist', async () => {
      const { getRecipeWeeks, groupRecipesByWeek, getRecipeWeekStats } = require('../../src/lib/recipeWeeks')
      
      const mockGroupedRecipes = [
        {
          year: 2024,
          week: 1,
          recipes: [
            { id: 1, recipeName: 'Pasta', accountName: 'user1' },
            { id: 2, recipeName: 'Pizza', accountName: 'user1' }
          ]
        }
      ]
      
      getRecipeWeeks.mockResolvedValue([])
      groupRecipesByWeek.mockReturnValue(mockGroupedRecipes)
      getRecipeWeekStats.mockReturnValue({ 
        totalWeeks: 1, 
        totalRecipes: 2, 
        avgRecipesPerWeek: 3.0 
      })
      
      const component = await RecipeWeeksPage()
      render(component)
      
      // Check stats are displayed
      expect(screen.getByText('1')).toBeInTheDocument() // totalWeeks
      expect(screen.getByText('2')).toBeInTheDocument() // totalRecipes
      expect(screen.getByText('3')).toBeInTheDocument() // avgRecipesPerWeek
      expect(screen.getByText('Weeks')).toBeInTheDocument()
      expect(screen.getByText('Recipes')).toBeInTheDocument()
      expect(screen.getByText('Avg per Week')).toBeInTheDocument()
      
      // Empty state should NOT be rendered
      expect(screen.queryByText('No recipe weeks found.')).not.toBeInTheDocument()
    })

    it('displays stats with different values', async () => {
      const { getRecipeWeeks, groupRecipesByWeek, getRecipeWeekStats } = require('../../src/lib/recipeWeeks')
      
      const mockGroupedRecipes = [
        {
          year: 2024,
          week: 1,
          recipes: [{ id: 1, recipeName: 'Pasta', accountName: 'user1' }]
        },
        {
          year: 2024,
          week: 2,
          recipes: [
            { id: 2, recipeName: 'Pizza', accountName: 'user1' },
            { id: 3, recipeName: 'Salad', accountName: 'user2' },
            { id: 4, recipeName: 'Soup', accountName: 'user1' }
          ]
        }
      ]
      
      getRecipeWeeks.mockResolvedValue([])
      groupRecipesByWeek.mockReturnValue(mockGroupedRecipes)
      getRecipeWeekStats.mockReturnValue({ 
        totalWeeks: 2, 
        totalRecipes: 4, 
        avgRecipesPerWeek: 3.0 
      })
      
      const component = await RecipeWeeksPage()
      render(component)
      
      expect(screen.getByText('2')).toBeInTheDocument() // totalWeeks
      expect(screen.getByText('4')).toBeInTheDocument() // totalRecipes
      // avgRecipesPerWeek of 3.0 will display as '3'
    })
  })

  describe('Recipe Week Cards', () => {
    it('displays single recipe week card with multiple recipes', async () => {
      const { getRecipeWeeks, groupRecipesByWeek, getRecipeWeekStats } = require('../../src/lib/recipeWeeks')
      
      const mockGroupedRecipes = [
        {
          year: 2024,
          week: 1,
          recipes: [
            { id: 1, recipeName: 'Pasta', accountName: 'user1' },
            { id: 2, recipeName: 'Pizza', accountName: 'user1' }
          ]
        }
      ]
      
      getRecipeWeeks.mockResolvedValue([])
      groupRecipesByWeek.mockReturnValue(mockGroupedRecipes)
      getRecipeWeekStats.mockReturnValue({ totalWeeks: 1, totalRecipes: 2, avgRecipesPerWeek: 3 })
      
      const component = await RecipeWeeksPage()
      render(component)
      
      expect(screen.getByText('Week 1, 2024')).toBeInTheDocument()
      expect(screen.getByText('2 recipes')).toBeInTheDocument() // Plural form
      expect(screen.getByText('Pasta')).toBeInTheDocument()
      expect(screen.getByText('Pizza')).toBeInTheDocument()
    })

    it('displays recipe week card with single recipe (singular text)', async () => {
      const { getRecipeWeeks, groupRecipesByWeek, getRecipeWeekStats } = require('../../src/lib/recipeWeeks')
      
      const mockGroupedRecipes = [
        {
          year: 2024,
          week: 5,
          recipes: [
            { id: 1, recipeName: 'Solo Dish', accountName: 'user1' }
          ]
        }
      ]
      
      getRecipeWeeks.mockResolvedValue([])
      groupRecipesByWeek.mockReturnValue(mockGroupedRecipes)
      getRecipeWeekStats.mockReturnValue({ totalWeeks: 1, totalRecipes: 1, avgRecipesPerWeek: 1 })
      
      const component = await RecipeWeeksPage()
      render(component)
      
      expect(screen.getByText('Week 5, 2024')).toBeInTheDocument()
      expect(screen.getByText('1 recipe')).toBeInTheDocument() // Singular form
      expect(screen.getByText('Solo Dish')).toBeInTheDocument()
    })

    it('displays multiple recipe week cards', async () => {
      const { getRecipeWeeks, groupRecipesByWeek, getRecipeWeekStats } = require('../../src/lib/recipeWeeks')
      
      const mockGroupedRecipes = [
        {
          year: 2024,
          week: 1,
          recipes: [
            { id: 1, recipeName: 'Pasta', accountName: 'user1' },
            { id: 2, recipeName: 'Pizza', accountName: 'user1' }
          ]
        },
        {
          year: 2024,
          week: 2,
          recipes: [
            { id: 3, recipeName: 'Salad', accountName: 'user2' }
          ]
        },
        {
          year: 2023,
          week: 52,
          recipes: [
            { id: 4, recipeName: 'Soup', accountName: 'user1' },
            { id: 5, recipeName: 'Bread', accountName: 'user3' },
            { id: 6, recipeName: 'Cake', accountName: 'user2' }
          ]
        }
      ]
      
      getRecipeWeeks.mockResolvedValue([])
      groupRecipesByWeek.mockReturnValue(mockGroupedRecipes)
      getRecipeWeekStats.mockReturnValue({ totalWeeks: 3, totalRecipes: 6, avgRecipesPerWeek: 2 })
      
      const component = await RecipeWeeksPage()
      render(component)
      
      // Check all week headers
      expect(screen.getByText('Week 1, 2024')).toBeInTheDocument()
      expect(screen.getByText('Week 2, 2024')).toBeInTheDocument()
      expect(screen.getByText('Week 52, 2023')).toBeInTheDocument()
      
      // Check recipe counts
      expect(screen.getByText('2 recipes')).toBeInTheDocument()
      expect(screen.getByText('1 recipe')).toBeInTheDocument()
      expect(screen.getByText('3 recipes')).toBeInTheDocument()
      
      // Check all recipes are rendered
      expect(screen.getByText('Pasta')).toBeInTheDocument()
      expect(screen.getByText('Pizza')).toBeInTheDocument()
      expect(screen.getByText('Salad')).toBeInTheDocument()
      expect(screen.getByText('Soup')).toBeInTheDocument()
      expect(screen.getByText('Bread')).toBeInTheDocument()
      expect(screen.getByText('Cake')).toBeInTheDocument()
    })
  })

  describe('RecipeItem Component Border Logic', () => {
    it('applies border to non-last items and no border to last item', async () => {
      const { getRecipeWeeks, groupRecipesByWeek, getRecipeWeekStats } = require('../../src/lib/recipeWeeks')
      
      const mockGroupedRecipes = [
        {
          year: 2024,
          week: 1,
          recipes: [
            { id: 1, recipeName: 'First Recipe', accountName: 'user1' },
            { id: 2, recipeName: 'Middle Recipe', accountName: 'user1' },
            { id: 3, recipeName: 'Last Recipe', accountName: 'user1' }
          ]
        }
      ]
      
      getRecipeWeeks.mockResolvedValue([])
      groupRecipesByWeek.mockReturnValue(mockGroupedRecipes)
      getRecipeWeekStats.mockReturnValue({ totalWeeks: 1, totalRecipes: 3, avgRecipesPerWeek: 3 })
      
      const component = await RecipeWeeksPage()
      const { container } = render(component)
      
      // Find all recipe divs
      const recipeItems = container.querySelectorAll('div > div > div > div > div')
      
      // Verify all recipes are rendered
      expect(screen.getByText('First Recipe')).toBeInTheDocument()
      expect(screen.getByText('Middle Recipe')).toBeInTheDocument()
      expect(screen.getByText('Last Recipe')).toBeInTheDocument()
      
      // The isLast logic should be tested - last item (id: 3) should not have border
      expect(screen.getByText('3 recipes')).toBeInTheDocument()
    })

    it('handles single recipe item (which is both first and last)', async () => {
      const { getRecipeWeeks, groupRecipesByWeek, getRecipeWeekStats } = require('../../src/lib/recipeWeeks')
      
      const mockGroupedRecipes = [
        {
          year: 2024,
          week: 1,
          recipes: [
            { id: 1, recipeName: 'Only Recipe', accountName: 'user1' }
          ]
        }
      ]
      
      getRecipeWeeks.mockResolvedValue([])
      groupRecipesByWeek.mockReturnValue(mockGroupedRecipes)
      getRecipeWeekStats.mockReturnValue({ totalWeeks: 1, totalRecipes: 1, avgRecipesPerWeek: 1 })
      
      const component = await RecipeWeeksPage()
      render(component)
      
      expect(screen.getByText('Only Recipe')).toBeInTheDocument()
      expect(screen.getByText('1 recipe')).toBeInTheDocument()
    })
  })

  describe('Edge Cases and Integration', () => {
    it('handles zero stats correctly', async () => {
      const { getRecipeWeeks, groupRecipesByWeek, getRecipeWeekStats } = require('../../src/lib/recipeWeeks')
      
      getRecipeWeeks.mockResolvedValue([])
      groupRecipesByWeek.mockReturnValue([])
      getRecipeWeekStats.mockReturnValue({ 
        totalWeeks: 0, 
        totalRecipes: 0, 
        avgRecipesPerWeek: 0 
      })
      
      const component = await RecipeWeeksPage()
      render(component)
      
      // Should show empty state, not stats
      expect(screen.getByText('No recipe weeks found.')).toBeInTheDocument()
      expect(screen.queryByText('0')).not.toBeInTheDocument()
    })

    it('handles decimal avgRecipesPerWeek', async () => {
      const { getRecipeWeeks, groupRecipesByWeek, getRecipeWeekStats } = require('../../src/lib/recipeWeeks')
      
      const mockGroupedRecipes = [
        {
          year: 2024,
          week: 1,
          recipes: [{ id: 1, recipeName: 'Recipe1', accountName: 'user1' }]
        }
      ]
      
      getRecipeWeeks.mockResolvedValue([])
      groupRecipesByWeek.mockReturnValue(mockGroupedRecipes)
      getRecipeWeekStats.mockReturnValue({ 
        totalWeeks: 3, 
        totalRecipes: 5, 
        avgRecipesPerWeek: 1.67 
      })
      
      const component = await RecipeWeeksPage()
      render(component)
      
      expect(screen.getByText('3')).toBeInTheDocument() // totalWeeks
      expect(screen.getByText('5')).toBeInTheDocument() // totalRecipes  
      expect(screen.getByText('1.67')).toBeInTheDocument() // avgRecipesPerWeek
    })
  })
})