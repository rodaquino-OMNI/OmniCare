import React from 'react';
import { act } from '@testing-library/react';

// Simplified type definitions that match real zustand
type StateCreator<T> = (
  setState: (partial: T | Partial<T> | ((state: T) => T | Partial<T>)) => void,
  getState: () => T,
  api: any
) => T;

type UseStore<T> = (() => T) & {
  getState: () => T;
  setState: (partial: T | Partial<T> | ((state: T) => T | Partial<T>)) => void;
  subscribe: (listener: (state: T, prevState: T) => void) => () => void;
  destroy: () => void;
};

// Create the main zustand function - supports both direct usage and curried usage
const create = <T>(stateCreator?: StateCreator<T>): any => {
  // If stateCreator is provided, use direct pattern
  if (stateCreator) {
    return createUseStore(stateCreator);
  }
  
  // If no stateCreator, return function for curried pattern create<T>()(middleware)
  return (stateCreatorOrMiddleware: StateCreator<T>) => {
    return createUseStore(stateCreatorOrMiddleware);
  };
};

// Helper function to create the actual store
const createUseStore = <T>(stateCreator: StateCreator<T>): UseStore<T> => {
  let state: T;
  let listeners = new Set<(state: T, prevState: T) => void>();

  const setState = (partial: T | Partial<T> | ((state: T) => T | Partial<T>)) => {
    const prevState = state;
    const nextState = typeof partial === 'function' 
      ? (partial as (state: T) => T | Partial<T>)(state)
      : partial;
    
    state = typeof nextState === 'object' && !Array.isArray(nextState)
      ? { ...state, ...nextState }
      : nextState as T;

    // Wrap in act for React updates
    act(() => {
      listeners.forEach(listener => listener(state, prevState));
    });
  };

  const getState = () => state;

  const subscribe = (listener: (state: T, prevState: T) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const destroy = () => {
    listeners.clear();
  };

  // Initialize state
  state = stateCreator(setState, getState, {});

  const useStore = (() => state) as UseStore<T>;
  useStore.getState = getState;
  useStore.setState = setState;
  useStore.subscribe = subscribe;
  useStore.destroy = destroy;

  return useStore;
};

// Default export (main function)
export default create;

// Named exports for various zustand utilities
export { create };

// Simplified middleware functions to avoid complex type issues
export const persist = <T>(stateCreator: StateCreator<T>): StateCreator<T> => {
  return (set, get, api) => {
    return stateCreator(set, get, api);
  };
};

export const devtools = <T>(stateCreator: StateCreator<T>): StateCreator<T> => {
  return (set, get, api) => {
    return stateCreator(set, get, api);
  };
};

export const immer = <T>(stateCreator: StateCreator<T>): StateCreator<T> => {
  return (set, get, api) => {
    return stateCreator(set, get, api);
  };
};

// Simplified subscribeWithSelector - removed complex type parameters
export const subscribeWithSelector = <T>(stateCreator: StateCreator<T>): StateCreator<T> => {
  return (set, get, api) => {
    const state = stateCreator(set, get, api);
    return state;
  };
};

// Additional commonly used middleware with simplified types
export const createJSONStorage = () => ({
  getItem: jest.fn().mockReturnValue(null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
});

// Temporal utilities - simplified
export const temporal = <T>(stateCreator: StateCreator<T>) => {
  return (set: any, get: any, api: any) => {
    const baseState = stateCreator(set, get, api);
    return {
      ...baseState,
      undo: jest.fn(),
      redo: jest.fn(),
      clear: jest.fn(),
      canUndo: false,
      canRedo: false,
      futureStates: [],
      pastStates: [],
    };
  };
};

// Redux-like utilities
export const redux = <T>(reducer: any, initialState: T) => {
  return (set: any, get: any, api: any) => {
    return {
      ...initialState,
      dispatch: jest.fn((action) => {
        const currentState = get();
        const newState = reducer(currentState, action);
        set(newState);
      }),
    };
  };
};

// Combine stores utility
export const combine = <T, U>(
  initialState: T,
  actions: (set: any, get: any) => U
): StateCreator<T & U> => {
  return (set, get, api) => {
    const actionCreators = actions(set, get);
    return {
      ...initialState,
      ...actionCreators,
    };
  };
};

// Storage utilities for persist middleware
export const createStorage = () => createJSONStorage();

// Shallow equality function
export const shallow = (a: any, b: any): boolean => {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || !Object.is(a[key], b[key])) {
      return false;
    }
  }
  
  return true;
};

// Storage interface for testing
export interface StateStorage {
  getItem: (name: string) => string | null | Promise<string | null>;
  setItem: (name: string, value: string) => void | Promise<void>;
  removeItem: (name: string) => void | Promise<void>;
}