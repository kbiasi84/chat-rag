import Link from 'next/link';
import React, { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './code-block';

// Função para limpar textos de debug e metadados
const cleanMarkdownText = (text: string): string => {
  if (!text) return '';

  // Remover objeto JSON no início (como `{"query": "texto", "keywords": []}`)
  let cleaned = text.replace(/^\s*{[\s\S]*?}\s*/m, '');

  // Remover texto inicial de "Informações relevantes encontradas na base"
  cleaned = cleaned.replace(
    /^"?(?:<!--)?[\s\n]*Informações relevantes encontradas na base de conhecimento[\s\S]*?(?:-->)?[\s\n]*/m,
    '',
  );

  // Remover outros comentários HTML
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/gm, '');

  // Remover textos de instrução como "Lembre-se de citar os artigos"
  cleaned = cleaned.replace(
    /\n\nLembre-se de citar(?:[\s\S]*?)sua resposta\.?$/m,
    '',
  );

  // Remover os blocos de trechos completos com formato de cabeçalho e conteúdo
  cleaned = cleaned.replace(/---\nTrecho #\d+[\s\S]*?---\n/g, '');

  // Remover seções de referências legais identificadas
  cleaned = cleaned.replace(
    /\n\nReferências Legais Identificadas[\s\S]*?(?:\n\n|$)/m,
    '',
  );

  // Se o texto começar com aspas, remove-as
  cleaned = cleaned.replace(/^"/, '');
  cleaned = cleaned.replace(/"$/, '');

  // Se após a limpeza, o texto começar com "---" (possível início de um trecho), remova até o próximo "---"
  if (cleaned.startsWith('---')) {
    const restAfterFirstSection = cleaned.split('---').slice(2).join('---');
    cleaned = restAfterFirstSection.trim();
  }

  // Remover múltiplas linhas em branco
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
};

const components: Partial<Components> = {
  // @ts-expect-error
  code: CodeBlock,
  pre: ({ children }) => <>{children}</>,
  ol: ({ node, children, ...props }) => {
    return (
      <ol className="list-decimal list-outside ml-4" {...props}>
        {children}
      </ol>
    );
  },
  li: ({ node, children, ...props }) => {
    return (
      <li className="py-1" {...props}>
        {children}
      </li>
    );
  },
  ul: ({ node, children, ...props }) => {
    return (
      <ul className="list-decimal list-outside ml-4" {...props}>
        {children}
      </ul>
    );
  },
  strong: ({ node, children, ...props }) => {
    return (
      <span className="font-semibold" {...props}>
        {children}
      </span>
    );
  },
  a: ({ node, children, ...props }) => {
    return (
      // @ts-expect-error
      <Link
        className="text-blue-500 hover:underline"
        target="_blank"
        rel="noreferrer"
        {...props}
      >
        {children}
      </Link>
    );
  },
  h1: ({ node, children, ...props }) => {
    return (
      <h1 className="text-3xl font-semibold mt-6 mb-2" {...props}>
        {children}
      </h1>
    );
  },
  h2: ({ node, children, ...props }) => {
    return (
      <h2 className="text-2xl font-semibold mt-6 mb-2" {...props}>
        {children}
      </h2>
    );
  },
  h3: ({ node, children, ...props }) => {
    return (
      <h3 className="text-xl font-semibold mt-6 mb-2" {...props}>
        {children}
      </h3>
    );
  },
  h4: ({ node, children, ...props }) => {
    return (
      <h4 className="text-lg font-semibold mt-6 mb-2" {...props}>
        {children}
      </h4>
    );
  },
  h5: ({ node, children, ...props }) => {
    return (
      <h5 className="text-base font-semibold mt-6 mb-2" {...props}>
        {children}
      </h5>
    );
  },
  h6: ({ node, children, ...props }) => {
    return (
      <h6 className="text-sm font-semibold mt-6 mb-2" {...props}>
        {children}
      </h6>
    );
  },
};

const remarkPlugins = [remarkGfm];

const NonMemoizedMarkdown = ({ children }: { children: string }) => {
  // Limpar o texto antes de renderizar
  const cleanedText = cleanMarkdownText(children);

  return (
    <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
      {cleanedText}
    </ReactMarkdown>
  );
};

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);
