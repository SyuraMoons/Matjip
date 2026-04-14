import MapWrapper from "@/components/MapWrapper";

export default function Home() {
  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-950">
      {/* Full-screen map */}
      <MapWrapper />

      {/* Header overlay */}
      <div className="absolute top-0 left-0 right-0 z-[1000] flex items-center justify-between px-6 py-4 bg-gradient-to-b from-gray-950/90 to-transparent pointer-events-none">
        <div>
          <h1 className="text-white text-xl font-bold tracking-tight">
            matjib
          </h1>
          <p className="text-purple-400 text-xs tracking-widest uppercase mt-0.5">
            Your world, mapped in memories
          </p>
        </div>
        <button className="pointer-events-auto bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium px-4 py-2 rounded-full transition-colors shadow-lg shadow-purple-900/50">
          + Add Memory
        </button>
      </div>

      {/* Memory count badge */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] bg-gray-900/90 border border-purple-500/30 text-purple-300 text-xs px-4 py-2 rounded-full tracking-wide shadow-lg shadow-purple-900/20 pointer-events-none">
        5 memories across 5 countries
      </div>
    </div>
  );
}
