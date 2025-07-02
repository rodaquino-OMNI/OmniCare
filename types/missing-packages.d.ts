/**
 * Type definitions for packages that don't have @types packages
 * or have incomplete type definitions
 */

// React Big Calendar types (extending existing incomplete types)
declare module 'react-big-calendar' {
  import { Component, ReactNode } from 'react';

  export interface Event {
    id?: string | number;
    title: string;
    start: Date;
    end: Date;
    allDay?: boolean;
    resource?: any;
    [key: string]: any;
  }

  export interface View {
    name: string;
    title: string;
  }

  export interface CalendarProps {
    localizer: any;
    events: Event[];
    startAccessor?: string | ((event: Event) => Date);
    endAccessor?: string | ((event: Event) => Date);
    titleAccessor?: string | ((event: Event) => string);
    allDayAccessor?: string | ((event: Event) => boolean);
    resourceAccessor?: string | ((event: Event) => any);
    resources?: any[];
    resourceIdAccessor?: string | ((resource: any) => any);
    resourceTitleAccessor?: string | ((resource: any) => string);
    defaultView?: string;
    view?: string;
    views?: string[] | { [key: string]: boolean | Component };
    onView?: (view: string) => void;
    date?: Date;
    defaultDate?: Date;
    onNavigate?: (date: Date, view: string, action: string) => void;
    onSelectEvent?: (event: Event, e: React.SyntheticEvent) => void;
    onSelectSlot?: (slotInfo: {
      start: Date;
      end: Date;
      slots: Date[];
      action: 'select' | 'click' | 'doubleClick';
      bounds?: any;
      box?: any;
    }) => void;
    onDoubleClickEvent?: (event: Event, e: React.SyntheticEvent) => void;
    onKeyPressEvent?: (event: Event, e: React.KeyboardEvent) => void;
    onShowMore?: (events: Event[], date: Date) => void;
    selectable?: boolean | 'ignoreEvents';
    longPressThreshold?: number;
    resizable?: boolean;
    style?: React.CSSProperties;
    className?: string;
    elementProps?: React.HTMLAttributes<HTMLDivElement>;
    popup?: boolean;
    popupOffset?: number | { x: number; y: number };
    components?: {
      event?: Component;
      eventWrapper?: Component;
      dayWrapper?: Component;
      dateCellWrapper?: Component;
      timeSlotWrapper?: Component;
      timeGutterHeader?: Component;
      toolbar?: Component;
      agenda?: {
        event?: Component;
        date?: Component;
        time?: Component;
      };
      day?: {
        header?: Component;
        event?: Component;
      };
      week?: {
        header?: Component;
        event?: Component;
      };
      month?: {
        header?: Component;
        dateHeader?: Component;
        event?: Component;
      };
    };
    formats?: {
      dateFormat?: string | Function;
      dayFormat?: string | Function;
      dayHeaderFormat?: string | Function;
      dayRangeHeaderFormat?: string | Function;
      agendaDateFormat?: string | Function;
      agendaTimeFormat?: string | Function;
      agendaTimeRangeFormat?: string | Function;
      timeGutterFormat?: string | Function;
      monthHeaderFormat?: string | Function;
      weekdayFormat?: string | Function;
      selectRangeFormat?: string | Function;
      eventTimeRangeFormat?: string | Function;
      eventTimeRangeStartFormat?: string | Function;
      eventTimeRangeEndFormat?: string | Function;
    };
    messages?: {
      allDay?: string;
      previous?: string;
      next?: string;
      today?: string;
      month?: string;
      week?: string;
      day?: string;
      agenda?: string;
      date?: string;
      time?: string;
      event?: string;
      noEventsInRange?: string;
      showMore?: (total: number) => string;
    };
    timeslots?: number;
    step?: number;
    range?: number;
    min?: Date;
    max?: Date;
    scrollToTime?: Date;
    culture?: string;
    dayLayoutAlgorithm?: string | Function;
    getDrilldownView?: (targetDate: Date, currentViewName: string, configuredViewNames: string[]) => string | null;
    length?: number;
    toolbar?: boolean;
    doShowMoreDrillDown?: boolean;
  }

  export default class Calendar extends Component<CalendarProps> {}

  export function momentLocalizer(moment: any): any;
  export function dayjsLocalizer(dayjs: any): any;
  export function dateFnsLocalizer(dateFns: {
    format: Function;
    parse: Function;
    startOfWeek: Function;
    getDay: Function;
    locales: any;
  }): any;

