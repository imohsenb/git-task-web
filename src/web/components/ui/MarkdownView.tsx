import { useEffect, useMemo, useRef } from "react";
import { Marked } from "marked";
import { toast } from "sonner";

// svg-pan-zoom's .d.ts declares `SvgPanZoom` as a global ambient namespace (its
// module export is a bare `export =`, not a named type export) — referencing it
// here doesn't force the ~50KB lib into the eager bundle, only its types; the
// actual module is pulled in lazily via dynamic import() in the effect below.
type SvgPanZoomInstance = SvgPanZoom.Instance;

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const COPY_ICON =
  '<svg class="icon-copy" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const CHECK_ICON =
  '<svg class="icon-check hidden" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

const markdown = new Marked({ gfm: true, breaks: true });
markdown.use({
  renderer: {
    code({ text, lang }) {
      if (lang === "mermaid") return `<pre class="mermaid">${escapeHtml(text)}</pre>`;

      const langToken = (lang ?? "").trim().split(/\s+/)[0] ?? "";
      const langClass = langToken ? ` language-${langToken}` : "";
      return `<div class="code-block relative my-3 overflow-hidden rounded-control border border-line bg-surface">
  <div class="code-block-bar flex items-center justify-between gap-2 border-b border-line bg-surface-sunk px-3 py-1.5 font-mono text-micro text-ink-3">
    <span>${escapeHtml(langToken || "text")}</span>
    <button type="button" data-copy-btn class="inline-flex items-center gap-1 rounded-control px-1.5 py-0.5 text-ink-3 transition-colors hover:bg-surface hover:text-ink-1" aria-label="Copy code">
      ${COPY_ICON}${CHECK_ICON}
      <span class="code-block-copy-label">Copy</span>
    </button>
  </div>
  <pre class="code-block-pre"><code class="hljs${langClass}">${escapeHtml(text)}</code></pre>
</div>`;
    },
  },
});

