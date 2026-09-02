"use client";

import { useEffect, useState } from "react";
import {
  addIntentNode,
  evolveIntent,
  forkIntent,
  focusAttention,
  intentState,
  registerIntentTools,
  resetIntentNodes,
  setIntent,
  subscribeIntent,
  surfaceContradiction,
  unregisterIntentTools,
  type IntentNode,
  type IntentNodeType,
} from "./webmcp";

export default function Home() {
  const [intent, setIntentInput] = useState("");
  const [submittedIntent, setSubmittedIntent] = useState("");
  const [nodes, setNodes] = useState<IntentNode[]>([]);
  const [activeNode, setActiveNode] =
    useState<IntentNodeType>("goal");

  const [contradiction, setContradiction] = useState("");
  const [evolution, setEvolution] = useState("");
  const [forked, setForked] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    registerIntentTools();

    const unsubscribe = subscribeIntent(() => {
      setNodes([...intentState.nodes]);

      const active = intentState.nodes.find(
        (node) => node.id === intentState.activeNode
      );

      if (active) {
        setActiveNode(active.type);
      }
    });

    return () => {
      unsubscribe();
      unregisterIntentTools();
    };
  }, []);

  function enterIntent() {
    if (!intent.trim()) return;

    setIntent(intent.trim());
    resetIntentNodes();

    const goal = addIntentNode(
      "goal",
      intent.trim(),
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

    setSubmittedIntent(intent.trim());
    setContradiction("");
    setEvolution("");
    setForked(false);
    setHistory([intent.trim()]);
  }

  function selectNode(node: IntentNode) {
    focusAttention(node.id);
  }

  function revealContradiction() {
    const result = surfaceContradiction(
      "Maximum originality",
      "Fast execution"
    );

    setContradiction(
      `${result.first} ↔ ${result.second}`
    );
  }

  function proposeEvolution() {
    const result = evolveIntent(
      "Meaningful impact now matters more than speed."
    );

    setEvolution(
      `Version ${result.version}: Meaningful impact now matters more than speed.`
    );
  }

  function acceptEvolution() {
    if (!evolution) return;

    setHistory((previous) => [
      ...previous,
      evolution,
    ]);

    setEvolution("");
  }

  function createFork() {
    forkIntent("Maximize novelty");
    setForked(true);
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-black px-6 py-10 text-white">
      <div className="mx-auto w-full max-w-6xl">
        <p className="text-sm tracking-[0.3em] text-gray-500">
          INTENT
        </p>

        <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight md:text-7xl">
          What are you trying to make happen?
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-gray-400">
          Don&apos;t describe the task. Describe the change
          you want in the world.
        </p>

        <section className="mt-12 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-10">
          <textarea
            value={intent}
            onChange={(event) =>
              setIntentInput(event.target.value)
            }
            placeholder="I want to..."
            className="min-h-40 w-full resize-none bg-transparent text-2xl outline-none placeholder:text-gray-700 md:text-4xl"
          />

          <button
            onClick={enterIntent}
            className="mt-6 rounded-full bg-white px-6 py-3 font-medium text-black transition hover:bg-gray-200 active:scale-95"
          >
            Enter Intent Space →
          </button>
        </section>

        {submittedIntent && (
          <>
            <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.02] p-6 md:p-10">
              <p className="text-xs tracking-[0.25em] text-gray-500">
                LIVING INTENT
              </p>

              <p className="mt-2 text-sm text-gray-600">
                A shared space where human intention and
                agent reasoning meet.
              </p>

              <h2 className="mt-5 text-2xl md:text-3xl">
                {submittedIntent}
              </h2>

              <div className="mt-10 grid gap-5 md:grid-cols-2">
                {nodes.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => selectNode(node)}
                    className={`rounded-2xl border p-6 text-left transition-all duration-700 active:scale-95 ${
                      node.id === intentState.activeNode
                        ? "scale-[1.03] border-white/50 bg-white/10"
                        : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs tracking-[0.2em] text-gray-500">
                        {node.type.toUpperCase()}
                      </p>

                      <span className="text-xs text-gray-700">
                        {Math.round(
                          (node.relevance ?? 0) * 100
                        )}
                        %
                      </span>
                    </div>

                    <p className="mt-3 text-gray-300">
                      {node.label}
                    </p>
                  </button>
                ))}
              </div>

              <p className="mt-8 text-sm text-gray-600">
                Human + Agent shared attention
              </p>

              <button
                onClick={revealContradiction}
                className="mt-4 rounded-full border border-white/20 px-6 py-3 text-sm transition hover:bg-white/10 active:scale-95"
              >
                Surface tension
              </button>

              {contradiction && (
                <div className="mt-6 rounded-2xl border border-white/20 p-6">
                  <p className="text-xs tracking-[0.2em] text-gray-500">
                    CONTRADICTION DETECTED
                  </p>

                  <p className="mt-3 text-xl">
                    {contradiction}
                  </p>

                  <p className="mt-3 text-gray-500">
                    Human decision required.
                  </p>
                </div>
              )}

              <button
                onClick={proposeEvolution}
                className="mt-4 rounded-full border border-white/20 px-6 py-3 text-sm transition hover:bg-white/10 active:scale-95"
              >
                Propose evolution
              </button>

              {evolution && (
                <div className="mt-6 rounded-2xl border border-white/20 p-6">
                  <p className="text-xs tracking-[0.2em] text-gray-500">
                    INTENT EVOLUTION
                  </p>

                  <p className="mt-3 text-xl">
                    {evolution}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      onClick={acceptEvolution}
                      className="rounded-full bg-white px-5 py-2 text-sm text-black transition active:scale-95"
                    >
                      Accept
                    </button>

                    <button
                      onClick={() => setEvolution("")}
                      className="rounded-full border border-white/20 px-5 py-2 text-sm transition hover:bg-white/10 active:scale-95"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={createFork}
                className="mt-8 rounded-full border border-white/20 px-6 py-3 text-sm transition hover:bg-white/10 active:scale-95"
              >
                Fork intent
              </button>

              {forked && (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 p-6">
                    <p className="text-xs tracking-[0.2em] text-gray-500">
                      FORK A
                    </p>

                    <h3 className="mt-3 text-xl">
                      Maximize novelty
                    </h3>

                    <p className="mt-2 text-gray-500">
                      Explore the most original possibility.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 p-6">
                    <p className="text-xs tracking-[0.2em] text-gray-500">
                      FORK B
                    </p>

                    <h3 className="mt-3 text-xl">
                      Maximize feasibility
                    </h3>

                    <p className="mt-2 text-gray-500">
                      Explore the fastest credible path.
                    </p>
                  </div>
                </div>
              )}
            </section>

            {history.length > 0 && (
              <section className="mt-10 rounded-3xl border border-white/10 p-6 md:p-10">
                <p className="text-xs tracking-[0.25em] text-gray-500">
                  INTENT MEMORY
                </p>

                <div className="mt-6 space-y-4">
                  {history.map((item, index) => (
                    <div
                      key={`${item}-${index}`}
                      className="rounded-2xl border border-white/10 p-5"
                    >
                      <p className="text-xs text-gray-600">
                        VERSION {index + 1}
                      </p>

                      <p className="mt-2 text-gray-300">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}