  export const Views: {
    MONTH: 'month';
    WEEK: 'week';
    WORK_WEEK: 'work_week';
    DAY: 'day';
    AGENDA: 'agenda';
  };

  export const Navigate: {
    PREVIOUS: 'PREV';
    NEXT: 'NEXT';
    TODAY: 'TODAY';
    DATE: 'DATE';
  };
}

// Artillery load testing types
declare module 'artillery' {
  export interface ArtilleryConfig {
    target: string;
    phases: Array<{
      duration: number;
      arrivalRate?: number;
      rampTo?: number;
      name?: string;
    }>;
  }

  export interface ArtilleryScenario {
    name: string;
    flow: Array<{
      get?: {
        url: string;
        headers?: Record<string, string>;
        json?: any;
        expect?: Array<{
          statusCode?: number;
          contentType?: string;
          hasProperty?: string;
        }>;
      };
      post?: {
        url: string;
        headers?: Record<string, string>;
        json?: any;
        expect?: Array<{
          statusCode?: number;
          contentType?: string;
          hasProperty?: string;
        }>;
      };
      think?: number;
    }>;
  }

  export interface ArtilleryTest {
    config: ArtilleryConfig;
    scenarios: ArtilleryScenario[];
  }
}

// Autocannon types
declare module 'autocannon' {
  export interface AutocannonOptions {
    url: string;
    connections?: number;
    pipelining?: number;
    duration?: number;
    amount?: number;
    timeout?: number;
    method?: string;
    headers?: Record<string, string>;
    body?: string | Buffer;
    bailout?: number;
    debug?: boolean;
    forever?: boolean;
    servername?: string;
    excludeErrorStats?: boolean;
    expectBody?: string;
    setupClient?: (client: any) => void;
  }

  export interface AutocannonResult {
    title: string;
    url: string;
    socketPath: string | null;
    connections: number;
    pipelining: number;
    duration: number;
    samples: number;
    start: Date;
    finish: Date;
    errors: number;
    timeouts: number;
    mismatches: number;
    non2xx: number;
    resets: number;
    requests: {
      average: number;
      mean: number;
      stddev: number;
      min: number;
      max: number;
      total: number;
      p0_001: number;
      p0_01: number;
      p0_1: number;
      p1: number;
      p2_5: number;
      p10: number;
      p25: number;
      p50: number;
      p75: number;
      p90: number;
      p97_5: number;
      p99: number;
      p99_9: number;
      p99_99: number;
      p99_999: number;
    };
    latency: {
      average: number;
      mean: number;
      stddev: number;
      min: number;
      max: number;
      p0_001: number;
      p0_01: number;
      p0_1: number;
      p1: number;
      p2_5: number;
      p10: number;
      p25: number;
      p50: number;
      p75: number;
      p90: number;
      p97_5: number;
      p99: number;
      p99_9: number;
      p99_99: number;
      p99_999: number;
    };
    throughput: {
      average: number;
      mean: number;
      stddev: number;
      min: number;
      max: number;
      total: number;
      p0_001: number;
      p0_01: number;
      p0_1: number;
      p1: number;
      p2_5: number;
      p10: number;
      p25: number;
      p50: number;
      p75: number;
      p90: number;
      p97_5: number;
      p99: number;
      p99_9: number;
      p99_99: number;
      p99_999: number;
    };
  }

  export default function autocannon(options: AutocannonOptions): Promise<AutocannonResult>;
  export default function autocannon(options: AutocannonOptions, callback: (err: Error | null, result: AutocannonResult) => void): void;
}

// Node-cron types
declare module 'node-cron' {
  export interface ScheduleOptions {
    scheduled?: boolean;
    timezone?: string;
    recoverMissedExecutions?: boolean;
  }

  export interface ScheduledTask {
    start(): void;
    stop(): void;
    destroy(): void;
    getStatus(): string;
  }

  export function schedule(cronExpression: string, task: () => void, options?: ScheduleOptions): ScheduledTask;
  export function validate(cronExpression: string): boolean;
  export function getTasks(): Map<string, ScheduledTask>;
}

