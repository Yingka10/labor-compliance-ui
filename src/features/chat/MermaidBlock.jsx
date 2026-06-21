// 渲染 ```mermaid 區塊成圖(CLAUDE.md:回答中若含 mermaid 區塊要渲染成圖)。
import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

let initialized = false;
function ensureInit() {
  if (initialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "neutral",
    securityLevel: "strict",
    themeVariables: {
      primaryColor: "#e2e9f1",
      primaryBorderColor: "#1e3a5f",
      primaryTextColor: "#1e3a5f",
      lineColor: "#5f7ea6",
      fontFamily: "inherit",
    },
  });
  initialized = true;
}

let seq = 0;

export default function MermaidBlock({ code }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState(false);
  const idRef = useRef(`mermaid-${(seq += 1)}`);

  useEffect(() => {
    let active = true;
    ensureInit();
    mermaid
      .render(idRef.current, code)
      .then(({ svg }) => active && setSvg(svg))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [code]);

  if (error) {
    // 渲染失敗時退回顯示原始碼,不讓整則回答壞掉
    return (
      <pre className="overflow-x-auto rounded-lg bg-navy-50 p-3 text-xs text-navy-700">
        {code}
      </pre>
    );
  }

  return (
    <div
      className="my-4 flex justify-center rounded-xl border border-navy-100 bg-white p-4"
      // mermaid 輸出為受信任的本地渲染結果
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
