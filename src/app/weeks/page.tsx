// app/weeks/page.tsx
import { 
  getRecipeWeeks, 
  groupRecipesByWeek, 
  getRecipeWeekStats
} from '@/lib/recipeWeeks';
import HeaderPage from '../components/HeaderPage';

export default async function RecipeWeeksPage() {
  // Fetch data using library functions
  const recipeWeeksResult = await getRecipeWeeks(6); // Last 6 months
  if (!recipeWeeksResult.success) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <HeaderPage>
            Error fetching recipe weeks
          </HeaderPage>
          <p className="text-red-500">{recipeWeeksResult.error}</p>
        </div>
      </div>
    );
  }

  const groupedRecipes = groupRecipesByWeek(recipeWeeksResult.data);
  const stats = getRecipeWeekStats(groupedRecipes);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <HeaderPage>
            Past plans
          </HeaderPage>
          <p className="text-muted">
            Last 6 months of planned recipes
          </p>
        </div>

        {/* Stats Summary */}
        {groupedRecipes.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-surface border border-custom rounded-lg p-4 text-center">
              <p className="text-2xl font-semibold text-foreground">{stats.totalWeeks}</p>
              <p className="text-xs text-muted">Weeks</p>
            </div>
            <div className="bg-surface border border-custom rounded-lg p-4 text-center">
              <p className="text-2xl font-semibold text-foreground">{stats.totalRecipes}</p>
              <p className="text-xs text-muted">Recipes</p>
            </div>
            <div className="bg-surface border border-custom rounded-lg p-4 text-center">
              <p className="text-2xl font-semibold text-foreground">{stats.avgRecipesPerWeek}</p>
              <p className="text-xs text-muted">Avg per Week</p>
            </div>
          </div>
        )}
        
        {/* Recipe Cards */}
        {groupedRecipes.length === 0 ? (
          <div className="bg-surface border border-custom rounded-lg p-8 text-center">
            <p className="text-secondary">No recipe weeks found.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-6">
            {groupedRecipes.map(({ year, week, recipes }) => (
              <RecipeWeekCard 
                key={`${year}-${week}`}
                year={year}
                week={week}
                recipes={recipes}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Recipe Week Card Component
interface RecipeWeekCardProps {
  year: number;
  week: number;
  recipes: Array<{
    id: number;
    recipeName: string;
  }>;
}

// Recipe Item Component
interface RecipeItemProps {
  recipe: {
    id: number;
    recipeName: string;
  };
  isLast: boolean;
}

function RecipeItem({ recipe, isLast }: RecipeItemProps) {
  return (
    <div className={`${!isLast ? 'border-b border-light pb-3' : ''}`}>
      <p className="font-medium text-foreground text-sm leading-snug">
        {recipe.recipeName}
      </p>
    </div>
  );
}

function RecipeWeekCard({ year, week, recipes }: RecipeWeekCardProps) {
  return (
    <div className="flex-1 min-w-80 max-w-sm bg-surface border border-custom rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      <div className="bg-accent text-background px-4 py-3">
        <h2 className="text-lg font-medium">
          Week {week}, {year}
        </h2>
        <p className="text-sm opacity-80">
          {recipes.length} recipe{recipes.length !== 1 ? 's' : ''}
        </p>
      </div>
      
      <div className="p-4">
        <div className="space-y-3">
          {recipes.map((recipe) => (
            <RecipeItem 
              key={recipe.id}
              recipe={recipe}
              isLast={recipes[recipes.length - 1].id === recipe.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
}