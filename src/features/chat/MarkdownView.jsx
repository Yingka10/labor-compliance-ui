// react-markdown + remark-gfm 渲染 AI 回答(支援表格、清單)。
// fenced code 為 mermaid 時交給 MermaidBlock 渲染成圖。
// Tailwind v4 會 reset 預設樣式,故各元素以 components 明確上 class。
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MermaidBlock from "./MermaidBlock.jsx";
import { sanitizeNodeCodes } from "../../data/docNodes.js";

const components = {
  h1: (p) => <h1 className="mt-5 mb-3 text-xl font-bold text-brand" {...p} />,
  h2: (p) => <h2 className="mt-5 mb-2 text-lg font-bold text-brand" {...p} />,
  h3: (p) => <h3 className="mt-4 mb-2 text-base font-semibold text-brand" {...p} />,
  h4: (p) => <h4 className="mt-4 mb-1.5 text-[15px] font-semibold text-navy-700" {...p} />,
  p: (p) => <p className="my-2.5 leading-7 text-navy-800" {...p} />,
  ul: (p) => <ul className="my-2.5 list-disc space-y-1 pl-5 text-navy-800" {...p} />,
  ol: (p) => <ol className="my-2.5 list-decimal space-y-1 pl-5 text-navy-800" {...p} />,
  li: (p) => <li className="leading-7" {...p} />,
  a: (p) => <a className="text-brand-soft underline underline-offset-2" {...p} />,
  strong: (p) => <strong className="font-semibold text-brand" {...p} />,
  blockquote: (p) => (
    <blockquote
      className="my-3 border-l-4 border-navy-200 bg-navy-50 px-4 py-2 text-navy-700"
      {...p}
    />
  ),
  hr: () => <hr className="my-4 border-navy-100" />,
  table: (p) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-navy-100">
      <table className="w-full border-collapse text-sm" {...p} />
    </div>
  ),
  thead: (p) => <thead className="bg-navy-50" {...p} />,
  th: (p) => (
    <th
      className="border-b border-navy-100 px-3 py-2 text-left font-semibold text-brand"
      {...p}
    />
  ),
  td: (p) => (
    <td className="border-b border-navy-100 px-3 py-2 text-navy-700" {...p} />
  ),
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    const lang = match?.[1];
    if (lang === "mermaid") {
      return <MermaidBlock code={String(children).replace(/\n$/, "")} />;
    }
    if (lang) {
      return (
        <pre className="my-3 overflow-x-auto rounded-lg bg-navy-900 p-3 text-xs leading-relaxed text-navy-100">
          <code {...props}>{children}</code>
        </pre>
      );
    }
    return (
      <code
        className="rounded bg-navy-50 px-1.5 py-0.5 text-[13px] text-brand-soft"
        {...props}
      >
        {children}
      </code>
    );
  },
};

export default function MarkdownView({ children }) {
  return (
    <div className="text-[15px]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {sanitizeNodeCodes(children)}
      </ReactMarkdown>
    </div>
  );
}
