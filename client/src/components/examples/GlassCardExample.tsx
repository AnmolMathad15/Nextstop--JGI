import GlassCard from "../GlassCard";

export default function GlassCardExample() {
  return (
    <div className="p-4 bg-gradient-to-br from-teal-600 to-blue-600 min-h-[200px] flex items-center justify-center">
      <GlassCard className="max-w-sm">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Glass Card</h3>
        <p className="text-gray-600 dark:text-gray-300">
          This is a glass-morphism styled card component.
        </p>
      </GlassCard>
    </div>
  );
}
