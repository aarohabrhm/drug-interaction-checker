import { useEffect } from 'react';

/**
 * Set the document title and meta description for a page.
 *
 * Replaces `next/head`, which was imported into this Vite SPA from two pages.
 * Outside a Next.js app that component renders nothing, so neither the titles
 * nor the descriptions were ever applied -- and it pulled the entire `next`
 * package (~100MB installed) in as a dependency to do nothing.
 */
export function useDocumentMeta(title: string, description?: string): void {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    let meta: HTMLMetaElement | null = null;
    let createdMeta = false;

    if (description) {
      meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
        createdMeta = true;
      }
      meta.content = description;
    }

    return () => {
      document.title = previousTitle;
      if (meta && createdMeta) {
        meta.remove();
      }
    };
  }, [title, description]);
}
