import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import RecipeWeeksPage from '@/app/weeks/page.tsx' // Adjust path as needed

// Mock the library functions
jest.mock('../../src/lib/recipeWeeks', () => ({
  getRecipeWeeks: jest.fn(),
  groupRecipesByWeek: jest.fn(),
  getRecipeWeekStats: jest.fn(),
}))

// Mock the HeaderPage component
jest.mock('../../src/app/components/HeaderPage', () => {
  return function MockHeaderPage({ children }) {
    return <h2>{children}</h2>
  }
})

const mockData = {
  recipeWeeks: [
    { id: 1, recipeName: 'Pasta', accountName: 'user1', year: 2024, week: 1 },
    { id: 2, recipeName: 'Pizza', accountName: 'user1', year: 2024, week: 1 },
  ],
  groupedRecipes: [
    {
      year: 2024,
      week: 1,
      recipes: [
        { id: 1, recipeName: 'Pasta', accountName: 'user1' },
        { id: 2, recipeName: 'Pizza', accountName: 'user1' },
      ]
    }
  ],
  stats: {
    totalWeeks: 1,
    totalRecipes: 2,
    avgRecipesPerWeek: 3
  }
}

describe('RecipeWeeksPage', () => {
  beforeEach(() => {
    const { getRecipeWeeks, groupRecipesByWeek, getRecipeWeekStats } = require('../../src/lib/recipeWeeks')
    
    getRecipeWeeks.mockResolvedValue(mockData.recipeWeeks)
    groupRecipesByWeek.mockReturnValue(mockData.groupedRecipes)
    getRecipeWeekStats.mockReturnValue(mockData.stats)
  })

  it('renders the page header', async () => {
    const component = await RecipeWeeksPage()
    render(component)
    
    expect(screen.getByText('Past plans')).toBeInTheDocument()
    expect(screen.getByText('Last 6 months of planned recipes')).toBeInTheDocument()
  })

  it('displays stats when recipes exist', async () => {
    const component = await RecipeWeeksPage()
    render(component)
    
    expect(screen.getByText('1')).toBeInTheDocument() // totalWeeks
    expect(screen.getByText('2')).toBeInTheDocument() // totalRecipes and avgRecipesPerWeek
    expect(screen.getByText('Weeks')).toBeInTheDocument()
    expect(screen.getByText('Recipes')).toBeInTheDocument()
    expect(screen.getByText('Avg per Week')).toBeInTheDocument()
  })

  it('displays recipe week cards', async () => {
    const component = await RecipeWeeksPage()
    render(component)
    
    expect(screen.getByText('Week 1, 2024')).toBeInTheDocument()
    expect(screen.getByText('2 recipes')).toBeInTheDocument()
    expect(screen.getByText('Pasta')).toBeInTheDocument()
    expect(screen.getByText('Pizza')).toBeInTheDocument()
  })

  it('shows empty state when no recipes', async () => {
    const { getRecipeWeeks, groupRecipesByWeek, getRecipeWeekStats } = require('../../src/lib/recipeWeeks')
    
    getRecipeWeeks.mockResolvedValue([])
    groupRecipesByWeek.mockReturnValue([])
    getRecipeWeekStats.mockReturnValue({ totalWeeks: 0, totalRecipes: 0, avgRecipesPerWeek: 0 })
    
    const component = await RecipeWeeksPage()
    render(component)
    
    expect(screen.getByText('No recipe weeks found.')).toBeInTheDocument()
  })

  it('calls library functions with correct parameters', async () => {
    const { getRecipeWeeks } = require('../../src/lib/recipeWeeks')
    
    await RecipeWeeksPage()
    
    expect(getRecipeWeeks).toHaveBeenCalledWith(6)
  })
})