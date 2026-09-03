"use client";

import { useEffect, useState } from "react";
import {
  intentState,
  addIntentNode,
  focusAttention,
  surfaceContradiction,
  evolveIntent,
  forkIntent,
  registerIntentTools,
  unregisterIntentTools,
  subscribeIntent,
  setIntent,
  resetIntentNodes,
  type IntentNode,
} from "./webmcp";

export default function Home() {
  const [intent, setIntentText] = useState("");
  const [submittedIntent, setSubmittedIntent] = useState("");
  const [activeNode, setActiveNode] = useState("");
  const [nodes, setNodes] = useState<IntentNode[]>([]);
  const [contradiction, setContradiction] = useState<{
    first: string;
    second: string;
  } | null>(null);
  const [evolution, setEvolution] = useState<{
    version: number;
    reason: string;
  } | null>(null);
  const [forked, setForked] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    const syncState = () => {
      setNodes([...intentState.nodes]);
      setActiveNode(intentState.activeNode);
    };

    syncState();

    const unsubscribe = subscribeIntent(syncState);

    registerIntentTools();

    return () => {
      unsubscribe();
      unregisterIntentTools();
    };
  }, []);

  function enterIntent() {
    const trimmed = intent.trim();

    if (!trimmed) return;

    setIntentText(trimmed);
    setSubmittedIntent(trimmed);

    setIntent(trimmed);
    resetIntentNodes();

    const goal = addIntentNode(
      "goal",
      trimmed,
      1
    );

    addIntentNode(
      "constraint",
      "Must feel genuinely original",
      0.8
    );

    addIntentNode(
      "value",
      "Meaningful real-world impact",
      0.9
    );

    addIntentNode(
      "unknown",
      "What becomes possible when humans and agents share intent?",
      0.6
    );

    focusAttention(goal.id);

    setContradiction(null);
    setEvolution(null);
    setForked(null);

    setHistory((previous) => [
      trimmed,
      ...previous.filter((item) => item !== trimmed),
    ]);
  }

  function handleFocus(node: IntentNode) {
    focusAttention(node.id);
  }

  function handleContradiction() {
    const result = surfaceContradiction(
      "Genuinely original",
      "Fast to build"
    );

    setContradiction({
      first: result.first,
      second: result.second,
    });
  }

  function handleEvolution() {
    const result = evolveIntent(
      "The user prioritised originality over speed."
    );

    setEvolution({
      version: result.version,
      reason: result.reason,
    });
  }

  function handleFork() {
    const result = forkIntent(
      "Explore a more radical direction"
    );

    setForked(result.forkId);
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <div>
            <div className="text-sm font-medium tracking-[0.35em] text-white/50">
              INTENT
            </div>

            <div className="mt-1 text-xs text-white/30">
              The interface between what you mean and what becomes possible.
            </div>
          </div>

          <div className="rounded-full border border-white/10 px-3 py-1 text-[10px] tracking-[0.2em] text-white/40">
            WEBMCP
          </div>
        </header>

        {!submittedIntent ? (
          <section className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-3xl">
              <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/30">
                Intent Interface
              </p>

              <h1 className="text-5xl font-medium leading-tight tracking-tight md:text-7xl">
                What are you trying
                <br />
                to make happen?
              </h1>

              <p className="mt-6 max-w-xl text-base leading-7 text-white/45">
                Don&apos;t describe the task. Describe the change you want
                in the world.
              </p>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <input
                  value={intent}
                  onChange={(event) =>
                    setIntentText(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      enterIntent();
                    }
                  }}
                  placeholder="I want to..."
                  className="h-14 flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-base outline-none transition placeholder:text-white/20 focus:border-white/25"
                />

                <button
                  onClick={enterIntent}
                  className="h-14 rounded-2xl bg-white px-7 text-sm font-medium text-black transition hover:bg-white/90"
                >
                  Enter intent
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="flex-1 py-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
              <div>
                <div className="mb-3 text-xs uppercase tracking-[0.3em] text-white/30">
                  Living intent
                </div>

                <h1 className="max-w-4xl text-3xl font-medium leading-tight md:text-5xl">
                  {submittedIntent}
                </h1>

                <div className="mt-5 flex items-center gap-3 text-xs text-white/35">
                  <span className="h-2 w-2 rounded-full bg-white/70" />
                  Shared intent space active
                </div>

                <div className="mt-10">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-xs uppercase tracking-[0.25em] text-white/30">
                      Intent gravity
                    </div>

                    <div className="text-[10px] tracking-[0.2em] text-white/25">
                      {nodes.length} NODES
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {nodes.map((node) => {
                      const isActive = node.id === activeNode;
                      const relevance = node.relevance ?? 0.7;

                      return (
                        <button
                          key={node.id}
                          onClick={() => handleFocus(node)}
                          className={`group rounded-2xl border p-5 text-left transition-all duration-500 ${
                            isActive
                              ? "border-white/30 bg-white/[0.09]"
                              : "border-white/10 bg-white/[0.03] hover:border-white/20"
                          }`}
                          style={{
                            transform: `scale(${0.97 + relevance * 0.03})`,
                            opacity: 0.55 + relevance * 0.45,
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-[0.25em] text-white/30">
                              {node.type}
                            </span>

                            <span className="text-[10px] text-white/25">
                              {Math.round(relevance * 100)}%
                            </span>
                          </div>

                          <div className="mt-4 text-sm leading-6 text-white/75">
                            {node.label}
                          </div>

                          {isActive && (
                            <div className="mt-4 text-[10px] uppercase tracking-[0.2em] text-white/45">
                              Shared attention
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    onClick={handleContradiction}
                    className="rounded-xl border border-white/10 px-4 py-3 text-xs text-white/60 transition hover:border-white/25 hover:text-white"
                  >
                    Surface contradiction
                  </button>

                  <button
                    onClick={handleEvolution}
                    className="rounded-xl border border-white/10 px-4 py-3 text-xs text-white/60 transition hover:border-white/25 hover:text-white"
                  >
                    Evolve intent
                  </button>

                  <button
                    onClick={handleFork}
                    className="rounded-xl border border-white/10 px-4 py-3 text-xs text-white/60 transition hover:border-white/25 hover:text-white"
                  >
                    Fork possibility
                  </button>
                </div>

                {contradiction && (
                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-white/30">
                      Contradiction surfaced
                    </div>

                    <div className="mt-3 text-sm text-white/70">
                      {contradiction.first}
                      <span className="mx-3 text-white/20">
                        ↔
                      </span>
                      {contradiction.second}
                    </div>

                    <div className="mt-3 text-xs text-white/30">
                      Human decision required.
                    </div>
                  </div>
                )}

                {evolution && (
                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-white/30">
                      Intent evolved
                    </div>

                    <div className="mt-3 text-sm text-white/70">
                      Version {evolution.version}
                    </div>

                    <div className="mt-2 text-xs leading-5 text-white/35">
                      {evolution.reason}
                    </div>
                  </div>
                )}

                {forked && (
                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-white/30">
                      Possibility forked
                    </div>

                    <div className="mt-3 text-sm text-white/65">
                      A separate direction can now be explored without
                      changing the original intent.
                    </div>
                  </div>
                )}
              </div>

              <aside className="lg:border-l lg:border-white/10 lg:pl-8">
                <div className="text-xs uppercase tracking-[0.3em] text-white/30">
                  Shared attention
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-white/80" />

                    <div className="text-sm text-white/70">
                      Human + Agent
                    </div>
                  </div>

                  <div className="mt-4 text-xs leading-5 text-white/35">
                    Both can observe and manipulate the same living intent
                    space.
                  </div>
                </div>

                <div className="mt-8 text-xs uppercase tracking-[0.3em] text-white/30">
                  Intent memory
                </div>

                <div className="mt-4 space-y-2">
                  {history.length === 0 ? (
                    <div className="text-xs text-white/20">
                      No previous intents.
                    </div>
                  ) : (
                    history.map((item, index) => (
                      <div
                        key={`${item}-${index}`}
                        className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs leading-5 text-white/40"
                      >
                        {item}
                      </div>
                    ))
                  )}
                </div>
              </aside>
            </div>
          </section>
        )}

        <footer className="border-t border-white/10 pt-5 text-[10px] uppercase tracking-[0.2em] text-white/20">
          Don&apos;t tell software what to do. Show it what you want.
        </footer>
      </div>
    </main>
  );
}