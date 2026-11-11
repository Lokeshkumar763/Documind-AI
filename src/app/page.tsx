
"use client";

import {
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
  type ChangeEvent,
  type DragEvent,
  type MouseEvent,
  type FormEvent,
} from "react";

import {
  ChevronDown,
  FileText,
  FolderOpen,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Sparkles,
  UploadCloud,
  X,
  Loader2,
  FileCheck2,
  ArrowLeft,
  ArrowRight,
  Send,
  Copy,
  Check,
} from "lucide-react";

interface ExtractionResult {
  fileName: string;
  totalPages: number;
  characterCount: number;
  text: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type View = "dashboard" | "extraction" | "conversations";

/* 3D Tilt card */

function Tilt({
  children,
  className = "",
  max = 8,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;

    el.style.transition = "transform 90ms ease-out";
    el.style.transform = `perspective(1200px) rotateX(${(0.5 - y) * max}deg) rotateY(${(x - 0.5) * max}deg)`;
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
  }

  function handleLeave() {
    const el = ref.current;
    if (!el) return;

    el.style.transition = "transform 600ms cubic-bezier(.2,.8,.2,1)";
    el.style.transform =
      "perspective(1200px) rotateX(0deg) rotateY(0deg)";
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ transformStyle: "preserve-3d" }}
      className={`group relative rounded-[28px] border border-white/10 bg-gradient-to-b from-[#15151d] to-[#050507] shadow-[0_50px_90px_-40px_#000,0_30px_60px_-30px_rgba(99,102,241,0.35),inset_0_1px_0_rgba(255,255,255,0.1)] ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/70 to-transparent"
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[28px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(460px circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,0.075), transparent 55%)",
        }}
      />

      {children}
    </div>
  );
}

const primaryBtn =
  "relative flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-white to-zinc-300 px-6 py-3.5 text-sm font-semibold text-black " +
  "shadow-[0_6px_0_#71717a,0_18px_36px_rgba(129,140,248,0.35),inset_0_1px_0_#fff] " +
  "transition-all duration-150 hover:-translate-y-0.5 " +
  "active:translate-y-[5px] active:shadow-[0_1px_0_#71717a,0_6px_14px_rgba(129,140,248,0.3),inset_0_1px_0_#fff] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black";

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatNumber(value: number) {
  return value.toLocaleString();
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [activeView, setActiveView] = useState<View>("dashboard");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState("");
  const [extractionResult, setExtractionResult] =
    useState<ExtractionResult | null>(null);

  const [question, setQuestion] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [chatError, setChatError] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const wordCount = extractionResult
    ? extractionResult.text.trim()
        ? extractionResult.text.trim().split(/\s+/).length
        : 0
    : 0;

  /* File selection */

  function acceptFile(file: File | undefined | null) {
    if (!file) return false;

    if (file.type !== "application/pdf") {
      alert("Please select a PDF file.");
      return false;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("PDF file size must be 10 MB or less.");
      return false;
    }

    setSelectedFile(file);
    setExtractionResult(null);
    setExtractionError("");
    setChatMessages([]);
    setChatError("");
    setQuestion("");
    setActiveView("dashboard");

    return true;
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (!acceptFile(event.target.files?.[0])) {
      event.target.value = "";
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    acceptFile(e.dataTransfer.files?.[0]);
  }

  /* PDF extraction */

  async function handleExtract() {
    if (!selectedFile || isExtracting) return;

    setIsExtracting(true);
    setExtractionError("");
    setExtractionResult(null);
    setChatMessages([]);
    setChatError("");
    setQuestion("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "PDF extraction failed.");
      }

      setExtractionResult({
        fileName: data.fileName,
        totalPages: data.totalPages,
        characterCount: data.characterCount,
        text: data.text,
      });

      setActiveView("extraction");
    } catch (error) {
      setExtractionError(
        error instanceof Error
          ? error.message
          : "Something went wrong while extracting the PDF."
      );
    } finally {
      setIsExtracting(false);
    }
  }

  /* Gemini question and answer */

  async function handleAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!extractionResult || !question.trim() || isAsking) {
      return;
    }

    const currentQuestion = question.trim();

    setIsAsking(true);
    setChatError("");
    setQuestion("");

    const updatedHistory = [
      ...chatMessages,
      { role: "user" as const, content: currentQuestion },
    ];

    setChatMessages(updatedHistory);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentText: extractionResult.text,
          question: currentQuestion,
          history: chatMessages,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to get an AI response.");
      }

      setChatMessages((previous) => [
        ...previous,
        { role: "assistant", content: data.answer },
      ]);
    } catch (error) {
      setQuestion(currentQuestion);

      setChatMessages((previous) =>
        previous.filter(
          (message, index) =>
            index !== previous.length - 1 ||
            message.role !== "user" ||
            message.content !== currentQuestion
        )
      );

      setChatError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setIsAsking(false);
    }
  }

  /* Remove selected file */

  function removeFile() {
    setSelectedFile(null);
    setExtractionResult(null);
    setExtractionError("");
    setChatMessages([]);
    setChatError("");
    setQuestion("");
    setActiveView("dashboard");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  /* Start AI conversation */

  function startConversation() {
    if (!extractionResult) return;

    setChatMessages([]);
    setChatError("");
    setQuestion("");
    setActiveView("conversations");
  }

  /* Copy AI response */

  async function copyResponse(content: string, index: number) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex(null), 1800);
    } catch {
      setChatError("Unable to copy the response.");
    }
  }

  /* 3D hero animation */

  function handleHeroMove(e: MouseEvent<HTMLDivElement>) {
    const el = heroRef.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;

    el.style.setProperty("--rx", String(x * 22));
    el.style.setProperty("--ry", String(-y * 14));
  }

  function handleHeroLeave() {
    heroRef.current?.style.setProperty("--rx", "0");
    heroRef.current?.style.setProperty("--ry", "0");
  }

  const sheets = [0, 1, 2, 3];

  const navItems = [
    { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
    { id: "extraction" as const, label: "Extraction Results", icon: FileCheck2 },
    { id: "conversations" as const, label: "AI Conversations", icon: MessageSquare },
  ];

  return (
    <main
      className="relative h-dvh overflow-hidden bg-black text-zinc-100"
      style={{
        fontFamily:
          "'Bricolage Grotesque', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&display=swap');

        @keyframes bob {
          0%, 100% { transform: translateZ(var(--z)); }
          50%      { transform: translateZ(calc(var(--z) + 16px)); }
        }

        @keyframes orb {
          0%, 100% { transform: translateZ(170px) rotateZ(32deg) rotateX(-58deg) translateY(0); }
          50%      { transform: translateZ(190px) rotateZ(32deg) rotateX(-58deg) translateY(-10px); }
        }

        @keyframes gridMove {
          from { background-position: 0 0; }
          to   { background-position: 0 64px; }
        }

        .sheet { animation: bob 5.5s ease-in-out infinite; }
        .orb { animation: orb 5s ease-in-out infinite; }
        .grid-floor { animation: gridMove 5s linear infinite; }

        .output-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(129,140,248,0.6) rgba(255,255,255,0.04);
        }

        .output-scroll::-webkit-scrollbar {
          width: 8px;
        }

        .output-scroll::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.04);
          border-radius: 20px;
        }

        .output-scroll::-webkit-scrollbar-thumb {
          background: rgba(129,140,248,0.6);
          border-radius: 20px;
        }

        @media (prefers-reduced-motion: reduce) {
          .sheet, .orb, .grid-floor { animation: none; }
          .sheet { transform: translateZ(var(--z)); }
          .orb { transform: translateZ(170px) rotateZ(32deg) rotateX(-58deg); }
        }
      `}</style>

