"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  intentState,
  subscribeIntent,
  setIntent,
  addIntentNode,
  focusAttention,
  surfaceContradiction,
  resolveContradiction,
  evolveIntent,
  forkIntent,
  mergeForks,
  addAssumption,
  createAgentProposals,
  acceptAgentProposal,
  rejectAgentProposal,
  createSnapshot,
  restoreSnapshot,
  getIntentDiff,
  compressIntent,
  counterfactualLens,
  intentDNA,
  addAttachments,
  registerIntentTools,
  unregisterIntentTools,
  type IntentNode,
} from "./webmcp";

const labels: Record<
  IntentNode["type"],
  {
    title: string;
    eyebrow: string;
  }
> = {
  goal: {
    title: "What you want to change",
    eyebrow: "Direction",
  },
  constraint: {
    title: "What must stay true",
    eyebrow: "Boundary",
  },
  value: {
    title: "What matters",
    eyebrow: "Value",
  },
  unknown: {
    title: "What is still unclear",
    eyebrow: "Unknown",
  },
};

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Home() {
  const [, rerender] = useState(0);

  const [draft, setDraft] = useState("");
  const [assumption, setAssumption] =
    useState("");

  const [showIdea, setShowIdea] =
    useState(false);

  const [showFiles, setShowFiles] =
    useState(false);

  const [dragging, setDragging] =
    useState(false);

  const [lens, setLens] =
    useState<ReturnType<
      typeof counterfactualLens
    > | null>(null);

  const [compression, setCompression] =
    useState<ReturnType<
      typeof compressIntent
    > | null>(null);

  const [dna, setDna] =
    useState<ReturnType<typeof intentDNA> | null>(
      null
    );

  const [diff, setDiff] =
    useState<ReturnType<
      typeof getIntentDiff
    > | null>(null);

  const fileInput =
    useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sync = () => {
      rerender((value) => value + 1);
    };

    sync();

    const unsubscribe =
      subscribeIntent(sync);

    void registerIntentTools();

    return () => {
      unsubscribe();
      unregisterIntentTools();
    };
  }, []);

  function start() {
    const value = draft.trim();

    if (!value) return;

    setIntent(value);

    const goal = addIntentNode(
      "goal",
      value,
      1,
      false,
      0.12
    );

    addIntentNode(
      "constraint",
      "It should feel genuinely original",
      0.82,
      false,
      0.24
    );

    addIntentNode(
      "value",
      "It should create meaningful real-world impact",
      0.9,
      false,
      0.18
    );

    addIntentNode(
      "unknown",
      "What is still unclear?",
      0.62,
      false,
      0.64
    );

    focusAttention(goal.id);

    intentState.activities = [];

    createSnapshot("Starting point");
  }

  function focus(node: IntentNode) {
    focusAttention(node.id);
    setLens(counterfactualLens(node.id));
  }

  function newIntent() {
    window.location.reload();
  }

  function addFiles(files: FileList | null) {
    if (!files) return;

    addAttachments(Array.from(files));
    setShowFiles(true);
  }

  function onDrop(
    event: React.DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  }

  function addAssumptionValue() {
    const value = assumption.trim();

    if (!value) return;

    addAssumption(value);
    setAssumption("");
  }

  if (!intentState.text) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#050608] text-white">
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
                radial-gradient(circle at 72% 24%, rgba(255,255,255,.11), transparent 23%),
                radial-gradient(circle at 15% 72%, rgba(110,130,255,.07), transparent 24%),
                radial-gradient(circle at 86% 82%, rgba(180,130,255,.055), transparent 22%),
                linear-gradient(rgba(255,255,255,.017) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,.017) 1px, transparent 1px)
              `,
              backgroundSize:
                "auto, auto, auto, 62px 62px, 62px 62px",
              maskImage:
                "linear-gradient(to bottom, black 65%, transparent 100%)",
            }}
          />

          <div
            className="absolute left-1/2 top-1/2 h-[40rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.035]"
            style={{
              transform:
                "translate(-50%, -50%) rotateX(68deg)",
            }}
          />

          <div
            className="absolute left-1/2 top-[62%] h-[22rem] w-[22rem] -translate-x-1/2 rounded-full border border-white/[0.025]"
            style={{
              transform:
                "translateX(-50%) rotateX(68deg)",
            }}
          />
        </div>

        <div className="relative mx-auto flex min-h-screen max-w-[1480px] flex-col px-5 py-5 sm:px-8">
          <header className="flex items-center justify-between border-b border-white/[0.08] pb-5">
            <button
              onClick={newIntent}
              className="text-left"
            >
              <div className="text-[11px] font-semibold tracking-[0.45em] text-white/72">
                INTENT
              </div>

              <div className="mt-1 text-[8px] uppercase tracking-[0.28em] text-white/20">
                Human × Agent × World
              </div>
            </button>

            <button
              onClick={() =>
                setShowIdea((value) => !value)
              }
              className="rounded-full border border-white/10 bg-white/[0.025] px-4 py-2 text-[8px] uppercase tracking-[0.2em] text-white/30 transition hover:border-white/20 hover:text-white/60"
            >
              {showIdea ? "Close" : "Inside"}
            </button>
          </header>

          <section className="flex flex-1 items-center py-14">
            <div className="grid w-full items-center gap-14 lg:grid-cols-[.95fr_1.05fr]">
              <div>
                <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/75" />

                  <span className="text-[8px] uppercase tracking-[0.28em] text-white/34">
                    Human × Agent × World
                  </span>
                </div>

                <h1 className="max-w-4xl text-5xl font-medium tracking-[-0.06em] sm:text-7xl lg:text-[7rem] lg:leading-[0.88]">
                  Start with
                  <span className="block text-white/40">
                    what matters.
                  </span>
                </h1>

                <p className="mt-8 max-w-xl text-base leading-7 text-white/34 sm:text-lg">
                  Say what you are trying to change.
                  INTENT keeps the meaning alive while
                  you explore what comes next.
                </p>

                <div className="mt-10 max-w-2xl rounded-[28px] border border-white/10 bg-white/[0.035] p-2 backdrop-blur-xl">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={draft}
                      onChange={(event) =>
                        setDraft(event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          start();
                        }
                      }}
                      placeholder="What are you trying to make happen?"
                      className="h-14 flex-1 rounded-[20px] bg-transparent px-4 text-sm text-white outline-none placeholder:text-white/18"
                    />

                    <button
                      onClick={start}
                      className="h-14 rounded-[20px] bg-white px-7 text-xs font-semibold uppercase tracking-[0.15em] text-black transition hover:scale-[1.01] hover:bg-white/90"
                    >
                      Begin
                    </button>
                  </div>
                </div>

                <div className="mt-5 text-xs text-white/19">
                  Meaning first. Action second.
                </div>

                <div className="mt-10 flex flex-wrap gap-2">
                  {[
                    "Gravity",
                    "Friction",
                    "Shift",
                    "Branch",
                    "Echo",
                    "Pulse",
                    "Signal",
                    "Merge",
                    "Lens",
                    "DNA",
                  ].map((name) => (
                    <span
                      key={name}
                      className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[8px] uppercase tracking-[0.18em] text-white/23"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>

              <div
                className="relative mx-auto hidden w-full max-w-[660px] lg:block"
                style={{
                  perspective: "1500px",
                }}
              >
                <div
                  className="relative aspect-square w-full"
                  style={{
                    transform:
                      "rotateX(12deg) rotateY(-14deg)",
                    transformStyle:
                      "preserve-3d",
                  }}
                >
                  <div className="absolute inset-[7%] rounded-full border border-white/[0.10] bg-white/[0.012] shadow-[0_0_140px_rgba(255,255,255,.04)]" />

                  <div
                    className="absolute inset-[15%] rounded-full border border-white/[0.08]"
                    style={{
                      transform:
                        "translateZ(28px)",
                    }}
                  />

                  <div
                    className="absolute inset-[24%] rounded-full border border-white/[0.09] bg-white/[0.018]"
                    style={{
                      transform:
                        "translateZ(62px)",
                    }}
                  />

                  <div
                    className="absolute inset-[34%] rounded-full border border-white/[0.12] bg-white/[0.045] shadow-[inset_0_0_60px_rgba(255,255,255,.035)]"
                    style={{
                      transform:
                        "translateZ(104px)",
                    }}
                  />

                  <div
                    className="absolute left-1/2 top-1/2 flex h-40 w-40 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[#090a0d]/92 text-center shadow-[0_0_90px_rgba(255,255,255,.06)]"
                    style={{
                      transform:
                        "translate(-50%,-50%) translateZ(140px)",
                    }}
                  >
                    <div>
                      <div className="text-[8px] uppercase tracking-[0.34em] text-white/24">
                        what matters
                      </div>

                      <div className="mt-2 text-lg text-white/68">
                        intent
                      </div>
                    </div>
                  </div>

                  {[
                    {
                      label: "WHAT YOU WANT",
                      position:
                        "left-[1%] top-[18%]",
                    },
                    {
                      label: "WHAT MATTERS",
                      position:
                        "right-[1%] top-[20%]",
                    },
                    {
                      label: "WHAT STAYS TRUE",
                      position:
                        "left-[5%] bottom-[18%]",
                    },
                    {
                      label: "WHAT'S UNCLEAR",
                      position:
                        "right-[4%] bottom-[20%]",
                    },
                  ].map((node) => (
                    <div
                      key={node.label}
                      className={`absolute ${node.position} rounded-2xl border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-xl`}
                      style={{
                        transform:
                          "translateZ(78px)",
                      }}
                    >
                      <div className="text-[7px] tracking-[0.2em] text-white/24">
                        {node.label}
                      </div>

                      <div className="mt-2 h-1 w-11 rounded-full bg-white/15" />
                    </div>
                  ))}
                </div>

                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] uppercase tracking-[0.25em] text-white/16">
                  Human × Agent × World
                </div>
              </div>
            </div>
          </section>

          {showIdea && (
            <div className="fixed inset-x-4 bottom-5 z-40 mx-auto max-w-5xl">
              <div className="rounded-[28px] border border-white/10 bg-[#090a0d]/95 p-5 shadow-2xl backdrop-blur-2xl">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["Human", "Meaning"],
                    ["Agent", "Possibility"],
                    ["World", "Change"],
                  ].map(([title, detail]) => (
                    <div
                      key={title}
                      className="rounded-2xl border border-white/10 bg-white/[0.018] p-4"
                    >
                      <div className="text-[8px] uppercase tracking-[0.22em] text-white/18">
                        {title}
                      </div>

                      <div className="mt-3 text-sm text-white/50">
                        {detail}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <footer className="border-t border-white/[0.08] pt-5 text-[8px] uppercase tracking-[0.22em] text-white/15">
            Start with what matters.
          </footer>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#050608] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(circle at 50% 0%, rgba(255,255,255,.07), transparent 28%),
              radial-gradient(circle at 0% 55%, rgba(110,130,255,.04), transparent 25%),
              radial-gradient(circle at 100% 52%, rgba(180,130,255,.04), transparent 25%)
            `,
          }}
        />
      </div>

      <div className="relative mx-auto max-w-[1550px] px-4 py-4 sm:px-7 lg:px-9">
        <header className="flex items-center justify-between border-b border-white/[0.08] pb-5">
          <button
            onClick={newIntent}
            className="text-left"
          >
            <div className="text-[11px] font-semibold tracking-[0.45em] text-white/72">
              INTENT
            </div>

            <div className="mt-1 text-[8px] uppercase tracking-[0.28em] text-white/20">
              Human × Agent × World
            </div>
          </button>

          <div className="flex items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[8px] uppercase tracking-[0.2em] text-white/24">
              v{intentState.version}
            </span>

            <span className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[8px] uppercase tracking-[0.2em] text-white/24">
              WebMCP
            </span>
          </div>
        </header>

        <section className="py-7">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[8px] uppercase tracking-[0.28em] text-white/21">
                <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
                Living intent
              </div>

              <h1 className="max-w-5xl text-3xl font-medium tracking-[-0.04em] sm:text-5xl lg:text-6xl">
                {intentState.text}
              </h1>

              <div className="mt-4 flex flex-wrap gap-2 text-[8px] uppercase tracking-[0.18em] text-white/18">
                <span>
                  {intentState.nodes.length} parts
                </span>

                <span>/</span>

                <span>
                  {intentState.activities.length} changes
                </span>

                <span>/</span>

                <span>Human × Agent</span>
              </div>

              <div
                className={`mt-6 rounded-[30px] border p-4 transition ${
                  dragging
                    ? "border-white/25 bg-white/[0.055]"
                    : "border-white/10 bg-white/[0.02]"
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() =>
                  setDragging(false)
                }
                onDrop={onDrop}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[8px] uppercase tracking-[0.25em] text-white/18">
                      Context
                    </div>

                    <div className="mt-1 text-xs text-white/25">
                      Drop files or add context.
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        fileInput.current?.click()
                      }
                      className="rounded-xl border border-white/10 px-3 py-2 text-[8px] uppercase tracking-[0.18em] text-white/27 transition hover:border-white/20 hover:text-white/55"
                    >
                      Add files
                    </button>

                    <button
                      onClick={() =>
                        setShowFiles(
                          (value) => !value
                        )
                      }
                      className="rounded-xl border border-white/10 px-3 py-2 text-[8px] uppercase tracking-[0.18em] text-white/20"
                    >
                      {intentState.attachments.length} added
                    </button>
                  </div>
                </div>

                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) =>
                    addFiles(event.target.files)
                  }
                />

                {showFiles &&
                  intentState.attachments.length > 0 && (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {intentState.attachments.map(
                        (file) => (
                          <div
                            key={file.id}
                            className="rounded-2xl border border-white/10 bg-black/10 p-3"
                          >
                            <div className="truncate text-[10px] text-white/42">
                              {file.name}
                            </div>

                            <div className="mt-1 text-[8px] text-white/16">
                              {formatSize(file.size)}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
              </div>

              <div className="mt-5 rounded-[30px] border border-white/10 bg-white/[0.02] p-4 sm:p-6">
                <div className="mb-6 flex items-end justify-between">
                  <div>
                    <div className="text-[8px] uppercase tracking-[0.28em] text-white/18">
                      Gravity
                    </div>

                    <div className="mt-1 text-xs text-white/23">
                      What matters moves closer.
                    </div>
                  </div>

                  <div className="text-[8px] uppercase tracking-[0.18em] text-white/13">
                    live
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {intentState.nodes.map(
                    (node) => {
                      const active =
                        node.id ===
                        intentState.activeNode;

                      return (
                        <button
                          key={node.id}
                          onClick={() =>
                            focus(node)
                          }
                          className={`relative min-h-[185px] overflow-hidden rounded-[24px] border p-5 text-left transition-all duration-500 ${
                            active
                              ? "border-white/25 bg-white/[0.075] shadow-[0_25px_70px_rgba(0,0,0,.3)]"
                              : "border-white/10 bg-white/[0.018] hover:border-white/18 hover:bg-white/[0.035]"
                          }`}
                          style={{
                            opacity:
                              0.55 +
                              node.relevance *
                                0.45,
                            transform: active
                              ? "perspective(900px) translateZ(10px)"
                              : "perspective(900px)",
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="text-[8px] uppercase tracking-[0.24em] text-white/21">
                                {
                                  labels[
                                    node.type
                                  ].eyebrow
                                }
                              </div>

                              <div className="mt-1 text-[9px] text-white/15">
                                {
                                  labels[
                                    node.type
                                  ].title
                                }
                              </div>
                            </div>

                            <div className="text-[8px] text-white/16">
                              {pct(node.relevance)}
                            </div>
                          </div>

                          <div className="mt-8 max-w-sm text-sm leading-6 text-white/62">
                            {node.label}
                          </div>

                          <div className="absolute bottom-5 left-5 right-5">
                            <div className="h-1 overflow-hidden rounded-full bg-white/[0.05]">
                              <div
                                className="h-full rounded-full bg-white/65 transition-all duration-700"
                                style={{
                                  width: `${Math.max(
                                    7,
                                    node.relevance * 100
                                  )}%`,
                                }}
                              />
                            </div>

                            <div className="mt-3 flex items-center justify-between text-[7px] uppercase tracking-[0.18em] text-white/14">
                              <span>
                                uncertainty{" "}
                                {pct(node.uncertainty)}
                              </span>

                              {active && (
                                <span>
                                  focused
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>

                {intentState.activeNode && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                    <div className="text-[8px] uppercase tracking-[0.22em] text-white/16">
                      Shared attention
                    </div>

                    <div className="mt-2 text-xs text-white/40">
                      {
                        intentState.nodes.find(
                          (node) =>
                            node.id ===
                            intentState.activeNode
                        )?.label
                      }
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <button
                  onClick={() =>
                    surfaceContradiction(
                      "Make something genuinely original",
                      "Make something quickly"
                    )
                  }
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-left transition hover:-translate-y-0.5 hover:border-white/20"
                >
                  <div className="text-[8px] uppercase tracking-[0.2em] text-white/14">
                    Friction
                  </div>

                  <div className="mt-2 text-sm text-white/56">
                    See the tradeoff
                  </div>
                </button>

                <button
                  onClick={() =>
                    evolveIntent(
                      "Originality now matters more than speed."
                    )
                  }
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-left transition hover:-translate-y-0.5 hover:border-white/20"
                >
                  <div className="text-[8px] uppercase tracking-[0.2em] text-white/14">
                    Shift
                  </div>

                  <div className="mt-2 text-sm text-white/56">
                    Change the priority
                  </div>
                </button>

                <button
                  onClick={() =>
                    forkIntent(
                      "A more radical direction"
                    )
                  }
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-left transition hover:-translate-y-0.5 hover:border-white/20"
                >
                  <div className="text-[8px] uppercase tracking-[0.2em] text-white/14">
                    Branch
                  </div>

                  <div className="mt-2 text-sm text-white/56">
                    Explore another future
                  </div>
                </button>
              </div>

              {intentState.contradiction && (
                <div className="mt-5 rounded-[26px] border border-white/10 bg-white/[0.022] p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[8px] uppercase tracking-[0.25em] text-white/17">
                        Friction
                      </div>

                      <div className="mt-1 text-xs text-white/24">
                        Choose what matters more.
                      </div>
                    </div>

                    <span className="rounded-full border border-white/10 px-3 py-1.5 text-[8px] uppercase tracking-[0.16em] text-white/17">
                      Human
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                    <button
                      onClick={() =>
                        resolveContradiction(
                          "first"
                        )
                      }
                      className={`rounded-2xl border p-4 text-left transition ${
                        intentState.contradiction
                          ?.resolvedAs ===
                        intentState.contradiction
                          ?.first
                          ? "border-white/25 bg-white/[0.07]"
                          : "border-white/10 bg-black/10 hover:border-white/20"
                      }`}
                    >
                      <div className="text-sm text-white/58">
                        {
                          intentState.contradiction
                            .first
                        }
                      </div>
                    </button>

                    <div className="hidden text-white/15 sm:block">
                      ↔
                    </div>

                    <button
                      onClick={() =>
                        resolveContradiction(
                          "second"
                        )
                      }
                      className={`rounded-2xl border p-4 text-left transition ${
                        intentState.contradiction
                          ?.resolvedAs ===
                        intentState.contradiction
                          ?.second
                          ? "border-white/25 bg-white/[0.07]"
                          : "border-white/10 bg-black/10 hover:border-white/20"
                      }`}
                    >
                      <div className="text-sm text-white/58">
                        {
                          intentState.contradiction
                            .second
                        }
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {intentState.evolution && (
                <div className="mt-5 rounded-[26px] border border-white/10 bg-white/[0.022] p-5">
                  <div className="text-[8px] uppercase tracking-[0.25em] text-white/17">
                    Shift
                  </div>

                  <div className="mt-3 text-xl text-white/62">
                    v{intentState.evolution.version}
                  </div>

                  <div className="mt-2 text-xs leading-6 text-white/27">
                    {intentState.evolution.reason}
                  </div>

                  <div className="mt-4 inline-flex rounded-full border border-white/10 px-3 py-1.5 text-[8px] uppercase tracking-[0.18em] text-white/18">
                    Human approval required
                  </div>
                </div>
              )}

              {intentState.forks.length > 0 && (
                <div className="mt-5 rounded-[26px] border border-white/10 bg-white/[0.022] p-5">
                  <div className="text-[8px] uppercase tracking-[0.25em] text-white/17">
                    Branches
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {intentState.forks.map(
                      (fork) => (
                        <div
                          key={fork.forkId}
                          className="rounded-2xl border border-white/10 bg-black/10 p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm text-white/52">
                              {fork.label}
                            </div>

                            <div className="text-[8px] text-white/15">
                              {pct(fork.score)}
                            </div>
                          </div>

                          <div className="mt-2 text-[8px] uppercase tracking-[0.18em] text-white/15">
                            from v{fork.sourceVersion}
                          </div>

                          <button
                            onClick={() =>
                              mergeForks(
                                fork.forkId,
                                `Insight from "${fork.label}"`
                              )
                            }
                            className="mt-4 rounded-xl border border-white/10 px-3 py-2 text-[8px] uppercase tracking-[0.16em] text-white/23 hover:border-white/20 hover:text-white/50"
                          >
                            Merge insight
                          </button>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>

            <aside className="space-y-4">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.025] p-5">
                <div className="text-[8px] uppercase tracking-[0.25em] text-white/17">
                  Pulse
                </div>

                <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="h-full rounded-full bg-white/70 transition-all duration-700"
                    style={{
                      width: `${Math.round(
                        intentState.pulse * 100
                      )}%`,
                    }}
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  {[
                    [
                      "Clarity",
                      pct(intentState.clarity),
                    ],
                    [
                      "Resonance",
                      pct(intentState.resonance),
                    ],
                    [
                      "Uncertainty",
                      pct(intentState.uncertainty),
                    ],
                    [
                      "Decision debt",
                      pct(intentState.decisionDebt),
                    ],
                  ].map(([name, value]) => (
                    <div
                      key={name}
                      className="rounded-2xl border border-white/10 bg-black/10 p-3"
                    >
                      <div className="text-[7px] uppercase tracking-[0.18em] text-white/14">
                        {name}
                      </div>

                      <div className="mt-2 text-sm text-white/46">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 rounded-2xl border border-white/10 bg-black/10 p-3">
                  <div className="text-[7px] uppercase tracking-[0.2em] text-white/14">
                    Drift Guard
                  </div>

                  <div className="mt-2 text-[10px] leading-5 text-white/23">
                    {intentState.meaningDrift < 0.2
                      ? "Close to the original meaning."
                      : intentState.meaningDrift < 0.5
                      ? "Meaning is moving."
                      : "Meaning has moved significantly."}
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/[0.025] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[8px] uppercase tracking-[0.25em] text-white/17">
                      Signal
                    </div>

                    <div className="mt-1 text-[10px] text-white/21">
                      Agent suggestions.
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      createAgentProposals()
                    }
                    className="rounded-xl border border-white/10 px-3 py-2 text-[8px] uppercase tracking-[0.18em] text-white/24"
                  >
                    Think
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  {intentState.proposals.map(
                    (proposal) => (
                      <div
                        key={proposal.id}
                        className="rounded-2xl border border-white/10 bg-black/10 p-4"
                      >
                        <div className="text-sm text-white/51">
                          {proposal.title}
                        </div>

                        <div className="mt-2 text-[9px] leading-5 text-white/22">
                          {proposal.detail}
                        </div>

                        {!proposal.accepted && (
                          <div className="mt-4 flex gap-2">
                            <button
                              onClick={() =>
                                acceptAgentProposal(
                                  proposal.id
                                )
                              }
                              className="rounded-xl bg-white px-3 py-2 text-[8px] uppercase tracking-[0.16em] text-black"
                            >
                              Keep
                            </button>

                            <button
                              onClick={() =>
                                rejectAgentProposal(
                                  proposal.id
                                )
                              }
                              className="rounded-xl border border-white/10 px-3 py-2 text-[8px] uppercase tracking-[0.16em] text-white/22"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/[0.025] p-5">
                <div className="text-[8px] uppercase tracking-[0.25em] text-white/17">
                  Anchors
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    value={assumption}
                    onChange={(event) =>
                      setAssumption(
                        event.target.value
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        addAssumptionValue();
                      }
                    }}
                    placeholder="What must stay true?"
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-[10px] text-white outline-none placeholder:text-white/14"
                  />

                  <button
                    onClick={addAssumptionValue}
                    className="rounded-xl border border-white/10 px-3 text-[8px] uppercase tracking-[0.16em] text-white/22"
                  >
                    Add
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {intentState.assumptions.map(
                    (item) => (
                      <div
                        key={item}
                        className="rounded-xl bg-black/10 px-3 py-2 text-[9px] leading-5 text-white/23"
                      >
                        {item}
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/[0.025] p-5">
                <div className="text-[8px] uppercase tracking-[0.25em] text-white/17">
                  Echo
                </div>

                <div className="mt-4 space-y-2">
                  {intentState.history.map(
                    (item, index) => (
                      <div
                        key={`${item}-${index}`}
                        className={`rounded-2xl border p-3 text-[9px] leading-5 ${
                          index === 0
                            ? "border-white/15 bg-white/[0.04] text-white/42"
                            : "border-white/10 bg-black/10 text-white/20"
                        }`}
                      >
                        {item}
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/[0.025] p-5">
                <div className="text-[8px] uppercase tracking-[0.25em] text-white/17">
                  Activity
                </div>

                <div className="mt-5 space-y-4">
                  {intentState.activities.map(
                    (activity) => (
                      <div
                        key={activity.id}
                        className="relative border-l border-white/10 pl-4"
                      >
                        <div className="absolute -left-[3px] top-1.5 h-1.5 w-1.5 rounded-full bg-white/55" />

                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[10px] text-white/40">
                            {activity.action}
                          </div>

                          <div className="text-[7px] text-white/13">
                            {activity.time}
                          </div>
                        </div>

                        <div className="mt-1 text-[9px] leading-5 text-white/21">
                          {activity.detail}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </aside>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            <div className="rounded-[26px] border border-white/10 bg-white/[0.02] p-5">
              <div className="text-[8px] uppercase tracking-[0.25em] text-white/17">
                Lens
              </div>

              <div className="mt-2 text-sm text-white/44">
                What changes if this matters more?
              </div>

              <button
                onClick={() => {
                  const node =
                    intentState.nodes.find(
                      (item) =>
                        item.id ===
                        intentState.activeNode
                    );

                  if (node) {
                    setLens(
                      counterfactualLens(
                        node.id
                      )
                    );
                  }
                }}
                className="mt-4 rounded-xl border border-white/10 px-3 py-2 text-[8px] uppercase tracking-[0.16em] text-white/22"
              >
                Explore
              </button>

              {lens?.success && (
                <div className="mt-4 rounded-2xl bg-black/10 p-3 text-[9px] leading-5 text-white/27">
                  {lens.question}
                </div>
              )}
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/[0.02] p-5">
              <div className="text-[8px] uppercase tracking-[0.25em] text-white/17">
                Compression
              </div>

              <div className="mt-2 text-sm text-white/44">
                Keep the meaning. Lose the noise.
              </div>

              <button
                onClick={() =>
                  setCompression(
                    compressIntent()
                  )
                }
                className="mt-4 rounded-xl border border-white/10 px-3 py-2 text-[8px] uppercase tracking-[0.16em] text-white/22"
              >
                Compress
              </button>

              {compression?.success && (
                <div className="mt-4 rounded-2xl bg-black/10 p-3 text-[9px] leading-5 text-white/27">
                  {compression.essence}
                </div>
              )}
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/[0.02] p-5">
              <div className="text-[8px] uppercase tracking-[0.25em] text-white/17">
                DNA
              </div>

              <div className="mt-2 text-sm text-white/44">
                A fingerprint of what matters.
              </div>

              <button
                onClick={() =>
                  setDna(intentDNA())
                }
                className="mt-4 rounded-xl border border-white/10 px-3 py-2 text-[8px] uppercase tracking-[0.16em] text-white/22"
              >
                Reveal
              </button>

              {dna && (
                <div className="mt-4 font-mono text-sm tracking-[0.15em] text-white/43">
                  {dna.signature}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 rounded-[26px] border border-white/10 bg-white/[0.02] p-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <div className="text-[8px] uppercase tracking-[0.25em] text-white/17">
                  Snapshots
                </div>

                <div className="mt-1 text-[10px] text-white/21">
                  Remember where the intent was.
                </div>
              </div>

              <button
                onClick={() =>
                  createSnapshot()
                }
                className="rounded-xl border border-white/10 px-3 py-2 text-[8px] uppercase tracking-[0.18em] text-white/22"
              >
                Save
              </button>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {intentState.snapshots.map(
                (snapshot) => (
                  <div
                    key={snapshot.id}
                    className="rounded-2xl border border-white/10 bg-black/10 p-4"
                  >
                    <div className="text-[8px] text-white/15">
                      v{snapshot.version}
                    </div>

                    <div className="mt-2 text-xs text-white/34">
                      {snapshot.label}
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() =>
                          setDiff(
                            getIntentDiff(
                              snapshot.id
                            )
                          )
                        }
                        className="rounded-lg border border-white/10 px-2 py-1.5 text-[7px] uppercase tracking-[0.14em] text-white/21"
                      >
                        Diff
                      </button>

                      <button
                        onClick={() =>
                          restoreSnapshot(
                            snapshot.id
                          )
                        }
                        className="rounded-lg border border-white/10 px-2 py-1.5 text-[7px] uppercase tracking-[0.14em] text-white/21"
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>

            {diff?.success && (
              <div className="mt-4 rounded-2xl bg-black/10 p-4 text-[9px] leading-5 text-white/23">
                v{diff.fromVersion} → v
                {diff.toVersion} ·{" "}
                {diff.added.length} added ·{" "}
                {diff.changed.length} changed
              </div>
            )}
          </div>

          <div className="mt-10 border-t border-white/[0.08] pt-8">
            <div className="grid gap-8 lg:grid-cols-[.7fr_1.3fr] lg:items-end">
              <div>
                <div className="text-[8px] uppercase tracking-[0.3em] text-white/17">
                  Civilization
                </div>

                <h2 className="mt-4 max-w-xl text-3xl font-medium tracking-[-0.04em] text-white/67 sm:text-4xl">
                  What matters shapes what becomes possible.
                </h2>
              </div>

              <div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    ["Human", "Meaning"],
                    ["Agent", "Possibility"],
                    ["World", "Change"],
                  ].map(([title, detail]) => (
                    <div
                      key={title}
                      className="rounded-2xl border border-white/10 bg-white/[0.018] p-4"
                    >
                      <div className="text-sm text-white/49">
                        {title}
                      </div>

                      <div className="mt-1 text-[9px] uppercase tracking-[0.18em] text-white/17">
                        {detail}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 max-w-4xl text-sm leading-7 text-white/24">
                  INTENT gives humans and agents a shared
                  place to shape what matters before the
                  world changes.
                </div>
              </div>
            </div>
          </div>

          <footer className="mt-8 flex flex-col justify-between gap-2 border-t border-white/[0.08] pt-5 text-[8px] uppercase tracking-[0.22em] text-white/14 sm:flex-row">
            <span>
              Start with what matters.
            </span>

            <span>
              Human × Agent × World
            </span>
          </footer>
        </section>
      </div>
    </main>
  );
}