// TSC-Alias types
declare module 'tsc-alias' {
  export interface TscAliasOptions {
    basePath?: string;
    paths?: Record<string, string[]>;
    outDir?: string;
    verbose?: boolean;
    debug?: boolean;
    replacer?: (importPath: string, outputPath: string, alias: string) => string;
  }

  export function replaceTscAliasPaths(options?: TscAliasOptions): void;
}

// Enzyme to JSON types (if not properly typed)
declare module 'enzyme-to-json' {
  import { ReactWrapper, ShallowWrapper } from 'enzyme';

  export interface Options {
    mode?: 'deep' | 'shallow';
    ignoreProps?: boolean;
    noKey?: boolean;
    map?: (json: any) => any;
  }

  export default function toJson(wrapper: ReactWrapper | ShallowWrapper, options?: Options): any;
  export function createSerializer(options?: Options): any;
}

// PiUsage types
declare module 'pidusage' {
  export interface Stat {
    cpu: number;
    memory: number;
    ppid: number;
    pid: number;
    ctime: number;
    elapsed: number;
    timestamp: number;
  }

  export default function pidusage(pid: number): Promise<Stat>;
  export default function pidusage(pid: number, callback: (err: Error | null, stats: Stat) => void): void;
  export default function pidusage(pids: number[]): Promise<{ [pid: number]: Stat }>;
  export default function pidusage(pids: number[], callback: (err: Error | null, stats: { [pid: number]: Stat }) => void): void;
}

// Fake IndexedDB types
declare module 'fake-indexeddb' {
  export = FDBFactory;
  declare class FDBFactory {
    constructor();
    open(name: string, version?: number): IDBOpenDBRequest;
    deleteDatabase(name: string): IDBOpenDBRequest;
    cmp(first: any, second: any): number;
    databases(): Promise<Array<{ name: string; version: number }>>;
  }
}

declare module 'fake-indexeddb/fdb-key-range' {
  export = FDBKeyRange;
  declare class FDBKeyRange {
    static bound(lower: any, upper: any, lowerOpen?: boolean, upperOpen?: boolean): IDBKeyRange;
    static only(value: any): IDBKeyRange;
    static lowerBound(bound: any, open?: boolean): IDBKeyRange;
    static upperBound(bound: any, open?: boolean): IDBKeyRange;
  }
}

// Testcontainers types (if incomplete)
declare module 'testcontainers' {
  export interface StartedTestContainer {
    stop(): Promise<void>;
    restart(): Promise<void>;
    logs(): Promise<string>;
    exec(command: string[]): Promise<{ output: string; exitCode: number }>;
    copyFilesToContainer(files: Array<{ source: string; target: string }>): Promise<void>;
    copyContentToContainer(content: Array<{ content: string; target: string }>): Promise<void>;
    getHost(): string;
    getMappedPort(port: number): number;
    getId(): string;
    getNetworkNames(): string[];
    getNetworkId(networkName: string): string;
  }

  export class GenericContainer {
    constructor(image: string);
    withExposedPorts(...ports: number[]): this;
    withPortBindings(portBindings: Record<string, string>): this;
    withEnvironment(environment: Record<string, string>): this;
    withCommand(command: string[]): this;
    withName(name: string): this;
    withNetworkMode(networkMode: string): this;
    withNetworkAliases(...networkAliases: string[]): this;
    withTmpFs(tmpFs: Record<string, string>): this;
    withBindMounts(bindMounts: Array<{ source: string; target: string; mode?: string }>): this;
    withWaitStrategy(waitStrategy: any): this;
    withStartupTimeout(startupTimeout: number): this;
    withHealthcheck(healthcheck: {
      test: string | string[];
      interval?: number;
      timeout?: number;
      retries?: number;
      startPeriod?: number;
    }): this;
    start(): Promise<StartedTestContainer>;
  }

  export class PostgreSqlContainer extends GenericContainer {
    constructor(image?: string);
    withDatabase(database: string): this;
    withUsername(username: string): this;
    withPassword(password: string): this;
  }

  export class RedisContainer extends GenericContainer {
    constructor(image?: string);
  }
}

// Additional Express types for better integration
declare module 'express-serve-static-core' {
  interface Request {
    user?: import('../../../types/shared').User;
    session?: any;
    requestId?: string;
    startTime?: number;
  }

  interface Response {
    locals: {
      user?: import('../../../types/shared').User;
      requestId?: string;
      startTime?: number;
      [key: string]: any;
    };
  }
}

export {};