      {/* Background effects */}

      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -left-48 -top-24 h-[560px] w-[560px] rounded-full bg-indigo-600/20 blur-[150px]" />
        <div className="absolute -right-40 top-1/3 h-[460px] w-[460px] rounded-full bg-fuchsia-600/12 blur-[150px]" />
        <div className="absolute bottom-0 left-1/3 h-[300px] w-[500px] rounded-full bg-cyan-500/10 blur-[140px]" />

        <div
          className="absolute inset-x-[-50%] bottom-[-10%] h-[50vh]"
          style={{ perspective: "620px" }}
        >
          <div
            className="grid-floor h-full w-full"
            style={{
              transform: "rotateX(63deg)",
              transformOrigin: "center bottom",
              backgroundImage:
                "linear-gradient(rgba(129,140,248,0.28) 1px, transparent 1px), linear-gradient(90deg, rgba(129,140,248,0.28) 1px, transparent 1px)",
              backgroundSize: "64px 64px",
              maskImage:
                "linear-gradient(to top, rgba(0,0,0,0.85), transparent 80%)",
              WebkitMaskImage:
                "linear-gradient(to top, rgba(0,0,0,0.85), transparent 80%)",
            }}
          />
        </div>
      </div>

      <div className="relative z-10 flex h-dvh items-start">

