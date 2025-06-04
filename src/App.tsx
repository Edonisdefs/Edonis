import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { Scene } from './components/Scene';

export default function App() {
  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex-1 relative">
        <Toolbar className="absolute top-2 left-1/2 -translate-x-1/2 z-10" />
        <Scene />
      </div>
    </div>
  );
}
