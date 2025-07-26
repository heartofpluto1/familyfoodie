import pool from '../../../lib/db';

export async function GET() {
  try {
    const [rows] = await pool.execute('SELECT week, year from menus_recipeweek order by year desc, week desc limit 10');
    return Response.json({ 
      message: 'Database connected successfully', 
      data: rows 
    });
  } catch (error) {
    return Response.json(
      { 
        error: 'Database connection failed', 
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}