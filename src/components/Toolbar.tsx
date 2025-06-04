import { useConfigStore, ModuleType } from '../store';

export function Toolbar({ className = '' }: { className?: string }) {
  const selected = useConfigStore((s) => s.selectedType);
  const selectType = useConfigStore((s) => s.selectType);
  const types: ModuleType[] = ['wall', 'window', 'roof', 'floor'];

  return (
    <div className={`bg-white p-2 rounded shadow flex gap-2 ${className}`}>
      {types.map((type) => (
        <button
          key={type}
          onClick={() => selectType(type)}
          className={`px-2 py-1 rounded ${selected === type ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          {type}
        </button>
      ))}
    </div>
  );
}
