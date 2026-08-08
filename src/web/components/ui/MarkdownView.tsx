import { useEffect, useMemo, useRef } from "react";
import { Marked } from "marked";

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const markdown = new Marked({ gfm: true, breaks: true });
markdown.use({
  renderer: {
    code({ text, lang }) {
      if (lang !== "mermaid") return false;
      return `<pre class="mermaid">${escapeHtml(text)}</pre>`;
    },
  },
});

export function MarkdownView({ content, className = "" }: { content: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasMermaid = useMemo(() => /```mermaid\b/.test(content), [content]);

  const html = useMemo(() => {
    if (!content) return "";
    try {
      return markdown.parse(content, { async: false }) as string;
    } catch {
      return content;
    }
  }, [content]);

  // Renders after the diagram source is in the DOM (dangerouslySetInnerHTML above), and only
  // pulls in the ~500KB mermaid bundle for descriptions/comments that actually use it.
  useEffect(() => {
    if (!hasMermaid || !containerRef.current) return;
    const nodes = containerRef.current.querySelectorAll<HTMLElement>("pre.mermaid");
    if (nodes.length === 0) return;

    let cancelled = false;
    import("mermaid").then(({ default: mermaid }) => {
      if (cancelled) return;
      const isDark = document.documentElement.dataset.theme === "dark";
      mermaid.initialize({ startOnLoad: false, theme: isDark ? "dark" : "neutral" });
      mermaid.run({ nodes: Array.from(nodes) }).catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [html, hasMermaid]);

  return (
    <div
      ref={containerRef}
      className={`prose prose-sm max-w-none text-ink-2 [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-ink-1 [&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink-1 [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-ink-1 [&_p]:mb-2.5 [&_p]:last:mb-0 [&_p]:leading-relaxed [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_a]:font-medium [&_a]:text-brand [&_a]:underline-offset-2 hover:[&_a]:underline [&_code]:rounded [&_code]:border [&_code]:border-line [&_code]:bg-surface [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-micro [&_code]:text-ink-1 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-control [&_pre]:border [&_pre]:border-line [&_pre]:bg-surface [&_pre]:p-3 [&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-ink-3 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
