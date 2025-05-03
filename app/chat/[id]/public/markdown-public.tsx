'use client';

import Link from 'next/link';
import { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Componente de bloco de código simplificado
function SimpleCodeBlock({
  node,
  inline,
  className,
  children,
  ...props
}: {
  node: any;
  inline: boolean;
  className: string;
  children: any;
}) {
  if (!inline) {
    return (
      <div className="my-3">
        <pre
          {...props}
          className="text-sm w-full overflow-x-auto bg-gray-100 p-4 border border-gray-200 rounded-lg"
        >
          <code className="whitespace-pre-wrap break-words">{children}</code>
        </pre>
      </div>
    );
  } else {
    return (
      <code
        className="text-sm bg-gray-100 py-0.5 px-1 rounded"
        {...props}
      >
        {children}
      </code>
    );
  }
}

// Componentes personalizados para o Markdown
const components: Partial<Components> = {
  // @ts-expect-error
  code: SimpleCodeBlock,
  pre: ({ children }) => <>{children}</>,
  ol: ({ children, ...props }) => (
    <ol className="list-decimal list-outside ml-4 my-3" {...props}>
      {children}
    </ol>
  ),
  ul: ({ children, ...props }) => (
    <ul className="list-disc list-outside ml-4 my-3" {...props}>
      {children}
    </ul>
  ),
  li: ({ children, ...props }) => (
    <li className="py-1" {...props}>
      {children}
    </li>
  ),
  p: ({ children, ...props }) => (
    <p className="my-2" {...props}>
      {children}
    </p>
  ),
  strong: ({ children, ...props }) => (
    <span className="font-semibold" {...props}>
      {children}
    </span>
  ),
  a: ({ children, ...props }) => (
    // @ts-expect-error
    <Link
      className="text-blue-600 hover:underline"
      target="_blank"
      rel="noreferrer"
      {...props}
    >
      {children}
    </Link>
  ),
  h1: ({ children, ...props }) => (
    <h1 className="text-2xl font-semibold mt-4 mb-2" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-xl font-semibold mt-4 mb-2" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-lg font-semibold mt-3 mb-2" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="text-base font-semibold mt-3 mb-2" {...props}>
      {children}
    </h4>
  ),
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto my-4">
      <table className="min-w-full border border-gray-200" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-gray-50" {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }) => (
    <th className="px-3 py-2 text-left text-sm font-semibold border-b" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="px-3 py-2 text-sm border-b border-gray-200" {...props}>
      {children}
    </td>
  ),
};

// Plugins de Markdown
const remarkPlugins = [remarkGfm];

// Componente de Markdown não memorizado
function NonMemoizedPublicMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
      {children}
    </ReactMarkdown>
  );
}

// Componente Markdown memorizado (otimizado para rerenderizações)
export const PublicMarkdown = memo(
  NonMemoizedPublicMarkdown,
  (prevProps, nextProps) => prevProps.children === nextProps.children
); 