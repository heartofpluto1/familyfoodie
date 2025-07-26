'use client';

import HeaderPage from '@/app/components/HeaderPage';
import { useState, useEffect } from 'react';
import { RecipeWeeksStats } from '@/lib/recipeWeeks';

export default function WeeksPage() {
  const [plans, setPlans] = useState([]);
  const [stats, setStats] = useState<RecipeWeeksStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlans() {
      try {
        const response = await fetch('/api/plans');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (!data.success) {
          throw new Error(`Database error! status: ${data.error}`);
        }
        setPlans(data.data);
        setStats(data.stats);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }
    fetchPlans();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <HeaderPage>
            Menus
          </HeaderPage>
          <p className="text-muted">
            Last 6 months of meal planning.
          </p>
        </div>
        
        {plans.length === 0 && (
          <div className="bg-surface border border-custom rounded-lg p-8 text-center">
             <p className="text-secondary">
              { loading ? 'Loading menus...' : 
               error ? `Error: ${error}` : 
               'No menus found.'
              }
             </p>
          </div>
        )}

        {stats && (
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

        {plans.length > 0 && (
          <div className="flex flex-wrap gap-6">
            {plans.map(({ year, week, recipes }) => (
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