        {/* Sidebar */}

        <aside className="sticky top-4 m-4 hidden h-[calc(100dvh-2rem)] w-64 shrink-0 flex-col rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.015] px-5 py-6 shadow-[0_40px_80px_-30px_#000,inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-2xl md:flex">
          <button
            onClick={() => setActiveView("dashboard")}
            className="mb-7 flex items-center gap-3 text-left"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-300 via-indigo-500 to-fuchsia-600 shadow-[0_5px_0_#312e81,0_14px_28px_rgba(99,102,241,0.55),inset_0_1px_0_rgba(255,255,255,0.5)]">
              <Sparkles size={21} />
            </div>

            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                DocuMind <span className="text-indigo-300">AI</span>
              </h1>
              <p className="text-xs text-zinc-500">
                Document Intelligent!
              </p>
            </div>
          </button>

          <p className="mb-3 px-1 text-xs font-medium text-zinc-600">
            Workspace
          </p>

          <nav className="space-y-2">
            {navItems.map(({ id, label, icon: Icon }) => {
              const isActive = activeView === id;

              return (
                <button
                  key={id}
                  onClick={() => {
                    if (id === "extraction" && !extractionResult) {
                      setActiveView("dashboard");
                      return;
                    }

                    if (id === "conversations" && !extractionResult) {
                      setActiveView("dashboard");
                      return;
                    }

                    setActiveView(id);
                  }}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-2.5 text-left text-sm transition duration-150 ${
                    isActive
                      ? "border-indigo-300/25 bg-gradient-to-b from-indigo-400/20 to-indigo-700/5 font-medium text-indigo-100 shadow-[0_4px_0_rgba(49,46,129,0.7),0_12px_26px_rgba(99,102,241,0.22),inset_0_1px_0_rgba(255,255,255,0.15)]"
                      : "border-transparent text-zinc-400 hover:translate-x-1 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <Icon size={18} />
                  {label}
                </button>
              );
            })}
          </nav>

          <div className="mt-6 min-h-0 flex-1 overflow-hidden">
            <p className="mb-3 px-1 text-xs font-medium text-zinc-600">
              Recent activity
            </p>

            {selectedFile ? (
              <button
                onClick={() =>
                  setActiveView(
                    extractionResult ? "extraction" : "dashboard"
                  )
                }
                className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] px-3 py-2.5 text-left shadow-[0_4px_0_rgba(0,0,0,0.8),0_12px_20px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-300 to-indigo-600 text-white shadow-[0_3px_0_#312e81]">
                  <FileText size={16} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatSize(selectedFile.size)}
                  </p>
                </div>

                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
              </button>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/15 px-4 py-5 text-center">
                <FolderOpen size={20} className="mx-auto mb-2 text-zinc-600" />
                <p className="text-sm text-zinc-300">No documents yet</p>
                <p className="mt-1 text-xs text-zinc-600">
                  Upload your first PDF to get started.
                </p>
              </div>
            )}
          </div>

          <div className="pt-3">
            <div className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-zinc-500">
              <Settings size={18} />
              Settings
            </div>

            <div className="mt-3 flex items-center gap-3 border-t border-white/10 pt-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b from-zinc-600 to-zinc-900 text-sm font-semibold shadow-[0_3px_0_#000,inset_0_1px_0_rgba(255,255,255,0.25)]">
                D
              </div>

              <div className="flex-1">
                <p className="text-xs text-zinc-500">Ready to Extract!</p>
              </div>

              <ChevronDown size={16} className="text-zinc-500" />
            </div>
          </div>
        </aside>

        {/* Main content */}

        <section className="flex h-dvh min-w-0 flex-1 flex-col">
          <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-5 py-5 md:px-8 md:py-6">

            {/* SCREEN 1: DASHBOARD */}

            {activeView === "dashboard" && (
              <Tilt max={3} className="min-h-0 flex-1">
                <div
                  ref={heroRef}
                  onMouseMove={handleHeroMove}
                  onMouseLeave={handleHeroLeave}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  className="relative grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] items-center gap-4 p-6 md:p-10 lg:grid-cols-[1.05fr_1fr] lg:grid-rows-1"
                >
                  {dragging && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-3 rounded-[22px] border-2 border-dashed border-indigo-300/70 bg-indigo-400/5"
                    />
                  )}

                  {/* Upload section */}

                  <div className="relative min-w-0">
                    <h2 className="bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text text-4xl font-semibold leading-[1.05] tracking-tight text-transparent md:text-5xl xl:text-6xl">
                      Ask anything about your PDF documents.
                    </h2>

                    <p className="mt-5 max-w-md text-base leading-7 text-zinc-400">
                      Simply upload a PDF and let DocuMind help you find answers, understand key points, and save your time.
                    </p>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={handleFileChange}
                    />

                    <div className="mt-8 flex flex-wrap items-center gap-4">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className={primaryBtn}
                        disabled={isExtracting}
                      >
                        <UploadCloud size={18} />
                        Choose PDF file
                      </button>

                    </div>

                    {selectedFile && (
                      <div className="mt-7 inline-flex max-w-full items-center gap-3 rounded-2xl border border-emerald-400/30 bg-gradient-to-b from-emerald-400/15 to-emerald-400/5 px-4 py-3 shadow-[0_4px_0_rgba(6,78,59,0.7),0_14px_28px_rgba(16,185,129,0.18),inset_0_1px_0_rgba(255,255,255,0.12)]">
                        <FileText size={18} className="shrink-0 text-emerald-300" />

                        <span className="max-w-[200px] truncate text-sm text-zinc-100">
                          {selectedFile.name}
                        </span>

                        <span className="text-xs text-emerald-200/70">
                          {formatSize(selectedFile.size)}
                        </span>

                        <button
                          onClick={removeFile}
                          disabled={isExtracting || isAsking}
                          className="rounded text-zinc-400 hover:text-white"
                          aria-label="Remove selected file"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}

                    {selectedFile && (
                      <div className="mt-6">
                        <button
                          onClick={handleExtract}
                          disabled={isExtracting || isAsking}
                          className={`${primaryBtn} ${isExtracting ? "cursor-not-allowed opacity-70" : ""}`}
                        >
                          {isExtracting ? (
                            <>
                              <Loader2 size={18} className="animate-spin" />
                              Extracting PDF 🚀💥
                            </>
                          ) : (
                            <>
                              <Sparkles size={18} />
                              Extract PDF
                              <ArrowRight size={17} />
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {extractionError && (
                      <div className="mt-5 max-w-md rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        {extractionError}
                      </div>
                    )}

                    <div className="mt-8 flex items-center gap-5 text-xs text-zinc-500">
                      <span className="flex items-center gap-2">
                        <FileCheck2 size={15} className="text-indigo-300" />
                        PDF documents
                      </span>
                      <span>Maximum 10 MB</span>
                    </div>
                  </div>

                  {/* Original 3D PDF animation */}

                  <div
                    className="relative h-full min-h-0 w-full"
                    style={{ perspective: "1500px" }}
                    aria-hidden
                  >
                    <div className="absolute left-1/2 top-[78%] h-10 w-64 -translate-x-1/2 rounded-full bg-indigo-500/40 blur-2xl" />

                    <div
                      className="absolute left-1/2 top-1/2 -ml-28 -mt-36 h-72 w-56 transition-transform duration-500 [@media(max-height:820px)]:[--s:0.78]"
                      style={{
                        transform: `scale(calc(var(--s, 1) * ${dragging ? 1.1 : 1}))`,
                      }}
                    >
                      <div
                        className="h-full w-full"
                        style={{
                          transformStyle: "preserve-3d",
                          transform:
                            "rotateX(calc(58deg + var(--ry, 0) * 1deg)) rotateZ(calc(-32deg + var(--rx, 0) * 1deg))",
                          transition: "transform 200ms ease-out",
                        }}
                      >
                        {sheets.map((i) => {
                          const isTop = i === sheets.length - 1;

                          return (
                            <div
                              key={i}
                              className="sheet absolute inset-0 rounded-2xl border p-5"
                              style={
                                {
                                  "--z": `${i * 30}px`,
                                  animationDelay: `${i * -0.7}s`,
                                  transformStyle: "preserve-3d",
                                  borderColor: isTop
                                    ? "rgba(199,210,254,0.8)"
                                    : "rgba(255,255,255,0.12)",
                                  background: isTop
                                    ? "linear-gradient(145deg,#ffffff,#d9dcf5 60%,#c4c7ee)"
                                    : `linear-gradient(145deg,rgba(${28 + i * 8},${28 + i * 8},${44 + i * 10},0.92),rgba(10,10,18,0.95))`,
                                  boxShadow: isTop
                                    ? "0 0 70px rgba(129,140,248,0.5), inset 0 1px 0 #fff"
                                    : "inset 0 1px 0 rgba(255,255,255,0.1)",
                                } as CSSProperties
                              }
                            >
                              {isTop ? (
                                <>
                                  <span className="inline-block rounded-md bg-black px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">
                                    PDF
                                  </span>

                                  <p className="mt-3 truncate text-sm font-semibold text-black">
                                    {selectedFile?.name ?? "your-document.pdf"}
                                  </p>

                                  <div className="mt-4 space-y-2.5">
                                    <div className="h-2 w-full rounded bg-black/15" />
                                    <div className="h-2 w-11/12 rounded bg-black/15" />
                                    <div className="h-2 w-4/5 rounded bg-black/15" />
                                    <div className="h-2 w-full rounded bg-black/15" />
                                    <div className="h-2 w-2/3 rounded bg-indigo-500/50" />
                                  </div>
                                </>
                              ) : i === sheets.length - 2 ? (
                                <div className="space-y-2.5 pt-8">
                                  <div className="h-2 w-full rounded bg-white/10" />
                                  <div className="h-2 w-10/12 rounded bg-white/10" />
                                  <div className="h-2 w-3/4 rounded bg-white/10" />
                                </div>
                              ) : null}
                            </div>
                          );
                        })}

                        <div
                          className="orb absolute -right-6 top-2 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cyan-200 via-indigo-400 to-fuchsia-600 text-white shadow-[0_20px_40px_rgba(99,102,241,0.6),inset_0_3px_6px_rgba(255,255,255,0.6),inset_0_-8px_14px_rgba(0,0,0,0.35)]"
                          style={{ transformStyle: "preserve-3d" }}
                        >
                          <Sparkles size={24} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Tilt>
            )}

            {/* SCREEN 2: EXTRACTION RESULTS */}

            {activeView === "extraction" && (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-b from-[#15151d] to-[#07070b] p-5 shadow-[0_30px_70px_-30px_rgba(99,102,241,0.35),inset_0_1px_0_rgba(255,255,255,0.1)] md:p-7">

                {extractionResult ? (
                  <>
                    <div className="mb-5 flex shrink-0 items-center justify-between gap-3 border-b border-white/10 pb-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-300 to-indigo-600 shadow-[0_4px_0_#312e81]">
                          <FileCheck2 size={23} />
                        </div>

                        <div className="min-w-0">
                          <h3 className="text-lg font-semibold text-white md:text-xl">
                            Extraction Completed
                          </h3>
                          <p className="truncate text-sm text-zinc-500">
                            {extractionResult.fileName}
                          </p>
                        </div>
                      </div>

                      <span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
                        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Successful
                      </span>
                    </div>

                    {/* Statistics */}

                    <div className="mb-5 grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
                      {[
                        {
                          label: "Total Pages",
                          value: formatNumber(extractionResult.totalPages),
                          icon: FileText,
                        },
                        {
                          label: "Characters",
                          value: formatNumber(extractionResult.characterCount),
                          icon: FileCheck2,
                        },
                        {
                          label: "Words",
                          value: formatNumber(wordCount),
                          icon: MessageSquare,
                        },
                        {
                          label: "File Size",
                          value: selectedFile ? formatSize(selectedFile.size) : "—",
                          icon: FolderOpen,
                        },
                      ].map(({ label, value, icon: Icon }) => (
                        <div
                          key={label}
                          className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs text-zinc-500">{label}</p>
                            <Icon size={17} className="text-indigo-300" />
                          </div>
                          <p className="text-2xl font-semibold text-white">
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Larger extracted text panel */}

                    <div className="output-scroll min-h-0 flex-1 overflow-y-auto rounded-2xl border border-indigo-300/15 bg-black/40 p-5 shadow-[inset_0_2px_20px_rgba(0,0,0,0.35)] md:p-7">
                      <pre className="whitespace-pre-wrap break-words font-sans text-[15px] leading-8 text-zinc-300 md:text-base">
                        {extractionResult.text}
                      </pre>
                    </div>

                    {/* Next action */}

                    <div className="mt-5 flex shrink-0 flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        onClick={() => setActiveView("dashboard")}
                        className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm text-zinc-300 transition hover:bg-white/[0.05] hover:text-white"
                      >
                        <ArrowLeft size={17} />
                        Back to Dashboard
                      </button>

                      <button
                        onClick={startConversation}
                        className={primaryBtn}
                      >
                        <Sparkles size={18} />
                        Ask About This Document
                        <ArrowRight size={17} />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center text-center">
                    <FileText size={42} className="mb-4 text-zinc-600" />
                    <h3 className="text-lg font-semibold text-white">
                      No extracted document
                    </h3>
                    <p className="mt-2 text-sm text-zinc-500">
                      Upload a PDF and extract its content first.
                    </p>
                    <button
                      onClick={() => setActiveView("dashboard")}
                      className={`${primaryBtn} mt-6`}
                    >
                      Go to Dashboard
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* SCREEN 3: AI CONVERSATIONS */}

            {activeView === "conversations" && (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-b from-[#15151d] to-[#07070b] shadow-[0_30px_70px_-30px_rgba(99,102,241,0.35),inset_0_1px_0_rgba(255,255,255,0.1)]">

                {/* Chat header */}

                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 py-4 md:px-7">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-300 via-indigo-500 to-fuchsia-600 shadow-[0_4px_0_#312e81]">
                      <Sparkles size={21} />
                    </div>

                    <div className="min-w-0">
                      <h3 className="font-semibold text-white">
                        DocuMind AI Assistant
                      </h3>
                      <p className="truncate text-xs text-zinc-500">
                        {extractionResult?.fileName ?? "No document selected"}
                      </p>
                    </div>
                  </div>

                  <span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-300">
                    Document connected
                  </span>
                </div>

                {/* Conversation messages */}

                <div className="output-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 md:px-7 md:py-6">
                  {chatMessages.length === 0 && !isAsking && (
                    <div className="flex min-h-full flex-col items-center justify-center text-center">
                      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl border border-indigo-300/20 bg-gradient-to-br from-indigo-400/20 to-fuchsia-500/10 shadow-[0_0_45px_rgba(99,102,241,0.15)]">
                        <Sparkles size={30} className="text-indigo-200" />
                      </div>

                      <h3 className="text-xl font-semibold text-white">
                        Ask your document anything.
                      </h3>

                      <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
                        Your PDF has been extracted. Ask DocuMind AI a question
                        and get answers based on the document content.
                      </p>

                      <div className="mt-7 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                        {[
                          "Summarise this document.",
                          "What are the main topics?",
                          "Explain the important points.",
                          "What are the key conclusions?",
                        ].map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => setQuestion(suggestion)}
                            className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-left text-sm text-zinc-300 transition hover:border-indigo-300/30 hover:bg-indigo-400/10 hover:text-white"
                          >
                            <span className="mr-2 text-indigo-300">✦</span>
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {chatMessages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex gap-3 ${
                        message.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {message.role === "assistant" && (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-300 to-indigo-600 text-white shadow-[0_3px_0_#312e81]">
                          <Sparkles size={17} />
                        </div>
                      )}

                      <div
                        className={`max-w-[88%] rounded-2xl border px-4 py-3 md:max-w-[80%] ${
                          message.role === "user"
                            ? "border-indigo-400/25 bg-indigo-500/15 text-indigo-50"
                            : "border-white/10 bg-white/[0.045] text-zinc-200"
                        }`}
                      >
                        <p className="mb-2 text-xs font-semibold text-indigo-300">
                          {message.role === "user" ? "You" : "DocuMind AI"}
                        </p>

                        <div className="whitespace-pre-wrap break-words text-sm leading-7">
                          {message.content}
                        </div>

                        {message.role === "assistant" && (
                          <div className="mt-3 flex justify-end border-t border-white/10 pt-2">
                            <button
                              onClick={() => copyResponse(message.content, index)}
                              className="flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-indigo-300"
                            >
                              {copiedIndex === index ? (
                                <>
                                  <Check size={13} />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy size={13} />
                                  Copy response
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      {message.role === "user" && (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-zinc-800 text-xs font-semibold text-white">
                          You
                        </div>
                      )}
                    </div>
                  ))}

                  {isAsking && (
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-300 to-indigo-600">
                        <Sparkles size={17} />
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-indigo-200">
                          <Loader2 size={16} className="animate-spin" />
                          Documind is generating a response 🙌
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                {/* Chat error */}

                {chatError && (
                  <div className="mx-4 mb-2 shrink-0 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300 md:mx-7">
                    {chatError}
                  </div>
                )}

                {/* Chat input */}

                <div className="shrink-0 border-t border-white/10 bg-black/20 p-4 md:px-7 md:py-5">
                  <form onSubmit={handleAsk} className="flex items-end gap-3">
                    <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/40 transition focus-within:border-indigo-400/50">
                      <textarea
                        value={question}
                        onChange={(event) => setQuestion(event.target.value)}
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" &&
                            !event.shiftKey
                          ) {
                            event.preventDefault();
                            event.currentTarget.form?.requestSubmit();
                          }
                        }}
                        placeholder="Ask anything about your document..."
                        maxLength={2000}
                        disabled={isAsking || !extractionResult}
                        rows={2}
                        className="max-h-32 min-h-[54px] w-full resize-none bg-transparent px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-zinc-600 disabled:opacity-50"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={!question.trim() || isAsking || !extractionResult}
                      className="flex h-[54px] shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-indigo-300 to-indigo-500 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isAsking ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Send size={18} />
                      )}
                      <span className="hidden sm:inline">Send</span>
                    </button>
                  </form>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-zinc-600">
                      Answers are generated using your uploaded document.
                    </p>

                    <button
                      onClick={() => setActiveView("extraction")}
                      className="shrink-0 text-xs text-indigo-300 transition hover:text-white"
                    >
                      View extracted text
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

