/// <reference types="node" />
/// <reference types="react" />
/// <reference types="react-dom" />

declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: typeof compose;
  }
}

// Extend the global worker types
declare global {
  interface ServiceWorkerGlobalScope {
    __WB_MANIFEST: (string | PrecacheEntry)[];
  }
}

// Add missing Workbox types
declare module 'workbox-window' {
  interface Workbox {
    register(options?: RegistrationOptions): Promise<ServiceWorkerRegistration>;
    update(): Promise<void>;
    active: ServiceWorker | null;
    controlling: ServiceWorker | null;
    addEventListener(type: 'waiting', listener: (event: any) => void): void;
    addEventListener(type: 'controlling', listener: (event: any) => void): void;
    addEventListener(type: 'activated', listener: (event: any) => void): void;
    addEventListener(type: 'redundant', listener: (event: any) => void): void;
    addEventListener(type: 'message', listener: (event: any) => void): void;
    removeEventListener(type: string, listener: (event: any) => void): void;
    messageSW(data: any): Promise<any>;
    getSW(): Promise<ServiceWorker>;
  }
  
  interface PrecacheEntry {
    url: string;
    revision?: string;
  }
}

export {};