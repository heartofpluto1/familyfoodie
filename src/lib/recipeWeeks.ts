// lib/recipeWeeks.ts
import pool from './db.js';

export interface RecipeWeek {
  id: number;
  week: number;
  year: number;
  recipe_id: number;
  account_id: number;
  recipe_name: string;
}

export interface GroupedRecipe {
  id: number;
  recipeName: string;
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
        menus_recipeweek.id,
        week,
        year,
        recipe_id,
        name as recipe_name
      FROM menus_recipeweek
      JOIN menus_recipe ON menus_recipeweek.recipe_id = menus_recipe.id
      WHERE 
        (year = ${currentYear} AND week <= ${currentWeek}) OR
        (year = ${monthsAgoYear} AND week >= ${monthsAgoWeek})
      ORDER BY year DESC, week DESC
    `;

    const [rows] = await pool.execute(query);
    console.log('Is something returned?', rows);

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
      recipeName: recipeWeek.recipe_name
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
      recipe.recipeName.toLowerCase().includes(lowerSearchTerm)
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

  return {
    totalWeeks,
    totalRecipes,
    avgRecipesPerWeek: parseFloat(avgRecipesPerWeek)
  };
}