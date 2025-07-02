/**
 * Type definitions for modules without @types packages
 */

// React Error Boundary
declare module 'react-error-boundary' {
  import { Component, ReactNode, ComponentType } from 'react';

  export interface ErrorBoundaryProps {
    children: ReactNode;
    FallbackComponent?: ComponentType<ErrorBoundaryPropsWithFallback>;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: { componentStack: string }) => void;
    onReset?: () => void;
    resetOnPropsChange?: boolean;
    resetKeys?: Array<string | number>;
  }

  export interface ErrorBoundaryPropsWithFallback {
    error: Error;
    resetErrorBoundary: () => void;
  }

  export class ErrorBoundary extends Component<ErrorBoundaryProps> {}
  export function withErrorBoundary<P>(
    component: ComponentType<P>,
    errorBoundaryProps: ErrorBoundaryProps
  ): ComponentType<P>;
  export function useErrorHandler(): (error: Error) => void;
}

// React Diff Viewer
declare module 'react-diff-viewer-continued' {
  import { ComponentType } from 'react';

  export interface DiffViewerProps {
    oldValue: string;
    newValue: string;
    splitView?: boolean;
    disableWordDiff?: boolean;
    compareMethod?: 'diffChars' | 'diffWords' | 'diffWordsWithSpace' | 'diffLines' | 'diffTrimmedLines' | 'diffSentences';
    hideLineNumbers?: boolean;
    showDiffOnly?: boolean;
    extraLinesSurroundingDiff?: number;
    codeFoldMessageRenderer?: (
      totalFoldedLines: number,
      leftStartLineNumber: number,
      rightStartLineNumber: number
    ) => ReactNode;
    onLineNumberClick?: (
      lineId: string,
      event: React.MouseEvent<HTMLTableCellElement>
    ) => void;
    styles?: any;
    useDarkTheme?: boolean;
    leftTitle?: string;
    rightTitle?: string;
  }

  const DiffViewer: ComponentType<DiffViewerProps>;
  export default DiffViewer;
}

// Next.js Router (if missing specific types)
declare module 'next/router' {
  export interface NextRouter {
    asPath: string;
    back(): void;
    beforePopState(cb: (state: any) => boolean): void;
    forward(): void;
    prefetch(url: string, asPath?: string, options?: object): Promise<void>;
    push(url: string, as?: string, options?: object): Promise<boolean>;
    reload(): void;
    replace(url: string, as?: string, options?: object): Promise<boolean>;
    route: string;
    pathname: string;
    query: { [key: string]: string | string[] };
    basePath: string;
    isFallback: boolean;
    isLocaleDomain: boolean;
    isReady: boolean;
    defaultLocale?: string;
    domainLocales?: Array<{
      domain: string;
      defaultLocale: string;
      locales?: string[];
    }>;
    locale?: string;
    locales?: string[];
    isPreview: boolean;
    events: {
      on(type: string, handler: (...args: any[]) => void): void;
      off(type: string, handler: (...args: any[]) => void): void;
      emit(type: string, ...args: any[]): void;
    };
  }

  export function useRouter(): NextRouter;
  export default NextRouter;
}

// Service Worker types
declare module 'workbox-window' {
  export class Workbox {
    constructor(scriptURL: string, registerOptions?: RegistrationOptions);
    register(options?: RegistrationOptions): Promise<ServiceWorkerRegistration | undefined>;
    update(): Promise<ServiceWorkerRegistration | undefined>;
    addEventListener(type: string, listener: (event: any) => void): void;
    removeEventListener(type: string, listener: (event: any) => void): void;
    messageSkipWaiting(): void;
    messageSW(data: any): Promise<any>;
    getSW(): Promise<ServiceWorker | undefined>;
  }

  export interface RegistrationOptions {
    immediate?: boolean;
    scope?: string;
    type?: 'classic' | 'module';
    updateViaCache?: 'imports' | 'all' | 'none';
  }
}

