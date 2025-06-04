import create from 'zustand';
import * as THREE from 'three';

export type ModuleType = 'wall' | 'window' | 'roof' | 'floor';

export interface Module {
  id: string;
  type: ModuleType;
  position: [number, number, number];
  rotation: [number, number, number];
  price: number;
}

interface HistoryState {
  modules: Module[];
}

interface ConfigStore {
  modules: Module[];
  history: HistoryState[];
  future: HistoryState[];
  selectedType: ModuleType;
  selectedId: string | null;
  ghost: Module | null;
  scene: THREE.Scene | null;
  selectType: (type: ModuleType) => void;
  selectModule: (id: string | null) => void;
  setGhost: (module: Module | null) => void;
  setScene: (scene: THREE.Scene) => void;
  addModule: (module: Module) => void;
  updateModule: (id: string, partial: Partial<Module>) => void;
  removeModule: (id: string) => void;
  undo: () => void;
  redo: () => void;
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
  modules: [],
  history: [],
  future: [],
  selectedType: 'wall',
  selectedId: null,
  ghost: null,
  scene: null,
  selectType: (type) => set({ selectedType: type }),
  selectModule: (id) => set({ selectedId: id }),
  setGhost: (ghost) => set({ ghost }),
  setScene: (scene) => set({ scene }),
  addModule: (module) => set((state) => ({
    modules: [...state.modules, module],
    history: [...state.history, { modules: state.modules }],
    future: [],
  })),
  updateModule: (id, partial) => set((state) => ({
    modules: state.modules.map((m) => m.id === id ? { ...m, ...partial } : m),
  })),
  removeModule: (id) => set((state) => ({
    modules: state.modules.filter((m) => m.id !== id),
    history: [...state.history, { modules: state.modules }],
    future: [],
  })),
  undo: () => set((state) => {
    const prev = state.history[state.history.length - 1];
    if (!prev) return state;
    const newHistory = state.history.slice(0, -1);
    return {
      modules: prev.modules,
      history: newHistory,
      future: [{ modules: state.modules }, ...state.future],
    };
  }),
  redo: () => set((state) => {
    const next = state.future[0];
    if (!next) return state;
    const newFuture = state.future.slice(1);
    return {
      modules: next.modules,
      history: [...state.history, { modules: state.modules }],
      future: newFuture,
    };
  }),
}));
