/**
 * Centralized Logger Utility for Snappd Web
 *
 * Provides structured logging with automatic request ID correlation.
 * Integrates with Next.js middleware and API routes for consistent logging.
 *
 * Features:
 * - Automatic request ID extraction from headers
 * - Structured metadata logging
 * - Environment-aware verbosity (dev vs production)
 * - Type-safe logging methods
 * - Performance timing utilities
 *
 * @example
 * ```typescript
 * import { logger } from '@/lib/logger';
 *
 * export async function GET(request: NextRequest) {
 *   logger.info('Processing screenshot request', request, {
 *     shortId: params.shortId
 *   });
 *
 *   try {
 *     // ... route logic
 *   } catch (error) {
 *     logger.error('Failed to process screenshot', request, { error });
 *   }
 * }
 * ```
 */

import { NextRequest } from 'next/server';

/**
 * Log levels for filtering and categorization
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Structured log entry format
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  requestId?: string;
  message: string;
  metadata?: Record<string, unknown>;
  route?: string;
  method?: string;
  userId?: string;
}

/**
 * Logger configuration options
 */
interface LoggerOptions {
  /** Minimum log level to output (default: INFO in production, DEBUG in development) */
  minLevel?: LogLevel;
  /** Whether to include timestamps (default: true) */
  includeTimestamp?: boolean;
  /** Whether to output as JSON in production (default: true) */
  jsonOutput?: boolean;
}

/**
 * Default logger configuration
 */
const DEFAULT_OPTIONS: Required<LoggerOptions> = {
  minLevel: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  includeTimestamp: true,
  jsonOutput: process.env.NODE_ENV === 'production',
};

/**
 * Log level hierarchy for filtering
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

class Logger {
  private options: Required<LoggerOptions>;

  constructor(options: LoggerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Extract request ID from Next.js request headers
   */
  private getRequestId(request?: NextRequest | Request | null): string | undefined {
    if (!request) return undefined;

    try {
      return request.headers.get('x-request-id') || undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Extract route and method from Next.js request
   */
  private getRouteInfo(request?: NextRequest | Request | null): { route?: string; method?: string } {
    if (!request) return {};

    try {
      const url = new URL(request.url);
      return {
        route: url.pathname,
        method: request.method,
      };
    } catch {
      return {};
    }
  }

  /**
   * Check if a log level should be output based on configuration
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.options.minLevel];
  }

  /**
   * Format and output a log entry
   */
  private log(
    level: LogLevel,
    message: string,
    request?: NextRequest | Request | null,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.shouldLog(level)) return;

    const requestId = this.getRequestId(request);
    const routeInfo = this.getRouteInfo(request);

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(requestId && { requestId }),
      ...routeInfo,
      ...(metadata && { metadata }),
    };

    // Remove undefined fields for cleaner output
    Object.keys(entry).forEach((key) => {
      if (entry[key as keyof LogEntry] === undefined) {
        delete entry[key as keyof LogEntry];
      }
    });

    if (this.options.jsonOutput) {
      // Production: JSON output for log aggregation services
      const output = JSON.stringify(entry);

      switch (level) {
        case LogLevel.ERROR:
          console.error(output);
          break;
        case LogLevel.WARN:
          console.warn(output);
          break;
        default:
          console.log(output);
      }
    } else {
      // Development: Human-readable format
      const requestPrefix = requestId ? `[${requestId}]` : '';
      const levelPrefix = `[${level}]`;
      const routePrefix = routeInfo.method && routeInfo.route
        ? `[${routeInfo.method} ${routeInfo.route}]`
        : '';

      const prefixes = [requestPrefix, levelPrefix, routePrefix].filter(Boolean).join(' ');
      const metadataStr = metadata ? `\n${JSON.stringify(metadata, null, 2)}` : '';

      const output = `${prefixes} ${message}${metadataStr}`;

      switch (level) {
        case LogLevel.ERROR:
          console.error(output);
          break;
        case LogLevel.WARN:
          console.warn(output);
          break;
        case LogLevel.DEBUG:
          console.debug(output);
          break;
        default:
          console.log(output);
      }
    }
  }

  /**
   * Log debug-level message (verbose, development only by default)
   */
  debug(
    message: string,
    request?: NextRequest | Request | null,
    metadata?: Record<string, unknown>
  ): void {
    this.log(LogLevel.DEBUG, message, request, metadata);
  }

  /**
   * Log info-level message (general information)
   */
  info(
    message: string,
    request?: NextRequest | Request | null,
    metadata?: Record<string, unknown>
  ): void {
    this.log(LogLevel.INFO, message, request, metadata);
  }

  /**
   * Log warning-level message (non-critical issues)
   */
  warn(
    message: string,
    request?: NextRequest | Request | null,
    metadata?: Record<string, unknown>
  ): void {
    this.log(LogLevel.WARN, message, request, metadata);
  }

  /**
   * Log error-level message (critical issues)
   */
  error(
    message: string,
    request?: NextRequest | Request | null,
    metadata?: Record<string, unknown>
  ): void {
    this.log(LogLevel.ERROR, message, request, metadata);
  }

  /**
   * Create a timer for measuring operation duration
   *
   * @example
   * ```typescript
   * const timer = logger.startTimer();
   * await someOperation();
   * const duration = timer.end();
   * logger.info('Operation completed', request, { duration });
   * ```
   */
  startTimer(): { end: () => number } {
    const start = Date.now();
    return {
      end: () => Date.now() - start,
    };
  }

  /**
   * Log with custom metadata including timing information
   */
  withTiming<T>(
    fn: () => T | Promise<T>,
    message: string,
    request?: NextRequest | Request | null,
    metadata?: Record<string, unknown>
  ): T | Promise<T> {
    const timer = this.startTimer();
    const result = fn();

    if (result instanceof Promise) {
      return result.then((value) => {
        const duration = timer.end();
        this.info(message, request, { ...metadata, durationMs: duration });
        return value;
      }).catch((error) => {
        const duration = timer.end();
        this.error(message, request, { ...metadata, durationMs: duration, error });
        throw error;
      });
    }

    const duration = timer.end();
    this.info(message, request, { ...metadata, durationMs: duration });
    return result;
  }
}

/**
 * Default logger instance
 *
 * Use this throughout the application for consistent logging.
 */
export const logger = new Logger();

/**
 * Create a custom logger with specific options
 *
 * @example
 * ```typescript
 * const debugLogger = createLogger({ minLevel: LogLevel.DEBUG });
 * ```
 */
export function createLogger(options: LoggerOptions): Logger {
  return new Logger(options);
}
