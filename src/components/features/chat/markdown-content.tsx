import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed break-words space-y-2">
      <ReactMarkdown
        components={{
          h1: ({ children }: { children?: ReactNode }) => (
            <h1 className="mt-3 mb-1.5 font-bold text-lg">{children}</h1>
          ),
          h2: ({ children }: { children?: ReactNode }) => (
            <h2 className="mt-2.5 mb-1 font-semibold text-base">{children}</h2>
          ),
          h3: ({ children }: { children?: ReactNode }) => (
            <h3 className="mt-2 mb-1 font-semibold text-sm">{children}</h3>
          ),
          p: ({ children }: { children?: ReactNode }) => (
            <p className="my-1 leading-relaxed">{children}</p>
          ),
          ul: ({ children }: { children?: ReactNode }) => (
            <ul className="my-1.5 list-disc space-y-0.5 pl-5 text-sm">
              {children}
            </ul>
          ),
          ol: ({ children }: { children?: ReactNode }) => (
            <ol className="my-1.5 list-decimal space-y-0.5 pl-5 text-sm">
              {children}
            </ol>
          ),
          li: ({ children }: { children?: ReactNode }) => (
            <li className="leading-normal">{children}</li>
          ),
          strong: ({ children }: { children?: ReactNode }) => (
            <strong className="font-semibold text-foreground">
              {children}
            </strong>
          ),
          code: ({
            children,
            className,
          }: {
            children?: ReactNode;
            className?: string;
          }) => {
            const isInline = !className?.includes("language-");
            if (isInline) {
              return (
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.8rem] text-foreground">
                  {children}
                </code>
              );
            }
            return (
              <pre className="my-2 overflow-x-auto rounded-lg bg-muted p-2.5 font-mono text-xs text-foreground">
                <code>{children}</code>
              </pre>
            );
          },
          blockquote: ({ children }: { children?: ReactNode }) => (
            <blockquote className="my-2 border-primary/50 border-l-2 pl-3 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
