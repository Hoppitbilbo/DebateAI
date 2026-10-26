import { createElement, type ComponentType, type FunctionComponent } from "react";

// Code-split pages that can be loaded ahead of time. React.lazy suspends on
// its first render even when the code is already there, which shows the page
// spinner in the middle of a transition; a preloaded lazyPage renders at once.

type Loader<P> = () => Promise<{ default: ComponentType<P> }>;

export type LazyPage<P> = FunctionComponent<P> & { preload: () => Promise<unknown> };

const byPath = new Map<string, () => Promise<unknown>>();

/** A page loaded on first use; `paths` lets links preload it before navigating. */
export const lazyPage = <P extends object>(load: Loader<P>, paths: string[] = []): LazyPage<P> => {
  let Loaded: ComponentType<P> | null = null;
  let loading: Promise<unknown> | null = null;
  const preload = () =>
    (loading ??= load().then(
      (m) => (Loaded = m.default),
      (e) => {
        loading = null; // a failed download (e.g. offline) can be tried again
        throw e;
      },
    ));
  const Page = ((props: P) => {
    if (Loaded) return createElement(Loaded, props);
    throw preload(); // Suspense shows the fallback until the code arrives
  }) as LazyPage<P>;
  Page.preload = preload;
  for (const p of paths) byPath.set(p, preload);
  return Page;
};

/** Downloads the page of a path, if it is a lazy page; never rejects. */
export const preloadPath = (path: string): Promise<unknown> => {
  const clean = path.split(/[?#]/)[0];
  const preload = byPath.get(clean);
  return preload ? preload().catch(() => undefined) : Promise.resolve();
};

/** All the registered pages under a prefix (e.g. "/apps/"). */
export const preloadPrefix = (prefix: string) =>
  Promise.all([...byPath.keys()].filter((p) => p.startsWith(prefix)).map(preloadPath));
