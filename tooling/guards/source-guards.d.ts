export interface ScanOptions {
  /** Recurse into subdirectories (default: false, except findAnyInSqlTemplates which defaults true). */
  recursive?: boolean;
}

/** Files reading `request.body` without a Zod `.parse`/`.safeParse` (each with a count). */
export function findUnvalidatedRequestBody(routesDir: string, opts?: ScanOptions): string[];

/** Files that cast `request.body` with `as`. */
export function findRequestBodyCasts(routesDir: string, opts?: ScanOptions): string[];

/** Files using the `sql`… ANY(${…}) …`` idiom that Drizzle can't serialize (use inArray). */
export function findAnyInSqlTemplates(srcDir: string, opts?: ScanOptions): string[];

/** Plugin files that call `addHook` but aren't `fp()`-wrapped (hooks silently won't apply). */
export function findPluginsMissingFp(pluginsDir: string, opts?: ScanOptions): string[];
