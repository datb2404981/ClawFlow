/**
 * Markdown trong luồng chat — chỉ dùng biến CSS theme (không lẫn trắng/đen).
 * Code: JetBrains Mono (đã load qua Google Fonts trong index.html).
 */
import type { Components } from 'react-markdown'

const jb = "font-['JetBrains_Mono',ui-monospace,monospace]"

export const TASK_CHAT_MD_COMPONENTS: Components = {
  p: ({ children }) => (
    <p
      className="mb-4 text-[0.9375rem] leading-[1.75] sm:text-[1rem] sm:leading-[1.8]"
      style={{ color: 'var(--cf-chat-prose)' }}
    >
      {children}
    </p>
  ),
  h1: ({ children }) => (
    <h1
      className="mb-4 mt-10 border-b pb-2 text-2xl font-semibold tracking-tight first:mt-0 sm:text-[1.65rem]"
      style={{
        color: 'var(--cf-chat-heading)',
        borderColor: 'var(--cf-chat-divider)',
      }}
    >
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2
      className="mb-3 mt-9 text-xl font-semibold tracking-tight first:mt-0 sm:text-[1.35rem]"
      style={{ color: 'var(--cf-chat-heading)' }}
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      className="mb-2.5 mt-7 text-lg font-semibold first:mt-0 sm:text-[1.2rem]"
      style={{ color: 'var(--cf-chat-heading)' }}
    >
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4
      className="mb-2 mt-5 text-base font-semibold sm:text-[1.05rem]"
      style={{ color: 'var(--cf-chat-heading)' }}
    >
      {children}
    </h4>
  ),
  ul: ({ children }) => (
    <ul
      className="mb-4 list-outside list-disc space-y-2 pl-5 text-[1.0625rem] leading-[1.75] sm:text-[1.125rem]"
      style={{ color: 'var(--cf-chat-prose)' }}
    >
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol
      className="mb-4 list-outside list-decimal space-y-2 pl-5 text-[1.0625rem] leading-[1.75] sm:text-[1.125rem]"
      style={{ color: 'var(--cf-chat-prose)' }}
    >
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  hr: () => (
    <hr className="my-6 border-0 border-t" style={{ borderColor: 'var(--cf-chat-divider)' }} />
  ),
  strong: ({ children }) => (
    <strong className="font-semibold" style={{ color: 'var(--cf-chat-heading)' }}>
      {children}
    </strong>
  ),
  em: ({ children }) => (
    <em className="italic" style={{ color: 'var(--cf-chat-prose)' }}>
      {children}
    </em>
  ),
  blockquote: ({ children }) => (
    <blockquote
      className="my-4 border-l-[3px] py-2.5 pl-4 pr-3 text-[1.0625rem] leading-[1.75] sm:text-[1.125rem]"
      style={{
        borderColor: 'var(--cf-chat-blockquote-border)',
        background: 'var(--cf-chat-blockquote-bg)',
        color: 'var(--cf-chat-prose)',
      }}
    >
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="font-medium underline underline-offset-2 transition-opacity hover:opacity-90"
      style={{ color: 'var(--cf-electric)' }}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div
      className="my-4 max-w-full overflow-x-auto rounded-xl border shadow-sm [-webkit-overflow-scrolling:touch]"
      style={{
        borderColor: 'var(--cf-chat-divider)',
        background: 'var(--cf-chat-shell)',
      }}
    >
      <table
        className={`w-full min-w-0 max-w-full border-collapse text-left text-[0.875rem] sm:min-w-[16rem] sm:text-[1rem] ${jb}`}
        style={{ color: 'var(--cf-chat-prose)' }}
      >
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b" style={{ borderColor: 'var(--cf-chat-divider)', background: 'var(--cf-chat-code-bg)' }}>
      {children}
    </thead>
  ),
  tbody: ({ children }) => <tbody className="divide-y" style={{ borderColor: 'var(--cf-chat-divider)' }}>{children}</tbody>,
  tr: ({ children }) => <tr className="transition-colors">{children}</tr>,
  th: ({ children }) => (
    <th className="border-b px-3 py-2.5 font-semibold" style={{ borderColor: 'var(--cf-chat-divider)', color: 'var(--cf-chat-heading)' }}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2.5 align-top" style={{ color: 'var(--cf-chat-muted)' }}>
      {children}
    </td>
  ),
  pre: ({ children }) => (
    <pre
      className={`my-5 max-w-full overflow-x-auto rounded-xl border p-3 text-[0.875rem] leading-relaxed shadow-inner sm:p-5 sm:text-[1rem] [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit [&>code]:shadow-none ${jb}`}
      style={{
        borderColor: 'var(--cf-chat-pre-border)',
        background: 'var(--cf-chat-code-bg)',
        color: 'var(--cf-chat-code-fg)',
      }}
    >
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    const cls = className || ''
    if (cls.includes('language-')) {
      return (
        <code className={`${jb} text-[0.9375rem] sm:text-[1rem] ${cls}`} style={{ color: 'var(--cf-chat-code-fg)' }}>
          {children}
        </code>
      )
    }
    const text = String(children)
    if (text.includes('\n')) {
      return (
        <code
          className={`block w-full whitespace-pre-wrap break-words text-[0.9375rem] sm:text-[1rem] ${jb}`}
          style={{ color: 'var(--cf-chat-code-fg)' }}
        >
          {children}
        </code>
      )
    }
    return (
      <code
        className={`rounded-md px-1.5 py-0.5 text-[0.9em] ${jb}`}
        style={{
          background: 'var(--cf-chat-code-inline-bg)',
          color: 'var(--cf-chat-code-inline-fg)',
        }}
      >
        {children}
      </code>
    )
  },
}
