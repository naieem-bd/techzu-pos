import type { Express } from 'express';

/**
 * Lists every route of an Express 4 app as "METHOD /path/{param}" (OpenAPI path syntax), by
 * walking the router stack. Express 4 keeps route paths as strings but mount paths
 * (`router.use('/x/:id', sub)`) only as compiled regexps, so those are decoded back. Anything the
 * decoder doesn't recognise throws instead of being skipped, so a route can't silently escape
 * the docs-coverage test.
 */

interface Key {
  name: string;
}

interface RouteInfo {
  path: unknown;
  methods: Record<string, boolean>;
}

interface Layer {
  name: string;
  regexp: RegExp & { fast_slash?: boolean };
  keys: Key[];
  route?: RouteInfo;
  handle: unknown;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isLayer = (value: unknown): value is Layer =>
  isObject(value) &&
  typeof value.name === 'string' &&
  value.regexp instanceof RegExp &&
  Array.isArray(value.keys);

const stackOf = (handle: unknown): Layer[] => {
  if (!(typeof handle === 'function' || isObject(handle)) || !('stack' in handle)) {
    throw new Error('Router layer has no stack');
  }
  const { stack } = handle as { stack: unknown };
  if (!Array.isArray(stack) || !stack.every(isLayer)) {
    throw new Error('Unrecognised router stack shape (Express internals changed?)');
  }
  return stack;
};

// path-to-regexp 0.1.x (Express 4), non-strict, end: false:
//   router.use('/outlets/:outletId/x', ...)  ->  ^\/outlets(?:\/([^/]+?))\/x\/?(?=\/|$)
const MOUNT_SUFFIX = '\\/?(?=\\/|$)';
// One param segment; the "/" sits inside the group. `[^/]` may also be written `[^\/]`.
const PARAM_GROUP = /\(\?:\\\/\(\[\^\\?\/\]\+\?\)\)/;

/** "/outlets/:outletId" from a mount layer's regexp; "" for a pathless `router.use(sub)`. */
export const decodeMountPath = (layer: Layer): string => {
  if (layer.regexp.fast_slash === true) return '';

  let source = layer.regexp.source;
  if (!source.startsWith('^') || !source.endsWith(MOUNT_SUFFIX)) {
    throw new Error(`Cannot decode mount regexp ${String(layer.regexp)}`);
  }
  source = source.slice(1, -MOUNT_SUFFIX.length);

  const keys = [...layer.keys];
  source = source.split(PARAM_GROUP).reduce((acc, part, index) => {
    if (index === 0) return part;
    const key = keys.shift();
    if (!key) throw new Error(`More params than keys in ${String(layer.regexp)}`);
    return `${acc}/:${key.name}${part}`;
  });
  if (keys.length > 0) throw new Error(`Unused keys in ${String(layer.regexp)}`);

  // Only escaped literal characters may remain; any other regex syntax means "unknown pattern".
  const unescaped = source.replace(/\\(.)/g, '$1');
  if (/[()[\]*+?^$|]/.test(source.replace(/\\./g, ''))) {
    throw new Error(`Unsupported pattern in mount regexp ${String(layer.regexp)}`);
  }
  return unescaped;
};

/** Express ":param" -> OpenAPI "{param}". */
export const toOpenApiPath = (expressPath: string): string =>
  expressPath.replace(/:([A-Za-z0-9_]+)/g, '{$1}');

const walk = (stack: Layer[], prefix: string, out: string[]): void => {
  for (const layer of stack) {
    if (layer.route) {
      const { path, methods } = layer.route;
      if (typeof path !== 'string') throw new Error(`Non-string route path under ${prefix}`);
      const full = `${prefix}${path === '/' ? '' : path}` || '/';
      for (const [method, enabled] of Object.entries(methods)) {
        if (enabled && method !== '_all') {
          out.push(`${method.toUpperCase()} ${toOpenApiPath(full)}`);
        }
      }
      continue;
    }
    if (layer.name === 'router') {
      walk(stackOf(layer.handle), `${prefix}${decodeMountPath(layer)}`, out);
    }
    // Any other layer is plain middleware (helmet, cors, logger, rate limit...): not a route.
  }
};

/** Every "METHOD /path" the app serves, sorted. */
export const listRoutes = (app: Express): string[] => {
  const router: unknown = (app as unknown as { _router?: unknown })._router;
  const out: string[] = [];
  walk(stackOf(router), '', out);
  return out.sort();
};
