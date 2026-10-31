// 028-details-drawer (FR-002): linear navigation history of the details drawer, pure and capped.
export const HISTORY_MAX = 20;

export interface DrawerState {
  current: string;
  history: string[];
}

export function open(id: string): DrawerState {
  return { current: id, history: [] };
}

export function navigate(state: DrawerState, id: string): DrawerState {
  if (id === state.current) return state;
  const history = [...state.history, state.current];
  return { current: id, history: history.length > HISTORY_MAX ? history.slice(history.length - HISTORY_MAX) : history };
}

export function back(state: DrawerState): DrawerState {
  if (state.history.length === 0) return state;
  return { current: state.history[state.history.length - 1], history: state.history.slice(0, -1) };
}
