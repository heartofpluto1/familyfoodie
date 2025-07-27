'use client';

import HeaderPage from '@/app/components/HeaderPage';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import type { Stats, Meal, Menu } from '@/lib/menus';


export default function WeeksPage() {
  const [plans, setPlans] = useState([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlans() {
      try {
        const response = await fetch('/api/menus');
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
              <p className="text-xs text-muted">Meals</p>
            </div>
            <div className="bg-surface border border-custom rounded-lg p-4 text-center">
              <p className="text-2xl font-semibold text-foreground">{stats.avgRecipesPerWeek}</p>
              <p className="text-xs text-muted">Avg per Week</p>
            </div>
          </div>
        )}

        {plans.length > 0 && (
<div className="flex flex-wrap gap-6 items-start">
            {plans.map(({ year, week, meals }) => (
              <MenuCard 
                key={`${year}-${week}`}
                year={year}
                week={week}
                meals={meals}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Meal({ meal, isLast }: {
  meal: Meal;
  isLast: boolean;
}) {
  return (
    <div className={`${!isLast ? 'border-b border-light' : ''}`}>
      <p className="font-sm text-foreground text-sm leading-snug flex items-center gap-3 pr-3">
        <div className="w-12 h-12 bg-gray-200 overflow-hidden flex-shrink-0">
          <Image 
            src={`/static/${meal.filename}.jpg`}
            alt="thumb" 
            width="48" 
            height="48" 
            className="w-full h-full object-cover"
            unoptimized={true}
          />
        </div>
        {meal.name}
      </p>
    </div>
  );
}

function MenuCard({ year, week, meals }: Menu) {
  return (
    <div className="flex-1 min-w-80 max-w-sm bg-surface border border-custom rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      <div className="bg-accent text-background px-4 py-3 flex items-center justify-between">
        <h2 className="text-base font-medium">
          Week {week}, {year}
        </h2>
        <a 
          href="#" 
          className="opacity-90 hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
          title="Shopping list"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5-6m0 0h16M17 21a2 2 0 100-4 2 2 0 000 4zM9 21a2 2 0 100-4 2 2 0 000 4z" />
          </svg>
        </a>
      </div>
      
      <div className="">
        <div className="">
          {meals.map((meal) => (
            <Meal 
              key={meal.id}
              meal={meal}
              isLast={meals[meals.length - 1].id === meal.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
