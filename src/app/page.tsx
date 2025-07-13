import { Crimson_Text } from "next/font/google";

const crimsonText = Crimson_Text({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
})


export default function Home() {
  return (
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <div>
          <h1 className={`${crimsonText.className} text-gray-400`}>
            <div className="text-4xl mb-2" role="img" aria-label="plate with cutlery">🍽️</div>
            <div className="text-6xl font-bold">Family Foodie</div>
          </h1>
          <h2 className={`text-xl text-gray-600`}>
            What the fork is for dinner?
          </h2>
        </div>
      </main>
  );
}