// IndexedDB Promised (if using)
declare module 'idb' {
  export interface IDBPDatabase<DBTypes = unknown> extends Omit<IDBDatabase, 'transaction'> {
    transaction<Name extends string>(
      storeNames: Name | Name[],
      mode?: IDBTransactionMode,
      options?: IDBTransactionOptions
    ): IDBPTransaction<DBTypes, Name[]>;
  }

  export interface IDBPTransaction<DBTypes = unknown, TxStores extends string[] = string[]> 
    extends Omit<IDBTransaction, 'objectStore'> {
    objectStore<Name extends TxStores[number]>(name: Name): IDBPObjectStore<DBTypes, TxStores, Name>;
    store: TxStores extends [infer Name] ? Name extends string ? IDBPObjectStore<DBTypes, TxStores, Name> : never : never;
  }

  export interface IDBPObjectStore<DBTypes = unknown, TxStores extends string[] = string[], StoreName extends string = string>
    extends Omit<IDBObjectStore, 'add' | 'clear' | 'count' | 'delete' | 'get' | 'getAll' | 'getAllKeys' | 'getKey' | 'put'> {
    add(value: any, key?: IDBValidKey): Promise<IDBValidKey>;
    clear(): Promise<void>;
    count(query?: IDBValidKey | IDBKeyRange): Promise<number>;
    delete(query: IDBValidKey | IDBKeyRange): Promise<void>;
    get(query: IDBValidKey | IDBKeyRange): Promise<any>;
    getAll(query?: IDBValidKey | IDBKeyRange, count?: number): Promise<any[]>;
    getAllKeys(query?: IDBValidKey | IDBKeyRange, count?: number): Promise<IDBValidKey[]>;
    getKey(query: IDBValidKey | IDBKeyRange): Promise<IDBValidKey | undefined>;
    put(value: any, key?: IDBValidKey): Promise<IDBValidKey>;
  }

  export function openDB<DBTypes = unknown>(
    name: string,
    version?: number,
    options?: {
      upgrade?: (db: IDBPDatabase<DBTypes>, oldVersion: number, newVersion: number | null, transaction: IDBPTransaction<DBTypes>) => void;
      blocked?: (currentVersion: number, blockedVersion: number | null, event: IDBVersionChangeEvent) => void;
      blocking?: (currentVersion: number, blockedVersion: number | null, event: IDBVersionChangeEvent) => void;
      terminated?: () => void;
    }
  ): Promise<IDBPDatabase<DBTypes>>;
}

// Crypto-JS (if not properly typed)
declare module 'crypto-js' {
  export interface CipherParams {
    ciphertext: any;
    key?: any;
    iv?: any;
    algorithm?: any;
    mode?: any;
    padding?: any;
    blockSize?: number;
    formatter?: any;
  }

  export interface WordArray {
    words: number[];
    sigBytes: number;
    toString(encoder?: any): string;
  }

  export namespace AES {
    function encrypt(message: string | WordArray, secretPassphrase: string | WordArray, option?: any): CipherParams;
    function decrypt(encryptedMessage: CipherParams | string, secretPassphrase: string | WordArray, option?: any): WordArray;
  }

  export namespace enc {
    const Utf8: {
      stringify(wordArray: WordArray): string;
      parse(str: string): WordArray;
    };
    const Base64: {
      stringify(wordArray: WordArray): string;
      parse(str: string): WordArray;
    };
  }

  export namespace lib {
    const WordArray: {
      create(words?: number[], sigBytes?: number): WordArray;
      random(nBytes: number): WordArray;
    };
  }
}

// Mock service worker types for testing
declare global {
  interface ServiceWorkerGlobalScope {
    skipWaiting(): Promise<void>;
    clients: Clients;
    registration: ServiceWorkerRegistration;
    addEventListener(type: string, listener: (event: any) => void): void;
    removeEventListener(type: string, listener: (event: any) => void): void;
  }
}