export function MarkdownView({ content, className = "" }: { content: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasMermaid = useMemo(() => /```mermaid\b/.test(content), [content]);
  const hasCodeBlock = useMemo(() => /```(?!mermaid\b)\S*\n/.test(content), [content]);

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
    const panZoomInstances: SvgPanZoomInstance[] = [];
    const controlElements: HTMLElement[] = [];

    import("mermaid").then(async ({ default: mermaid }) => {
      if (cancelled) return;
      const isDark = document.documentElement.dataset.theme === "dark";
      mermaid.initialize({ startOnLoad: false, theme: isDark ? "dark" : "neutral" });
      await mermaid.run({ nodes: Array.from(nodes) }).catch(() => {});
      if (cancelled) return;

      // Diagrams get a fixed-height viewport (see className below) so pan/zoom has
      // room to do something useful instead of just sitting at 100% fit.
      const { default: svgPanZoom } = await import("svg-pan-zoom");
      if (cancelled) return;
      nodes.forEach((node) => {
        const svg = node.querySelector("svg");
        if (!svg) return;
        const instance = svgPanZoom(svg, {
          zoomEnabled: true,
          panEnabled: true,
          controlIconsEnabled: false,
          fit: true,
          center: true,
          minZoom: 0.5,
          maxZoom: 10,
          // Default "auto" redraws via requestAnimationFrame, which browsers
          // throttle hard in backgrounded/unfocused tabs — a fixed timer keeps
          // zoom/pan responsive even when the tab isn't the active one.
          refreshRate: 30,
        });
        panZoomInstances.push(instance);
        const controls = buildZoomControls(instance);
        controlElements.push(controls);
        node.appendChild(controls);
      });
    });

    return () => {
      cancelled = true;
      panZoomInstances.forEach((instance) => instance.destroy());
      controlElements.forEach((el) => el.remove());
    };
  }, [html, hasMermaid]);

  // Same lazy-load story as mermaid above: only pay for highlight.js when there's an
  // actual fenced code block (not just a mermaid diagram) to highlight.
  useEffect(() => {
    if (!hasCodeBlock || !containerRef.current) return;
    const nodes = containerRef.current.querySelectorAll<HTMLElement>(".code-block-pre code");
    if (nodes.length === 0) return;

    let cancelled = false;
    import("highlight.js/lib/common").then(({ default: hljs }) => {
      if (cancelled) return;
      nodes.forEach((node) => hljs.highlightElement(node));
    });
    return () => {
      cancelled = true;
    };
  }, [html, hasCodeBlock]);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const button = (e.target as HTMLElement).closest<HTMLElement>("[data-copy-btn]");
    if (!button) return;
    const code = button.closest(".code-block")?.querySelector("code");
    const text = code?.textContent ?? "";
    navigator.clipboard.writeText(text).then(
      () => {
        const copyIcon = button.querySelector(".icon-copy");
        const checkIcon = button.querySelector(".icon-check");
        const label = button.querySelector(".code-block-copy-label");
        copyIcon?.classList.add("hidden");
        checkIcon?.classList.remove("hidden");
        if (label) label.textContent = "Copied";
        window.setTimeout(() => {
          copyIcon?.classList.remove("hidden");
          checkIcon?.classList.add("hidden");
          if (label) label.textContent = "Copy";
        }, 1500);
      },
      () => toast.error("Couldn't copy code"),
    );
  }

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className={`prose prose-sm max-w-none text-ink-2 [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-ink-1 [&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink-1 [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-ink-1 [&_p]:mb-2.5 [&_p]:last:mb-0 [&_p]:leading-relaxed [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_a]:font-medium [&_a]:text-brand [&_a]:underline-offset-2 hover:[&_a]:underline [&_code]:rounded [&_code]:border [&_code]:border-line [&_code]:bg-surface [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-micro [&_code]:text-ink-1 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-control [&_pre]:border [&_pre]:border-line [&_pre]:bg-surface [&_pre]:p-3 [&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-ink-3 [&_.code-block_.code-block-pre]:my-0 [&_.code-block_.code-block-pre]:rounded-none [&_.code-block_.code-block-pre]:border-0 [&_.code-block_.code-block-pre]:bg-transparent [&_pre.mermaid]:relative [&_pre.mermaid]:h-[360px] [&_pre.mermaid]:overflow-hidden [&_pre.mermaid_svg]:!h-full [&_pre.mermaid_svg]:!w-full [&_pre.mermaid_svg]:!max-w-none [&_.hljs-comment]:text-ink-4 [&_.hljs-comment]:italic [&_.hljs-quote]:text-ink-4 [&_.hljs-quote]:italic [&_.hljs-keyword]:text-brand-ink [&_.hljs-selector-tag]:text-brand-ink [&_.hljs-literal]:text-brand-ink [&_.hljs-type]:text-brand-ink [&_.hljs-string]:text-success-ink [&_.hljs-attr]:text-success-ink [&_.hljs-regexp]:text-success-ink [&_.hljs-addition]:text-success-ink [&_.hljs-number]:text-accent-ink [&_.hljs-symbol]:text-accent-ink [&_.hljs-title]:text-info-ink [&_.hljs-section]:text-info-ink [&_.hljs-variable]:text-ink-2 [&_.hljs-template-variable]:text-ink-2 [&_.hljs-params]:text-ink-2 [&_.hljs-tag]:text-danger-ink [&_.hljs-name]:text-danger-ink [&_.hljs-built_in]:text-danger-ink [&_.hljs-deletion]:text-danger-ink [&_.hljs-attribute]:text-warn-ink [&_.hljs-emphasis]:italic [&_.hljs-strong]:font-semibold ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function buildZoomControls(instance: SvgPanZoomInstance) {
  const group = document.createElement("div");
  group.className =
    "absolute bottom-2 right-2 z-10 flex flex-col overflow-hidden rounded-control border border-line bg-surface/90 shadow-card backdrop-blur";

  const buttonClass =
    "flex h-6 w-6 items-center justify-center text-ink-3 transition-colors hover:bg-surface-sunk hover:text-ink-1 not-last:border-b not-last:border-line";

  const zoomIn = document.createElement("button");
  zoomIn.type = "button";
  zoomIn.className = buttonClass;
  zoomIn.setAttribute("aria-label", "Zoom in");
  zoomIn.textContent = "+";
  zoomIn.addEventListener("click", () => instance.zoomIn());

  const zoomOut = document.createElement("button");
  zoomOut.type = "button";
  zoomOut.className = buttonClass;
  zoomOut.setAttribute("aria-label", "Zoom out");
  zoomOut.textContent = "−";
  zoomOut.addEventListener("click", () => instance.zoomOut());

  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = buttonClass;
  reset.setAttribute("aria-label", "Reset zoom");
  reset.innerHTML =
    '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>';
  reset.addEventListener("click", () => {
    instance.reset();
    instance.fit();
    instance.center();
  });

  group.append(zoomIn, zoomOut, reset);
  return group;
}
