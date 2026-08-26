import { memo, useEffect, useState } from 'react';
import { createHighlighter, type BundledLanguage, type BundledTheme, type HighlighterGeneric } from 'shiki';
import { classNames } from '~/utils/classNames';
import { createScopedLogger } from '~/utils/logger';

import styles from './CodeBlock.module.scss';

const logger = createScopedLogger('CodeBlock');

/**
 * Every language this block will ever highlight, loaded once and never added to at runtime.
 *
 * The closed list is the point, not a limitation. Shiki's `codeToHtml` fetches a grammar on demand,
 * and some grammars drag in a crowd: `markdown` alone embeds around forty of them, `ruby` included.
 * One failed chunk among those forty rejects the whole call, so the block rendered nothing at all —
 * a code fence that looks like it is still loading, forever. Worse, the browser remembers a module
 * that failed to fetch, so every later block failed instantly without so much as a retry.
 *
 * A fence tagged with anything outside this list is highlighted as plain text. That is a fair trade
 * for a chat that talks about web projects, and it removes the whole class of failure along with a
 * few dozen downloads per block.
 */
const SUPPORTED_LANGUAGES = [
  'bash',
  'css',
  'html',
  'javascript',
  'json',
  'jsx',
  'python',
  'scss',
  'shell',
  'tsx',
  'typescript',
  'yaml',
] as const;

const ALIASES: Record<string, string> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  sh: 'shell',
  zsh: 'shell',
  yml: 'yaml',
  py: 'python',
};

const THEMES = ['light-plus', 'dark-plus'] as const;

type Highlighter = HighlighterGeneric<BundledLanguage, BundledTheme>;

let highlighterPromise: Promise<Highlighter> | undefined;

/**
 * Built on first use rather than at module scope, and deliberately.
 *
 * The other three highlighters in the app are top level `await`s, which is fine for them: they load
 * one grammar each. Here a failure would take the whole module down with it, and this module is on
 * the path every chat message renders through. Failing to a plain block beats failing to no chat.
 */
function getHighlighter(): Promise<Highlighter> {
  if (highlighterPromise) {
    return highlighterPromise;
  }

  const pending: Promise<Highlighter> = createHighlighter({
    langs: [...SUPPORTED_LANGUAGES],
    themes: [...THEMES],
  }).catch((error) => {
    // let the next block try again, instead of caching the failure the way the browser caches a module
    if (highlighterPromise === pending) {
      highlighterPromise = undefined;
    }

    throw error;
  });

  highlighterPromise = pending;

  return pending;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface CodeBlockProps {
  className?: string;
  code: string;
  language?: string;
  theme?: (typeof THEMES)[number];
  disableCopy?: boolean;
}

export const CodeBlock = memo(
  ({ className, code, language = 'plaintext', theme = 'dark-plus', disableCopy = false }: CodeBlockProps) => {
    const [html, setHTML] = useState<string | undefined>(undefined);
    const [copied, setCopied] = useState(false);

    const copyToClipboard = () => {
      if (copied) {
        return;
      }

      navigator.clipboard.writeText(code);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    };

    useEffect(() => {
      let cancelled = false;

      // the plain version is what shows if highlighting is slow, unavailable, or unsupported for this fence
      const plain = `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;

      const requested = ALIASES[language] ?? language;
      const supported = (SUPPORTED_LANGUAGES as readonly string[]).includes(requested);

      if (!supported) {
        setHTML(plain);
        return undefined;
      }

      getHighlighter()
        .then((highlighter) => {
          if (!cancelled) {
            setHTML(highlighter.codeToHtml(code, { lang: requested, theme }));
          }
        })
        .catch((error) => {
          logger.warn(`Could not highlight '${requested}', showing it as plain text`, error);

          if (!cancelled) {
            setHTML(plain);
          }
        });

      return () => {
        cancelled = true;
      };
    }, [code, language, theme]);

    return (
      <div className={classNames('relative group text-left', className)}>
        <div
          className={classNames(
            styles.CopyButtonContainer,
            'bg-transparant absolute top-[10px] right-[10px] rounded-md z-10 text-lg flex items-center justify-center opacity-0 group-hover:opacity-100',
            {
              'rounded-l-0 opacity-100': copied,
            },
          )}
        >
          {!disableCopy && (
            <button
              className={classNames(
                'flex items-center bg-accent-500 p-[6px] justify-center before:bg-white before:rounded-l-md before:text-gray-500 before:border-r before:border-gray-300 rounded-md transition-theme',
                {
                  'before:opacity-0': !copied,
                  'before:opacity-100': copied,
                },
              )}
              title="Copy Code"
              onClick={() => copyToClipboard()}
            >
              <div className="i-ph:clipboard-text-duotone"></div>
            </button>
          )}
        </div>
        <div dangerouslySetInnerHTML={{ __html: html ?? '' }}></div>
      </div>
    );
  },
);
