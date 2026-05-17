"use client";

import { type ChangeEvent, type MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import NextImage from "next/image";
import { useAuth } from "@/lib/auth-context";
import { type Comment, type Document, type DocumentPresence, type User, type Version } from "@/lib/types";
import {
  addCommentToDocument,
  createDocument,
  getBranchDocumentsForParent,
  subscribeToBranchDocuments,
  getCommentsForDocument,
  getDocumentById,
  getUserByEmail,
  removeDocumentPresence,
  subscribeToDocumentById,
  subscribeToDocumentPresence,
  updateDocument,
  upsertDocumentPresence,
} from "@/lib/firestore";
import { deleteDocumentImageByUrl, isFirebaseStorageUrl, uploadDocumentCover, uploadDocumentImage } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Save, GitBranch, Clock, Users, MessageSquare, Sparkles, Share2, Download,
  Bold, Italic, Heading1, Heading2, Heading3, List, ListOrdered, Link2, Quote, Code2, Palette, Type, ImagePlus, Trash2,
  Strikethrough, Undo2, Redo2, Minus,
  Globe, Lock,
  AlignLeft, AlignCenter, AlignRight,
  ArrowUp, ArrowDown, ChevronLeft, ChevronRight,
  RotateCcw, GitCommit, Eye, CheckCircle2,
  GitMerge, AlertTriangle, Check, X,
} from "lucide-react";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { toast } from "sonner";

const FONT_PRESETS = [
  "Arial", "Arial Black", "Verdana", "Tahoma", "Trebuchet MS", "Times New Roman", "Georgia", "Garamond", "Courier New", "Brush Script MT",
  "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Nunito", "Inter", "Work Sans", "Fira Sans", "Source Sans Pro",
  "PT Sans", "Rubik", "Merriweather", "Playfair Display", "Raleway", "Ubuntu", "Noto Sans", "Noto Serif", "Cabin", "Inconsolata",
  "Bebas Neue", "Oswald", "Karla", "DM Sans", "Manrope", "Quicksand", "Josefin Sans", "Arimo", "Mulish", "Titillium Web",
  "Heebo", "Mukta", "Barlow", "Hind", "Teko", "Acme", "Anton", "Archivo", "Asap", "Bitter",
  "Cairo", "Catamaran", "Chivo", "Comfortaa", "Crimson Text", "Domine", "Dosis", "Exo 2", "Fjalla One", "Francois One",
  "IBM Plex Sans", "IBM Plex Serif", "Jost", "Kanit", "Libre Baskerville", "Libre Franklin", "Lora", "M PLUS 1", "Maven Pro", "Nanum Gothic",
  "Oxygen", "Overpass", "Pacifico", "Philosopher", "Prompt", "Questrial", "Rokkitt", "Sarabun", "Signika", "Slabo 27px",
  "Space Grotesk", "Tinos", "Varela Round", "Yanone Kaffeesatz", "Zilla Slab", "Alegreya", "Alegreya Sans", "Arapey", "Archivo Narrow", "Baloo 2",
  "Cormorant", "Didact Gothic", "EB Garamond", "Encode Sans", "Exo", "Fira Code", "Hammersmith One", "Kreon", "Lexend", "Mada",
  "Newsreader", "Outfit", "Pathway Gothic One", "Public Sans", "Rasa", "Sora", "Spectral", "Syne", "Vollkorn", "Yantramanav",
];
const FONT_SIZE_PRESETS = ["10", "11", "12", "13", "14", "15", "16", "18", "20", "22", "24", "28", "32", "36", "40", "48", "56", "64", "72"];
const QUILL_TOOLBAR_CONFIG = [
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  [{ font: [] }, { size: ["small", false, "large", "huge"] }],
  ["bold", "italic", "underline", "strike"],
  [{ color: [] }, { background: [] }],
  [{ script: "sub" }, { script: "super" }],
  [{ list: "ordered" }, { list: "bullet" }, { indent: "-1" }, { indent: "+1" }],
  [{ align: [] }, { direction: "rtl" }],
  ["blockquote", "code-block"],
  ["link", "image", "video"],
  ["clean"],
];
const LOCAL_DRAFT_KEY_PREFIX = "coresearch:report-draft";

const TextStyleAttributes = Extension.create({
  name: "textStyleAttributes",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: (element) => element.style.fontFamily || null,
            renderHTML: (attributes) =>
              attributes.fontFamily ? { style: `font-family: ${attributes.fontFamily}` } : {},
          },
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) =>
              attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
          },
        },
      },
    ];
  },
});

type QuillInstance = {
  root: HTMLElement;
  clipboard: { dangerouslyPasteHTML: (html: string) => void };
  on: (eventName: string, callback: () => void) => void;
  getSelection: (focus?: boolean) => { index: number; length: number } | null;
  getLength: () => number;
  insertEmbed: (index: number, type: string, value: string, source?: string) => void;
  setSelection: (index: number, length: number) => void;
};
type ImageAlign = "left" | "center" | "right";

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function estimateReadTimeMinutes(html: string) {
  const words = stripHtml(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function extractImageUrlsFromHtml(html: string) {
  const matches = Array.from(html.matchAll(/<img[^>]+src=["']([^"']+)["']/g));
  return matches.map((m) => m[1]).filter((url) => /^https?:\/\//i.test(url));
}

function uniqueUrls(urls: string[]) {
  return Array.from(new Set(urls.filter(Boolean)));
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return "Unexpected error";
}

function markdownToBasicHtml(markdown: string) {
  if (/<[a-z][\s\S]*>/i.test(markdown)) return markdown;
  const escaped = markdown.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return escaped
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br />");
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function createSlug(input: string, fallback: string) {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return base || fallback;
}

function parseHtmlBody(html: string) {
  const parser = new DOMParser();
  return parser.parseFromString(html || "<p></p>", "text/html");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function userCanOpenDocument(document: Document, user: User) {
  return (
    document.ownerId === user.id ||
    user.role === "admin" ||
    document.collaborators.some((collab) => collab.id === user.id) ||
    (document.stage === "published" && (document.publishVisibility ?? "public") === "public")
  );
}

function stripGeneratedSection(doc: globalThis.Document, blockType: "toc" | "image-index") {
  doc.querySelectorAll(`section[data-report-block="${blockType}"]`).forEach((el) => el.remove());
}

function insertGeneratedSection(doc: globalThis.Document, section: HTMLElement, blockType: "toc" | "image-index") {
  section.setAttribute("data-report-block", blockType);
  const body = doc.body;
  const existingToc = body.querySelector('section[data-report-block="toc"]');

  if (blockType === "toc") {
    body.prepend(section);
    return;
  }

  if (existingToc?.parentNode === body) {
    existingToc.insertAdjacentElement("afterend", section);
    return;
  }
  body.prepend(section);
}

function buildTocAndNormalizedContent(html: string) {
  const doc = parseHtmlBody(html);
  stripGeneratedSection(doc, "toc");

  const headings = Array.from(doc.body.querySelectorAll("h1, h2, h3")).filter((heading) => !heading.closest("section[data-report-block]"));
  const usedSlugs = new Set<string>();

  const entries = headings.map((heading, index) => {
    const text = (heading.textContent || "").trim();
    const level = heading.tagName.toLowerCase();
    const root = createSlug(text, `section-${index + 1}`);
    let slug = root;
    let suffix = 1;
    while (usedSlugs.has(slug)) {
      suffix += 1;
      slug = `${root}-${suffix}`;
    }
    usedSlugs.add(slug);
    heading.setAttribute("id", slug);
    return { text: text || `Section ${index + 1}`, level, slug };
  });

  if (entries.length === 0) {
    return { updatedHtml: html, tocHtml: "", count: 0 };
  }

  const tocItems = entries
    .map((entry) => {
      const margin = entry.level === "h1" ? 0 : entry.level === "h2" ? 20 : 40;
      return `<li style="margin-left:${margin}px;"><a href="#${entry.slug}" style="color:#1d4ed8;text-decoration:none;">${escapeHtml(entry.text)}</a></li>`;
    })
    .join("");

  const section = doc.createElement("section");
  section.innerHTML = `<h2>Table of Contents</h2><ol>${tocItems}</ol>`;
  insertGeneratedSection(doc, section, "toc");

  return { updatedHtml: doc.body.innerHTML, tocHtml: section.outerHTML, count: entries.length };
}

function buildImageIndexAndNormalizedContent(html: string) {
  const doc = parseHtmlBody(html);
  stripGeneratedSection(doc, "image-index");

  const images = Array.from(doc.body.querySelectorAll("img")).filter((image) => !image.closest("section[data-report-block]"));
  if (images.length === 0) {
    return { updatedHtml: html, count: 0 };
  }

  const lines = images
    .map((image, index) => {
      const src = image.getAttribute("src") || "";
      if (!src) return "";
      const alt = (image.getAttribute("alt") || "").trim();
      const fallback = `Image ${index + 1}`;
      const label = alt || fallback;
      const href = escapeHtml(src);
      return `<li><a href="${href}" target="_blank" rel="noreferrer" style="color:#1d4ed8;text-decoration:none;">Figure ${index + 1}: ${escapeHtml(label)}</a></li>`;
    })
    .filter(Boolean)
    .join("");

  const section = doc.createElement("section");
  section.innerHTML = `<h2>Image Index</h2><ol>${lines}</ol>`;
  insertGeneratedSection(doc, section, "image-index");

  return { updatedHtml: doc.body.innerHTML, count: images.length };
}

function buildResearchReportTemplate() {
  return `
    <h1>Research Report Title</h1>
    <p><strong>Authors:</strong> Add author names and affiliations.</p>
    <h2>Abstract</h2>
    <p>Summarize your objective, method, and core findings in 150-250 words.</p>
    <h2>Keywords</h2>
    <p>keyword 1, keyword 2, keyword 3</p>
    <h2>1. Introduction</h2>
    <p>State the problem, context, and research motivation.</p>
    <h2>2. Literature Review</h2>
    <p>Summarize existing work and identify the research gap.</p>
    <h2>3. Methodology</h2>
    <p>Describe your design, data sources, and analysis approach.</p>
    <h2>4. Results</h2>
    <p>Present findings with evidence, figures, and tables.</p>
    <h2>5. Discussion</h2>
    <p>Interpret findings, limitations, and implications.</p>
    <h2>6. Conclusion</h2>
    <p>Summarize contributions and suggest future work.</p>
    <h2>References</h2>
    <ol>
      <li>Author, A. A. (Year). Title. Journal, Volume(Issue), pages.</li>
    </ol>
    <h2>Appendix</h2>
    <p>Supplementary details, raw outputs, or additional figures.</p>
  `;
}

// ── Merge diff utilities ──────────────────────────────────────────────────────

interface HtmlBlock {
  html: string;
  text: string;
}

function splitHtmlBlocks(html: string): HtmlBlock[] {
  const parts = html
    .replace(/>\s+</g, "><")
    .split(/(?<=<\/(?:p|h[1-6]|li|blockquote|pre)>)/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    const text = html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
    return [{ html, text }];
  }
  return parts.map((h) => ({
    html: h,
    text: h.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim(),
  }));
}

function lcsDp(a: string[], b: string[]): number[][] {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return dp;
}

export type MergeBlockStatus = "unchanged" | "branch-add" | "parent-only" | "conflict";

export interface MergeBlock {
  status: MergeBlockStatus;
  html: string;
  text: string;
  branchHtml?: string;
  branchText?: string;
  idx: number;
}

function threeWayDiff(ancestorHtml: string, parentHtml: string, branchHtml: string): MergeBlock[] {
  const ancestor = splitHtmlBlocks(ancestorHtml);
  const parent   = splitHtmlBlocks(parentHtml);
  const branch   = splitHtmlBlocks(branchHtml);

  const aTexts = ancestor.map((b) => b.text);
  const pTexts = parent.map((b) => b.text);
  const brTexts = branch.map((b) => b.text);

  // Which ancestor lines are still in parent / branch
  function survivingAncestorIndices(aT: string[], bT: string[]): Set<number> {
    const dp = lcsDp(aT, bT);
    const surviving = new Set<number>();
    let i = aT.length, j = bT.length;
    while (i > 0 && j > 0) {
      if (aT[i - 1] === bT[j - 1]) { surviving.add(i - 1); i--; j--; }
      else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
      else j--;
    }
    return surviving;
  }

  const inParent = survivingAncestorIndices(aTexts, pTexts);
  const inBranch = survivingAncestorIndices(aTexts, brTexts);

  // 2-way diff: parent vs branch blocks
  const dp = lcsDp(pTexts, brTexts);
  const raw: { type: "same" | "p-only" | "br-only"; pIdx: number; brIdx: number }[] = [];
  let pi = pTexts.length, bri = brTexts.length;
  while (pi > 0 || bri > 0) {
    if (pi > 0 && bri > 0 && pTexts[pi - 1] === brTexts[bri - 1]) {
      raw.push({ type: "same", pIdx: pi - 1, brIdx: bri - 1 });
      pi--; bri--;
    } else if (bri > 0 && (pi === 0 || dp[pi][bri - 1] >= dp[pi - 1][bri])) {
      raw.push({ type: "br-only", pIdx: -1, brIdx: bri - 1 });
      bri--;
    } else {
      raw.push({ type: "p-only", pIdx: pi - 1, brIdx: -1 });
      pi--;
    }
  }
  raw.reverse();

  const blocks: MergeBlock[] = [];
  let idx = 0;
  let i = 0;
  while (i < raw.length) {
    const cur = raw[i];
    if (cur.type === "same") {
      blocks.push({ status: "unchanged", html: parent[cur.pIdx].html, text: parent[cur.pIdx].text, idx: idx++ });
      i++;
    } else if (cur.type === "p-only" && i + 1 < raw.length && raw[i + 1].type === "br-only") {
      // Adjacent parent-only + branch-only = conflict
      const pb = parent[cur.pIdx];
      const brb = branch[raw[i + 1].brIdx];
      // Check if ancestor actually had the parent block (parent changed it) AND branch changed it too
      const ancestorHadIt = inParent.size > 0 || inBranch.size > 0;
      if (ancestorHadIt) {
        blocks.push({ status: "conflict", html: pb.html, text: pb.text, branchHtml: brb.html, branchText: brb.text, idx: idx++ });
      } else {
        blocks.push({ status: "parent-only", html: pb.html, text: pb.text, idx: idx++ });
        blocks.push({ status: "branch-add", html: brb.html, text: brb.text, idx: idx++ });
      }
      i += 2;
    } else if (cur.type === "br-only" && i + 1 < raw.length && raw[i + 1].type === "p-only") {
      // branch-only then parent-only = conflict
      const brb = branch[cur.brIdx];
      const pb = parent[raw[i + 1].pIdx];
      blocks.push({ status: "conflict", html: pb.html, text: pb.text, branchHtml: brb.html, branchText: brb.text, idx: idx++ });
      i += 2;
    } else if (cur.type === "br-only") {
      blocks.push({ status: "branch-add", html: branch[cur.brIdx].html, text: branch[cur.brIdx].text, idx: idx++ });
      i++;
    } else {
      // p-only
      blocks.push({ status: "parent-only", html: parent[cur.pIdx].html, text: parent[cur.pIdx].text, idx: idx++ });
      i++;
    }
  }
  return blocks;
}

function buildMergedHtml(blocks: MergeBlock[], resolutions: Map<number, "parent" | "branch">): string {
  return blocks
    .map((b) => {
      if (b.status === "unchanged") return b.html;
      if (b.status === "parent-only") return b.html;
      if (b.status === "branch-add") return b.html;
      // conflict
      const res = resolutions.get(b.idx) ?? "parent";
      return res === "branch" ? (b.branchHtml ?? b.html) : b.html;
    })
    .join("");
}

type AiDiffSegmentType = "unchanged" | "add" | "remove" | "replace";

interface AiDiffSegment {
  type: AiDiffSegmentType;
  value: string;
  nextValue?: string;
}

interface AiPreviewState {
  from: number;
  to: number;
  selectedText: string;
  output: string;
  segments: AiDiffSegment[];
}

interface AiSelectionState {
  from: number;
  to: number;
  selectedText: string;
}

function tokenizeDiffText(value: string): string[] {
  return value.match(/\s+|[^\s]+/g) ?? [];
}

function buildAiDiffSegments(before: string, after: string): AiDiffSegment[] {
  const beforeTokens = tokenizeDiffText(before);
  const afterTokens = tokenizeDiffText(after);
  const dp = lcsDp(beforeTokens, afterTokens);
  const raw: { type: "same" | "remove" | "add"; value: string }[] = [];

  let i = beforeTokens.length;
  let j = afterTokens.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && beforeTokens[i - 1] === afterTokens[j - 1]) {
      raw.push({ type: "same", value: beforeTokens[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      raw.push({ type: "add", value: afterTokens[j - 1] });
      j--;
    } else {
      raw.push({ type: "remove", value: beforeTokens[i - 1] });
      i--;
    }
  }

  raw.reverse();

  const segments: AiDiffSegment[] = [];
  let cursor = 0;
  while (cursor < raw.length) {
    if (raw[cursor].type === "same") {
      let value = "";
      while (cursor < raw.length && raw[cursor].type === "same") {
        value += raw[cursor].value;
        cursor++;
      }
      segments.push({ type: "unchanged", value });
      continue;
    }

    let removed = "";
    let added = "";
    while (cursor < raw.length && raw[cursor].type !== "same") {
      if (raw[cursor].type === "remove") removed += raw[cursor].value;
      if (raw[cursor].type === "add") added += raw[cursor].value;
      cursor++;
    }

    if (removed && added) {
      segments.push({ type: "replace", value: removed, nextValue: added });
    } else if (removed) {
      segments.push({ type: "remove", value: removed });
    } else if (added) {
      segments.push({ type: "add", value: added });
    }
  }

  return segments;
}

// ─────────────────────────────────────────────────────────────────────────────

function applyLocalPrompt(prompt: string, selectedText: string) {
  const instruction = prompt.trim().toLowerCase();
  const cleanText = selectedText.trim();
  if (!instruction || !cleanText) return cleanText;

  if (instruction.includes("uppercase")) return cleanText.toUpperCase();
  if (instruction.includes("lowercase")) return cleanText.toLowerCase();
  if (instruction.includes("title case")) return toTitleCase(cleanText);
  if (instruction.includes("bullet")) {
    return cleanText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `- ${line}`)
      .join("\n");
  }
  if (instruction.includes("summar")) {
    const sentences = cleanText
      .split(/(?<=[.!?])\s+/)
      .map((line) => line.trim())
      .filter(Boolean);
    return sentences.slice(0, 2).join(" ");
  }
  if (instruction.includes("expand")) {
    return `${cleanText}\n\nFurther detail: add evidence, examples, and citations to support this point.`;
  }
  if (instruction.includes("rewrite") || instruction.includes("improve")) {
    return cleanText
      .replace(/\s+/g, " ")
      .replace(/\bi\b/g, "I")
      .trim();
  }
  return cleanText;
}

function buildDraftDocument(user: User): Document {
  const now = new Date().toISOString();
  return {
    id: `doc-new-${Date.now()}`,
    title: "Untitled Research Paper",
    content: "<h1>Untitled Research Paper</h1><p>Start writing your research here...</p>",
    imageUrls: [],
    ownerId: user.id,
    ownerName: user.name,
    collaborators: [{ id: user.id, name: user.name, email: user.email, role: "owner", joinedAt: now }],
    versions: [],
    currentVersion: 0,
    field: "General",
    topic: "Research",
    stage: "draft",
    createdAt: now,
    updatedAt: now,
    university: user.university.name,
  };
}

function getLocalDraftKey(userId: string) {
  return `${LOCAL_DRAFT_KEY_PREFIX}:${userId}`;
}

function inferImageAlign(img: HTMLImageElement): ImageAlign {
  const ml = img.style.marginLeft;
  const mr = img.style.marginRight;
  if (ml === "auto" && mr === "0px") return "right";
  if (ml === "0px" && mr === "auto") return "left";
  return "center";
}

function inferImageWidthPercent(img: HTMLImageElement): number {
  const raw = img.style.width?.trim() || "";
  if (raw.endsWith("%")) {
    const parsed = Number(raw.replace("%", ""));
    if (!Number.isNaN(parsed) && parsed > 0) return Math.min(100, Math.max(20, parsed));
  }
  return 100;
}

function inferImageOffsetPx(img: HTMLImageElement) {
  const left = Number.parseInt((img.style.left || "0").replace("px", ""), 10);
  const top = Number.parseInt((img.style.top || "0").replace("px", ""), 10);
  return {
    left: Number.isNaN(left) ? 0 : left,
    top: Number.isNaN(top) ? 0 : top,
  };
}

function applyImageFormatting(img: HTMLImageElement, widthPercent: number, align: ImageAlign) {
  img.style.display = "block";
  img.style.maxWidth = "100%";
  img.style.height = "auto";
  img.style.width = `${widthPercent}%`;
  if (!img.style.position) img.style.position = "relative";
  if (!img.style.left) img.style.left = "0px";
  if (!img.style.top) img.style.top = "0px";
  img.style.cursor = "move";
  if (align === "left") {
    img.style.marginLeft = "0px";
    img.style.marginRight = "auto";
  } else if (align === "right") {
    img.style.marginLeft = "auto";
    img.style.marginRight = "0px";
  } else {
    img.style.marginLeft = "auto";
    img.style.marginRight = "auto";
  }
}

const PRESENCE_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"];

function presenceColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length];
}

const cursorPluginKey = new PluginKey("collaborativeCursors");

function buildCursorExtension(presenceRef: React.MutableRefObject<DocumentPresence[]>) {
  return Extension.create({
    name: "collaborativeCursors",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: cursorPluginKey,
          props: {
            decorations(state) {
              const decorations: Decoration[] = [];
              const docSize = state.doc.content.size;
              for (const p of presenceRef.current) {
                if (p.cursorFrom === null || p.cursorFrom === undefined) continue;
                const pos = Math.max(0, Math.min(p.cursorFrom, docSize));
                const cursorEl = window.document.createElement("span");
                cursorEl.style.cssText = `position:relative;border-left:2px solid ${p.color};margin-left:-1px;`;
                const labelEl = window.document.createElement("span");
                labelEl.textContent = p.userName.split(" ")[0];
                labelEl.style.cssText = `position:absolute;top:-1.4em;left:-1px;background:${p.color};color:#fff;font-size:10px;padding:1px 5px;border-radius:3px 3px 3px 0;white-space:nowrap;pointer-events:none;z-index:50;font-family:sans-serif;line-height:1.4;`;
                cursorEl.appendChild(labelEl);
                decorations.push(Decoration.widget(pos, cursorEl, { side: 1, key: p.userId }));
              }
              return DecorationSet.create(state.doc, decorations);
            },
          },
        }),
      ];
    },
  });
}

