import { 
  getRecipeWeeks, 
  groupRecipesByWeek, 
  filterGroupedWeeks,
  getRecipeWeekStats 
} from '@/lib/recipeWeeks'

// Mock the database pool
jest.mock('../../src/lib/db.js', () => ({
  __esModule: true,
  default: {
    execute: jest.fn(),
  },
}))

describe('RecipeWeeks Library', () => {
  const mockRecipeWeeks = [
    {
      id: 1,
      week: 1,
      year: 2024,
      recipe_id: 101,
      account_id: 1,
      recipe_name: 'Pasta',
      account_name: 'User1'
    },
    {
      id: 2,
      week: 1,
      year: 2024,
      recipe_id: 102,
      account_id: 2,
      recipe_name: 'Pizza',
      account_name: 'User2'
    },
    {
      id: 3,
      week: 2,
      year: 2024,
      recipe_id: 103,
      account_id: 1,
      recipe_name: 'Salad',
      account_name: 'User1'
    }
  ]

  describe('getRecipeWeeks', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('fetches recipe weeks successfully', async () => {
      const pool = require('../../src/lib/db.js').default
      pool.execute.mockResolvedValue([mockRecipeWeeks])

      const result = await getRecipeWeeks(6)

      expect(pool.execute).toHaveBeenCalled()
      expect(result).toEqual(mockRecipeWeeks)
    })

    it('returns empty array on error', async () => {
      const pool = require('../../src/lib/db.js').default
      pool.execute.mockRejectedValue(new Error('Database error'))
      console.error = jest.fn() // Mock console.error

      const result = await getRecipeWeeks(6)

      expect(result).toEqual([])
      expect(console.error).toHaveBeenCalledWith('Error fetching recipe weeks:', expect.any(Error))
    })

    it('uses default months parameter', async () => {
      const pool = require('../../src/lib/db.js').default
      pool.execute.mockResolvedValue([mockRecipeWeeks])

      await getRecipeWeeks()

      expect(pool.execute).toHaveBeenCalled()
    })
  })

  describe('groupRecipesByWeek', () => {
    it('groups recipes by week and year', () => {
      const result = groupRecipesByWeek(mockRecipeWeeks)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        year: 2024,
        week: 1,
        recipes: [
          { id: 1, recipeName: 'Pasta', accountName: 'User1' },
          { id: 2, recipeName: 'Pizza', accountName: 'User2' }
        ]
      })
      expect(result[1]).toEqual({
        year: 2024,
        week: 2,
        recipes: [
          { id: 3, recipeName: 'Salad', accountName: 'User1' }
        ]
      })
    })

    it('handles empty array', () => {
      const result = groupRecipesByWeek([])
      expect(result).toEqual([])
    })
  })

  describe('filterGroupedWeeks', () => {
    const groupedWeeks = [
      {
        year: 2024,
        week: 1,
        recipes: [
          { id: 1, recipeName: 'Pasta', accountName: 'User1' },
          { id: 2, recipeName: 'Pizza', accountName: 'User2' }
        ]
      },
      {
        year: 2024,
        week: 2,
        recipes: [
          { id: 3, recipeName: 'Salad', accountName: 'User1' }
        ]
      }
    ]

    it('filters by recipe name', () => {
      const result = filterGroupedWeeks(groupedWeeks, 'pasta')
      
      expect(result).toHaveLength(1)
      expect(result[0].recipes).toHaveLength(1)
      expect(result[0].recipes[0].recipeName).toBe('Pasta')
    })

    it('filters by account name', () => {
      const result = filterGroupedWeeks(groupedWeeks, 'User2')
      
      expect(result).toHaveLength(1)
      expect(result[0].recipes[0].accountName).toBe('User2')
    })

    it('returns all weeks when search term is empty', () => {
      const result = filterGroupedWeeks(groupedWeeks, '')
      expect(result).toEqual(groupedWeeks)
    })

    it('returns empty array when no matches', () => {
      const result = filterGroupedWeeks(groupedWeeks, 'nonexistent')
      expect(result).toEqual([])
    })
  })

  describe('getRecipeWeekStats', () => {
    const groupedWeeks = [
      {
        year: 2024,
        week: 1,
        recipes: [
          { id: 1, recipeName: 'Pasta', accountName: 'User1' },
          { id: 2, recipeName: 'Pizza', accountName: 'User2' }
        ]
      },
      {
        year: 2024,
        week: 2,
        recipes: [
          { id: 3, recipeName: 'Salad', accountName: 'User1' }
        ]
      }
    ]

    it('calculates correct statistics', () => {
      const result = getRecipeWeekStats(groupedWeeks)

      expect(result).toEqual({
        totalWeeks: 2,
        totalRecipes: 3,
        avgRecipesPerWeek: 1.5,
        uniqueAccounts: 2
      })
    })

    it('handles empty array', () => {
      const result = getRecipeWeekStats([])

      expect(result).toEqual({
        totalWeeks: 0,
        totalRecipes: 0,
        avgRecipesPerWeek: 0,
        uniqueAccounts: 0
      })
    })

    it('handles single week', () => {
      const singleWeek = [groupedWeeks[0]]
      const result = getRecipeWeekStats(singleWeek)

      expect(result).toEqual({
        totalWeeks: 1,
        totalRecipes: 2,
        avgRecipesPerWeek: 2,
        uniqueAccounts: 2
      })
    })
  })
})