import React, { useMemo } from "react";
import guideMd from "../docs/GUIDE_UTILISATEUR.md?raw";

const C = {
  ink: "#182430",
  inkSoft: "#3C4A58",
  bg: "#F4F6F8",
  card: "#FFFFFF",
  teal: "#0E7C7B",
  line: "#E3E8ED",
  muted: "#5E6E7B",
};

function inlineMd(text) {
  const parts = [];
  const re = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={`${m.index}-b`}>{token.slice(2, -2)}</strong>);
    } else {
      const link = /\[([^\]]+)\]\(([^)]+)\)/.exec(token);
      if (link) {
        parts.push(
          <a key={`${m.index}-a`} href={link[2]} target="_blank" rel="noopener noreferrer" style={{ color: C.teal, fontWeight: 600 }}>
            {link[1]}
          </a>
        );
      }
    }
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : text;
}

function parseTable(lines, start) {
  const rows = [];
  let i = start;
  while (i < lines.length && lines[i].trim().startsWith("|")) {
    const cells = lines[i].split("|").slice(1, -1).map((c) => c.trim());
    if (!/^[-:|\s]+$/.test(lines[i].replace(/\|/g, ""))) rows.push(cells);
    i++;
  }
  if (rows.length < 2) return null;
  const [head, ...body] = rows;
  return {
    end: i,
    node: (
      <div key={`tbl-${start}`} style={{ overflowX: "auto", margin: "12px 0 18px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              {head.map((c, j) => (
                <th key={j} style={{ textAlign: "left", padding: "10px 12px", borderBottom: `2px solid ${C.line}`, color: C.ink, fontWeight: 700, background: C.bg }}>
                  {inlineMd(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => (
              <tr key={ri}>
                {row.map((c, ci) => (
                  <td key={ci} style={{ padding: "9px 12px", borderBottom: `1px solid ${C.line}`, color: C.inkSoft, verticalAlign: "top" }}>
                    {inlineMd(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  };
}

function renderMarkdown(md) {
  const lines = md.split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { i++; continue; }

    if (trimmed === "---") {
      out.push(<hr key={`hr-${i}`} style={{ border: "none", borderTop: `1px solid ${C.line}`, margin: "24px 0" }} />);
      i++;
      continue;
    }

    if (trimmed.startsWith("|")) {
      const tbl = parseTable(lines, i);
      if (tbl) { out.push(tbl.node); i = tbl.end; continue; }
    }

    if (trimmed.startsWith("# ")) {
      out.push(<h1 key={`h1-${i}`} style={{ fontSize: 26, fontWeight: 800, color: C.ink, margin: "0 0 8px" }}>{trimmed.slice(2)}</h1>);
      i++; continue;
    }
    if (trimmed.startsWith("## ")) {
      out.push(<h2 key={`h2-${i}`} style={{ fontSize: 19, fontWeight: 700, color: C.ink, margin: "28px 0 10px", paddingTop: 4 }}>{trimmed.slice(3)}</h2>);
      i++; continue;
    }
    if (trimmed.startsWith("### ")) {
      out.push(<h3 key={`h3-${i}`} style={{ fontSize: 16, fontWeight: 700, color: C.ink, margin: "20px 0 8px" }}>{trimmed.slice(4)}</h3>);
      i++; continue;
    }

    if (trimmed.startsWith("> ")) {
      out.push(
        <blockquote key={`q-${i}`} style={{ margin: "12px 0", padding: "12px 16px", background: "#E3F1F0", borderLeft: `4px solid ${C.teal}`, borderRadius: "0 9px 9px 0", color: C.inkSoft, fontSize: 14, lineHeight: 1.65 }}>
          {inlineMd(trimmed.slice(2))}
        </blockquote>
      );
      i++; continue;
    }

    if (trimmed.startsWith("- ")) {
      const items = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        items.push(<li key={i} style={{ marginBottom: 6 }}>{inlineMd(lines[i].trim().slice(2))}</li>);
        i++;
      }
      out.push(<ul key={`ul-${i}`} style={{ margin: "8px 0 14px", paddingLeft: 22, color: C.inkSoft, lineHeight: 1.65 }}>{items}</ul>);
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(<li key={i} style={{ marginBottom: 6 }}>{inlineMd(lines[i].trim().replace(/^\d+\.\s/, ""))}</li>);
        i++;
      }
      out.push(<ol key={`ol-${i}`} style={{ margin: "8px 0 14px", paddingLeft: 22, color: C.inkSoft, lineHeight: 1.65 }}>{items}</ol>);
      continue;
    }

    if (trimmed.startsWith("*") && trimmed.endsWith("*") && !trimmed.startsWith("**")) {
      out.push(<p key={`em-${i}`} style={{ margin: "16px 0 0", fontSize: 13, color: C.muted, fontStyle: "italic" }}>{trimmed.slice(1, -1)}</p>);
      i++; continue;
    }

    const para = [trimmed];
    i++;
    while (i < lines.length && lines[i].trim() && !lines[i].trim().startsWith("#") && !lines[i].trim().startsWith("- ") && !lines[i].trim().startsWith("|") && lines[i].trim() !== "---" && !/^\d+\.\s/.test(lines[i].trim()) && !lines[i].trim().startsWith("> ")) {
      para.push(lines[i].trim());
      i++;
    }
    out.push(
      <p key={`p-${i}`} style={{ margin: "0 0 12px", color: C.inkSoft, fontSize: 14.5, lineHeight: 1.7 }}>
        {inlineMd(para.join(" "))}
      </p>
    );
  }

  return out;
}

export default function GuideUtilisateur({ title }) {
  const content = useMemo(() => renderMarkdown(guideMd), []);

  return (
    <div style={{ maxWidth: 860 }}>
      <h1 style={{ margin: "0 0 20px", fontSize: 22, color: C.ink }}>{title}</h1>
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 13, padding: "28px 32px 36px" }}>
        {content}
      </div>
    </div>
  );
}
