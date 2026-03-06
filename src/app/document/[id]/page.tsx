"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import NextImage from "next/image";
import { useAuth } from "@/lib/auth-context";
import { type Comment, type Document, type User, type Version } from "@/lib/types";
import {
  addCommentToDocument,
  createDocument,
  getCommentsForDocument,
  getDocumentById,
  getUserByEmail,
  updateDocument,
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
} from "lucide-react";
import { EditorContent, useEditor } from "@tiptap/react";
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
  const starterContent = "<h1>Untitled Research Paper</h1><p>Start writing your research here...</p>";
  return {
    id: `doc-new-${Date.now()}`,
    title: "Untitled Research Paper",
    content: starterContent,
    imageUrls: [],
    ownerId: user.id,
    ownerName: user.name,
    collaborators: [{ id: user.id, name: user.name, email: user.email, role: "owner", joinedAt: now }],
    versions: [{ id: "v1", version: 1, content: starterContent, author: user.name, authorId: user.id, timestamp: now, message: "Initial commit", changes: [] }],
    currentVersion: 1,
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

export default function DocumentEditorPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const isNewDocument = id === "new";
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const quillHostRef = useRef<HTMLDivElement | null>(null);
  const quillInstanceRef = useRef<QuillInstance | null>(null);
  const quillSyncGuardRef = useRef(false);
  const quillLatestHtmlRef = useRef("<p></p>");
  const editorModeRef = useRef<"quill" | "tiptap">("tiptap");
  const autosaveCreatingRef = useRef(false);
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

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const [branchName, setBranchName] = useState("");
  const [branchLoading, setBranchLoading] = useState(false);
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
  const canEdit = !!user;

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
    ],
    content: baseContent,
    onUpdate: ({ editor: e }) => setEditorHtml(e.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    if ((editorHtml || baseContent) !== baseContent) return;
    editor.commands.setContent(baseContent, { emitUpdate: false });
  }, [editor, baseContent, editorHtml]);

  useEffect(() => {
    setTrackedImageUrls(extractImageUrlsFromHtml(baseContent));
  }, [baseContent]);

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
  }, [editorMode]);

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
  }, [editor, editorMode]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) return router.push("/");
    if (isNewDocument) return;

    async function loadDocument() {
      try {
        const existingDoc = await getDocumentById(id);
        if (!existingDoc) {
          toast.error("Document not found.");
          router.push("/dashboard");
          return;
        }
        setPersistedDocument(existingDoc);
        setTitleDraft(existingDoc.title);
        setEditorHtml(markdownToBasicHtml(existingDoc.content));
      } catch {
        toast.error("Failed to load document.");
        router.push("/dashboard");
      }
    }
    void loadDocument();
  }, [id, isLoading, isNewDocument, router, user]);

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

  const handleRunPrompt = () => {
    if (editorMode === "quill") return toast.info("Prompt Assistant works in Structured mode.");
    if (!editor) return;
    const instruction = aiPrompt.trim();
    if (!instruction) return toast.error("Enter a prompt.");

    const { from, to, empty } = editor.state.selection;
    if (empty) return toast.error("Select text first, then run a prompt.");

    const selectedText = editor.state.doc.textBetween(from, to, "\n");
    const output = applyLocalPrompt(instruction, selectedText);
    if (!output || output === selectedText) {
      toast.info("No changes made. Try a clearer prompt like: summarize, expand, title case.");
      return;
    }

    editor.chain().focus().insertContentAt({ from, to }, output).run();
    setAiDialogOpen(false);
    setAiPrompt("");
    toast.success("Prompt applied.");
  };

  const handleApplyFont = () => {
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
    if (editorMode === "quill") return toast.info("Use color controls in the Full Toolbar.");
    if (!editor) return;
    editor.chain().focus().setColor(selectedColor).run();
  };

  const handleUndo = () => {
    if (!editor) return;
    const ok = editor.chain().focus().undo().run();
    if (!ok) toast.info("Nothing to undo.");
  };

  const handleRedo = () => {
    if (!editor) return;
    const ok = editor.chain().focus().redo().run();
    if (!ok) toast.info("Nothing to redo.");
  };

  const handleInsertReportTemplate = () => {
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
    if (!file || !user || !document) return;
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

  const handleSave = async () => {
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
        message: "Updated content",
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
    if (!selectedVersion) return;
    setSelectedVersion(null);
    toast.success("Version restored.");
  };

  const handleInviteCollaborator = async () => {
    if (!document || isNewDocument) return toast.error("Save document first.");
    if (!inviteEmail.trim()) return toast.error("Enter collaborator email.");
    setInviteLoading(true);
    try {
      const invitedUser = await getUserByEmail(inviteEmail.trim().toLowerCase());
      if (!invitedUser) return toast.error("User not found.");
      if (collaborators.some((c) => c.id === invitedUser.id)) return toast.error("Already a collaborator.");
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
    setBranchLoading(true);
    try {
      const liveContent =
        editorMode === "quill"
          ? quillInstanceRef.current?.root.innerHTML || effectiveContent
          : editor ? editor.getHTML() : effectiveContent;
      const liveImageUrls = uniqueUrls([...extractImageUrlsFromHtml(liveContent), ...trackedImageUrls]);
      const label = branchName.trim() || "Branch";
      const now = new Date().toISOString();
      const payload = {
        ...document,
        title: `${effectiveTitle} [${label}]`,
        content: liveContent,
        imageUrls: liveImageUrls,
        versions: [...document.versions, { id: `v${document.versions.length + 1}`, version: document.versions.length + 1, content: liveContent, author: user.name, authorId: user.id, timestamp: now, message: `Created branch: ${label}`, changes: [] }],
        currentVersion: document.versions.length + 1,
        createdAt: now,
        updatedAt: now,
      };
      const createdId = await createDocument({ ...payload, collaboratorIds: collaborators.map((c) => c.id) });
      setBranchOpen(false);
      setBranchName("");
      router.push(`/document/${createdId}`);
      toast.success("Branch created.");
    } catch (error) {
      toast.error(`Branch creation failed: ${getErrorMessage(error)}`);
    } finally {
      setBranchLoading(false);
    }
  };

  const handlePublishCoverUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user || !document) return;
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

  const handleExportPdf = () => {
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
  };

  const handleAddComment = async () => {
    if (!user || !document || isNewDocument || !newComment.trim()) return;
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
  }, [editor, editorMode, effectiveContent]);

  if (isLoading || !document || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
            <div>
              <Input value={effectiveTitle} onChange={(e) => setTitleDraft(e.target.value)} className="border-0 px-0 text-lg font-semibold focus-visible:ring-0" disabled={!canEdit} />
              <p className="text-xs text-gray-500">{stripHtml(effectiveContent).split(/\s+/).filter(Boolean).length} words</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">v{document.currentVersion}</Badge>
            {hasChanges && <Badge className="bg-amber-100 text-amber-800">Unsaved changes</Badge>}
            {autoSaving && <Badge className="bg-blue-100 text-blue-800">Auto-saving...</Badge>}
            <Button variant="outline" size="sm" onClick={() => imageInputRef.current?.click()} disabled={imageUploading}><ImagePlus className="mr-2 h-4 w-4" />Image</Button>
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            <Button variant="outline" size="sm" onClick={() => setAiDialogOpen(true)}><Sparkles className="mr-2 h-4 w-4" />AI</Button>
            <Button size="sm" onClick={handleSave} disabled={!hasChanges}><Save className="mr-2 h-4 w-4" />Save Version</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,3fr)_minmax(320px,1fr)] lg:px-8">
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 pt-6">
              {editorMode === "tiptap" && (
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
                      <Button data-tour-id="document-save-version" size="sm" onClick={handleSave} disabled={!hasChanges}><Save className="mr-2 h-4 w-4" />Save Version</Button>
                    </div>
                  </TabsContent>
                </Tabs>
              )}

              {editorMode === "quill" ? (
                <div className="report-quill-editor rounded-md border bg-white">
                  <div ref={quillHostRef} className="min-h-[620px]" />
                </div>
              ) : (
                <EditorContent editor={editor} className="min-h-[620px] rounded-md border bg-white p-4" />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" />Version History</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Select value={selectedVersion?.toString() || document.currentVersion.toString()} onValueChange={handleVersionChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {document.versions.slice().reverse().map((version) => <SelectItem key={version.id} value={version.version.toString()}>v{version.version} - {version.author}</SelectItem>)}
                </SelectContent>
              </Select>
              {selectedVersion && <Button size="sm" className="w-full" onClick={handleRestoreVersion}>Restore Selected Version</Button>}
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
              <Button data-tour-id="document-invite" variant="outline" size="sm" className="w-full" onClick={() => setInviteOpen(true)}><Share2 className="mr-2 h-4 w-4" />Invite</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button data-tour-id="document-publish" variant="default" size="sm" className="w-full justify-start" onClick={() => setPublishOpen(true)}>
                {publishVisibility === "public" ? <Globe className="mr-2 h-4 w-4 shrink-0" /> : <Lock className="mr-2 h-4 w-4 shrink-0" />}
                Publish Research
              </Button>
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
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setBranchOpen(true)}><GitBranch className="mr-2 h-4 w-4 shrink-0" />Create Branch</Button>
              <Button data-tour-id="document-export" variant="outline" size="sm" className="w-full justify-start" onClick={handleExportPdf}><Download className="mr-2 h-4 w-4 shrink-0" />Export PDF</Button>
              <Button data-tour-id="document-comments" variant="outline" size="sm" className="w-full justify-start" onClick={() => setCommentsOpen(true)}><MessageSquare className="mr-2 h-4 w-4 shrink-0" />Comments ({comments.length})</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ImagePlus className="h-4 w-4" />Image Library</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {allImageUrls.length === 0 ? <p className="text-sm text-gray-500">No images yet.</p> : allImageUrls.map((url, i) => (
                <div key={`${url}-${i}`} className="space-y-2 rounded-md border p-2">
                  <div className="relative h-24 w-full overflow-hidden rounded">
                    <NextImage
                      src={url}
                      alt={`img-${i + 1}`}
                      fill
                      unoptimized
                      sizes="(max-width: 1024px) 100vw, 320px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button size="sm" variant="outline" className="w-full" onClick={() => handleInsertExistingImage(url)}>Insert</Button>
                    <Button size="sm" variant="outline" className="w-full text-red-600" onClick={() => void handleRemoveImage(url)}>
                      <Trash2 className="mr-1 h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
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
          <DialogHeader><DialogTitle>Create Branch</DialogTitle><DialogDescription>Create a paper copy from current state.</DialogDescription></DialogHeader>
          <div className="space-y-2"><Label htmlFor="branch-name">Branch name</Label><Input id="branch-name" value={branchName} onChange={(e) => setBranchName(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBranchOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateBranch} disabled={branchLoading}>{branchLoading ? "Creating..." : "Create"}</Button>
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

      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prompt Assistant</DialogTitle>
            <DialogDescription>Select text, then enter a prompt (for example: summarize, expand, title case, uppercase).</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ai-prompt">Prompt</Label>
            <Textarea
              id="ai-prompt"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Example: summarize this paragraph in 2 sentences"
              className="min-h-24"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRunPrompt}>Apply Prompt</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={imageEditorOpen} onOpenChange={setImageEditorOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Image Editor</DialogTitle>
            <DialogDescription>Resize, align, and reposition the selected image. You can also drag the image directly inside the document.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="truncate text-xs text-gray-500">{selectedImageSrc || "No image selected"}</p>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>Size</span>
                <span>{selectedImageWidth}%</span>
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
                className="w-full"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button size="sm" variant={selectedImageAlign === "left" ? "default" : "outline"} onClick={() => { setSelectedImageAlign("left"); handleApplySelectedImageStyle(selectedImageWidth, "left"); }}>Left</Button>
              <Button size="sm" variant={selectedImageAlign === "center" ? "default" : "outline"} onClick={() => { setSelectedImageAlign("center"); handleApplySelectedImageStyle(selectedImageWidth, "center"); }}>Center</Button>
              <Button size="sm" variant={selectedImageAlign === "right" ? "default" : "outline"} onClick={() => { setSelectedImageAlign("right"); handleApplySelectedImageStyle(selectedImageWidth, "right"); }}>Right</Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="outline" onClick={() => handleMoveSelectedImage("up")}>Move Up</Button>
              <Button size="sm" variant="outline" onClick={() => handleMoveSelectedImage("down")}>Move Down</Button>
            </div>
            <div className="space-y-2 rounded-md border p-2">
              <p className="text-xs text-gray-500">Fine Position (px)</p>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" onClick={() => handleNudgeSelectedImage("x", -10)}>Left -10</Button>
                <Button size="sm" variant="outline" onClick={() => handleNudgeSelectedImage("x", 10)}>Right +10</Button>
                <Button size="sm" variant="outline" onClick={() => handleNudgeSelectedImage("y", -10)}>Up -10</Button>
                <Button size="sm" variant="outline" onClick={() => handleNudgeSelectedImage("y", 10)}>Down +10</Button>
              </div>
              <p className="text-xs text-gray-500">Current offset: X {selectedImageLeft}px, Y {selectedImageTop}px</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImageEditorOpen(false)}>Close</Button>
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
