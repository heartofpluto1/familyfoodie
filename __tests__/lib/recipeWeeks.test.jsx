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
      recipe_name: 'Pasta'
    },
    {
      id: 2,
      week: 1,
      year: 2024,
      recipe_id: 102,
      account_id: 2,
      recipe_name: 'Pizza'
    },
    {
      id: 3,
      week: 2,
      year: 2024,
      recipe_id: 103,
      account_id: 1,
      recipe_name: 'Salad'
    }
  ]

  // Mock console.error to avoid noise in test output
  const originalConsoleError = console.error
  beforeAll(() => {
    console.error = jest.fn()
  })

  afterAll(() => {
    console.error = originalConsoleError
  })

  describe('getRecipeWeeks', () => {
    let pool

    beforeEach(() => {
      jest.clearAllMocks()
      pool = require('../../src/lib/db.js').default
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('fetches recipe weeks successfully with default months parameter', async () => {
      pool.execute.mockResolvedValue([mockRecipeWeeks])

      const result = await getRecipeWeeks()

      expect(pool.execute).toHaveBeenCalled()
      expect(result).toEqual(mockRecipeWeeks)
      
      // Verify the query structure
      const query = pool.execute.mock.calls[0][0]
      expect(query).toContain('SELECT')
      expect(query).toContain('FROM menus_recipeweek')
      expect(query).toContain('JOIN menus_recipe')
      expect(query).toContain('WHERE')
      expect(query).toContain('ORDER BY year DESC, week DESC')
    })

    it('fetches recipe weeks with custom months parameter', async () => {
      pool.execute.mockResolvedValue([mockRecipeWeeks])

      const result = await getRecipeWeeks(12)

      expect(pool.execute).toHaveBeenCalled()
      expect(result).toEqual(mockRecipeWeeks)
    })

    it('handles same year date range correctly', async () => {
      // Mock current date to be mid-year
      const mockCurrentDate = new Date('2024-06-15')
      jest.useFakeTimers().setSystemTime(mockCurrentDate)
      
      pool.execute.mockResolvedValue([mockRecipeWeeks])

      await getRecipeWeeks(3)

      expect(pool.execute).toHaveBeenCalled()
      
      // Verify query contains correct year logic
      const query = pool.execute.mock.calls[0][0]
      expect(query).toContain('year = 2024')
    })

    it('handles cross-year date range correctly', async () => {
      // Mock current date to be early in year
      const mockCurrentDate = new Date('2024-02-15')
      jest.useFakeTimers().setSystemTime(mockCurrentDate)
      
      pool.execute.mockResolvedValue([mockRecipeWeeks])

      await getRecipeWeeks(6) // This should go back to previous year

      expect(pool.execute).toHaveBeenCalled()
      
      const query = pool.execute.mock.calls[0][0]
      expect(query).toContain('year = 2024')
      expect(query).toContain('year = 2023')
    })

    it('handles year boundary edge case', async () => {
      // Mock date at year end
      const mockCurrentDate = new Date('2024-12-31')
      jest.useFakeTimers().setSystemTime(mockCurrentDate)
      
      pool.execute.mockResolvedValue([mockRecipeWeeks])

      await getRecipeWeeks(1)

      expect(pool.execute).toHaveBeenCalled()
    })

    it('returns empty array on database error', async () => {
      const dbError = new Error('Database connection failed')
      pool.execute.mockRejectedValue(dbError)

      const result = await getRecipeWeeks(6)

      expect(result).toEqual([])
      expect(console.error).toHaveBeenCalledWith('Error fetching recipe weeks:', dbError)
    })

    it('handles different error types', async () => {
      const typeError = new TypeError('Invalid query')
      pool.execute.mockRejectedValue(typeError)

      const result = await getRecipeWeeks(6)

      expect(result).toEqual([])
      expect(console.error).toHaveBeenCalledWith('Error fetching recipe weeks:', typeError)
    })

    it('handles non-Error objects thrown', async () => {
      pool.execute.mockRejectedValue('String error')

      const result = await getRecipeWeeks(6)

      expect(result).toEqual([])
      expect(console.error).toHaveBeenCalledWith('Error fetching recipe weeks:', 'String error')
    })

    it('handles different months values affecting date calculation', async () => {
      pool.execute.mockResolvedValue([mockRecipeWeeks])

      // Test various month values
      await getRecipeWeeks(1)
      await getRecipeWeeks(12)
      await getRecipeWeeks(24)

      expect(pool.execute).toHaveBeenCalledTimes(3)
    })
  })

  describe('groupRecipesByWeek', () => {
    it('groups recipes by week and year correctly', () => {
      const result = groupRecipesByWeek(mockRecipeWeeks)

      expect(result).toHaveLength(2)
      
      // Find week 1 and week 2 results
      const week1 = result.find(w => w.week === 1 && w.year === 2024)
      const week2 = result.find(w => w.week === 2 && w.year === 2024)

      expect(week1).toEqual({
        year: 2024,
        week: 1,
        recipes: [
          { id: 1, recipeName: 'Pasta' },
          { id: 2, recipeName: 'Pizza' }
        ]
      })

      expect(week2).toEqual({
        year: 2024,
        week: 2,
        recipes: [
          { id: 3, recipeName: 'Salad' }
        ]
      })
    })

    it('handles empty array input', () => {
      const result = groupRecipesByWeek([])
      expect(result).toEqual([])
    })

    it('handles single recipe', () => {
      const singleRecipe = [mockRecipeWeeks[0]]
      const result = groupRecipesByWeek(singleRecipe)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        year: 2024,
        week: 1,
        recipes: [{ id: 1, recipeName: 'Pasta' }]
      })
    })

    it('handles multiple recipes in same week', () => {
      const sameWeekRecipes = [
        { id: 1, week: 1, year: 2024, recipe_id: 101, account_id: 1, recipe_name: 'Recipe1' },
        { id: 2, week: 1, year: 2024, recipe_id: 102, account_id: 1, recipe_name: 'Recipe2' },
        { id: 3, week: 1, year: 2024, recipe_id: 103, account_id: 1, recipe_name: 'Recipe3' }
      ]

      const result = groupRecipesByWeek(sameWeekRecipes)

      expect(result).toHaveLength(1)
      expect(result[0].recipes).toHaveLength(3)
    })

    it('handles different years correctly', () => {
      const multiYearRecipes = [
        { id: 1, week: 1, year: 2023, recipe_id: 101, account_id: 1, recipe_name: 'Recipe2023' },
        { id: 2, week: 1, year: 2024, recipe_id: 102, account_id: 1, recipe_name: 'Recipe2024' }
      ]

      const result = groupRecipesByWeek(multiYearRecipes)

      expect(result).toHaveLength(2)
      expect(result.find(w => w.year === 2023)).toBeDefined()
      expect(result.find(w => w.year === 2024)).toBeDefined()
    })
  })

  describe('filterGroupedWeeks', () => {
    const groupedWeeks = [
      {
        year: 2024,
        week: 1,
        recipes: [
          { id: 1, recipeName: 'Pasta Carbonara' },
          { id: 2, recipeName: 'Pizza Margherita' }
        ]
      },
      {
        year: 2024,
        week: 2,
        recipes: [
          { id: 3, recipeName: 'Caesar Salad' },
          { id: 4, recipeName: 'Greek Salad' }
        ]
      },
      {
        year: 2024,
        week: 3,
        recipes: [
          { id: 5, recipeName: 'Beef Stew' }
        ]
      }
    ]

    it('returns all weeks when search term is empty string', () => {
      const result = filterGroupedWeeks(groupedWeeks, '')
      expect(result).toEqual(groupedWeeks)
    })

    it('returns all weeks when search term is only whitespace', () => {
      const result = filterGroupedWeeks(groupedWeeks, '   ')
      expect(result).toEqual(groupedWeeks)
    })

    it('returns all weeks when search term is tab/newline whitespace', () => {
      const result = filterGroupedWeeks(groupedWeeks, '\t\n  ')
      expect(result).toEqual(groupedWeeks)
    })

    it('filters by recipe name case-insensitively', () => {
      const result = filterGroupedWeeks(groupedWeeks, 'pasta')
      
      expect(result).toHaveLength(1)
      expect(result[0].week).toBe(1)
      expect(result[0].recipes).toHaveLength(1)
      expect(result[0].recipes[0].recipeName).toBe('Pasta Carbonara')
    })

    it('filters by recipe name with uppercase search', () => {
      const result = filterGroupedWeeks(groupedWeeks, 'PIZZA')
      
      expect(result).toHaveLength(1)
      expect(result[0].recipes[0].recipeName).toBe('Pizza Margherita')
    })

    it('filters by partial recipe name match', () => {
      const result = filterGroupedWeeks(groupedWeeks, 'salad')
      
      expect(result).toHaveLength(1)
      expect(result[0].week).toBe(2)
      expect(result[0].recipes).toHaveLength(2)
    })

    it('returns multiple weeks when search matches recipes in different weeks', () => {
      // Search for something that appears in multiple weeks
      const testWeeks = [
        {
          year: 2024,
          week: 1,
          recipes: [{ id: 1, recipeName: 'Chicken Pasta' }]
        },
        {
          year: 2024,
          week: 2,
          recipes: [{ id: 2, recipeName: 'Beef Pasta' }]
        }
      ]

      const result = filterGroupedWeeks(testWeeks, 'pasta')
      
      expect(result).toHaveLength(2)
    })

    it('filters out weeks with no matching recipes', () => {
      const result = filterGroupedWeeks(groupedWeeks, 'sushi')
      expect(result).toEqual([])
    })

    it('preserves week structure when filtering', () => {
      const result = filterGroupedWeeks(groupedWeeks, 'caesar')
      
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        year: 2024,
        week: 2,
        recipes: [{ id: 3, recipeName: 'Caesar Salad' }]
      })
    })

    it('handles mixed case in recipe names', () => {
      const mixedCaseWeeks = [
        {
          year: 2024,
          week: 1,
          recipes: [
            { id: 1, recipeName: 'PaStA CaRbOnArA' },
            { id: 2, recipeName: 'pizza MARGHERITA' }
          ]
        }
      ]

      const result = filterGroupedWeeks(mixedCaseWeeks, 'pasta')
      expect(result[0].recipes).toHaveLength(1)
    })
  })

  describe('getRecipeWeekStats', () => {
    it('calculates correct statistics for multiple weeks', () => {
      const groupedWeeks = [
        {
          year: 2024,
          week: 1,
          recipes: [
            { id: 1, recipeName: 'Pasta' },
            { id: 2, recipeName: 'Pizza' }
          ]
        },
        {
          year: 2024,
          week: 2,
          recipes: [
            { id: 3, recipeName: 'Salad' }
          ]
        }
      ]

      const result = getRecipeWeekStats(groupedWeeks)

      expect(result).toEqual({
        totalWeeks: 2,
        totalRecipes: 3,
        avgRecipesPerWeek: 1.5
      })
    })

    it('handles empty array', () => {
      const result = getRecipeWeekStats([])

      expect(result).toEqual({
        totalWeeks: 0,
        totalRecipes: 0,
        avgRecipesPerWeek: 0
      })
    })

    it('handles single week with multiple recipes', () => {
      const singleWeek = [
        {
          year: 2024,
          week: 1,
          recipes: [
            { id: 1, recipeName: 'Recipe1' },
            { id: 2, recipeName: 'Recipe2' },
            { id: 3, recipeName: 'Recipe3' }
          ]
        }
      ]

      const result = getRecipeWeekStats(singleWeek)

      expect(result).toEqual({
        totalWeeks: 1,
        totalRecipes: 3,
        avgRecipesPerWeek: 3
      })
    })

    it('handles single week with single recipe', () => {
      const singleWeek = [
        {
          year: 2024,
          week: 1,
          recipes: [{ id: 1, recipeName: 'Recipe1' }]
        }
      ]

      const result = getRecipeWeekStats(singleWeek)

      expect(result).toEqual({
        totalWeeks: 1,
        totalRecipes: 1,
        avgRecipesPerWeek: 1
      })
    })

    it('handles weeks with no recipes', () => {
      const weeksWithNoRecipes = [
        {
          year: 2024,
          week: 1,
          recipes: []
        },
        {
          year: 2024,
          week: 2,
          recipes: []
        }
      ]

      const result = getRecipeWeekStats(weeksWithNoRecipes)

      expect(result).toEqual({
        totalWeeks: 2,
        totalRecipes: 0,
        avgRecipesPerWeek: 0
      })
    })

    it('handles decimal averages correctly', () => {
      const groupedWeeks = [
        {
          year: 2024,
          week: 1,
          recipes: [{ id: 1, recipeName: 'Recipe1' }]
        },
        {
          year: 2024,
          week: 2,
          recipes: [
            { id: 2, recipeName: 'Recipe2' },
            { id: 3, recipeName: 'Recipe3' }
          ]
        },
        {
          year: 2024,
          week: 3,
          recipes: [
            { id: 4, recipeName: 'Recipe4' },
            { id: 5, recipeName: 'Recipe5' },
            { id: 6, recipeName: 'Recipe6' }
          ]
        }
      ]

      const result = getRecipeWeekStats(groupedWeeks)

      expect(result).toEqual({
        totalWeeks: 3,
        totalRecipes: 6,
        avgRecipesPerWeek: 2
      })
    })

    it('rounds averages to one decimal place', () => {
      const groupedWeeks = [
        {
          year: 2024,
          week: 1,
          recipes: [{ id: 1, recipeName: 'Recipe1' }]
        },
        {
          year: 2024,
          week: 2,
          recipes: [
            { id: 2, recipeName: 'Recipe2' },
            { id: 3, recipeName: 'Recipe3' }
          ]
        }
      ]

      const result = getRecipeWeekStats(groupedWeeks)

      expect(result.avgRecipesPerWeek).toBe(1.5)
      expect(typeof result.avgRecipesPerWeek).toBe('number')
    })
  })
})