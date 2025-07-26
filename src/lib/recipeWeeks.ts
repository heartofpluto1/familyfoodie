// lib/recipeWeeks.ts
import pool from './db.js';

export interface RecipeWeek {
  id: number;
  week: number;
  year: number;
  recipe_id: number;
  account_id: number;
  recipe_name: string;
  account_name: string;
}

export interface GroupedRecipe {
  id: number;
  recipeName: string;
  accountName: string;
}

export interface GroupedWeek {
  year: number;
  week: number;
  recipes: GroupedRecipe[];
}

/**
 * Calculate week number from date
 */
function getWeekNumber(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  return Math.floor(diff / oneWeek) + 1;
}

/**
 * Get recipe weeks from the last N months
 */
export async function getRecipeWeeks(months: number = 6): Promise<RecipeWeek[]> {
  try {
    // Calculate date range
    const monthsAgo = new Date();
    monthsAgo.setMonth(monthsAgo.getMonth() - months);
    
    const currentYear = new Date().getFullYear();
    const monthsAgoYear = monthsAgo.getFullYear();
    
    const monthsAgoWeek = getWeekNumber(monthsAgo);
    const currentWeek = getWeekNumber(new Date());

    const query = `
      SELECT 
        rw.id,
        rw.week,
        rw.year,
        rw.recipe_id,
        rw.account_id,
        r.name as recipe_name,
        a.name as account_name
      FROM menus_recipeweek rw
      JOIN menus_recipe r ON rw.recipe_id = r.id
      JOIN menus_account a ON rw.account_id = a.id
      WHERE 
        (rw.year = ${currentYear} AND rw.week <= ${currentWeek}) OR
        (rw.year = ${monthsAgoYear} AND rw.week >= ${monthsAgoWeek})
      ORDER BY rw.year DESC, rw.week DESC
    `;

    const [rows] = await pool.execute(query);

    return rows as RecipeWeek[];
  } catch (error) {
    console.error('Error fetching recipe weeks:', error);
    return [];
  }
}

/**
 * Group recipe weeks by week and year
 */
export function groupRecipesByWeek(recipeWeeks: RecipeWeek[]): GroupedWeek[] {
  const grouped = recipeWeeks.reduce((acc, recipeWeek) => {
    const key = `${recipeWeek.year}-${recipeWeek.week}`;
    
    if (!acc[key]) {
      acc[key] = {
        year: recipeWeek.year,
        week: recipeWeek.week,
        recipes: []
      };
    }
    
    acc[key].recipes.push({
      id: recipeWeek.id,
      recipeName: recipeWeek.recipe_name,
      accountName: recipeWeek.account_name
    });
    
    return acc;
  }, {} as Record<string, GroupedWeek>);

  // Convert to array
  return Object.values(grouped);
}

/**
 * Filter grouped weeks by recipe name or account name
 */
export function filterGroupedWeeks(groupedWeeks: GroupedWeek[], searchTerm: string): GroupedWeek[] {
  if (!searchTerm.trim()) return groupedWeeks;
  
  const lowerSearchTerm = searchTerm.toLowerCase();
  
  return groupedWeeks.map(week => ({
    ...week,
    recipes: week.recipes.filter(recipe => 
      recipe.recipeName.toLowerCase().includes(lowerSearchTerm) ||
      recipe.accountName.toLowerCase().includes(lowerSearchTerm)
    )
  })).filter(week => week.recipes.length > 0);
}

/**
 * Get statistics for recipe weeks
 */
export function getRecipeWeekStats(groupedWeeks: GroupedWeek[]) {
  const totalWeeks = groupedWeeks.length;
  const totalRecipes = groupedWeeks.reduce((sum, week) => sum + week.recipes.length, 0);
  const avgRecipesPerWeek = totalWeeks > 0 ? (totalRecipes / totalWeeks).toFixed(1) : '0';
  
  // Get unique accounts
  const uniqueAccounts = new Set();
  groupedWeeks.forEach(week => {
    week.recipes.forEach(recipe => {
      uniqueAccounts.add(recipe.accountName);
    });
  });

  return {
    totalWeeks,
    totalRecipes,
    avgRecipesPerWeek: parseFloat(avgRecipesPerWeek),
    uniqueAccounts: uniqueAccounts.size
  };
}