export default function DocumentEditorPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const isNewDocument = id === "new";
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPublishedView = searchParams.get("view") === "published";
  const shouldAutoDownloadPdf = searchParams.get("download") === "1";

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const quillHostRef = useRef<HTMLDivElement | null>(null);
  const quillInstanceRef = useRef<QuillInstance | null>(null);
  const quillSyncGuardRef = useRef(false);
  const quillLatestHtmlRef = useRef("<p></p>");
  const editorModeRef = useRef<"quill" | "tiptap">("tiptap");
  const autosaveCreatingRef = useRef(false);
  const latestLocalEditAtRef = useRef(0);
  const pdfAutoDownloadStartedRef = useRef(false);
  const selectedImageRef = useRef<HTMLImageElement | null>(null);
  const [persistedDocument, setPersistedDocument] = useState<Document | null>(null);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [editorHtml, setEditorHtml] = useState("");
  const [editorMode] = useState<"quill" | "tiptap">("tiptap");
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [selectedFont, setSelectedFont] = useState("Georgia");
  const [selectedFontSize, setSelectedFontSize] = useState("16");
  const [customFont, setCustomFont] = useState("");
  const [selectedColor, setSelectedColor] = useState("#1f2937");
  const [trackedImageUrls, setTrackedImageUrls] = useState<string[]>([]);
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [selectedImageWidth, setSelectedImageWidth] = useState(100);
  const [selectedImageAlign, setSelectedImageAlign] = useState<ImageAlign>("center");
  const [selectedImageSrc, setSelectedImageSrc] = useState("");
  const [selectedImageLeft, setSelectedImageLeft] = useState(0);
  const [selectedImageTop, setSelectedImageTop] = useState(0);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("https://");
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSelection, setAiSelection] = useState<AiSelectionState | null>(null);
  const [aiPreview, setAiPreview] = useState<AiPreviewState | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const [branchName, setBranchName] = useState("");
  const [branchLoading, setBranchLoading] = useState(false);
  const [commitOpen, setCommitOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [parentDocTitle, setParentDocTitle] = useState<string | null>(null);
  // Merge — branch documents act as merge requests themselves
  const [branchDocs, setBranchDocs] = useState<Document[]>([]);
  const [mergeRequestOpen, setMergeRequestOpen] = useState(false);
  const [mergeRequestMsg, setMergeRequestMsg] = useState("");
  const [mergeRequestLoading, setMergeRequestLoading] = useState(false);
  // Merge review (parent sees incoming requests)
  const [mergeReviewOpen, setMergeReviewOpen] = useState(false);
  const [activeBranchDoc, setActiveBranchDoc] = useState<Document | null>(null);
  const [mergeDiffBlocks, setMergeDiffBlocks] = useState<MergeBlock[]>([]);
  const [mergeResolutions, setMergeResolutions] = useState<Map<number, "parent" | "branch">>(new Map());
  const [mergeApplying, setMergeApplying] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishVisibility, setPublishVisibility] = useState<"public" | "private">("public");
  const [publishAbstract, setPublishAbstract] = useState("");
  const [publishKeywords, setPublishKeywords] = useState("");
  const [publishCoverUrl, setPublishCoverUrl] = useState("");
  const [publishCoverUploading, setPublishCoverUploading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const publishCoverInputRef = useRef<HTMLInputElement | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const [otherPresence, setOtherPresence] = useState<DocumentPresence[]>([]);
  const otherPresenceRef = useRef<DocumentPresence[]>([]);
  const presenceThrottleRef = useRef(0);
  const mouseThrottleRef = useRef(0);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const cursorExtension = useMemo(() => buildCursorExtension(otherPresenceRef), []);

  const draftDocument = useMemo(() => (isNewDocument && user ? buildDraftDocument(user) : null), [isNewDocument, user]);
  const document = isNewDocument ? draftDocument : persistedDocument;
  const collaborators = useMemo(() => document?.collaborators ?? [], [document]);
  const baseTitle = document?.title ?? "";
  const baseContent = markdownToBasicHtml(document?.content ?? "");
  const effectiveTitle = titleDraft ?? baseTitle;
  const effectiveContent = editorHtml || baseContent;
  const currentImageUrls = useMemo(() => extractImageUrlsFromHtml(effectiveContent), [effectiveContent]);
  const allImageUrls = useMemo(() => uniqueUrls([...currentImageUrls, ...trackedImageUrls]), [currentImageUrls, trackedImageUrls]);
  const hasChanges = effectiveTitle !== baseTitle || effectiveContent !== baseContent;
  const collaboratorRole = user ? collaborators.find((collab) => collab.id === user.id)?.role : undefined;
  const canManageDocument = !!document && !!user && (document.ownerId === user.id || user.role === "admin");
  const hasEditorRole = !!document && !!user && (canManageDocument || collaboratorRole === "editor" || collaboratorRole === "owner");
  const isDiscoverReadOnlyView =
    !!document &&
    isPublishedView &&
    document.stage === "published" &&
    (document.publishVisibility ?? "public") === "public";
  // Branch is locked while its merge request is pending or already merged
  const mergeRequestLocked =
    !!document?.parentDocumentId &&
    (document.mergeRequestStatus === "pending" || document.mergeRequestStatus === "merged");
  // Published documents are permanently read-only regardless of how they're accessed
  const canEdit =
    !!user &&
    hasEditorRole &&
    !isDiscoverReadOnlyView &&
    !mergeRequestLocked &&
    document?.stage !== "published";
  const canInvite = canManageDocument && !isDiscoverReadOnlyView;
  const canPublish = !!document && canManageDocument && !isNewDocument && !document.parentDocumentId && !isDiscoverReadOnlyView;
  const canCreateBranch = !!document && !document.parentDocumentId && hasEditorRole && !isDiscoverReadOnlyView;
  const canComment = !!document && !!user && !isNewDocument && !isDiscoverReadOnlyView;
  const canViewDocument =
    !!document &&
    !!user &&
    (
      document.ownerId === user.id ||
      user.role === "admin" ||
      collaborators.some((collab) => collab.id === user.id) ||
      (document.stage === "published" && (document.publishVisibility ?? "public") === "public")
    );

  useEffect(() => {
    quillLatestHtmlRef.current = effectiveContent || baseContent || "<p></p>";
  }, [effectiveContent, baseContent]);

  useEffect(() => {
    if (!isNewDocument || !user) return;
    const key = getLocalDraftKey(user.id);
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as { title?: string; content?: string; imageUrls?: string[] };
      if (draft.title) setTitleDraft(draft.title);
      if (draft.content) setEditorHtml(draft.content);
      if (Array.isArray(draft.imageUrls)) setTrackedImageUrls(uniqueUrls(draft.imageUrls));
    } catch {
      window.localStorage.removeItem(key);
    }
  }, [isNewDocument, user]);

  useEffect(() => {
    if (!isNewDocument || !user) return;
    const key = getLocalDraftKey(user.id);
    const payload = {
      title: effectiveTitle,
      content: effectiveContent,
      imageUrls: allImageUrls,
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  }, [isNewDocument, user, effectiveTitle, effectiveContent, allImageUrls]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Image,
      TextStyle,
      TextStyleAttributes,
      Color,
      cursorExtension,
    ],
    content: baseContent,
    editable: canEdit,
    onUpdate: ({ editor: e }) => {
      if (!canEdit) return;
      latestLocalEditAtRef.current = Date.now();
      setEditorHtml(e.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(canEdit);
  }, [canEdit, editor]);

  useEffect(() => {
    if (!editor) return;
    if ((editorHtml || baseContent) !== baseContent) return;
    editor.commands.setContent(baseContent, { emitUpdate: false });
  }, [editor, baseContent, editorHtml]);

  useEffect(() => {
    setTrackedImageUrls(extractImageUrlsFromHtml(baseContent));
  }, [baseContent]);

  // Presence: write on mount, subscribe to others, clean up on unmount
  useEffect(() => {
    if (!user || !document || isNewDocument || isDiscoverReadOnlyView) return;
    const docId = document.id;
    const color = presenceColor(user.id);
    void upsertDocumentPresence(docId, user.id, {
      userName: user.name,
      color,
      cursorFrom: null,
      lastSeen: new Date().toISOString(),
    });
    const unsubscribe = subscribeToDocumentPresence(
      docId,
      (all) => {
        const others = all.filter((p) => p.userId !== user.id);
        setOtherPresence(others);
        otherPresenceRef.current = others;
      },
      () => {
        // Permission denied — silently clear presence rather than crashing the listener
        setOtherPresence([]);
        otherPresenceRef.current = [];
      },
    );
    const handleUnload = () => void removeDocumentPresence(docId, user.id);
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      void removeDocumentPresence(docId, user.id);
      unsubscribe();
      window.removeEventListener("beforeunload", handleUnload);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, document?.id, isNewDocument, isDiscoverReadOnlyView]);

  // Presence: re-render cursor decorations when other users' presence changes
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setMeta(cursorPluginKey, { refresh: true }));
  }, [editor, otherPresence]);

  // Presence: track text cursor position (throttled 500 ms)
  useEffect(() => {
    if (!editor || !user || !document || isNewDocument || isDiscoverReadOnlyView) return;
    const docId = document.id;
    const color = presenceColor(user.id);
    const handleSelection = () => {
      const now = Date.now();
      if (now - presenceThrottleRef.current < 500) return;
      presenceThrottleRef.current = now;
      const { from } = editor.state.selection;
      void upsertDocumentPresence(docId, user.id, {
        userName: user.name,
        color,
        cursorFrom: from,
        lastSeen: new Date().toISOString(),
      });
    };
    editor.on("selectionUpdate", handleSelection);
    return () => { editor.off("selectionUpdate", handleSelection); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, user?.id, document?.id, isNewDocument]);

  // Presence: track mouse position over the editor container (throttled 80 ms)
  useEffect(() => {
    if (!user || !document || isNewDocument || isDiscoverReadOnlyView) return;
    const container = editorContainerRef.current;
    if (!container) return;
    const docId = document.id;
    const color = presenceColor(user.id);
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - mouseThrottleRef.current < 80) return;
      mouseThrottleRef.current = now;
      const rect = container.getBoundingClientRect();
      const mouseX = Math.round(((e.clientX - rect.left) / rect.width) * 100 * 10) / 10;
      const mouseY = Math.round(((e.clientY - rect.top) / rect.height) * 100 * 10) / 10;
      void upsertDocumentPresence(docId, user.id, {
        userName: user.name,
        color,
        cursorFrom: null,
        lastSeen: new Date().toISOString(),
        mouseX,
        mouseY,
      });
    };
    const handleMouseLeave = () => {
      void upsertDocumentPresence(docId, user.id, {
        userName: user.name,
        color,
        cursorFrom: null,
        lastSeen: new Date().toISOString(),
        mouseX: null,
        mouseY: null,
      });
    };
    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, document?.id, isNewDocument, isDiscoverReadOnlyView]);

  useEffect(() => {
    editorModeRef.current = editorMode;
  }, [editorMode]);

  useEffect(() => {
    if (editorMode !== "quill") return;
    const host = quillHostRef.current;
    if (!host) return;

    // Fast refresh can leave a stale instance detached from the live DOM.
    if (quillInstanceRef.current && !quillInstanceRef.current.root.isConnected) {
      quillInstanceRef.current = null;
    }
    if (quillInstanceRef.current) return;

    host.innerHTML = "";
    let cancelled = false;

    void import("quill").then((module) => {
      if (cancelled) return;
      const QuillCtor = module.default;
      const quill = new QuillCtor(host, {
        theme: "snow",
        readOnly: !canEdit,
        modules: {
          toolbar: {
            container: QUILL_TOOLBAR_CONFIG,
            handlers: {
              image: () => imageInputRef.current?.click(),
            },
          },
        },
      }) as QuillInstance;

      quill.clipboard.dangerouslyPasteHTML(quillLatestHtmlRef.current || "<p></p>");
      quill.on("text-change", () => {
        if (!canEdit) return;
        latestLocalEditAtRef.current = Date.now();
        quillSyncGuardRef.current = true;
        setEditorHtml(quill.root.innerHTML);
      });

      const handleEditorClick = (event: Event) => {
        const target = event.target;
        if (!(target instanceof HTMLImageElement)) return;
        selectedImageRef.current = target;
        setSelectedImageSrc(target.getAttribute("src") || "");
        setSelectedImageWidth(inferImageWidthPercent(target));
        setSelectedImageAlign(inferImageAlign(target));
        setImageEditorOpen(true);
      };
      quill.root.addEventListener("click", handleEditorClick);

      quillInstanceRef.current = quill;

      return () => {
        quill.root.removeEventListener("click", handleEditorClick);
      };
    }).catch(() => {
      toast.error("Failed to initialize full toolbar editor.");
    });

    return () => {
      cancelled = true;
      quillInstanceRef.current = null;
    };
  }, [canEdit, editorMode]);

  useEffect(() => {
    const quill = quillInstanceRef.current;
    if (!quill) return;
    if ("enable" in quill && typeof (quill as QuillInstance & { enable?: (enabled: boolean) => void }).enable === "function") {
      (quill as QuillInstance & { enable: (enabled: boolean) => void }).enable(canEdit);
    }
  }, [canEdit]);

  useEffect(() => {
    if (editorMode !== "quill") return;
    const quill = quillInstanceRef.current;
    if (!quill) return;
    if (quillSyncGuardRef.current) {
      quillSyncGuardRef.current = false;
      return;
    }

    const nextHtml = effectiveContent || "<p></p>";
    if (quill.root.innerHTML === nextHtml) return;
    const range = quill.getSelection();
    quill.clipboard.dangerouslyPasteHTML(nextHtml);
    if (range) {
      const max = Math.max(0, quill.getLength() - 1);
      quill.setSelection(Math.min(range.index, max), range.length);
    }
  }, [editorMode, effectiveContent]);

  useEffect(() => {
    if (selectedImageRef.current && !selectedImageRef.current.isConnected) {
      selectedImageRef.current = null;
      if (editorModeRef.current === "quill") {
        setImageEditorOpen(false);
        setSelectedImageSrc("");
      }
    }
  }, [effectiveContent]);

  useEffect(() => {
    if (!editor || editorMode !== "tiptap") return;
    const root = editor.view.dom as HTMLElement;
    const handleEditorClick = (event: Event) => {
      if (!canEdit) return;
      const target = event.target;
      if (!(target instanceof HTMLImageElement)) return;
      selectedImageRef.current = target;
      setSelectedImageSrc(target.getAttribute("src") || "");
      setSelectedImageWidth(inferImageWidthPercent(target));
      setSelectedImageAlign(inferImageAlign(target));
      const offset = inferImageOffsetPx(target);
      setSelectedImageLeft(offset.left);
      setSelectedImageTop(offset.top);
      setImageEditorOpen(true);
    };

    const handleImageDragStart = (event: MouseEvent) => {
      if (!canEdit) return;
      const target = event.target;
      if (!(target instanceof HTMLImageElement)) return;
      event.preventDefault();

      selectedImageRef.current = target;
      setSelectedImageSrc(target.getAttribute("src") || "");
      setSelectedImageWidth(inferImageWidthPercent(target));
      setSelectedImageAlign(inferImageAlign(target));
      const startOffset = inferImageOffsetPx(target);
      setSelectedImageLeft(startOffset.left);
      setSelectedImageTop(startOffset.top);
      setImageEditorOpen(true);

      applyImageFormatting(target, inferImageWidthPercent(target), inferImageAlign(target));

      const startX = event.clientX;
      const startY = event.clientY;
      const baseLeft = inferImageOffsetPx(target).left;
      const baseTop = inferImageOffsetPx(target).top;

      const onMove = (moveEvent: MouseEvent) => {
        const nextLeft = baseLeft + (moveEvent.clientX - startX);
        const nextTop = baseTop + (moveEvent.clientY - startY);
        target.style.left = `${nextLeft}px`;
        target.style.top = `${nextTop}px`;
        setSelectedImageLeft(nextLeft);
        setSelectedImageTop(nextTop);
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        const rootHtml = (editor?.view.dom as HTMLElement).innerHTML;
        editor?.commands.setContent(rootHtml, { emitUpdate: true });
        setEditorHtml(rootHtml);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

    root.addEventListener("click", handleEditorClick);
    root.addEventListener("mousedown", handleImageDragStart);
    return () => {
      root.removeEventListener("click", handleEditorClick);
      root.removeEventListener("mousedown", handleImageDragStart);
    };
  }, [canEdit, editor, editorMode]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) return router.push("/");
    if (isNewDocument) return;

    const unsubscribe = subscribeToDocumentById(
      id,
      (existingDoc) => {
        if (!existingDoc) {
          toast.error("Document not found.");
          router.push("/dashboard");
          return;
        }
        if (!userCanOpenDocument(existingDoc, user)) {
          toast.error("You do not have access to this document.");
          router.push("/dashboard");
          return;
        }

        setPersistedDocument(existingDoc);

        const remoteHtml = markdownToBasicHtml(existingDoc.content);
        const hasVeryRecentLocalEdit = Date.now() - latestLocalEditAtRef.current < 3000;
        if (!hasVeryRecentLocalEdit) {
          setTitleDraft(existingDoc.title);
          setEditorHtml(remoteHtml);
          if (editorModeRef.current === "quill") {
            quillInstanceRef.current?.clipboard.dangerouslyPasteHTML(remoteHtml);
          } else {
            editor?.commands.setContent(remoteHtml, { emitUpdate: false });
          }
        }
      },
      () => {
        toast.error("Realtime document sync failed.");
      },
    );

    // Load parent title if on a branch (one-time is fine — title rarely changes)
    async function loadParentTitle() {
      try {
        const loadedDoc = await getDocumentById(id);
        if (loadedDoc?.parentDocumentId) {
          const parentDoc = await getDocumentById(loadedDoc.parentDocumentId);
          if (parentDoc) setParentDocTitle(parentDoc.title);
        }
      } catch {
        // Silently ignore
      }
    }
    void loadParentTitle();

    // Subscribe to branch documents in real time — parent owner sees new merge requests instantly
    let unsubBranches: (() => void) | null = null;
    getDocumentById(id).then((loadedDoc) => {
      if (!loadedDoc || loadedDoc.parentDocumentId) return; // Only for parent docs
      unsubBranches = subscribeToBranchDocuments(loadedDoc.id, (branches) => {
        setBranchDocs(branches);
      });
    }).catch(() => undefined);

    return () => {
      unsubscribe();
      unsubBranches?.();
    };
  }, [editor, id, isLoading, isNewDocument, router, user]);

  useEffect(() => {
    if (!commentsOpen || isNewDocument) return;
    async function loadComments() {
      setCommentsLoading(true);
      try {
        setComments(await getCommentsForDocument(id));
      } catch {
        toast.error("Failed to load comments.");
      } finally {
        setCommentsLoading(false);
      }
    }
    void loadComments();
  }, [commentsOpen, id, isNewDocument]);

  useEffect(() => {
    if (!document) return;
    setPublishVisibility(document.publishVisibility ?? "public");
    setPublishAbstract(document.abstract ?? stripHtml(document.content).slice(0, 280));
    setPublishKeywords((document.keywords ?? []).join(", "));
    setPublishCoverUrl(document.coverImageUrl ?? "");
  }, [document]);

  useEffect(() => {
    if (!document || !canEdit || !hasChanges) return;
    const timer = setTimeout(async () => {
      try {
        const liveContent =
          editorModeRef.current === "quill"
            ? quillInstanceRef.current?.root.innerHTML || effectiveContent
            : editor ? editor.getHTML() : effectiveContent;
        const liveImageUrls = uniqueUrls([...extractImageUrlsFromHtml(liveContent), ...trackedImageUrls]);
        setAutoSaving(true);

        if (isNewDocument) {
          if (autosaveCreatingRef.current || !user) return;
          autosaveCreatingRef.current = true;
          const now = new Date().toISOString();
          const payload: Omit<Document, "id"> = {
            ...document,
            title: effectiveTitle,
            content: liveContent,
            imageUrls: liveImageUrls,
            // Never persist pre-populated draft versions on auto-save — user explicitly saves versions
            versions: [],
            currentVersion: 0,
            updatedAt: now,
            createdAt: document.createdAt || now,
          };
          const createdId = await createDocument({ ...payload, collaboratorIds: collaborators.map((c) => c.id) });
          setPersistedDocument({ ...payload, id: createdId });
          router.replace(`/document/${createdId}`);
          return;
        }

        const previousUrls = document.imageUrls ?? [];
        await updateDocument(document.id, {
          title: effectiveTitle,
          content: liveContent,
          imageUrls: liveImageUrls,
          updatedAt: new Date().toISOString(),
          collaboratorIds: collaborators.map((c) => c.id),
        });
        await Promise.all(
          previousUrls
            .filter((url) => !liveImageUrls.includes(url) && isFirebaseStorageUrl(url))
            .map((url) => deleteDocumentImageByUrl(url).catch(() => undefined)),
        );
        setPersistedDocument((prev) => (prev ? { ...prev, title: effectiveTitle, content: liveContent, imageUrls: liveImageUrls } : prev));
      } catch (error) {
        toast.error(`Auto-save failed: ${getErrorMessage(error)}`);
      } finally {
        autosaveCreatingRef.current = false;
        setAutoSaving(false);
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [isNewDocument, document, canEdit, hasChanges, effectiveTitle, effectiveContent, collaborators, editor, trackedImageUrls, editorMode, user, router]);

  const handleInsertLink = () => {
    setLinkDialogOpen(true);
  };

  const handleApplyLink = () => {
    if (editorMode === "quill") return toast.info("Use the link tool in the Full Toolbar.");
    if (!editor) return;
    const url = linkUrl.trim();
    if (!url) return toast.error("Enter a URL.");
    if (!/^https?:\/\//i.test(url)) return toast.error("URL must start with http:// or https://");
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    setLinkDialogOpen(false);
    setLinkUrl("https://");
  };

  const handleOpenAiDialog = () => {
    if (editorMode === "quill") return toast.info("Prompt Assistant works in Structured mode.");
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    if (empty) return toast.error("Select text first, then open AI.");

    setAiSelection({
      from,
      to,
      selectedText: editor.state.doc.textBetween(from, to, "\n"),
    });
    setAiPreview(null);
    setAiDialogOpen(true);
  };

  const preventEditorBlur = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const handleRunPrompt = async () => {
    if (editorMode === "quill") return toast.info("Prompt Assistant works in Structured mode.");
    if (!editor) return;
    const instruction = aiPrompt.trim();
    if (!instruction) return toast.error("Enter a prompt.");

    const currentSelection = aiSelection ?? (() => {
      const { from, to, empty } = editor.state.selection;
      if (empty) return null;
      return {
        from,
        to,
        selectedText: editor.state.doc.textBetween(from, to, "\n"),
      };
    })();
    if (!currentSelection) return toast.error("Select text first, then run a prompt.");

    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: instruction, selectedText: currentSelection.selectedText }),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Unknown error" }));
        toast.error(error ?? "AI request failed.");
        return;
      }

      const { output } = await res.json();
      if (!output || output === currentSelection.selectedText) {
        setAiPreview(null);
        toast.info("No changes made.");
        return;
      }

      setAiPreview({
        from: currentSelection.from,
        to: currentSelection.to,
        selectedText: currentSelection.selectedText,
        output,
        segments: buildAiDiffSegments(currentSelection.selectedText, output),
      });
      toast.success("Preview ready. Confirm edits to apply them.");
    } catch {
      toast.error("Failed to reach AI service. Check your connection.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleConfirmAiEdits = () => {
    if (!editor || !aiPreview) return;
    editor.chain().focus().setTextSelection({ from: aiPreview.from, to: aiPreview.to }).insertContent(aiPreview.output).run();
    setAiSelection(null);
    setAiPreview(null);
    setAiDialogOpen(false);
    setAiPrompt("");
    toast.success("AI edits applied.");
  };

  const handleApplyFont = () => {
    if (!canEdit) return;
    if (editorMode === "quill") return toast.info("Use font controls in the Full Toolbar.");
    if (!editor) return;
    const font = (customFont || selectedFont).trim();
    if (!font) return;
    const isSelectionEmpty = editor.state.selection.empty;
    const command = isSelectionEmpty
      ? editor.chain().focus().selectAll().setMark("textStyle", { fontFamily: font }).run()
      : editor.chain().focus().setMark("textStyle", { fontFamily: font }).run();
    if (!command) return toast.error("Could not apply font to current selection.");
    if (isSelectionEmpty) {
      editor.chain().focus().setTextSelection(editor.state.doc.content.size).run();
    }
  };

  const handleApplyFontSize = () => {
    if (!canEdit) return;
    if (editorMode === "quill") return;
    if (!editor) return;
    const size = selectedFontSize.trim();
    if (!/^\d+$/.test(size)) return toast.error("Font size must be a number.");
    const px = Math.max(8, Math.min(96, parseInt(size, 10)));
    const isSelectionEmpty = editor.state.selection.empty;
    const command = isSelectionEmpty
      ? editor.chain().focus().selectAll().setMark("textStyle", { fontSize: `${px}px` }).run()
      : editor.chain().focus().setMark("textStyle", { fontSize: `${px}px` }).run();
    if (!command) return toast.error("Could not apply font size.");
    if (isSelectionEmpty) {
      editor.chain().focus().setTextSelection(editor.state.doc.content.size).run();
    }
    setSelectedFontSize(String(px));
  };

  const handleApplyColor = () => {
    if (!canEdit) return;
    if (editorMode === "quill") return toast.info("Use color controls in the Full Toolbar.");
    if (!editor) return;
    editor.chain().focus().setColor(selectedColor).run();
  };

  const handleUndo = () => {
    if (!canEdit) return;
    if (!editor) return;
    const ok = editor.chain().focus().undo().run();
    if (!ok) toast.info("Nothing to undo.");
  };

  const handleRedo = () => {
    if (!canEdit) return;
    if (!editor) return;
    const ok = editor.chain().focus().redo().run();
    if (!ok) toast.info("Nothing to redo.");
  };

  const handleInsertReportTemplate = () => {
    if (!canEdit) return;
    const template = buildResearchReportTemplate();
    if (editorMode === "quill") {
      quillInstanceRef.current?.clipboard.dangerouslyPasteHTML(template);
      setEditorHtml(quillInstanceRef.current?.root.innerHTML || template);
    } else {
      if (!editor) return;
      editor.commands.setContent(template, { emitUpdate: true });
      setEditorHtml(editor.getHTML());
    }
    toast.success("Research report template inserted.");
  };

  const handleCreateTableOfContents = () => {
    if (!canEdit) return;
    const currentHtml = editorMode === "quill"
      ? quillInstanceRef.current?.root.innerHTML || effectiveContent
      : editor?.getHTML() ?? effectiveContent;
    const { updatedHtml, count } = buildTocAndNormalizedContent(currentHtml);
    if (!count) return toast.error("Add headings (H1/H2/H3) first.");
    if (editorMode === "quill") {
      quillInstanceRef.current?.clipboard.dangerouslyPasteHTML(updatedHtml);
    } else {
      editor?.commands.setContent(updatedHtml, { emitUpdate: true });
    }
    setEditorHtml(updatedHtml);
    toast.success(`Table of Contents created from ${count} heading${count > 1 ? "s" : ""}.`);
  };

  const handleCreateImageIndex = () => {
    if (!canEdit) return;
    const sourceHtml = editorMode === "quill"
      ? quillInstanceRef.current?.root.innerHTML || effectiveContent
      : editor?.getHTML() ?? effectiveContent;
    const withLatestToc = buildTocAndNormalizedContent(sourceHtml).updatedHtml;
    const { updatedHtml, count } = buildImageIndexAndNormalizedContent(withLatestToc);
    if (!count) return toast.error("Add at least one image first.");
    if (editorMode === "quill") {
      quillInstanceRef.current?.clipboard.dangerouslyPasteHTML(updatedHtml);
    } else {
      editor?.commands.setContent(updatedHtml, { emitUpdate: true });
    }
    setEditorHtml(updatedHtml);
    toast.success(`Image Index created with ${count} item${count > 1 ? "s" : ""}.`);
  };

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user || !document || !canEdit) return;
    if (!file.type.startsWith("image/")) return toast.error("Please upload an image.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be smaller than 5MB.");

    setImageUploading(true);
    try {
      const storageDocId = isNewDocument ? `draft-${user.id}` : document.id;
      const imageUrl = await uploadDocumentImage(storageDocId, user.id, file);
      if (editorMode === "quill") {
        const quill = quillInstanceRef.current;
        if (!quill) return;
        const range = quill.getSelection(true);
        const index = typeof range?.index === "number" ? range.index : quill.getLength();
        quill.insertEmbed(index, "image", imageUrl, "user");
        quill.setSelection(index + 1, 0);
        setEditorHtml(quill.root.innerHTML);
      } else {
        if (!editor) return;
        editor.chain().focus().setImage({ src: imageUrl }).run();
        setEditorHtml(editor.getHTML());
      }
      setTrackedImageUrls((prev) => uniqueUrls([...prev, imageUrl]));
      toast.success("Image uploaded.");
    } catch (error) {
      toast.error(`Image upload failed: ${getErrorMessage(error)}`);
    } finally {
      setImageUploading(false);
    }
  };

  const handleInsertExistingImage = (url: string) => {
    if (!canEdit) return;
    if (editorMode === "quill") {
      const quill = quillInstanceRef.current;
      if (!quill) return;
      const range = quill.getSelection(true);
      const index = typeof range?.index === "number" ? range.index : quill.getLength();
      quill.insertEmbed(index, "image", url, "user");
      quill.setSelection(index + 1, 0);
      setEditorHtml(quill.root.innerHTML);
    } else {
      if (!editor) return;
      editor.chain().focus().setImage({ src: url }).run();
      setEditorHtml(editor.getHTML());
    }
    setTrackedImageUrls((prev) => uniqueUrls([...prev, url]));
  };

  const handleApplySelectedImageStyle = (nextWidth: number, nextAlign: ImageAlign) => {
    if (!canEdit) return;
    const img = selectedImageRef.current;
    if (!img || !img.isConnected) {
      setImageEditorOpen(false);
      return toast.error("Select an image inside the document first.");
    }
    applyImageFormatting(img, nextWidth, nextAlign);
    if (editorMode === "quill") {
      const quill = quillInstanceRef.current;
      if (!quill) return;
      setEditorHtml(quill.root.innerHTML);
      return;
    }

    if (!editor) return;
    const root = editor.view.dom as HTMLElement;
    const html = root.innerHTML;
    editor.commands.setContent(html, { emitUpdate: true });
    setEditorHtml(html);
  };

  const handleNudgeSelectedImage = (axis: "x" | "y", delta: number) => {
    const img = selectedImageRef.current;
    if (!img || !img.isConnected) return toast.error("Select an image inside the document first.");
    const offset = inferImageOffsetPx(img);
    const nextLeft = axis === "x" ? offset.left + delta : offset.left;
    const nextTop = axis === "y" ? offset.top + delta : offset.top;
    img.style.position = "relative";
    img.style.left = `${nextLeft}px`;
    img.style.top = `${nextTop}px`;
    setSelectedImageLeft(nextLeft);
    setSelectedImageTop(nextTop);

    if (!editor) return;
    const root = editor.view.dom as HTMLElement;
    const html = root.innerHTML;
    editor.commands.setContent(html, { emitUpdate: true });
    setEditorHtml(html);
  };

  const handleMoveSelectedImage = (direction: "up" | "down") => {
    if (!canEdit) return;
    const img = selectedImageRef.current;
    if (!img || !img.isConnected) return toast.error("Select an image inside the document first.");

    const block = img.closest("p,div,figure") ?? img;
    const parent = block.parentElement;
    if (!parent) return;

    if (direction === "up") {
      const prev = block.previousElementSibling;
      if (prev) parent.insertBefore(block, prev);
    } else {
      const next = block.nextElementSibling;
      if (next) parent.insertBefore(next, block);
    }

    if (editorMode === "quill") {
      const quill = quillInstanceRef.current;
      if (!quill) return;
      setEditorHtml(quill.root.innerHTML);
      return;
    }

    if (!editor) return;
    const root = editor.view.dom as HTMLElement;
    const html = root.innerHTML;
    editor.commands.setContent(html, { emitUpdate: true });
    setEditorHtml(html);
  };

  const handleRemoveImage = async (url: string) => {
    if (!canEdit) return;
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nextHtml = effectiveContent.replace(new RegExp(`<img[^>]+src=["']${escaped}["'][^>]*>`, "g"), "");
    setEditorHtml(nextHtml);
    if (editorMode === "quill") {
      quillInstanceRef.current?.clipboard.dangerouslyPasteHTML(nextHtml);
    } else {
      editor?.commands.setContent(nextHtml, { emitUpdate: false });
    }
    setTrackedImageUrls((prev) => prev.filter((item) => item !== url));
    if (isFirebaseStorageUrl(url)) {
      try {
        await deleteDocumentImageByUrl(url);
      } catch {
        toast.error("Failed to delete image from storage.");
      }
    }
  };

  const handleSave = async (msg?: string) => {
    if (!document || !user || !canEdit) return;
    try {
      const liveContent =
        editorMode === "quill"
          ? quillInstanceRef.current?.root.innerHTML || effectiveContent
          : editor ? editor.getHTML() : effectiveContent;
      const liveImageUrls = uniqueUrls([...extractImageUrlsFromHtml(liveContent), ...trackedImageUrls]);
      const nextVersion: Version = {
        id: `v${document.versions.length + 1}`,
        version: document.versions.length + 1,
        content: liveContent,
        author: user.name,
        authorId: user.id,
        timestamp: new Date().toISOString(),
        message: msg?.trim() || "Updated content",
        changes: [{ type: "modification", line: 0, content: "Content updated" }],
      };
      const nextDoc = {
        ...document,
        title: effectiveTitle,
        content: liveContent,
        imageUrls: liveImageUrls,
        versions: [...document.versions, nextVersion],
        currentVersion: nextVersion.version,
        updatedAt: new Date().toISOString(),
      };
      const collaboratorIds = collaborators.map((c) => c.id);

      if (isNewDocument) {
        const createdId = await createDocument({ ...nextDoc, collaboratorIds });
        window.localStorage.removeItem(getLocalDraftKey(user.id));
        setPersistedDocument({ ...nextDoc, id: createdId });
        router.push(`/document/${createdId}`);
      } else {
        const previousUrls = document.imageUrls ?? [];
        await updateDocument(nextDoc.id, {
          title: nextDoc.title,
          content: nextDoc.content,
          imageUrls: nextDoc.imageUrls,
          versions: nextDoc.versions,
          currentVersion: nextDoc.currentVersion,
          updatedAt: nextDoc.updatedAt,
          collaboratorIds,
        });
        await Promise.all(
          previousUrls
            .filter((url) => !liveImageUrls.includes(url) && isFirebaseStorageUrl(url))
            .map((url) => deleteDocumentImageByUrl(url).catch(() => undefined)),
        );
        setPersistedDocument(nextDoc);
      }
      toast.success("Saved.");
    } catch (error) {
      toast.error(`Save failed: ${getErrorMessage(error)}`);
    }
  };

  const handleVersionChange = (versionNumber: string) => {
    const version = document?.versions.find((v) => v.version === parseInt(versionNumber, 10));
    if (!version) return;
    setSelectedVersion(version.version);
    const html = markdownToBasicHtml(version.content);
    setEditorHtml(html);
    if (editorMode === "quill") {
      quillInstanceRef.current?.clipboard.dangerouslyPasteHTML(html);
    } else {
      editor?.commands.setContent(html, { emitUpdate: false });
    }
  };

  const handleRestoreVersion = () => {
    if (!selectedVersion || !document) return;
    const version = document.versions.find((v) => v.version === selectedVersion);
    if (!version) return;
    const restoredHtml = markdownToBasicHtml(version.content);
    // Push the historical content into tracked editor state so hasChanges becomes true
    setEditorHtml(restoredHtml);
    if (editorModeRef.current === "quill") {
      quillInstanceRef.current?.clipboard.dangerouslyPasteHTML(restoredHtml);
    } else {
      editor?.commands.setContent(restoredHtml, { emitUpdate: false });
    }
    setSelectedVersion(null);
    toast.success(`Restored to v${selectedVersion} — save to keep this version.`);
  };

  const handleInviteCollaborator = async () => {
    if (!document || isNewDocument) return toast.error("Save document first.");
    if (!canInvite) return toast.error("Only the document owner can invite collaborators.");
    if (!inviteEmail.trim()) return toast.error("Enter collaborator email.");
    setInviteLoading(true);
    try {
      const invitedUser = await getUserByEmail(inviteEmail.trim().toLowerCase());
      if (!invitedUser) return toast.error("No account found with that email.");
      if (!invitedUser.verified) return toast.error("That user hasn't been verified by their university yet.");
      if (invitedUser.university?.name !== document.university) return toast.error("You can only invite users from the same university.");
      if (collaborators.some((c) => c.id === invitedUser.id)) return toast.error("This person is already a collaborator.");
      const nextCollaborators = [...collaborators, { id: invitedUser.id, name: invitedUser.name, email: invitedUser.email, role: inviteRole, joinedAt: new Date().toISOString() }];
      const updatedAt = new Date().toISOString();
      await updateDocument(document.id, { collaborators: nextCollaborators, collaboratorIds: nextCollaborators.map((c) => c.id), updatedAt });
      setPersistedDocument({ ...document, collaborators: nextCollaborators, updatedAt });
      setInviteOpen(false);
      setInviteEmail("");
      toast.success("Collaborator invited.");
    } catch {
      toast.error("Invite failed.");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCreateBranch = async () => {
    if (!document || !user || isNewDocument) return toast.error("Save document first.");
    if (!canCreateBranch) return toast.error("You need edit access to create a branch.");
    setBranchLoading(true);
    try {
      const liveContent =
        editorMode === "quill"
          ? quillInstanceRef.current?.root.innerHTML || effectiveContent
          : editor ? editor.getHTML() : effectiveContent;
      const liveImageUrls = uniqueUrls([...extractImageUrlsFromHtml(liveContent), ...trackedImageUrls]);
      const label = branchName.trim() || "Branch";
      const now = new Date().toISOString();
      const branchCollaboratorIds = Array.from(new Set([...collaborators.map((c) => c.id), user.id]));
      // Destructure out merge-request fields so they are absent (not undefined) in the new doc
      const {
        mergeRequestStatus: _mrs,
        mergeRequestMessage: _mrm,
        mergeRequestCreatedAt: _mrca,
        mergeRequestAuthorId: _mrai,
        mergeRequestAuthorName: _mran,
        mergeRequestResolvedAt: _mrra,
        mergeRequestResolvedBy: _mrrb,
        parentDocumentId: _pid,
        branchLabel: _bl,
        branchAncestorContent: _bac,
        ...baseDocFields
      } = document;
      const payload: Omit<Document, "id"> & { collaboratorIds: string[] } = {
        ...baseDocFields,
        title: `${effectiveTitle} [${label}]`,
        content: liveContent,
        imageUrls: liveImageUrls,
        ownerId: user.id,
        ownerName: user.name,
        versions: [{ id: "v1", version: 1, content: liveContent, author: user.name, authorId: user.id, timestamp: now, message: `Created branch: ${label}`, changes: [] }],
        currentVersion: 1,
        stage: "draft",
        createdAt: now,
        updatedAt: now,
        parentDocumentId: document.id,
        branchLabel: label,
        branchAncestorContent: liveContent,
        collaboratorIds: branchCollaboratorIds,
      };
      const createdId = await createDocument(payload);
      setBranchOpen(false);
      setBranchName("");
      router.push(`/document/${createdId}`);
      toast.success("Branch created. Edit freely — use 'Request Merge' when ready.");
    } catch (error) {
      toast.error(`Branch creation failed: ${getErrorMessage(error)}`);
    } finally {
      setBranchLoading(false);
    }
  };

  // Branch author submits (or re-submits) a merge request
  const handleRequestMerge = async () => {
    if (!document?.parentDocumentId || !user) return;
    if (document.mergeRequestStatus === "pending") return toast.info("A merge request is already pending review.");
    if (document.mergeRequestStatus === "merged") return toast.info("This branch has already been merged.");
    setMergeRequestLoading(true);
    try {
      // Save latest content first so the reviewer always sees the freshest version
      await handleSave(
        document.mergeRequestStatus === "rejected"
          ? "Updated before resubmitting merge request"
          : "Auto-saved before merge request",
      );
      const now = new Date().toISOString();
      const updates = {
        mergeRequestStatus: "pending" as const,
        mergeRequestMessage: mergeRequestMsg.trim() || "Requesting to merge branch changes",
        mergeRequestCreatedAt: now,
        mergeRequestAuthorId: user.id,
        mergeRequestAuthorName: user.name,
        // Clear previous rejection metadata
        mergeRequestResolvedAt: undefined,
        mergeRequestResolvedBy: undefined,
      };
      await updateDocument(document.id, updates);
      setPersistedDocument((prev) => prev ? { ...prev, ...updates } : prev);
      setMergeRequestOpen(false);
      setMergeRequestMsg("");
      toast.success(
        document.mergeRequestStatus === "rejected"
          ? "Merge request resubmitted."
          : "Merge request submitted. The document owner will review it.",
      );
    } catch (err) {
      toast.error(`Failed to submit: ${getErrorMessage(err)}`);
    } finally {
      setMergeRequestLoading(false);
    }
  };

  // Parent doc owner opens the merge review dialog — always fetches latest branch snapshot first
  const handleOpenMergeReview = async (branchDoc: Document) => {
    if (!document) return;
    try {
      // Re-fetch the branch to guarantee we're diffing the latest saved content
      const latestBranch = await getDocumentById(branchDoc.id);
      const fresh = latestBranch ?? branchDoc;
      const ancestor = fresh.branchAncestorContent ?? fresh.versions[0]?.content ?? "";
      const blocks = threeWayDiff(ancestor, document.content, fresh.content);
      setMergeDiffBlocks(blocks);
      setMergeResolutions(new Map());
      setActiveBranchDoc(fresh);
      setMergeReviewOpen(true);
    } catch (err) {
      toast.error(`Failed to load branch: ${getErrorMessage(err)}`);
    }
  };

  // Parent doc owner applies the merge
  const handleApplyMerge = async () => {
    if (!document || !activeBranchDoc || !user) return;
    const unresolvedConflicts = mergeDiffBlocks.filter(
      (b) => b.status === "conflict" && !mergeResolutions.has(b.idx),
    );
    if (unresolvedConflicts.length > 0) {
      return toast.error(`Resolve all ${unresolvedConflicts.length} conflict(s) before merging.`);
    }
    setMergeApplying(true);
    try {
      const mergedHtml = buildMergedHtml(mergeDiffBlocks, mergeResolutions);
      const now = new Date().toISOString();
      const nextVersion: Version = {
        id: `v${document.versions.length + 1}`,
        version: document.versions.length + 1,
        content: mergedHtml,
        author: user.name,
        authorId: user.id,
        timestamp: now,
        message: `Merged branch: ${activeBranchDoc.branchLabel ?? activeBranchDoc.title}`,
        changes: [],
      };
      // Update parent with merged content
      await updateDocument(document.id, {
        content: mergedHtml,
        versions: [...document.versions, nextVersion],
        currentVersion: nextVersion.version,
        updatedAt: now,
      });
      // Mark branch document as merged
      await updateDocument(activeBranchDoc.id, {
        mergeRequestStatus: "merged",
        mergeRequestResolvedAt: now,
        mergeRequestResolvedBy: user.name,
      });
      editor?.commands.setContent(mergedHtml, { emitUpdate: false });
      setPersistedDocument({ ...document, content: mergedHtml, versions: [...document.versions, nextVersion], currentVersion: nextVersion.version, updatedAt: now });
      setBranchDocs((prev) => prev.map((b) => b.id === activeBranchDoc.id ? { ...b, mergeRequestStatus: "merged", mergeRequestResolvedAt: now, mergeRequestResolvedBy: user.name } : b));
      setMergeReviewOpen(false);
      setActiveBranchDoc(null);
      toast.success("Branch merged successfully.");
    } catch (err) {
      toast.error(`Merge failed: ${getErrorMessage(err)}`);
    } finally {
      setMergeApplying(false);
    }
  };

  // Parent doc owner rejects the merge request
  const handleRejectMerge = async () => {
    if (!activeBranchDoc || !user) return;
    try {
      const now = new Date().toISOString();
      await updateDocument(activeBranchDoc.id, {
        mergeRequestStatus: "rejected",
        mergeRequestResolvedAt: now,
        mergeRequestResolvedBy: user.name,
      });
      setBranchDocs((prev) => prev.map((b) => b.id === activeBranchDoc.id ? { ...b, mergeRequestStatus: "rejected", mergeRequestResolvedAt: now, mergeRequestResolvedBy: user.name } : b));
      setMergeReviewOpen(false);
      setActiveBranchDoc(null);
      toast.success("Merge request rejected.");
    } catch (err) {
      toast.error(`Failed to reject: ${getErrorMessage(err)}`);
    }
  };

  const handlePublishCoverUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user || !document || !canPublish) return;
    if (!file.type.startsWith("image/")) return toast.error("Please upload an image.");
    if (file.size > 8 * 1024 * 1024) return toast.error("Cover image must be under 8MB.");

    setPublishCoverUploading(true);
    try {
      const uploadDocId = isNewDocument ? `draft-${user.id}` : document.id;
      const coverUrl = await uploadDocumentCover(uploadDocId, user.id, file);
      setPublishCoverUrl(coverUrl);
      toast.success("Cover image uploaded.");
    } catch (error) {
      toast.error(`Cover upload failed: ${getErrorMessage(error)}`);
    } finally {
      setPublishCoverUploading(false);
    }
  };

  const handlePublishResearch = async () => {
    if (!document || !user) return;
    if (!canPublish) return toast.error("Only the document owner can publish this research.");
    const liveContent =
      editorModeRef.current === "quill"
        ? quillInstanceRef.current?.root.innerHTML || effectiveContent
        : editor ? editor.getHTML() : effectiveContent;
    const liveImageUrls = uniqueUrls([...extractImageUrlsFromHtml(liveContent), ...trackedImageUrls]);
    const now = new Date().toISOString();
    const parsedKeywords = publishKeywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 12);
    const finalAbstract = publishAbstract.trim() || stripHtml(liveContent).slice(0, 280);

    if (publishVisibility === "public" && !publishCoverUrl) {
      return toast.error("Public publish requires a cover image.");
    }
    if (!finalAbstract) {
      return toast.error("Add an abstract before publishing.");
    }

    setPublishLoading(true);
    try {
      const publishStage: Document["stage"] = publishVisibility === "public" ? "published" : "review";

      if (isNewDocument) {
        const payload: Omit<Document, "id"> = {
          ...document,
          title: effectiveTitle,
          content: liveContent,
          imageUrls: liveImageUrls,
          coverImageUrl: publishCoverUrl || undefined,
          abstract: finalAbstract,
          keywords: parsedKeywords,
          publishVisibility,
          publishedAt: now,
          readTimeMinutes: estimateReadTimeMinutes(liveContent),
          stage: publishStage,
          updatedAt: now,
          createdAt: document.createdAt || now,
        };
        const createdId = await createDocument({ ...payload, collaboratorIds: collaborators.map((c) => c.id) });
        setPersistedDocument({ ...payload, id: createdId });
        window.localStorage.removeItem(getLocalDraftKey(user.id));
        router.replace(`/document/${createdId}`);
        setPublishOpen(false);
        toast.success(publishVisibility === "public" ? "Research published to Discover." : "Research submitted privately.");
        return;
      }

      const updatePayload: Partial<Document> & { collaboratorIds: string[] } = {
        title: effectiveTitle,
        content: liveContent,
        imageUrls: liveImageUrls,
        coverImageUrl: publishCoverUrl || undefined,
        abstract: finalAbstract,
        keywords: parsedKeywords,
        publishVisibility,
        publishedAt: now,
        readTimeMinutes: estimateReadTimeMinutes(liveContent),
        stage: publishStage,
        updatedAt: now,
        collaboratorIds: collaborators.map((c) => c.id),
      };
      await updateDocument(document.id, updatePayload);
      setPersistedDocument((prev) => (prev ? { ...prev, ...updatePayload } : prev));
      setPublishOpen(false);
      toast.success(publishVisibility === "public" ? "Research published to Discover." : "Research submitted privately.");
    } catch (error) {
      toast.error(`Publish failed: ${getErrorMessage(error)}`);
    } finally {
      setPublishLoading(false);
    }
  };

  const handleExportPdf = useCallback(() => {
    const liveContent =
      editorMode === "quill"
        ? quillInstanceRef.current?.root.innerHTML || effectiveContent
        : editor ? editor.getHTML() : effectiveContent;
    const iframe = window.document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    window.document.body.appendChild(iframe);

    const printDoc = iframe.contentWindow?.document;
    if (!printDoc || !iframe.contentWindow) {
      iframe.remove();
      return toast.error("Failed to start PDF export.");
    }

    printDoc.open();
      printDoc.write(
      `<!doctype html><html><head><meta charset="utf-8"/><title>${effectiveTitle}</title><style>
      body { font-family: Georgia, 'Times New Roman', serif; margin: 32px; color: #111827; line-height: 1.6; }
      h1, h2, h3 { line-height: 1.3; }
      img { max-width: 100%; height: auto; margin: 12px 0; }
      pre, code { font-family: 'Courier New', monospace; }
      a { color: #1d4ed8; text-decoration: underline; }
      </style></head><body>${liveContent}</body></html>`,
    );
    printDoc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 1500);
    }, 250);
  }, [editor, editorMode, effectiveContent, effectiveTitle]);

  useEffect(() => {
    if (!document || !isDiscoverReadOnlyView || !shouldAutoDownloadPdf || pdfAutoDownloadStartedRef.current) return;
    pdfAutoDownloadStartedRef.current = true;
    const timer = window.setTimeout(() => {
      handleExportPdf();
    }, 800);
    return () => window.clearTimeout(timer);
  }, [document, handleExportPdf, isDiscoverReadOnlyView, shouldAutoDownloadPdf]);

  const handleAddComment = async () => {
    if (!user || !document || isNewDocument || !newComment.trim() || !canComment) return;
    setCommentSubmitting(true);
    try {
      const created = await addCommentToDocument({ documentId: document.id, author: user.name, authorId: user.id, content: newComment.trim(), selection: { start: 0, end: 0 }, timestamp: new Date().toISOString(), resolved: false, replies: [] });
      setComments((prev) => [...prev, created]);
      setNewComment("");
      toast.success("Comment added.");
    } catch {
      toast.error("Failed to add comment.");
    } finally {
      setCommentSubmitting(false);
    }
  };

  useEffect(() => {
    if (!canEdit) return;
    const runTemplateShortcut = () => {
      const template = buildResearchReportTemplate();
      if (editorModeRef.current === "quill") {
        quillInstanceRef.current?.clipboard.dangerouslyPasteHTML(template);
        setEditorHtml(quillInstanceRef.current?.root.innerHTML || template);
      } else if (editor) {
        editor.commands.setContent(template, { emitUpdate: true });
        setEditorHtml(editor.getHTML());
      }
      toast.success("Research report template inserted.");
    };

    const runTocShortcut = () => {
      const currentHtml = editorModeRef.current === "quill"
        ? quillInstanceRef.current?.root.innerHTML || effectiveContent
        : editor?.getHTML() ?? effectiveContent;
      const { updatedHtml, count } = buildTocAndNormalizedContent(currentHtml);
      if (!count) return toast.error("Add headings (H1/H2/H3) first.");
      if (editorModeRef.current === "quill") {
        quillInstanceRef.current?.clipboard.dangerouslyPasteHTML(updatedHtml);
      } else {
        editor?.commands.setContent(updatedHtml, { emitUpdate: true });
      }
      setEditorHtml(updatedHtml);
      toast.success(`Table of Contents created from ${count} heading${count > 1 ? "s" : ""}.`);
    };

    const runImageIndexShortcut = () => {
      const sourceHtml = editorModeRef.current === "quill"
        ? quillInstanceRef.current?.root.innerHTML || effectiveContent
        : editor?.getHTML() ?? effectiveContent;
      const withLatestToc = buildTocAndNormalizedContent(sourceHtml).updatedHtml;
      const { updatedHtml, count } = buildImageIndexAndNormalizedContent(withLatestToc);
      if (!count) return toast.error("Add at least one image first.");
      if (editorModeRef.current === "quill") {
        quillInstanceRef.current?.clipboard.dangerouslyPasteHTML(updatedHtml);
      } else {
        editor?.commands.setContent(updatedHtml, { emitUpdate: true });
      }
      setEditorHtml(updatedHtml);
      toast.success(`Image Index created with ${count} item${count > 1 ? "s" : ""}.`);
    };

    const onShortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey || !event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "t") {
        event.preventDefault();
        runTocShortcut();
      } else if (key === "i") {
        event.preventDefault();
        runImageIndexShortcut();
      } else if (key === "r") {
        event.preventDefault();
        runTemplateShortcut();
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [canEdit, editor, editorMode, effectiveContent]);

  if (isLoading || !document || !user || !canViewDocument) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
          {/* Left: back + title */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button variant="ghost" size="sm" className="shrink-0" onClick={() => router.push("/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">Back</span>
            </Button>
            <div className="min-w-0">
              <Input
                value={effectiveTitle}
                onChange={(e) => setTitleDraft(e.target.value)}
                className="h-auto truncate border-0 px-0 text-base font-semibold focus-visible:ring-0 sm:text-lg"
                disabled={!canEdit}
              />
              <p className="hidden text-xs text-gray-500 sm:block">
                {stripHtml(effectiveContent).split(/\s+/).filter(Boolean).length} words
              </p>
            </div>
          </div>

          {/* Right: presence + status + actions */}
          <div className="flex shrink-0 items-center gap-1.5">
            {/* Collaborator presence avatars */}
            {otherPresence.length > 0 && (
              <div className="flex items-center gap-0.5" title={otherPresence.map((p) => p.userName).join(", ") + " online"}>
                {otherPresence.slice(0, 3).map((p) => (
                  <div
                    key={p.userId}
                    title={`${p.userName} is viewing`}
                    className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-white"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500" />
                  </div>
                ))}
                {otherPresence.length > 3 && (
                  <span className="text-xs text-gray-500">+{otherPresence.length - 3}</span>
                )}
              </div>
            )}

            {/* Status badges — hide less-critical ones on mobile */}
            <Badge variant="outline" className="hidden sm:inline-flex">
              {document.currentVersion > 0 ? `v${document.currentVersion}` : "draft"}
            </Badge>
            {isDiscoverReadOnlyView && <Badge className="hidden bg-green-100 text-green-800 sm:inline-flex">Read-only</Badge>}
            {hasChanges && !autoSaving && <Badge className="bg-amber-100 text-amber-800">Unsaved</Badge>}
            {autoSaving && <Badge className="bg-blue-100 text-blue-800">Saving…</Badge>}

            {/* Action buttons — image + AI hidden on xs, shown on sm+ */}
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => imageInputRef.current?.click()}
              disabled={!canEdit || imageUploading}
            >
              <ImagePlus className="h-4 w-4" />
              <span className="ml-1.5 hidden lg:inline">Image</span>
            </Button>
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={handleOpenAiDialog}
              disabled={!canEdit}
            >
              <Sparkles className="h-4 w-4" />
              <span className="ml-1.5 hidden lg:inline">AI</span>
            </Button>
            <Button
              size="sm"
              onClick={() => { setCommitMessage(""); setCommitOpen(true); }}
              disabled={!canEdit || !hasChanges}
            >
              <Save className="h-4 w-4" />
              <span className="ml-1.5 hidden sm:inline">
                {document.parentDocumentId ? "Save Branch" : "Save"}
              </span>
            </Button>
          </div>
        </div>
      </header>

      {/* Branch status banner — changes colour and message based on merge request state */}
      {document.parentDocumentId && (() => {
        const mrs = document.mergeRequestStatus;
        const isPending  = mrs === "pending";
        const isMerged   = mrs === "merged";
        const isRejected = mrs === "rejected";
        const bannerCls = isPending
          ? "border-b bg-blue-50 text-blue-800"
          : isMerged
          ? "border-b bg-green-50 text-green-800"
          : isRejected
          ? "border-b bg-red-50 text-red-800"
          : "border-b bg-amber-50 text-amber-800";
        const iconEl = isPending  ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                     : isMerged   ? <Check className="h-3.5 w-3.5 shrink-0" />
                     : isRejected ? <X className="h-3.5 w-3.5 shrink-0" />
                                  : <GitBranch className="h-3.5 w-3.5 shrink-0" />;
        const message = isPending
          ? "Merge request pending — editing is locked while the owner reviews your changes."
          : isMerged
          ? "This branch has been merged into the original document. No further edits are needed."
          : isRejected
          ? `Merge request rejected by ${document.mergeRequestResolvedBy ?? "the owner"}. Make your changes and resubmit.`
          : "Changes here are isolated — the original stays unchanged until the owner merges.";
        return (
          <div className={`px-4 py-2 sm:px-6 lg:px-8 ${bannerCls}`}>
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1">
              {iconEl}
              <span className="text-xs font-semibold">Branch{document.branchLabel ? ` — ${document.branchLabel}` : ""}</span>
              <span className="text-xs">of</span>
              <button
                type="button"
                className="text-xs font-medium underline underline-offset-2 opacity-80 hover:opacity-100"
                onClick={() => document.parentDocumentId && router.push(`/document/${document.parentDocumentId}`)}
              >
                {parentDocTitle ?? "original document"}
              </button>
              <span className="ml-auto text-xs opacity-75">{message}</span>
            </div>
          </div>
        );
      })()}

      {isDiscoverReadOnlyView && (
        <div className="border-b bg-green-50 px-4 py-2 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 text-xs text-green-800">
            <Globe className="h-3.5 w-3.5" />
            <span className="font-semibold">Published view</span>
            <span>This paper is read-only from Discover. Use Download PDF to save a copy.</span>
          </div>
        </div>
      )}


      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,3fr)_minmax(320px,1fr)] lg:px-8">
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 pt-6">
              {editorMode === "tiptap" && canEdit && (
                <Tabs defaultValue="text" className="border-b pb-3">
                  <TabsList className="w-full">
                    <TabsTrigger value="text">Text</TabsTrigger>
                    <TabsTrigger value="structure">Structure</TabsTrigger>
                    <TabsTrigger value="insert">Insert</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                  </TabsList>

                  <TabsContent value="text" className="mt-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => editor?.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => editor?.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => editor?.chain().focus().toggleCode().run()}><Code2 className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}>Clear</Button>
                      </div>

                      <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
                        <div className="min-w-0 space-y-2 rounded-md border p-2">
                          <p className="text-xs font-medium text-gray-600">Font Family</p>
                          <div className="flex items-center gap-2">
                            <Type className="h-4 w-4 text-gray-500" />
                            <Select value={selectedFont} onValueChange={setSelectedFont}>
                              <SelectTrigger className="h-8 flex-1 min-w-0 border-0 px-1"><SelectValue /></SelectTrigger>
                              <SelectContent className="max-h-72">
                                {FONT_PRESETS.map((font) => <SelectItem key={font} value={font}>{font}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex gap-2">
                            <Input value={customFont} onChange={(e) => setCustomFont(e.target.value)} placeholder="Any font name" className="h-8 min-w-0 flex-1" />
                            <Button size="sm" variant="outline" onClick={handleApplyFont}>Apply</Button>
                          </div>
                        </div>

                        <div className="min-w-0 space-y-2 rounded-md border p-2">
                          <p className="text-xs font-medium text-gray-600">Font Size</p>
                          <div className="flex gap-2">
                            <Select value={selectedFontSize} onValueChange={setSelectedFontSize}>
                              <SelectTrigger className="h-8 min-w-0 flex-1 border-0 px-1"><SelectValue /></SelectTrigger>
                              <SelectContent>{FONT_SIZE_PRESETS.map((size) => <SelectItem key={size} value={size}>{size}px</SelectItem>)}</SelectContent>
                            </Select>
                            <Button size="sm" variant="outline" onClick={handleApplyFontSize}>Apply</Button>
                          </div>
                        </div>

                        <div className="min-w-0 space-y-2 rounded-md border p-2">
                          <p className="text-xs font-medium text-gray-600">Text Color</p>
                          <div className="flex items-center gap-2">
                            <Palette className="h-4 w-4 text-gray-500" />
                            <input type="color" value={selectedColor} onChange={(e) => setSelectedColor(e.target.value)} className="h-8 w-10 cursor-pointer rounded border" />
                            <Input value={selectedColor} onChange={(e) => setSelectedColor(e.target.value)} className="h-8 min-w-0 flex-1" />
                            <Button size="sm" variant="outline" onClick={handleApplyColor}>Apply</Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="structure" className="mt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => editor?.chain().focus().setParagraph().run()}>Paragraph</Button>
                      <Button size="sm" variant="outline" onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => editor?.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => editor?.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => editor?.chain().focus().toggleCodeBlock().run()}><Code2 className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => editor?.chain().focus().setHorizontalRule().run()}><Minus className="h-4 w-4" /></Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="insert" className="mt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" onClick={handleInsertLink}><Link2 className="mr-2 h-4 w-4" />Link</Button>
                      <Button size="sm" variant="outline" onClick={() => imageInputRef.current?.click()}><ImagePlus className="mr-2 h-4 w-4" />Image</Button>
                      <Button size="sm" variant="outline" onClick={handleInsertReportTemplate}><Heading1 className="mr-2 h-4 w-4" />Report Template</Button>
                      <Button size="sm" variant="outline" onClick={handleCreateTableOfContents}><ListOrdered className="mr-2 h-4 w-4" />Generate TOC</Button>
                      <Button size="sm" variant="outline" onClick={handleCreateImageIndex}><ImagePlus className="mr-2 h-4 w-4" />Generate Image Index</Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="history" className="mt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" onMouseDown={(e) => e.preventDefault()} onClick={handleUndo}><Undo2 className="mr-2 h-4 w-4" />Undo</Button>
                      <Button size="sm" variant="outline" onMouseDown={(e) => e.preventDefault()} onClick={handleRedo}><Redo2 className="mr-2 h-4 w-4" />Redo</Button>
                      <Button data-tour-id="document-save-version" size="sm" onClick={() => { setCommitMessage(""); setCommitOpen(true); }} disabled={!hasChanges}>
                        <Save className="mr-2 h-4 w-4" />{document.parentDocumentId ? "Save to Branch" : "Save Version"}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              )}

              {/* Editor wrapper — ref used for mouse-position tracking */}
              <div ref={editorContainerRef} className="relative">
                {/* Floating mouse cursors for other collaborators */}
                {otherPresence
                  .filter((p) => p.mouseX != null && p.mouseY != null)
                  .map((p) => (
                    <div
                      key={p.userId}
                      className="pointer-events-none absolute z-50 select-none"
                      style={{
                        left: `${p.mouseX}%`,
                        top: `${p.mouseY}%`,
                        transform: "translate(-2px, -2px)",
                      }}
                    >
                      {/* Cursor arrow */}
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M0 0 L0 13 L3.5 9.5 L6.5 15 L8 14.5 L5 8.5 L9.5 8.5 Z" fill={p.color} stroke="white" strokeWidth="0.8" />
                      </svg>
                      {/* Name label */}
                      <span
                        className="absolute left-3 top-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
                        style={{ backgroundColor: p.color }}
                      >
                        {p.userName.split(" ")[0]}
                      </span>
                    </div>
                  ))}

                {editorMode === "quill" ? (
                  <div className="report-quill-editor rounded-md border bg-white">
                    <div ref={quillHostRef} className="min-h-[620px]" />
                  </div>
                ) : (
                  <>
                    {editor && (
                      <BubbleMenu
                        editor={editor}
                        updateDelay={0}
                        shouldShow={({ editor: currentEditor }) => {
                          const { empty } = currentEditor.state.selection;
                          return currentEditor.isEditable && !empty;
                        }}
                        className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-lg backdrop-blur"
                      >
                        <Button size="sm" variant={editor.isActive("bold") ? "default" : "outline"} onMouseDown={preventEditorBlur} onClick={() => editor.chain().focus().toggleBold().run()}>
                          <Bold className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant={editor.isActive("italic") ? "default" : "outline"} onMouseDown={preventEditorBlur} onClick={() => editor.chain().focus().toggleItalic().run()}>
                          <Italic className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant={editor.isActive("strike") ? "default" : "outline"} onMouseDown={preventEditorBlur} onClick={() => editor.chain().focus().toggleStrike().run()}>
                          <Strikethrough className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant={editor.isActive("bulletList") ? "default" : "outline"} onMouseDown={preventEditorBlur} onClick={() => editor.chain().focus().toggleBulletList().run()}>
                          <List className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant={editor.isActive("orderedList") ? "default" : "outline"} onMouseDown={preventEditorBlur} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
                          <ListOrdered className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant={editor.isActive("blockquote") ? "default" : "outline"} onMouseDown={preventEditorBlur} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
                          <Quote className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onMouseDown={preventEditorBlur} onClick={handleInsertLink}>
                          <Link2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onMouseDown={preventEditorBlur} onClick={handleOpenAiDialog}>
                          <Sparkles className="mr-1 h-4 w-4" />AI
                        </Button>
                      </BubbleMenu>
                    )}
                    <EditorContent editor={editor} className={`min-h-[620px] rounded-md border bg-white p-4 ${!canEdit ? "prose max-w-none cursor-default" : ""}`} />
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4" />Version History
                <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">{document.versions.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 p-3">
              <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                {document.versions.length === 0 && (
                  <p className="py-4 text-center text-xs text-gray-400">
                    No saved versions yet.{"\n"}Use &quot;Save&quot; to create v1.
                  </p>
                )}
                {document.versions.slice().reverse().map((v) => {
                  const isCurrent = v.version === document.currentVersion && !selectedVersion;
                  const isPreviewing = v.version === selectedVersion;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => handleVersionChange(v.version.toString())}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                        isPreviewing
                          ? "border-blue-400 bg-blue-50 ring-1 ring-blue-300"
                          : isCurrent
                          ? "border-green-300 bg-green-50"
                          : "border-transparent bg-gray-50 hover:bg-gray-100"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-gray-700">v{v.version}</span>
                        {isCurrent && <span className="flex items-center gap-0.5 text-green-600 font-medium"><CheckCircle2 className="h-3 w-3" />current</span>}
                        {isPreviewing && !isCurrent && <span className="flex items-center gap-0.5 text-blue-600 font-medium"><Eye className="h-3 w-3" />preview</span>}
                      </div>
                      <p className="mt-0.5 truncate text-gray-600">{v.message || "No message"}</p>
                      <div className="mt-1 flex items-center justify-between text-gray-400">
                        <span>{v.author}</span>
                        <span>{new Date(v.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {selectedVersion && selectedVersion !== document.currentVersion && (
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => { setSelectedVersion(null); editor?.commands.setContent(markdownToBasicHtml(document.content), { emitUpdate: false }); }}>
                    Cancel
                  </Button>
                  <Button size="sm" className="flex-1 text-xs" onClick={handleRestoreVersion}>
                    <RotateCcw className="mr-1 h-3 w-3" />Restore v{selectedVersion}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" />Collaborators</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {collaborators.map((collab) => (
                <div key={collab.id} className="flex items-center gap-2">
                  <Avatar className="h-8 w-8"><AvatarFallback>{collab.name.split(" ").map((n) => n[0]).join("")}</AvatarFallback></Avatar>
                  <div className="flex-1"><p className="text-sm font-medium">{collab.name}</p><p className="text-xs text-gray-500">{collab.role}</p></div>
                </div>
              ))}
              {canInvite && (
                <Button data-tour-id="document-invite" variant="outline" size="sm" className="w-full" onClick={() => setInviteOpen(true)}><Share2 className="mr-2 h-4 w-4" />Invite</Button>
              )}
            </CardContent>
          </Card>

          {/* ── Merge Requests card — visible on both parent and branch docs ── */}
          {(document.parentDocumentId || !document.parentDocumentId) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <GitMerge className="h-4 w-4" />
                  {document.parentDocumentId ? "Your Merge Request" : "Merge Requests"}
                  {(() => {
                    if (document.parentDocumentId) return null;
                    const pendingCount = branchDocs.filter((b) => b.mergeRequestStatus === "pending").length;
                    return pendingCount > 0
                      ? <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">{pendingCount}</span>
                      : <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">{branchDocs.length}</span>;
                  })()}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-3">
                {document.parentDocumentId ? (
                  // Branch view — show this branch's own merge request status
                  document.mergeRequestStatus ? (
                    <div className={`rounded-lg border p-2.5 text-xs ${
                      document.mergeRequestStatus === "pending"  ? "border-amber-300 bg-amber-50" :
                      document.mergeRequestStatus === "merged"   ? "border-green-200 bg-green-50" :
                      document.mergeRequestStatus === "rejected" ? "border-red-200 bg-red-50" :
                                                                    "border-gray-200 bg-gray-50"
                    }`}>
                      <div className="flex items-center justify-between gap-1">
                        <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          document.mergeRequestStatus === "pending"  ? "bg-amber-100 text-amber-700" :
                          document.mergeRequestStatus === "merged"   ? "bg-green-100 text-green-700" :
                          document.mergeRequestStatus === "rejected" ? "bg-red-100 text-red-700" :
                                                                        "bg-gray-100 text-gray-500"
                        }`}>
                          {document.mergeRequestStatus === "pending"  && <AlertTriangle className="h-2.5 w-2.5" />}
                          {document.mergeRequestStatus === "merged"   && <Check className="h-2.5 w-2.5" />}
                          {document.mergeRequestStatus === "rejected" && <X className="h-2.5 w-2.5" />}
                          {document.mergeRequestStatus.charAt(0).toUpperCase() + document.mergeRequestStatus.slice(1)}
                        </span>
                        {document.mergeRequestStatus === "rejected" && (
                          <button
                            type="button"
                            onClick={() => { setMergeRequestMsg(""); setMergeRequestOpen(true); }}
                            className="rounded bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-red-600 transition-colors"
                          >
                            Resubmit
                          </button>
                        )}
                      </div>
                      {document.mergeRequestMessage && <p className="mt-1 italic text-gray-500 line-clamp-2">&quot;{document.mergeRequestMessage}&quot;</p>}
                      {document.mergeRequestCreatedAt && <p className="mt-1 text-gray-400">Submitted {new Date(document.mergeRequestCreatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>}
                      {document.mergeRequestResolvedBy && (
                        <p className="mt-0.5 text-gray-400">
                          {document.mergeRequestStatus === "merged" ? "Merged" : "Rejected"} by {document.mergeRequestResolvedBy}
                        </p>
                      )}
                      {document.mergeRequestStatus === "rejected" && (
                        <p className="mt-1.5 text-red-600 font-medium">Make your changes above and resubmit.</p>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-gray-200 py-5 text-center">
                      <GitBranch className="h-6 w-6 text-gray-300" />
                      <p className="text-xs text-gray-400">No merge request yet.{"\n"}Use &quot;Request Merge&quot; in Actions.</p>
                    </div>
                  )
                ) : (
                  // Parent view — show all branch documents
                  branchDocs.length === 0 ? (
                    <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-gray-200 py-5 text-center">
                      <GitBranch className="h-6 w-6 text-gray-300" />
                      <p className="text-xs text-gray-400">No branches yet.{"\n"}Create a branch to start collaborating.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {branchDocs.map((b) => {
                        const status = b.mergeRequestStatus;
                        const isPending = status === "pending";
                        const isMerged  = status === "merged";
                        return (
                          <div key={b.id} className={`rounded-lg border p-2.5 text-xs ${
                            isPending ? "border-amber-300 bg-amber-50" :
                            isMerged  ? "border-green-200 bg-green-50" :
                                        "border-gray-200 bg-gray-50"
                          }`}>
                            <div className="flex items-start justify-between gap-1">
                              {status ? (
                                <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                  isPending ? "bg-amber-100 text-amber-700" :
                                  isMerged  ? "bg-green-100 text-green-700" :
                                              "bg-gray-100 text-gray-500"
                                }`}>
                                  {isPending && <AlertTriangle className="h-2.5 w-2.5" />}
                                  {isMerged  && <Check className="h-2.5 w-2.5" />}
                                  {status === "rejected" && <X className="h-2.5 w-2.5" />}
                                  {status.charAt(0).toUpperCase() + status.slice(1)}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                                  <GitBranch className="h-2.5 w-2.5" />Branch
                                </span>
                              )}
                              {isPending && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenMergeReview(b)}
                                  className="rounded bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-amber-600 transition-colors"
                                >
                                  Review
                                </button>
                              )}
                            </div>
                            <p className="mt-1.5 font-medium text-gray-700 truncate">{b.branchLabel ?? b.title}</p>
                            {b.mergeRequestMessage && <p className="mt-0.5 italic text-gray-500 line-clamp-2">&quot;{b.mergeRequestMessage}&quot;</p>}
                            <div className="mt-1.5 flex items-center justify-between text-gray-400">
                              <span>{b.mergeRequestAuthorName ?? b.ownerName}</span>
                              {b.mergeRequestCreatedAt && <span>{new Date(b.mergeRequestCreatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
                            </div>
                            {b.mergeRequestResolvedBy && <p className="mt-0.5 text-gray-400">{isMerged ? "Merged" : "Rejected"} by {b.mergeRequestResolvedBy}</p>}
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {canPublish && (
                <Button data-tour-id="document-publish" variant="default" size="sm" className="w-full justify-start" onClick={() => setPublishOpen(true)}>
                  {publishVisibility === "public" ? <Globe className="mr-2 h-4 w-4 shrink-0" /> : <Lock className="mr-2 h-4 w-4 shrink-0" />}
                  Publish Research
                </Button>
              )}
              {canEdit && (
                <>
                  <Button variant="outline" size="sm" className="h-auto w-full justify-start py-2 text-left leading-tight" onClick={handleInsertReportTemplate}>
                    <Heading1 className="mr-2 h-4 w-4 shrink-0" />
                    <span>Report Template <span className="block text-xs text-gray-500">Ctrl+Alt+R</span></span>
                  </Button>
                  <Button variant="outline" size="sm" className="h-auto w-full justify-start py-2 text-left leading-tight" onClick={handleCreateTableOfContents}>
                    <ListOrdered className="mr-2 h-4 w-4 shrink-0" />
                    <span>Create Table of Contents <span className="block text-xs text-gray-500">Ctrl+Alt+T</span></span>
                  </Button>
                  <Button variant="outline" size="sm" className="h-auto w-full justify-start py-2 text-left leading-tight" onClick={handleCreateImageIndex}>
                    <ImagePlus className="mr-2 h-4 w-4 shrink-0" />
                    <span>Create Image Index <span className="block text-xs text-gray-500">Ctrl+Alt+I</span></span>
                  </Button>
                </>
              )}
              {/* Branch: only on non-branch documents */}
              {canCreateBranch && (
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setBranchOpen(true)}>
                  <GitBranch className="mr-2 h-4 w-4 shrink-0" />Create Branch
                </Button>
              )}
              {/* Request Merge: shown on branch documents */}
              {document.parentDocumentId && (
                <Button
                  size="sm"
                  variant={document.mergeRequestStatus === "pending" || document.mergeRequestStatus === "merged" ? "outline" : document.mergeRequestStatus === "rejected" ? "destructive" : "default"}
                  className="w-full justify-start"
                  disabled={document.mergeRequestStatus === "pending" || document.mergeRequestStatus === "merged"}
                  onClick={() => { setMergeRequestMsg(""); setMergeRequestOpen(true); }}
                >
                  <GitMerge className="mr-2 h-4 w-4 shrink-0" />
                  {document.mergeRequestStatus === "pending"  ? "Merge Request Pending…" :
                   document.mergeRequestStatus === "merged"   ? "Already Merged" :
                   document.mergeRequestStatus === "rejected" ? "Resubmit Merge Request" :
                                                                "Request Merge"}
                </Button>
              )}
              <Button data-tour-id="document-export" variant={isDiscoverReadOnlyView ? "default" : "outline"} size="sm" className="w-full justify-start" onClick={handleExportPdf}><Download className="mr-2 h-4 w-4 shrink-0" />Download PDF</Button>
              {canComment && (
                <Button data-tour-id="document-comments" variant="outline" size="sm" className="w-full justify-start" onClick={() => setCommentsOpen(true)}><MessageSquare className="mr-2 h-4 w-4 shrink-0" />Comments ({comments.length})</Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ImagePlus className="h-4 w-4" />Image Library
                {allImageUrls.length > 0 && (
                  <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">{allImageUrls.length}</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-3">
              {allImageUrls.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-200 py-6 text-center">
                  <ImagePlus className="h-7 w-7 text-gray-300" />
                  <p className="text-xs text-gray-400">No images yet.<br />Upload one using the toolbar.</p>
                </div>
              ) : (
                allImageUrls.map((url, i) => (
                  <div key={`${url}-${i}`} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                    <div className="relative h-28 w-full bg-gray-50">
                      <NextImage
                        src={url}
                        alt={`img-${i + 1}`}
                        fill
                        unoptimized
                        sizes="320px"
                        className="object-cover transition-opacity duration-200"
                      />
                      <span className="absolute left-1.5 top-1.5 rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        #{i + 1}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 divide-x border-t">
                      {canEdit ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleInsertExistingImage(url)}
                            className="flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <ImagePlus className="h-3 w-3" />Insert
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRemoveImage(url)}
                            className="flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />Remove
                          </button>
                        </>
                      ) : (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="col-span-2 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Open image
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite Collaborator</DialogTitle><DialogDescription>Invite existing user by email.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="invite-email">Email</Label><Input id="invite-email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "editor" | "viewer")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="editor">Editor</SelectItem><SelectItem value="viewer">Viewer</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInviteCollaborator} disabled={inviteLoading}>{inviteLoading ? "Inviting..." : "Invite"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={branchOpen} onOpenChange={setBranchOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Branch</DialogTitle><DialogDescription>Create an independent copy of this document to work on separately. When ready, request a merge back.</DialogDescription></DialogHeader>
          <div className="space-y-2"><Label htmlFor="branch-name">Branch name</Label><Input id="branch-name" value={branchName} onChange={(e) => setBranchName(e.target.value)} placeholder="e.g. methodology-revision" /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBranchOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateBranch} disabled={branchLoading}>{branchLoading ? "Creating..." : "Create Branch"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Branch author: submit / resubmit merge request */}
      <Dialog open={mergeRequestOpen} onOpenChange={setMergeRequestOpen}>
        <DialogContent className="w-full max-w-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="h-4 w-4" />
              {document.mergeRequestStatus === "rejected" ? "Resubmit Merge Request" : "Request Merge"}
            </DialogTitle>
            <DialogDescription>
              {document.mergeRequestStatus === "rejected"
                ? "Your previous request was rejected. Your changes have been updated — describe what you changed and resubmit for review."
                : "Ask the original document owner to review and merge your branch changes."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="merge-msg">Description (optional)</Label>
            <Textarea
              id="merge-msg"
              value={mergeRequestMsg}
              onChange={(e) => setMergeRequestMsg(e.target.value)}
              placeholder="Describe what you changed and why it should be merged…"
              className="min-h-20"
              disabled={mergeRequestLoading}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeRequestOpen(false)} disabled={mergeRequestLoading}>Cancel</Button>
            <Button onClick={handleRequestMerge} disabled={mergeRequestLoading}>
              {mergeRequestLoading ? "Submitting…" : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Parent doc owner: review merge request with diff */}
      <Dialog open={mergeReviewOpen} onOpenChange={(open) => { if (!mergeApplying) setMergeReviewOpen(open); }}>
        <DialogContent className="w-full max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><GitMerge className="h-4 w-4" />Review Merge Request</DialogTitle>
            {activeBranchDoc && (
              <DialogDescription>
                <strong>{activeBranchDoc.mergeRequestAuthorName ?? activeBranchDoc.ownerName}</strong> wants to merge <em>{activeBranchDoc.branchLabel ?? activeBranchDoc.title}</em> into this document.
                {activeBranchDoc.mergeRequestMessage && <><br /><span className="italic">&quot;{activeBranchDoc.mergeRequestMessage}&quot;</span></>}
              </DialogDescription>
            )}
          </DialogHeader>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-green-200" />Branch addition</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-orange-100 border border-orange-300" />Parent-only (preserved)</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-yellow-200 border border-yellow-400" />Conflict — choose a version</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-gray-100" />Unchanged</span>
          </div>

          {/* Diff viewer */}
          <div className="max-h-96 overflow-y-auto rounded-lg border text-sm font-mono">
            {mergeDiffBlocks.length === 0 && (
              <p className="p-4 text-gray-500 text-center">No differences detected.</p>
            )}
            {mergeDiffBlocks.map((block) => {
              if (block.status === "unchanged") {
                return (
                  <div key={block.idx} className="border-b border-gray-100 bg-white px-3 py-1.5 text-gray-400 text-xs last:border-0">
                    {block.text}
                  </div>
                );
              }
              if (block.status === "branch-add") {
                return (
                  <div key={block.idx} className="border-b border-green-100 bg-green-50 px-3 py-1.5 last:border-0 flex gap-2">
                    <span className="shrink-0 font-bold text-green-600">+</span>
                    <span className="text-green-800">{block.text}</span>
                  </div>
                );
              }
              if (block.status === "parent-only") {
                return (
                  <div key={block.idx} className="border-b border-orange-100 bg-orange-50 px-3 py-1.5 last:border-0 flex gap-2">
                    <span className="shrink-0 font-bold text-orange-400">~</span>
                    <span className="text-orange-700">{block.text}</span>
                  </div>
                );
              }
              // conflict
              const resolution = mergeResolutions.get(block.idx);
              return (
                <div key={block.idx} className="border-b border-yellow-300 bg-yellow-50 px-3 py-2 last:border-0 space-y-1">
                  <div className="flex items-center gap-1 text-xs font-semibold text-yellow-700">
                    <AlertTriangle className="h-3 w-3" />CONFLICT — pick a version:
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMergeResolutions((prev) => new Map(prev).set(block.idx, "parent"))}
                      className={`rounded border p-2 text-left text-xs transition-colors ${resolution === "parent" ? "border-blue-400 bg-blue-100 ring-1 ring-blue-400" : "border-gray-200 bg-white hover:bg-gray-50"}`}
                    >
                      <div className="mb-1 flex items-center gap-1 font-semibold text-blue-700">
                        {resolution === "parent" && <Check className="h-3 w-3" />}Keep Parent
                      </div>
                      <span className="text-gray-600">{block.text}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMergeResolutions((prev) => new Map(prev).set(block.idx, "branch"))}
                      className={`rounded border p-2 text-left text-xs transition-colors ${resolution === "branch" ? "border-green-400 bg-green-100 ring-1 ring-green-400" : "border-gray-200 bg-white hover:bg-gray-50"}`}
                    >
                      <div className="mb-1 flex items-center gap-1 font-semibold text-green-700">
                        {resolution === "branch" && <Check className="h-3 w-3" />}Use Branch
                      </div>
                      <span className="text-gray-600">{block.branchText}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Conflict summary */}
          {(() => {
            const total = mergeDiffBlocks.filter((b) => b.status === "conflict").length;
            const resolved = mergeDiffBlocks.filter((b) => b.status === "conflict" && mergeResolutions.has(b.idx)).length;
            return total > 0 ? (
              <p className={`text-xs font-medium ${resolved < total ? "text-yellow-600" : "text-green-600"}`}>
                {resolved < total ? <><AlertTriangle className="inline h-3 w-3 mr-1" />{total - resolved} conflict(s) still need resolution</> : <><Check className="inline h-3 w-3 mr-1" />All conflicts resolved — ready to merge</>}
              </p>
            ) : null;
          })()}

          <DialogFooter className="gap-2">
            <Button variant="outline" className="text-red-600 hover:bg-red-50" onClick={handleRejectMerge} disabled={mergeApplying}>
              <X className="mr-1.5 h-4 w-4" />Reject
            </Button>
            <Button variant="outline" onClick={() => setMergeReviewOpen(false)} disabled={mergeApplying}>Close</Button>
            <Button
              onClick={handleApplyMerge}
              disabled={mergeApplying || mergeDiffBlocks.filter((b) => b.status === "conflict" && !mergeResolutions.has(b.idx)).length > 0}
            >
              <GitMerge className="mr-1.5 h-4 w-4" />
              {mergeApplying ? "Merging…" : "Merge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Commit / Save Version dialog */}
      <Dialog open={commitOpen} onOpenChange={setCommitOpen}>
        <DialogContent className="w-full max-w-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {document.parentDocumentId ? <GitBranch className="h-4 w-4" /> : <GitCommit className="h-4 w-4" />}
              {document.parentDocumentId ? "Save Branch Changes" : "Save Version"}
            </DialogTitle>
            <DialogDescription>
              {document.parentDocumentId
                ? "Changes are saved to this branch only. The original document stays unchanged until the owner merges your request."
                : "Describe what changed in this version. This becomes part of your version history."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="commit-msg">Commit message</Label>
            <input
              id="commit-msg"
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { void handleSave(commitMessage); setCommitOpen(false); } }}
              placeholder="e.g. Added methodology section"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <p className="text-xs text-gray-400">Press Enter or click Save to commit · leave blank for a generic message</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommitOpen(false)}>Cancel</Button>
            <Button onClick={() => { void handleSave(commitMessage); setCommitOpen(false); }}>
              <Save className="mr-2 h-4 w-4" />Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={commentsOpen} onOpenChange={setCommentsOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Comments</DialogTitle><DialogDescription>Paper discussion.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-3">
              {commentsLoading ? <p className="text-sm text-gray-500">Loading...</p> : comments.length === 0 ? <p className="text-sm text-gray-500">No comments yet.</p> : comments.map((comment) => (
                <div key={comment.id} className="rounded-md border bg-white p-2">
                  <p className="text-xs text-gray-500">{comment.author} - {new Date(comment.timestamp).toLocaleString()}</p>
                  <p className="text-sm">{comment.content}</p>
                </div>
              ))}
            </div>
            <Textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Write a comment..." className="min-h-24" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentsOpen(false)}>Close</Button>
            <Button onClick={handleAddComment} disabled={commentSubmitting || !newComment.trim()}>{commentSubmitting ? "Posting..." : "Post Comment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Link</DialogTitle>
            <DialogDescription>Paste a full URL and apply it to selected text.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="link-url">URL</Label>
            <Input id="link-url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://example.com" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleApplyLink}>Apply Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={aiDialogOpen}
        onOpenChange={(open) => {
          if (aiLoading) return;
          setAiDialogOpen(open);
          if (!open) {
            setAiPreview(null);
            setAiSelection(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI Prompt Assistant</DialogTitle>
            <DialogDescription>Select text in the document, then describe what you want done — e.g. &quot;summarize in 3 bullet points&quot;, &quot;rewrite more formally&quot;, &quot;expand with more detail&quot;.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ai-prompt">Prompt</Label>
            <Textarea
              id="ai-prompt"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !aiLoading) handleRunPrompt(); }}
              placeholder="Example: summarize this in 2 sentences, rewrite more formally, convert to bullet points"
              className="min-h-24"
              disabled={aiLoading}
            />
          </div>
          {aiPreview && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-green-200" />Added</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-red-200" />Removed</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-yellow-200" />Changed</span>
              </div>
              <div className="max-h-72 overflow-y-auto rounded-lg border bg-slate-50 p-3 text-sm leading-7">
                <div className="whitespace-pre-wrap break-words">
                  {aiPreview.segments.map((segment, index) => {
                    if (segment.type === "unchanged") {
                      return <span key={index} className="text-slate-700">{segment.value}</span>;
                    }
                    if (segment.type === "add") {
                      return <span key={index} className="rounded bg-green-100 px-0.5 text-green-900">{segment.value}</span>;
                    }
                    if (segment.type === "remove") {
                      return <span key={index} className="rounded bg-red-100 px-0.5 text-red-800 line-through">{segment.value}</span>;
                    }
                    return (
                      <span key={index} className="inline-flex flex-wrap items-center gap-1 rounded bg-yellow-100 px-1 py-0.5 text-yellow-900">
                        <span className="line-through text-red-700">{segment.value}</span>
                        <span className="font-medium">{segment.nextValue}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Nothing is inserted into the document until you confirm the edits.
              </p>
            </div>
          )}
          <Button onClick={handleConfirmAiEdits} disabled={aiLoading || !aiPreview}>Confirm Edits</Button>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAiDialogOpen(false);
                setAiPreview(null);
                setAiSelection(null);
              }}
              disabled={aiLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleRunPrompt} disabled={aiLoading}>
              {aiLoading ? "Thinking…" : "Apply Prompt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={imageEditorOpen} onOpenChange={setImageEditorOpen}>
        <DialogContent className="w-full max-w-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ImagePlus className="h-4 w-4" />Image Editor</DialogTitle>
            <DialogDescription>Resize and align the selected image.</DialogDescription>
          </DialogHeader>

          {/* Preview */}
          {selectedImageSrc && (
            <div className="flex justify-center rounded-lg border bg-gray-50 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedImageSrc}
                alt="preview"
                className="max-h-36 max-w-full rounded object-contain"
              />
            </div>
          )}

          <div className="space-y-5">
            {/* Size slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Width</span>
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-sm font-mono">{selectedImageWidth}%</span>
              </div>
              <input
                type="range"
                min={20}
                max={100}
                step={5}
                value={selectedImageWidth}
                onChange={(e) => {
                  const width = Number(e.target.value);
                  setSelectedImageWidth(width);
                  handleApplySelectedImageStyle(width, selectedImageAlign);
                }}
                className="h-2 w-full cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>20%</span><span>60%</span><span>100%</span>
              </div>
            </div>

            {/* Alignment */}
            <div className="space-y-2">
              <span className="text-sm font-medium">Alignment</span>
              <div className="grid grid-cols-3 gap-2">
                {(["left", "center", "right"] as const).map((align) => {
                  const Icon = align === "left" ? AlignLeft : align === "center" ? AlignCenter : AlignRight;
                  return (
                    <Button
                      key={align}
                      size="sm"
                      variant={selectedImageAlign === align ? "default" : "outline"}
                      className="flex items-center gap-1.5 capitalize"
                      onClick={() => { setSelectedImageAlign(align); handleApplySelectedImageStyle(selectedImageWidth, align); }}
                    >
                      <Icon className="h-3.5 w-3.5" />{align}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Fine position nudge */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Fine Position</span>
                <span className="text-xs text-gray-400">X {selectedImageLeft}px · Y {selectedImageTop}px</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Button size="sm" variant="outline" className="w-10 h-8 p-0" onClick={() => handleNudgeSelectedImage("y", -10)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="w-10 h-8 p-0" onClick={() => handleNudgeSelectedImage("x", -10)}><ChevronLeft className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="outline" className="w-10 h-8 p-0 text-gray-300 cursor-default" disabled><Minus className="h-3 w-3" /></Button>
                  <Button size="sm" variant="outline" className="w-10 h-8 p-0" onClick={() => handleNudgeSelectedImage("x", 10)}><ChevronRight className="h-3.5 w-3.5" /></Button>
                </div>
                <Button size="sm" variant="outline" className="w-10 h-8 p-0" onClick={() => handleNudgeSelectedImage("y", 10)}><ArrowDown className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button className="w-full sm:w-auto" onClick={() => setImageEditorOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Publish Research</DialogTitle>
            <DialogDescription>
              Decide visibility, add a cover image, abstract, and keywords. Public publish appears in Discover.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Visibility</Label>
                <Select value={publishVisibility} onValueChange={(value) => setPublishVisibility(value as "public" | "private")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public (Discover)</SelectItem>
                    <SelectItem value="private">Private / Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estimated read time</Label>
                <div className="rounded-md border px-3 py-2 text-sm text-gray-700">
                  {estimateReadTimeMinutes(effectiveContent)} min read
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cover image {publishVisibility === "public" ? "(Required for public)" : "(Optional)"}</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" onClick={() => publishCoverInputRef.current?.click()} disabled={publishCoverUploading}>
                  <ImagePlus className="mr-2 h-4 w-4" />
                  {publishCoverUploading ? "Uploading..." : "Upload Cover"}
                </Button>
                <input
                  ref={publishCoverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePublishCoverUpload}
                />
                {publishCoverUrl && <span className="text-xs text-green-700">Cover ready</span>}
              </div>
              {publishCoverUrl && (
                <div className="relative h-40 w-full overflow-hidden rounded-md border">
                  <NextImage src={publishCoverUrl} alt="cover-preview" fill unoptimized className="object-cover" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="publish-abstract">Abstract</Label>
              <Textarea
                id="publish-abstract"
                value={publishAbstract}
                onChange={(e) => setPublishAbstract(e.target.value)}
                className="min-h-24"
                placeholder="Write a clear summary of your research contribution."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="publish-keywords">Keywords (comma separated)</Label>
              <Input
                id="publish-keywords"
                value={publishKeywords}
                onChange={(e) => setPublishKeywords(e.target.value)}
                placeholder="machine learning, healthcare, computer vision"
              />
            </div>

            <div className="rounded-md border bg-gray-50 p-3 text-sm text-gray-700">
              <p><strong>Author:</strong> {user.name}</p>
              <p><strong>University:</strong> {user.university.name}</p>
              <p><strong>Title:</strong> {effectiveTitle}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>Cancel</Button>
            <Button onClick={handlePublishResearch} disabled={publishLoading || publishCoverUploading}>
              {publishLoading ? "Publishing..." : "Publish Research"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
