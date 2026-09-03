"use client";

import {
  ChangeEvent,
  CSSProperties,
  DragEvent,
  KeyboardEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type View =
  | "home"
  | "intent"
  | "graph"
  | "files"
  | "search"
  | "activity"
  | "trust";

type NodeKind =
  | "goal"
  | "constraint"
  | "value"
  | "unknown"
  | "context"
  | "decision"
  | "action"
  | "output";

type NodeStatus = "active" | "resolved" | "open" | "blocked";

type IntentNode = {
  id: string;
  kind: NodeKind;
  title: string;
  detail: string;
  status: NodeStatus;
  confidence: number;
  createdAt: number;
  source?: string;
  relatedTo?: string[];
};

type IntentFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  source: "upload" | "reference";
  addedAt: number;
  summary: string;
  tags: string[];
};

type Decision = {
  id: string;
  title: string;
  question: string;
  choice?: string;
  options: string[];
  status: "open" | "decided";
  createdAt: number;
  changedAt: number;
};

type IntentAction = {
  id: string;
  title: string;
  detail: string;
  status: "ready" | "in-progress" | "done";
  owner: "human" | "agent";
  createdAt: number;
};

type Snapshot = {
  id: string;
  label: string;
  createdAt: number;
  text: string;
  nodes: IntentNode[];
  decisions: Decision[];
  actions: IntentAction[];
};

type AgentSuggestion = {
  id: string;
  kind: "clarify" | "tension" | "evolution" | "action" | "context";
  title: string;
  explanation: string;
  change: string;
  confidence: number;
  requiresHumanDecision: boolean;
  createdAt: number;
  status: "pending" | "accepted" | "rejected";
};

type ActivityItem = {
  id: string;
  actor: "human" | "agent" | "system";
  title: string;
  detail: string;
  createdAt: number;
  type:
    | "understood"
    | "proposed"
    | "changed"
    | "decision"
    | "context"
    | "action"
    | "memory"
    | "trust";
};

type GraphNode = {
  id: string;
  x: number;
  y: number;
  radius: number;
  label: string;
  sublabel: string;
  category:
    | "intent"
    | "context"
    | "decision"
    | "action"
    | "output"
    | "file"
    | "unknown";
  linked: string[];
};

type Toast = {
  id: string;
  title: string;
  detail?: string;
  tone?: "neutral" | "good" | "warning";
};

type SearchResult = {
  id: string;
  type:
    | "intent"
    | "node"
    | "file"
    | "decision"
    | "action"
    | "activity";
  title: string;
  detail: string;
  meta: string;
};

const STORAGE_KEY = "intent-paradigm-state-v2";

const DEFAULT_INTENT =
  "Create a focused space where people and AI can shape the same intent before acting.";

const DEFAULT_NODES: IntentNode[] = [
  {
    id: "goal-1",
    kind: "goal",
    title: "Shared understanding",
    detail:
      "Human and agent should work from the same evolving understanding of what matters.",
    status: "active",
    confidence: 0.96,
    createdAt: Date.now(),
    source: "initial intent",
  },
  {
    id: "goal-2",
    kind: "goal",
    title: "Better decisions before action",
    detail:
      "The system should make tradeoffs visible before they turn into irreversible actions.",
    status: "active",
    confidence: 0.92,
    createdAt: Date.now(),
    source: "initial intent",
  },
  {
    id: "constraint-1",
    kind: "constraint",
    title: "Human approval matters",
    detail:
      "Material changes should remain visible and require a human decision when appropriate.",
    status: "active",
    confidence: 0.93,
    createdAt: Date.now(),
    source: "initial intent",
  },
  {
    id: "value-1",
    kind: "value",
    title: "Clarity over complexity",
    detail:
      "The interface should expose useful complexity without forcing the human to manage internals.",
    status: "active",
    confidence: 0.94,
    createdAt: Date.now(),
    source: "initial intent",
  },
  {
    id: "unknown-1",
    kind: "unknown",
    title: "What should remain unresolved?",
    detail:
      "Some uncertainty may be useful. The system should distinguish unknowns from mistakes.",
    status: "open",
    confidence: 0.62,
    createdAt: Date.now(),
    source: "system interpretation",
  },
];

const DEFAULT_DECISIONS: Decision[] = [
  {
    id: "decision-1",
    title: "Where should autonomy stop?",
    question:
      "Which changes can the agent make on its own, and which must stay human-owned?",
    options: ["Low-risk changes", "Context changes", "Material decisions"],
    choice: undefined,
    status: "open",
    createdAt: Date.now(),
    changedAt: Date.now(),
  },
];

const DEFAULT_ACTIONS: IntentAction[] = [
  {
    id: "action-1",
    title: "Explore one concrete use case",
    detail:
      "Turn the current intent into a small scenario that can reveal what is still unclear.",
    status: "ready",
    owner: "human",
    createdAt: Date.now(),
  },
  {
    id: "action-2",
    title: "Map current context",
    detail:
      "Bring the relevant files, decisions and references into the same working space.",
    status: "ready",
    owner: "agent",
    createdAt: Date.now(),
  },
];

const DEFAULT_FILES: IntentFile[] = [
  {
    id: "reference-1",
    name: "Intent Interface Notes",
    type: "text/plain",
    size: 18400,
    source: "reference",
    addedAt: Date.now(),
    summary:
      "A lightweight reference describing the problem, principles and questions around intent-first interaction.",
    tags: ["reference", "principles", "intent"],
  },
];

const DEFAULT_ACTIVITY: ActivityItem[] = [
  {
    id: "activity-1",
    actor: "system",
    title: "Intent space initialized",
    detail:
      "The workspace separated goals, constraints, values, unknowns and context so they can evolve independently.",
    createdAt: Date.now() - 1000 * 60 * 22,
    type: "understood",
  },
  {
    id: "activity-2",
    actor: "agent",
    title: "A boundary was identified",
    detail:
      "Material intent changes should not silently become actions. Human decision remains visible in the loop.",
    createdAt: Date.now() - 1000 * 60 * 17,
    type: "trust",
  },
  {
    id: "activity-3",
    actor: "system",
    title: "A useful unknown surfaced",
    detail:
      "The system marked autonomy boundaries as unresolved rather than pretending certainty.",
    createdAt: Date.now() - 1000 * 60 * 9,
    type: "proposed",
  },
];

const KIND_LABEL: Record<NodeKind, string> = {
  goal: "Goal",
  constraint: "Constraint",
  value: "Value",
  unknown: "Unknown",
  context: "Context",
  decision: "Decision",
  action: "Action",
  output: "Output",
};

const KIND_ICON: Record<NodeKind, string> = {
  goal: "◎",
  constraint: "⊣",
  value: "◇",
  unknown: "?",
  context: "◌",
  decision: "◈",
  action: "→",
  output: "□",
};

const VIEW_LABEL: Record<View, string> = {
  home: "Start",
  intent: "Intent",
  graph: "Graph",
  files: "Context",
  search: "Search",
  activity: "Activity",
  trust: "Trust",
};

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now()
    .toString(36)
    .slice(-5)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function relativeTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function parseIntent(text: string): IntentNode[] {
  const normalized = text.trim();
  if (!normalized) return [];

  const now = Date.now();
  const lowered = normalized.toLowerCase();
  const result: IntentNode[] = [];

  const add = (
    kind: NodeKind,
    title: string,
    detail: string,
    confidence: number,
  ) => {
    result.push({
      id: uid(kind),
      kind,
      title,
      detail,
      status: kind === "unknown" ? "open" : "active",
      confidence,
      createdAt: now,
      source: "interpreted from intent",
    });
  };

  add("goal", "Primary intent", normalized, 0.91);

  if (
    lowered.includes("before") ||
    lowered.includes("understand") ||
    lowered.includes("clarif")
  ) {
    add(
      "goal",
      "Clarify before action",
      "Understanding should improve before execution becomes irreversible.",
      0.88,
    );
  }

  if (
    lowered.includes("human") ||
    lowered.includes("approval") ||
    lowered.includes("control")
  ) {
    add(
      "constraint",
      "Human ownership",
      "Material decisions should remain explicit and human-owned.",
      0.89,
    );
  }

  if (
    lowered.includes("simple") ||
    lowered.includes("clear") ||
    lowered.includes("focus") ||
    lowered.includes("calm")
  ) {
    add(
      "value",
      "Clarity",
      "The experience should feel calm while still making important relationships visible.",
      0.87,
    );
  }

  if (
    lowered.includes("file") ||
    lowered.includes("document") ||
    lowered.includes("context") ||
    lowered.includes("research")
  ) {
    add(
      "context",
      "Relevant context",
      "Files and references should become part of the same intent space.",
      0.84,
    );
  }

  if (
    lowered.includes("tradeoff") ||
    lowered.includes("tension") ||
    lowered.includes("between")
  ) {
    add(
      "unknown",
      "Tradeoff to resolve",
      "The intent contains a tension that should be surfaced before action.",
      0.68,
    );
  }

  if (result.length === 1) {
    add(
      "unknown",
      "What is still missing?",
      "The system should resist inventing certainty when the intent is under-specified.",
      0.57,
    );
  }

  return result;
}

function compactText(text: string, max = 120) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function actorLabel(actor: ActivityItem["actor"]) {
  if (actor === "agent") return "Agent";
  if (actor === "human") return "You";
  return "System";
}

function searchIncludes(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export default function Page() {
  const [view, setView] = useState<View>("home");
  const [intent, setIntent] = useState(DEFAULT_INTENT);
  const [draftIntent, setDraftIntent] = useState(DEFAULT_INTENT);
  const [nodes, setNodes] = useState<IntentNode[]>(DEFAULT_NODES);
  const [files, setFiles] = useState<IntentFile[]>(DEFAULT_FILES);
  const [decisions, setDecisions] =
    useState<Decision[]>(DEFAULT_DECISIONS);
  const [actions, setActions] = useState<IntentAction[]>(DEFAULT_ACTIONS);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [suggestions, setSuggestions] = useState<AgentSuggestion[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>(DEFAULT_ACTIVITY);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(
    DEFAULT_NODES[0]?.id ?? null,
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [editingIntent, setEditingIntent] = useState(false);
  const [savingIntent, setSavingIntent] = useState(false);
  const [selectedDecisionId, setSelectedDecisionId] =
    useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [graphScale, setGraphScale] = useState(1);
  const [graphPan, setGraphPan] = useState({ x: 0, y: 0 });

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [webMCPReady, setWebMCPReady] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const graphRef = useRef<HTMLDivElement | null>(null);
  const intentInputRef = useRef<HTMLTextAreaElement | null>(null);

  const pushToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = uid("toast");
    setToasts((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const addActivity = useCallback(
    (
      item: Omit<ActivityItem, "id" | "createdAt"> & { createdAt?: number },
    ) => {
      setActivity((current) => [
        {
          id: uid("activity"),
          createdAt: item.createdAt ?? Date.now(),
          ...item,
        },
        ...current,
      ]);
    },
    [],
  );

  const persistState = useCallback(
    (override?: Partial<Record<string, unknown>>) => {
      try {
        const payload = {
          intent,
          draftIntent,
          nodes,
          files,
          decisions,
          actions,
          snapshots,
          suggestions,
          activity,
          activeNodeId,
          savedAt: Date.now(),
          ...override,
        };

        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // Storage failures should never block the working surface.
      }
    },
    [
      intent,
      draftIntent,
      nodes,
      files,
      decisions,
      actions,
      snapshots,
      suggestions,
      activity,
      activeNodeId,
    ],
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<{
          intent: string;
          draftIntent: string;
          nodes: IntentNode[];
          files: IntentFile[];
          decisions: Decision[];
          actions: IntentAction[];
          snapshots: Snapshot[];
          suggestions: AgentSuggestion[];
          activity: ActivityItem[];
          activeNodeId: string | null;
        }>;

        if (saved.intent) setIntent(saved.intent);
        if (saved.draftIntent) setDraftIntent(saved.draftIntent);
        if (saved.nodes?.length) setNodes(saved.nodes);
        if (saved.files) setFiles(saved.files);
        if (saved.decisions) setDecisions(saved.decisions);
        if (saved.actions) setActions(saved.actions);
        if (saved.snapshots) setSnapshots(saved.snapshots);
        if (saved.suggestions) setSuggestions(saved.suggestions);
        if (saved.activity?.length) setActivity(saved.activity);
        if (saved.activeNodeId !== undefined) {
          setActiveNodeId(saved.activeNodeId);
        }
      }
    } catch {
      pushToast({
        title: "Started clean",
        detail: "Saved workspace data could not be restored safely.",
        tone: "warning",
      });
    }

    setHydrated(true);
  }, [pushToast]);

  useEffect(() => {
    if (!hydrated) return;
    persistState();
  }, [hydrated, persistState]);

  const openView = useCallback((nextView: View) => {
    setView(nextView);
    setSidebarOpen(false);
    setPlusOpen(false);
    setGlobalSearchOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const createSnapshot = useCallback(
    (label: string) => {
      const snapshot: Snapshot = {
        id: uid("snapshot"),
        label,
        createdAt: Date.now(),
        text: intent,
        nodes: structuredClone(nodes),
        decisions: structuredClone(decisions),
        actions: structuredClone(actions),
      };

      setSnapshots((current) => [snapshot, ...current].slice(0, 20));

      addActivity({
        actor: "human",
        title: "Intent remembered",
        detail: `Created snapshot “${label}” so this state can be revisited.`,
        type: "memory",
      });

      pushToast({
        title: "Remembered",
        detail: `Snapshot “${label}” is now in history.`,
        tone: "good",
      });
    },
    [actions, addActivity, decisions, intent, nodes, pushToast],
  );

  const restoreSnapshot = useCallback(
    (snapshot: Snapshot) => {
      setIntent(snapshot.text);
      setDraftIntent(snapshot.text);
      setNodes(structuredClone(snapshot.nodes));
      setDecisions(structuredClone(snapshot.decisions));
      setActions(structuredClone(snapshot.actions));
      setActiveNodeId(snapshot.nodes[0]?.id ?? null);

      addActivity({
        actor: "human",
        title: "Intent restored",
        detail: `Returned to “${snapshot.label}”.`,
        type: "changed",
      });

      pushToast({
        title: "Restored",
        detail: `The workspace is back at “${snapshot.label}”.`,
        tone: "good",
      });

      openView("intent");
    },
    [addActivity, openView, pushToast],
  );

  const analyzeIntent = useCallback(
    (sourceText: string) => {
      const interpreted = parseIntent(sourceText);

      setNodes((current) => {
        const retained = current.filter(
          (node) =>
            node.source !== "interpreted from intent" &&
            node.source !== "system interpretation",
        );

        return [...retained, ...interpreted];
      });

      const hasUnknown = interpreted.some((node) => node.kind === "unknown");

      if (hasUnknown) {
        setSuggestions((current) => [
          {
            id: uid("suggestion"),
            kind: "clarify",
            title: "One part of the intent is still open",
            explanation:
              "The system found meaningful ambiguity and is keeping it visible instead of filling it in silently.",
            change:
              "Clarify the most important unresolved tradeoff before committing to action.",
            confidence: 0.72,
            requiresHumanDecision: true,
            createdAt: Date.now(),
            status: "pending",
          },
          ...current,
        ]);
      }

      addActivity({
        actor: "agent",
        title: "Understanding refreshed",
        detail:
          "The intent was reinterpreted into goals, constraints, values, context and unknowns.",
        type: "understood",
      });
    },
    [addActivity],
  );

  const saveIntent = useCallback(() => {
    const next = draftIntent.trim();

    if (!next) {
      pushToast({
        title: "Intent is empty",
        detail: "Give the space something meaningful to work with.",
        tone: "warning",
      });
      return;
    }

    setSavingIntent(true);

    window.setTimeout(() => {
      createSnapshot("Before latest intent change");
      setIntent(next);
      analyzeIntent(next);
      setEditingIntent(false);
      setSavingIntent(false);

      addActivity({
        actor: "human",
        title: "Intent changed",
        detail: compactText(next, 180),
        type: "changed",
      });

      pushToast({
        title: "Intent evolved",
        detail: "The shared intent space has been updated.",
        tone: "good",
      });
    }, 280);
  }, [
    addActivity,
    analyzeIntent,
    createSnapshot,
    draftIntent,
    pushToast,
  ]);

  const addNode = useCallback(
    (
      kind: NodeKind,
      title: string,
      detail: string,
      confidence = 0.82,
    ) => {
      const node: IntentNode = {
        id: uid(kind),
        kind,
        title,
        detail,
        confidence,
        status: kind === "unknown" ? "open" : "active",
        createdAt: Date.now(),
        source: "human",
      };

      setNodes((current) => [node, ...current]);
      setActiveNodeId(node.id);

      addActivity({
        actor: "human",
        title: `${KIND_LABEL[kind]} added`,
        detail: title,
        type: "changed",
      });

      pushToast({
        title: `${KIND_LABEL[kind]} added`,
        detail: "It is now part of the living intent.",
        tone: "good",
      });

      return node;
    },
    [addActivity, pushToast],
  );

  const resolveNode = useCallback(
    (nodeId: string) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                status: "resolved",
              }
            : node,
        ),
      );

      const node = nodes.find((item) => item.id === nodeId);

      addActivity({
        actor: "human",
        title: "Intent point resolved",
        detail: node?.title ?? "A previously open point was resolved.",
        type: "changed",
      });

      pushToast({
        title: "Resolved",
        detail: node?.title ?? "The open point is no longer unresolved.",
        tone: "good",
      });
    },
    [addActivity, nodes, pushToast],
  );

  const createDecision = useCallback(() => {
    const decision: Decision = {
      id: uid("decision"),
      title: "New human decision",
      question:
        "What matters most at this point in the intent, and what should give way?",
      options: ["Option A", "Option B", "Not decided yet"],
      status: "open",
      createdAt: Date.now(),
      changedAt: Date.now(),
    };

    setDecisions((current) => [decision, ...current]);
    setSelectedDecisionId(decision.id);
    openView("intent");

    addActivity({
      actor: "human",
      title: "Decision created",
      detail: decision.question,
      type: "decision",
    });

    pushToast({
      title: "Decision space created",
      detail: "The tradeoff is now explicit instead of implicit.",
      tone: "good",
    });
  }, [addActivity, openView, pushToast]);

  const chooseDecision = useCallback(
    (decisionId: string, choice: string) => {
      setDecisions((current) =>
        current.map((decision) =>
          decision.id === decisionId
            ? {
                ...decision,
                choice,
                status: "decided",
                changedAt: Date.now(),
              }
            : decision,
        ),
      );

      const decision = decisions.find((item) => item.id === decisionId);

      addActivity({
        actor: "human",
        title: "Human decision made",
        detail: `${decision?.title ?? "Decision"} → ${choice}`,
        type: "decision",
      });

      pushToast({
        title: "Decision recorded",
        detail: "The choice is now part of the intent history.",
        tone: "good",
      });
    },
    [addActivity, decisions, pushToast],
  );

  const toggleAction = useCallback(
    (actionId: string) => {
      setActions((current) =>
        current.map((action) => {
          if (action.id !== actionId) return action;

          const nextStatus =
            action.status === "ready"
              ? "in-progress"
              : action.status === "in-progress"
                ? "done"
                : "ready";

          return {
            ...action,
            status: nextStatus,
          };
        }),
      );

      const action = actions.find((item) => item.id === actionId);

      addActivity({
        actor: "human",
        title: "Action state changed",
        detail: action?.title ?? "An action was updated.",
        type: "action",
      });
    },
    [actions, addActivity],
  );

  const addAction = useCallback(
    (title: string, detail: string, owner: "human" | "agent") => {
      const action: IntentAction = {
        id: uid("action"),
        title,
        detail,
        owner,
        status: "ready",
        createdAt: Date.now(),
      };

      setActions((current) => [action, ...current]);

      addActivity({
        actor: "agent",
        title: "Action proposed",
        detail: `${title}. ${detail}`,
        type: "action",
      });

      pushToast({
        title: "Action added",
        detail: "It stays visible as a proposed next step.",
        tone: "good",
      });
    },
    [addActivity, pushToast],
  );

  const generateAgentProposal = useCallback(() => {
    const unresolved = nodes.filter(
      (node) => node.status === "open" || node.kind === "unknown",
    );

    const hasFiles = files.length > 0;
    const firstOpen = unresolved[0];

    let proposal: AgentSuggestion;

    if (firstOpen) {
      proposal = {
        id: uid("suggestion"),
        kind: "clarify",
        title: `Clarify “${firstOpen.title}”`,
        explanation:
          "This point could materially change the direction, so it should remain visible before execution.",
        change:
          "Decide whether to resolve it now or intentionally keep it open.",
        confidence: 0.86,
        requiresHumanDecision: true,
        createdAt: Date.now(),
        status: "pending",
      };
    } else if (!hasFiles) {
      proposal = {
        id: uid("suggestion"),
        kind: "context",
        title: "Bring context into the space",
        explanation:
          "The current intent is understandable, but external context is still thin.",
        change:
          "Add the files, references or examples that should influence the intent.",
        confidence: 0.79,
        requiresHumanDecision: false,
        createdAt: Date.now(),
        status: "pending",
      };
    } else {
      proposal = {
        id: uid("suggestion"),
        kind: "evolution",
        title: "Try a narrower intent",
        explanation:
          "The current goal is broad enough that multiple valid outcomes could satisfy it.",
        change:
          "Explore a more focused branch before committing to one direction.",
        confidence: 0.77,
        requiresHumanDecision: true,
        createdAt: Date.now(),
        status: "pending",
      };
    }

    setSuggestions((current) => [proposal, ...current]);

    addActivity({
      actor: "agent",
      title: "Agent proposal created",
      detail: proposal.title,
      type: "proposed",
    });

    pushToast({
      title: "A proposal surfaced",
      detail: proposal.requiresHumanDecision
        ? "Nothing changed automatically."
        : "The proposal is informational until you act on it.",
      tone: "neutral",
    });
  }, [addActivity, files.length, nodes, pushToast]);

  const acceptSuggestion = useCallback(
    (suggestionId: string) => {
      const suggestion = suggestions.find(
        (item) => item.id === suggestionId,
      );

      if (!suggestion) return;

      setSuggestions((current) =>
        current.map((item) =>
          item.id === suggestionId
            ? { ...item, status: "accepted" }
            : item,
        ),
      );

      if (suggestion.kind === "action") {
        addAction(
          "Follow the accepted proposal",
          suggestion.change,
          "agent",
        );
      }

      if (suggestion.kind === "context") {
        openView("files");
      }

      if (suggestion.kind === "clarify") {
        createDecision();
      }

      addActivity({
        actor: "human",
        title: "Agent proposal accepted",
        detail: suggestion.title,
        type: "changed",
      });

      pushToast({
        title: "Proposal accepted",
        detail:
          "The workspace moved forward without hiding the human decision.",
        tone: "good",
      });
    },
    [
      addAction,
      addActivity,
      createDecision,
      openView,
      pushToast,
      suggestions,
    ],
  );

  const rejectSuggestion = useCallback(
    (suggestionId: string) => {
      const suggestion = suggestions.find(
        (item) => item.id === suggestionId,
      );

      setSuggestions((current) =>
        current.map((item) =>
          item.id === suggestionId
            ? { ...item, status: "rejected" }
            : item,
        ),
      );

      addActivity({
        actor: "human",
        title: "Agent proposal declined",
        detail: suggestion?.title ?? "A proposal was declined.",
        type: "decision",
      });
    },
    [addActivity, suggestions],
  );

  const handleFiles = useCallback(
    (incoming: File[]) => {
      if (!incoming.length) return;

      setUploading(true);

      const accepted: IntentFile[] = incoming
        .slice(0, 12)
        .map((file) => ({
          id: uid("file"),
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          source: "upload",
          addedAt: Date.now(),
          summary:
            file.type.startsWith("text/") ||
            file.name.toLowerCase().endsWith(".md") ||
            file.name.toLowerCase().endsWith(".txt")
              ? "Text context attached to the current intent."
              : "Context file attached to the current intent.",
          tags: ["context", file.type ? file.type.split("/")[0] : "file"],
        }));

      window.setTimeout(() => {
        setFiles((current) => [...accepted, ...current]);

        accepted.forEach((file) => {
          addActivity({
            actor: "human",
            title: "Context attached",
            detail: file.name,
            type: "context",
          });
        });

        setUploading(false);

        pushToast({
          title: `${accepted.length} file${accepted.length > 1 ? "s" : ""} added`,
          detail: "They now belong to the same intent context.",
          tone: "good",
        });
      }, 350);
    },
    [addActivity, pushToast],
  );

  const onFileInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(event.target.files ?? []);
      handleFiles(selected);
      event.target.value = "";
    },
    [handleFiles],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDropActive(false);
      handleFiles(Array.from(event.dataTransfer.files ?? []));
    },
    [handleFiles],
  );

  const removeFile = useCallback(
    (fileId: string) => {
      const file = files.find((item) => item.id === fileId);
      setFiles((current) => current.filter((item) => item.id !== fileId));
      setSelectedFileId(null);

      addActivity({
        actor: "human",
        title: "Context removed",
        detail: file?.name ?? "A file was removed.",
        type: "context",
      });
    },
    [addActivity, files],
  );

  const clearWorkspace = useCallback(() => {
    createSnapshot("Before reset");

    setIntent(DEFAULT_INTENT);
    setDraftIntent(DEFAULT_INTENT);
    setNodes(DEFAULT_NODES);
    setFiles(DEFAULT_FILES);
    setDecisions(DEFAULT_DECISIONS);
    setActions(DEFAULT_ACTIONS);
    setSnapshots([]);
    setSuggestions([]);
    setActiveNodeId(DEFAULT_NODES[0]?.id ?? null);

    addActivity({
      actor: "system",
      title: "Workspace reset",
      detail:
        "The demo state was reset while preserving the mental model of the product.",
      type: "changed",
    });

    pushToast({
      title: "Reset complete",
      detail: "INTENT is back to a clean starting point.",
      tone: "good",
    });
  }, [addActivity, createSnapshot, pushToast]);

  const resultSet = useMemo<SearchResult[]>(() => {
    const q = searchQuery.trim();
    if (!q) return [];

    const results: SearchResult[] = [];

    if (
      searchIncludes(intent, q) ||
      searchIncludes("primary intent", q)
    ) {
      results.push({
        id: "intent-result",
        type: "intent",
        title: "Current intent",
        detail: compactText(intent, 220),
        meta: "Living intent",
      });
    }

    nodes.forEach((node) => {
      if (
        searchIncludes(node.title, q) ||
        searchIncludes(node.detail, q) ||
        searchIncludes(KIND_LABEL[node.kind], q)
      ) {
        results.push({
          id: node.id,
          type: "node",
          title: node.title,
          detail: node.detail,
          meta: KIND_LABEL[node.kind],
        });
      }
    });

    files.forEach((file) => {
      if (
        searchIncludes(file.name, q) ||
        searchIncludes(file.summary, q) ||
        file.tags.some((tag) => searchIncludes(tag, q))
      ) {
        results.push({
          id: file.id,
          type: "file",
          title: file.name,
          detail: file.summary,
          meta: "Context",
        });
      }
    });

    decisions.forEach((decision) => {
      if (
        searchIncludes(decision.title, q) ||
        searchIncludes(decision.question, q) ||
        decision.options.some((option) => searchIncludes(option, q))
      ) {
        results.push({
          id: decision.id,
          type: "decision",
          title: decision.title,
          detail: decision.question,
          meta: decision.status === "decided" ? "Decided" : "Open",
        });
      }
    });

    actions.forEach((action) => {
      if (
        searchIncludes(action.title, q) ||
        searchIncludes(action.detail, q)
      ) {
        results.push({
          id: action.id,
          type: "action",
          title: action.title,
          detail: action.detail,
          meta: "Action",
        });
      }
    });

    activity.forEach((item) => {
      if (
        searchIncludes(item.title, q) ||
        searchIncludes(item.detail, q)
      ) {
        results.push({
          id: item.id,
          type: "activity",
          title: item.title,
          detail: item.detail,
          meta: actorLabel(item.actor),
        });
      }
    });

    return results.slice(0, 30);
  }, [actions, activity, decisions, files, intent, nodes, searchQuery]);

  const graphNodes = useMemo<GraphNode[]>(() => {
    const mapped: GraphNode[] = [
      {
        id: "graph-intent",
        x: 50,
        y: 48,
        radius: 108,
        label: "Intent",
        sublabel: compactText(intent, 84),
        category: "intent",
        linked: [],
      },
    ];

    nodes.slice(0, 10).forEach((node, index) => {
      const angle =
        (-Math.PI / 2 + (Math.PI * 2 * index) / Math.max(nodes.length, 1)) %
        (Math.PI * 2);

      const radius = index % 2 === 0 ? 33 : 39;

      mapped.push({
        id: `graph-node-${node.id}`,
        x: 50 + Math.cos(angle) * radius,
        y: 48 + Math.sin(angle) * radius,
        radius: node.kind === "unknown" ? 54 : 48,
        label: node.title,
        sublabel: KIND_LABEL[node.kind],
        category: node.kind === "unknown" ? "unknown" : "context",
        linked: ["graph-intent"],
      });
    });

    files.slice(0, 4).forEach((file, index) => {
      const angle = 0.3 + index * 0.47;
      mapped.push({
        id: `graph-file-${file.id}`,
        x: 80 + Math.cos(angle) * 12,
        y: 18 + Math.sin(angle) * 10,
        radius: 46,
        label: file.name,
        sublabel: "File",
        category: "file",
        linked: ["graph-intent"],
      });
    });

    decisions.slice(0, 3).forEach((decision, index) => {
      mapped.push({
        id: `graph-decision-${decision.id}`,
        x: 17 + index * 8,
        y: 81 - index * 5,
        radius: 47,
        label: decision.title,
        sublabel: "Decision",
        category: "decision",
        linked: ["graph-intent"],
      });
    });

    actions.slice(0, 3).forEach((action, index) => {
      mapped.push({
        id: `graph-action-${action.id}`,
        x: 79 - index * 8,
        y: 82 - index * 4,
        radius: 44,
        label: action.title,
        sublabel: "Action",
        category: "action",
        linked: ["graph-intent"],
      });
    });

    return mapped;
  }, [actions, decisions, files, intent, nodes]);

  const graphEdges = useMemo(() => {
    return graphNodes.flatMap((node) =>
      node.linked.map((targetId) => {
        const target = graphNodes.find((item) => item.id === targetId);
        if (!target) return null;
        return {
          from: node,
          to: target,
        };
      }),
    ).filter(Boolean) as { from: GraphNode; to: GraphNode }[];
  }, [graphNodes]);

  const openCount = useMemo(
    () => nodes.filter((node) => node.status === "open").length,
    [nodes],
  );

  const doneActions = useMemo(
    () => actions.filter((action) => action.status === "done").length,
    [actions],
  );

  const decidedCount = useMemo(
    () => decisions.filter((decision) => decision.status === "decided").length,
    [decisions],
  );

  const pendingSuggestions = useMemo(
    () => suggestions.filter((item) => item.status === "pending"),
    [suggestions],
  );

  const activeNode = useMemo(
    () => nodes.find((node) => node.id === activeNodeId) ?? null,
    [activeNodeId, nodes],
  );

  const selectedDecision = useMemo(
    () => decisions.find((item) => item.id === selectedDecisionId) ?? null,
    [decisions, selectedDecisionId],
  );

  const selectedFile = useMemo(
    () => files.find((item) => item.id === selectedFileId) ?? null,
    [files, selectedFileId],
  );

  const focusNode = useCallback((nodeId: string) => {
    setActiveNodeId(nodeId);
    setDetailOpen(true);
  }, []);

  useEffect(() => {
    const modelContext = (
      document as Document & {
        modelContext?: {
          registerTool: (
            name: string,
            config: {
              description: string;
              inputSchema?: Record<string, unknown>;
              execute: (args: Record<string, unknown>) => Promise<unknown>;
            },
          ) => void | (() => void);
        };
      }
    ).modelContext;

    if (!modelContext?.registerTool) {
      setWebMCPReady(false);
      return;
    }

    const registrations: Array<void | (() => void)> = [];

    registrations.push(
      modelContext.registerTool("inspect_intent", {
        description:
          "Inspect the current INTENT state, including goals, constraints, values, unknowns, context, decisions, actions and unresolved tensions.",
        inputSchema: {
          type: "object",
          properties: {},
        },
        execute: async () => ({
          intent,
          nodes,
          files: files.map(({ id, name, type, tags }) => ({
            id,
            name,
            type,
            tags,
          })),
          decisions,
          actions,
          openUnknowns: openCount,
        }),
      }),
    );

    registrations.push(
      modelContext.registerTool("add_intent_node", {
        description:
          "Add a meaningful node to the living intent space. Use goal, constraint, value, unknown, context, decision, action or output.",
        inputSchema: {
          type: "object",
          properties: {
            kind: {
              type: "string",
              enum: [
                "goal",
                "constraint",
                "value",
                "unknown",
                "context",
                "decision",
                "action",
                "output",
              ],
            },
            title: { type: "string" },
            detail: { type: "string" },
          },
          required: ["kind", "title", "detail"],
        },
        execute: async (args) => {
          const kind = String(args.kind) as NodeKind;
          const title = String(args.title);
          const detail = String(args.detail);

          const created: IntentNode = {
            id: uid(kind),
            kind,
            title,
            detail,
            status: kind === "unknown" ? "open" : "active",
            confidence: 0.82,
            createdAt: Date.now(),
            source: "WebMCP agent",
          };

          setNodes((current) => [created, ...current]);
          setActiveNodeId(created.id);

          addActivity({
            actor: "agent",
            title: `${KIND_LABEL[kind]} added via WebMCP`,
            detail: title,
            type: "changed",
          });

          return {
            ok: true,
            node: created,
            requiresHumanDecision:
              kind === "decision" || kind === "constraint",
          };
        },
      }),
    );

    registrations.push(
      modelContext.registerTool("focus_attention", {
        description:
          "Focus the human attention on a specific node or unresolved point without changing the underlying intent.",
        inputSchema: {
          type: "object",
          properties: {
            nodeId: { type: "string" },
          },
          required: ["nodeId"],
        },
        execute: async (args) => {
          const nodeId = String(args.nodeId);
          const node = nodes.find((item) => item.id === nodeId);

          if (!node) {
            return {
              ok: false,
              reason: "Node not found",
            };
          }

          setActiveNodeId(node.id);
          setDetailOpen(true);
          openView("intent");

          addActivity({
            actor: "agent",
            title: "Attention focused",
            detail: node.title,
            type: "understood",
          });

          return {
            ok: true,
            focused: node,
          };
        },
      }),
    );

    registrations.push(
      modelContext.registerTool("surface_contradiction", {
        description:
          "Surface a possible contradiction or tradeoff without silently resolving it.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            detail: { type: "string" },
          },
          required: ["title", "detail"],
        },
        execute: async (args) => {
          const created: IntentNode = {
            id: uid("unknown"),
            kind: "unknown",
            title: String(args.title),
            detail: String(args.detail),
            status: "open",
            confidence: 0.74,
            createdAt: Date.now(),
            source: "WebMCP agent",
          };

          setNodes((current) => [created, ...current]);
          setActiveNodeId(created.id);

          addActivity({
            actor: "agent",
            title: "Tension surfaced via WebMCP",
            detail: created.title,
            type: "proposed",
          });

          return {
            ok: true,
            tension: created,
            requiresHumanDecision: true,
          };
        },
      }),
    );

    registrations.push(
      modelContext.registerTool("propose_intent_evolution", {
        description:
          "Propose a change to the intent. The tool must not silently apply material changes; it creates a visible human-review proposal.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            explanation: { type: "string" },
            change: { type: "string" },
          },
          required: ["title", "explanation", "change"],
        },
        execute: async (args) => {
          const proposal: AgentSuggestion = {
            id: uid("suggestion"),
            kind: "evolution",
            title: String(args.title),
            explanation: String(args.explanation),
            change: String(args.change),
            confidence: 0.81,
            requiresHumanDecision: true,
            createdAt: Date.now(),
            status: "pending",
          };

          setSuggestions((current) => [proposal, ...current]);

          addActivity({
            actor: "agent",
            title: "Intent evolution proposed via WebMCP",
            detail: proposal.title,
            type: "proposed",
          });

          return {
            ok: true,
            proposal,
            requiresHumanDecision: true,
          };
        },
      }),
    );

    registrations.push(
      modelContext.registerTool("fork_intent", {
        description:
          "Create a safe branch of the current intent so another possibility can be explored without overwriting the current state.",
        inputSchema: {
          type: "object",
          properties: {
            label: { type: "string" },
          },
          required: ["label"],
        },
        execute: async (args) => {
          const label = String(args.label);

          const snapshot: Snapshot = {
            id: uid("branch"),
            label,
            createdAt: Date.now(),
            text: intent,
            nodes: structuredClone(nodes),
            decisions: structuredClone(decisions),
            actions: structuredClone(actions),
          };

          setSnapshots((current) => [snapshot, ...current].slice(0, 20));

          addActivity({
            actor: "agent",
            title: "Intent branch created",
            detail: label,
            type: "memory",
          });

          return {
            ok: true,
            forkId: snapshot.id,
            label,
            sourceIntent: intent,
            requiresHumanDecision: false,
          };
        },
      }),
    );

    setWebMCPReady(true);

    return () => {
      registrations.forEach((cleanup) => {
        try {
          if (typeof cleanup === "function") cleanup();
        } catch {
          // Best-effort cleanup for experimental WebMCP implementations.
        }
      });
    };
  }, [
    addActivity,
    files,
    intent,
    nodes,
    decisions,
    actions,
    openCount,
    openView,
  ]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;

      if (modifier && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setGlobalSearchOpen(true);
      }

      if (event.key === "/" && !event.metaKey && !event.ctrlKey) {
        const target = event.target as HTMLElement | null;
        if (
          target?.tagName !== "INPUT" &&
          target?.tagName !== "TEXTAREA" &&
          !target?.isContentEditable
        ) {
          event.preventDefault();
          setGlobalSearchOpen(true);
        }
      }

      if (event.key === "Escape") {
        setPlusOpen(false);
        setGlobalSearchOpen(false);
        setDetailOpen(false);
        setActivityOpen(false);
      }

      if (modifier && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setActivityOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!editingIntent) return;
    intentInputRef.current?.focus();
    intentInputRef.current?.setSelectionRange(
      intentInputRef.current.value.length,
      intentInputRef.current.value.length,
    );
  }, [editingIntent]);

  const handleIntentKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      saveIntent();
    }

    if (event.key === "Escape") {
      setDraftIntent(intent);
      setEditingIntent(false);
    }
  };

  const navItems: Array<{ view: View; label: string; icon: string }> = [
    { view: "intent", label: "Intent", icon: "◎" },
    { view: "graph", label: "Graph", icon: "◫" },
    { view: "files", label: "Context", icon: "□" },
    { view: "search", label: "Search", icon: "⌕" },
  ];

  const secondaryItems: Array<{ view: View; label: string; icon: string }> = [
    { view: "activity", label: "Activity", icon: "◒" },
    { view: "trust", label: "Trust", icon: "✓" },
  ];

  const sidebar = (
    <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
      <div className="sidebar-inner">
        <button
          className="brand"
          onClick={() => openView("home")}
          aria-label="Go to INTENT home"
        >
          <span className="brand-mark">I</span>
          <span className="brand-word">INTENT</span>
        </button>

        <div className="sidebar-section">
          <span className="sidebar-caption">Workspace</span>

          {navItems.map((item) => (
            <button
              key={item.view}
              className={`nav-item ${
                view === item.view ? "nav-item-active" : ""
              }`}
              onClick={() => openView(item.view)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.view === "graph" && (
                <span className="nav-meta">{nodes.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="sidebar-section">
          <span className="sidebar-caption">Understand</span>

          {secondaryItems.map((item) => (
            <button
              key={item.view}
              className={`nav-item ${
                view === item.view ? "nav-item-active" : ""
              }`}
              onClick={() => openView(item.view)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.view === "activity" && activity.length > 0 && (
                <span className="nav-meta">{activity.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="sidebar-spacer" />

        <div className="sidebar-status">
          <div className="status-line">
            <span className={`status-dot ${webMCPReady ? "live" : ""}`} />
            <span>{webMCPReady ? "WebMCP ready" : "Local mode"}</span>
          </div>
          <div className="status-copy">
            The agent can discover the same intent surface you see.
          </div>
        </div>

        <button
          className="sidebar-home"
          onClick={() => openView("home")}
        >
          <span>↗</span>
          <span>Back to start</span>
        </button>
      </div>
    </aside>
  );

  const topbar = (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="mobile-menu"
          onClick={() => setSidebarOpen((current) => !current)}
          aria-label="Toggle navigation"
        >
          ☰
        </button>

        <div className="breadcrumbs">
          <button onClick={() => openView("home")}>INTENT</button>
          <span>/</span>
          <span>{VIEW_LABEL[view]}</span>
        </div>
      </div>

      <div className="topbar-right">
        <button
          className="topbar-search"
          onClick={() => setGlobalSearchOpen(true)}
        >
          <span>⌕</span>
          <span>Search everything</span>
          <kbd>⌘K</kbd>
        </button>

        <button
          className={`agent-indicator ${
            webMCPReady ? "agent-indicator-live" : ""
          }`}
          onClick={() => openView("trust")}
        >
          <span className="agent-indicator-core" />
          <span>{webMCPReady ? "Agent connected" : "Local intelligence"}</span>
        </button>

        <button
          className="circle-button"
          onClick={() => setActivityOpen(true)}
          aria-label="Open activity"
        >
          ◒
        </button>
      </div>
    </header>
  );

  const plusMenu = plusOpen ? (
    <div className="plus-menu">
      <div className="plus-menu-head">
        <div>
          <span className="eyebrow">Create in context</span>
          <h3>What matters next?</h3>
        </div>
        <button
          className="circle-button small"
          onClick={() => setPlusOpen(false)}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="plus-grid">
        <button
          onClick={() => {
            addNode(
              "goal",
              "New goal",
              "A concrete outcome that should move the current intent forward.",
            );
            setPlusOpen(false);
          }}
        >
          <span>◎</span>
          <div>
            <strong>Goal</strong>
            <small>What are we trying to achieve?</small>
          </div>
        </button>

        <button
          onClick={() => {
            addNode(
              "constraint",
              "New constraint",
              "A boundary the intent should respect.",
            );
            setPlusOpen(false);
          }}
        >
          <span>⊣</span>
          <div>
            <strong>Constraint</strong>
            <small>What must remain true?</small>
          </div>
        </button>

        <button
          onClick={() => {
            addNode(
              "value",
              "New value",
              "A principle that should influence tradeoffs.",
            );
            setPlusOpen(false);
          }}
        >
          <span>◇</span>
          <div>
            <strong>Value</strong>
            <small>What matters beyond the outcome?</small>
          </div>
        </button>

        <button
          onClick={() => {
            addNode(
              "unknown",
              "New unknown",
              "A question worth keeping visible rather than guessing through.",
              0.61,
            );
            setPlusOpen(false);
          }}
        >
          <span>?</span>
          <div>
            <strong>Unknown</strong>
            <small>What is still unresolved?</small>
          </div>
        </button>

        <button
          onClick={() => {
            setPlusOpen(false);
            fileInputRef.current?.click();
          }}
        >
          <span>□</span>
          <div>
            <strong>Add context</strong>
            <small>Bring files into the same intent.</small>
          </div>
        </button>

        <button
          onClick={() => {
            createDecision();
            setPlusOpen(false);
          }}
        >
          <span>◈</span>
          <div>
            <strong>Decision</strong>
            <small>Make the tradeoff explicit.</small>
          </div>
        </button>

        <button
          onClick={() => {
            addAction(
              "New proposed action",
              "An action that follows from the current intent and can be reviewed before execution.",
              "human",
            );
            setPlusOpen(false);
          }}
        >
          <span>→</span>
          <div>
            <strong>Action</strong>
            <small>Turn intent into a next step.</small>
          </div>
        </button>

        <button
          onClick={() => {
            generateAgentProposal();
            setPlusOpen(false);
          }}
        >
          <span>✦</span>
          <div>
            <strong>Ask the agent</strong>
            <small>Surface something useful without hiding control.</small>
          </div>
        </button>
      </div>
    </div>
  ) : null;

  const intentHero = (
    <section className="intent-hero">
      <div className="intent-hero-copy">
        <span className="eyebrow">Living intent</span>

        {!editingIntent ? (
          <button
            className="intent-display"
            onClick={() => setEditingIntent(true)}
          >
            {intent}
          </button>
        ) : (
          <div className="intent-editor">
            <textarea
              ref={intentInputRef}
              value={draftIntent}
              onChange={(event) => setDraftIntent(event.target.value)}
              onKeyDown={handleIntentKey}
              rows={4}
              aria-label="Edit current intent"
            />
            <div className="intent-editor-footer">
              <span>⌘ Enter to evolve · Esc to cancel</span>
              <div className="inline-actions">
                <button
                  className="button button-quiet"
                  onClick={() => {
                    setDraftIntent(intent);
                    setEditingIntent(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="button button-primary"
                  onClick={saveIntent}
                  disabled={savingIntent}
                >
                  {savingIntent ? "Evolving…" : "Evolve intent"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="intent-meta-row">
          <span className="meta-pill">
            <span className="meta-dot" />
            Shared with agent
          </span>
          <span className="meta-pill">
            {nodes.length} intent points
          </span>
          <span className="meta-pill">
            {files.length} context item{files.length === 1 ? "" : "s"}
          </span>
          {openCount > 0 && (
            <span className="meta-pill warning">
              {openCount} unresolved
            </span>
          )}
        </div>
      </div>

      <div className="intent-hero-actions">
        <button
          className="button button-secondary"
          onClick={() => createSnapshot("Manual checkpoint")}
        >
          Remember
        </button>
        <button
          className="button button-primary"
          onClick={() => openView("graph")}
        >
          Open graph <span>→</span>
        </button>
      </div>
    </section>
  );

  const intentPoints = (
    <section className="surface-grid">
      <div className="surface-card surface-card-large">
        <div className="surface-heading">
          <div>
            <span className="eyebrow">What matters</span>
            <h2>The shape of the intent</h2>
          </div>
          <span className="surface-count">{nodes.length}</span>
        </div>

        <div className="node-grid">
          {nodes.length ? (
            nodes.map((node) => (
              <button
                key={node.id}
                className={`node-card ${
                  activeNodeId === node.id ? "node-card-active" : ""
                } ${node.kind === "unknown" ? "node-card-unknown" : ""}`}
                onClick={() => focusNode(node.id)}
              >
                <div className="node-card-top">
                  <span className={`node-kind kind-${node.kind}`}>
                    {KIND_ICON[node.kind]} {KIND_LABEL[node.kind]}
                  </span>
                  <span className="node-confidence">
                    {Math.round(node.confidence * 100)}%
                  </span>
                </div>

                <strong>{node.title}</strong>
                <p>{compactText(node.detail, 132)}</p>

                <div className="node-card-bottom">
                  <span>{node.status}</span>
                  <span>View point →</span>
                </div>
              </button>
            ))
          ) : (
            <EmptyState
              title="Nothing has taken shape yet"
              detail="Add a goal, constraint, value or unknown to begin."
              actionLabel="Add goal"
              onAction={() =>
                addNode(
                  "goal",
                  "New goal",
                  "A meaningful outcome to shape the intent around.",
                )
              }
            />
          )}
        </div>
      </div>

      <div className="surface-card">
        <div className="surface-heading">
          <div>
            <span className="eyebrow">Attention</span>
            <h2>One thing worth noticing</h2>
          </div>
        </div>

        {activeNode ? (
          <div className="attention-card">
            <div className="attention-mark">
              {KIND_ICON[activeNode.kind]}
            </div>

            <span className="eyebrow">{KIND_LABEL[activeNode.kind]}</span>
            <h3>{activeNode.title}</h3>
            <p>{activeNode.detail}</p>

            <div className="attention-footer">
              <span>
                Confidence {Math.round(activeNode.confidence * 100)}%
              </span>

              {activeNode.status === "open" ? (
                <button
                  className="button button-primary"
                  onClick={() => resolveNode(activeNode.id)}
                >
                  Resolve point
                </button>
              ) : (
                <button
                  className="button button-secondary"
                  onClick={generateAgentProposal}
                >
                  Explore further
                </button>
              )}
            </div>
          </div>
        ) : (
          <EmptyState
            title="Focus can move here"
            detail="Choose an intent point to inspect how it shapes the whole."
          />
        )}
      </div>
    </section>
  );

  const decisionSurface = (
    <section className="surface-grid surface-grid-bottom">
      <div className="surface-card">
        <div className="surface-heading">
          <div>
            <span className="eyebrow">Human decisions</span>
            <h2>Where the human still decides</h2>
          </div>
          <button className="text-button" onClick={createDecision}>
            + Decision
          </button>
        </div>

        <div className="decision-list">
          {decisions.length === 0 ? (
            <EmptyState
              title="No decisions yet"
              detail="A good intent interface does not force decisions where none exist."
              actionLabel="Create decision"
              onAction={createDecision}
            />
          ) : (
            decisions.slice(0, 4).map((decision) => (
              <div
                key={decision.id}
                className={`decision-row ${
                  selectedDecisionId === decision.id
                    ? "decision-row-active"
                    : ""
                }`}
              >
                <button
                  className="decision-main"
                  onClick={() => setSelectedDecisionId(decision.id)}
                >
                  <span className="decision-glyph">
                    {decision.status === "decided" ? "✓" : "◈"}
                  </span>
                  <div>
                    <strong>{decision.title}</strong>
                    <span>{compactText(decision.question, 120)}</span>
                  </div>
                </button>

                <div className="decision-state">
                  {decision.choice ? (
                    <span className="decision-choice">{decision.choice}</span>
                  ) : (
                    <span className="decision-open">Open</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="surface-card">
        <div className="surface-heading">
          <div>
            <span className="eyebrow">Next movement</span>
            <h2>Intent → action</h2>
          </div>
          <span className="surface-count">
            {doneActions}/{actions.length}
          </span>
        </div>

        <div className="action-list">
          {actions.slice(0, 5).map((action) => (
            <button
              key={action.id}
              className="action-row"
              onClick={() => toggleAction(action.id)}
            >
              <span
                className={`action-state action-state-${action.status}`}
              >
                {action.status === "done"
                  ? "✓"
                  : action.status === "in-progress"
                    ? "…"
                    : "→"}
              </span>
              <span className="action-copy">
                <strong>{action.title}</strong>
                <small>{compactText(action.detail, 112)}</small>
              </span>
              <span className="action-owner">{action.owner}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );

  const proposalSurface = (
    <section className="proposal-surface">
      <div className="proposal-intro">
        <span className="eyebrow">Human × Agent</span>
        <h2>AI should shape the question, not disappear behind the answer.</h2>
        <p>
          INTENT makes suggestions visible, explains why they matter, and
          keeps material changes on the human side of the boundary.
        </p>

        <div className="proposal-actions">
          <button
            className="button button-primary"
            onClick={generateAgentProposal}
          >
            Surface something useful
          </button>
          <button
            className="button button-quiet"
            onClick={() => openView("trust")}
          >
            See how it works
          </button>
        </div>
      </div>

      <div className="proposal-column">
        {pendingSuggestions.length === 0 ? (
          <div className="proposal-empty">
            <div className="proposal-empty-mark">✦</div>
            <div>
              <strong>Nothing waiting for approval</strong>
              <span>
                The agent has no unresolved recommendation to hand over.
              </span>
            </div>
          </div>
        ) : (
          pendingSuggestions.slice(0, 3).map((proposal) => (
            <div key={proposal.id} className="proposal-card">
              <div className="proposal-card-top">
                <span className="proposal-kind">
                  {proposal.kind}
                </span>
                <span>
                  {Math.round(proposal.confidence * 100)}% confidence
                </span>
              </div>

              <h3>{proposal.title}</h3>
              <p>{proposal.explanation}</p>

              <div className="proposal-change">
                <span>Proposed movement</span>
                <strong>{proposal.change}</strong>
              </div>

              <div className="proposal-footer">
                {proposal.requiresHumanDecision && (
                  <span className="approval-badge">
                    Human decision required
                  </span>
                )}

                <div className="inline-actions">
                  <button
                    className="button button-quiet"
                    onClick={() => rejectSuggestion(proposal.id)}
                  >
                    Decline
                  </button>
                  <button
                    className="button button-primary"
                    onClick={() => acceptSuggestion(proposal.id)}
                  >
                    Accept
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );

  const workView = (
    <div className="view-content">
      {intentHero}
      {intentPoints}
      {decisionSurface}
      {proposalSurface}

      <section className="continuity-strip">
        <div className="continuity-step continuity-active">
          <span>01</span>
          <strong>Intent</strong>
          <small>What matters</small>
        </div>
        <div className="continuity-line" />
        <div className="continuity-step">
          <span>02</span>
          <strong>Context</strong>
          <small>What informs it</small>
        </div>
        <div className="continuity-line" />
        <div className="continuity-step">
          <span>03</span>
          <strong>Action</strong>
          <small>What follows</small>
        </div>
        <div className="continuity-line" />
        <div className="continuity-step">
          <span>04</span>
          <strong>Memory</strong>
          <small>What changed</small>
        </div>
      </section>
    </div>
  );

  const graphView = (
    <div className="view-content">
      <section className="graph-header">
        <div>
          <span className="eyebrow">Living graph</span>
          <h1>See how the whole intent hangs together.</h1>
          <p>
            Goals, constraints, context, decisions, actions and outputs share
            one explainable space.
          </p>
        </div>

        <div className="graph-header-actions">
          <button
            className="button button-secondary"
            onClick={() => setGraphScale((current) => clamp(current - 0.1, 0.7, 1.4))}
          >
            −
          </button>
          <span className="scale-indicator">
            {Math.round(graphScale * 100)}%
          </span>
          <button
            className="button button-secondary"
            onClick={() => setGraphScale((current) => clamp(current + 0.1, 0.7, 1.4))}
          >
            +
          </button>
          <button
            className="button button-secondary"
            onClick={() => {
              setGraphScale(1);
              setGraphPan({ x: 0, y: 0 });
            }}
          >
            Reset
          </button>
        </div>
      </section>

      <div
        className="graph-shell"
        ref={graphRef}
        onWheel={(event) => {
          event.preventDefault();
          setGraphScale((current) =>
            clamp(current - event.deltaY * 0.0007, 0.7, 1.4),
          );
        }}
      >
        <div className="graph-toolbar">
          <span className="graph-legend">
            <i className="legend-dot legend-intent" /> Intent
          </span>
          <span className="graph-legend">
            <i className="legend-dot legend-context" /> Context
          </span>
          <span className="graph-legend">
            <i className="legend-dot legend-decision" /> Decision
          </span>
          <span className="graph-legend">
            <i className="legend-dot legend-action" /> Action
          </span>
          <span className="graph-legend">
            <i className="legend-dot legend-unknown" /> Unknown
          </span>
        </div>

        <div
          className="graph-canvas"
          style={{
            transform: `translate(${graphPan.x}px, ${graphPan.y}px) scale(${graphScale})`,
          }}
          onDoubleClick={() => {
            setGraphScale(1);
            setGraphPan({ x: 0, y: 0 });
          }}
        >
          <div className="graph-grid" />

          <svg
            className="graph-lines"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {graphEdges.map((edge) => (
              <line
                key={`${edge.from.id}-${edge.to.id}`}
                x1={edge.from.x}
                y1={edge.from.y}
                x2={edge.to.x}
                y2={edge.to.y}
              />
            ))}
          </svg>

          {graphNodes.map((graphNode) => (
            <button
              key={graphNode.id}
              className={`graph-node graph-${graphNode.category}`}
              style={{
                left: `${graphNode.x}%`,
                top: `${graphNode.y}%`,
                width: graphNode.radius * 2,
                height: graphNode.radius * 2,
              }}
              onClick={() => {
                const sourceId = graphNode.id.replace(
                  /^graph-(node|file|decision|action)-/,
                  "",
                );

                const matchingNode =
                  nodes.find((node) => node.id === sourceId) ??
                  nodes.find((node) => node.title === graphNode.label);

                if (matchingNode) focusNode(matchingNode.id);
              }}
            >
              <span className="graph-node-inner">
                <b>{graphNode.label}</b>
                <small>{graphNode.sublabel}</small>
              </span>
            </button>
          ))}
        </div>

        <div className="graph-footer">
          <div>
            <span>{graphNodes.length} connected objects</span>
            <span>•</span>
            <span>{nodes.length} intent points</span>
            <span>•</span>
            <span>{files.length} context items</span>
          </div>

          <button
            className="button button-primary"
            onClick={() => {
              const unknown = nodes.find((node) => node.kind === "unknown");
              if (unknown) focusNode(unknown.id);
              else generateAgentProposal();
            }}
          >
            Explain what needs attention →
          </button>
        </div>
      </div>

      <section className="graph-insight-grid">
        <InsightCard
          eyebrow="Relationship"
          title="Intent ↔ context"
          detail="The graph makes external material visible as context instead of burying it inside a chat transcript."
          stat={`${files.length} files`}
        />
        <InsightCard
          eyebrow="Relationship"
          title="Intent ↔ decisions"
          detail="Choices remain attached to the intent that caused them, making evolution understandable later."
          stat={`${decisions.length} decisions`}
        />
        <InsightCard
          eyebrow="Relationship"
          title="Intent ↔ action"
          detail="Actions appear as consequences of intent rather than isolated task objects."
          stat={`${actions.length} actions`}
        />
      </section>
    </div>
  );

  const filesView = (
    <div className="view-content">
      <section className="context-header">
        <div>
          <span className="eyebrow">Context</span>
          <h1>Keep the things that matter close.</h1>
          <p>
            Files are first-class parts of the intent, not attachments lost at
            the edge of a conversation.
          </p>
        </div>

        <button
          className="button button-primary"
          onClick={() => fileInputRef.current?.click()}
        >
          Add context
        </button>
      </section>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={onFileInput}
      />

      <div
        className={`dropzone ${dropActive ? "dropzone-active" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDropActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDropActive(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) setDropActive(false);
        }}
        onDrop={onDrop}
      >
        <div className="dropzone-icon">□</div>
        <strong>{uploading ? "Bringing context in…" : "Drop files here"}</strong>
        <span>
          {uploading
            ? "Attaching them to the current intent."
            : "PDFs, notes, images, exports and other useful context."}
        </span>
        {!uploading && (
          <button
            className="button button-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            Browse files
          </button>
        )}
      </div>

      <section className="context-layout">
        <div className="surface-card surface-card-large">
          <div className="surface-heading">
            <div>
              <span className="eyebrow">Attached context</span>
              <h2>{files.length} item{files.length === 1 ? "" : "s"}</h2>
            </div>
            <span className="surface-count">
              {formatBytes(files.reduce((sum, item) => sum + item.size, 0))}
            </span>
          </div>

          <div className="file-list">
            {files.length === 0 ? (
              <EmptyState
                title="The context is empty"
                detail="Add a file so the intent can be understood in a richer context."
                actionLabel="Add first file"
                onAction={() => fileInputRef.current?.click()}
              />
            ) : (
              files.map((file) => (
                <button
                  key={file.id}
                  className={`file-row ${
                    selectedFileId === file.id ? "file-row-active" : ""
                  }`}
                  onClick={() => setSelectedFileId(file.id)}
                >
                  <span className="file-mark">□</span>
                  <span className="file-copy">
                    <strong>{file.name}</strong>
                    <small>
                      {file.summary} • {formatBytes(file.size)}
                    </small>
                  </span>
                  <span className="file-tag">
                    {file.source === "upload" ? "Uploaded" : "Reference"}
                  </span>
                  <span className="file-arrow">→</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="surface-card">
          <div className="surface-heading">
            <div>
              <span className="eyebrow">Context meaning</span>
              <h2>Why this file is here</h2>
            </div>
          </div>

          {selectedFile ? (
            <div className="file-detail">
              <div className="file-detail-icon">□</div>
              <span className="eyebrow">{selectedFile.type || "File"}</span>
              <h3>{selectedFile.name}</h3>
              <p>{selectedFile.summary}</p>

              <div className="tag-row">
                {selectedFile.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="detail-meta">
                <span>{formatBytes(selectedFile.size)}</span>
                <span>Added {relativeTime(selectedFile.addedAt)}</span>
              </div>

              <div className="inline-actions">
                <button
                  className="button button-secondary"
                  onClick={() => setSelectedFileId(null)}
                >
                  Close
                </button>
                <button
                  className="button button-quiet"
                  onClick={() => removeFile(selectedFile.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <EmptyState
              title="Select a context item"
              detail="INTENT keeps context explainable by showing what it contributes to the living intent."
            />
          )}
        </div>
      </section>
    </div>
  );

  const searchView = (
    <div className="view-content">
      <section className="search-header">
        <div>
          <span className="eyebrow">Universal search</span>
          <h1>Search the whole intent.</h1>
          <p>
            Not just messages. Search intent, context, decisions, actions and
            memory as one semantic surface.
          </p>
        </div>
      </section>

      <div className="search-main">
        <div className="search-bar-large">
          <span>⌕</span>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Try “human”, “context”, “decision”, “constraint”..."
            autoFocus
          />
          <kbd>Esc</kbd>
        </div>

        <div className="search-scope">
          <span>{resultSet.length} results</span>
          <span>Across the whole workspace</span>
        </div>

        <div className="search-results">
          {!searchQuery.trim() ? (
            <div className="search-placeholder">
              <div className="search-orbit">
                <span>Intent</span>
                <span>Context</span>
                <span>Decisions</span>
                <span>Actions</span>
                <span>Memory</span>
              </div>
              <strong>Everything is context.</strong>
              <p>
                Search the workspace as a connected system rather than a set
                of separate pages.
              </p>
            </div>
          ) : resultSet.length === 0 ? (
            <EmptyState
              title="No strong match"
              detail="Try a concept rather than a file name—intent, context, human, decision, action..."
            />
          ) : (
            resultSet.map((result) => (
              <button
                key={`${result.type}-${result.id}`}
                className="search-result"
                onClick={() => {
                  if (result.type === "node") {
                    focusNode(result.id);
                    openView("intent");
                  } else if (result.type === "file") {
                    setSelectedFileId(result.id);
                    openView("files");
                  } else if (result.type === "decision") {
                    setSelectedDecisionId(result.id);
                    openView("intent");
                  } else if (result.type === "activity") {
                    openView("activity");
                  } else if (result.type === "intent") {
                    openView("intent");
                    setEditingIntent(true);
                  }
                }}
              >
                <span className={`search-result-icon search-${result.type}`}>
                  {result.type === "node"
                    ? "◎"
                    : result.type === "file"
                      ? "□"
                      : result.type === "decision"
                        ? "◈"
                        : result.type === "action"
                          ? "→"
                          : result.type === "activity"
                            ? "◒"
                            : "I"}
                </span>
                <span className="search-result-copy">
                  <strong>{result.title}</strong>
                  <small>{compactText(result.detail, 180)}</small>
                </span>
                <span className="search-result-meta">{result.meta}</span>
                <span>→</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const activityView = (
    <div className="view-content">
      <section className="activity-header">
        <div>
          <span className="eyebrow">Memory of the system</span>
          <h1>See what changed, and why.</h1>
          <p>
            Activity is not a server log. It is the human-readable memory of
            how the intent evolved.
          </p>
        </div>

        <button
          className="button button-secondary"
          onClick={() => createSnapshot("Activity checkpoint")}
        >
          Remember this state
        </button>
      </section>

      <div className="activity-layout">
        <section className="surface-card surface-card-large">
          <div className="surface-heading">
            <div>
              <span className="eyebrow">Recent movement</span>
              <h2>What happened</h2>
            </div>
            <span className="surface-count">{activity.length}</span>
          </div>

          <div className="timeline">
            {activity.map((item) => (
              <div className="timeline-row" key={item.id}>
                <div className={`timeline-avatar avatar-${item.actor}`}>
                  {item.actor === "agent"
                    ? "✦"
                    : item.actor === "human"
                      ? "Y"
                      : "·"}
                </div>
                <div className="timeline-body">
                  <div className="timeline-meta">
                    <strong>{actorLabel(item.actor)}</strong>
                    <span>{relativeTime(item.createdAt)}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card">
          <div className="surface-heading">
            <div>
              <span className="eyebrow">Memory</span>
              <h2>Snapshots</h2>
            </div>
          </div>

          <div className="snapshot-list">
            {snapshots.length === 0 ? (
              <EmptyState
                title="Nothing remembered yet"
                detail="Use Remember when the state becomes meaningful enough to revisit."
              />
            ) : (
              snapshots.slice(0, 10).map((snapshot) => (
                <button
                  key={snapshot.id}
                  className="snapshot-row"
                  onClick={() => restoreSnapshot(snapshot)}
                >
                  <span className="snapshot-icon">↺</span>
                  <span>
                    <strong>{snapshot.label}</strong>
                    <small>{relativeTime(snapshot.createdAt)}</small>
                  </span>
                  <span>Restore →</span>
                </button>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );

  const trustView = (
    <div className="view-content">
      <section className="trust-header">
        <div>
          <span className="eyebrow">Trust & boundaries</span>
          <h1>Powerful without becoming opaque.</h1>
          <p>
            The interface should make AI useful without asking the human to
            surrender understanding or control.
          </p>
        </div>

        <span className="trust-status">
          <span className="status-dot live" />
          {webMCPReady ? "WebMCP connected" : "Browser-local mode"}
        </span>
      </section>

      <section className="trust-grid">
        <TrustCard
          icon="◎"
          title="Shared state"
          detail="The agent operates against the same living intent surface the human sees."
          status="Visible"
        />
        <TrustCard
          icon="◈"
          title="Human approval"
          detail="Material proposals remain explicit and can be accepted or declined."
          status="Protected"
        />
        <TrustCard
          icon="◌"
          title="Uncertainty"
          detail="Unknowns remain unknown. INTENT does not need to fake certainty to stay useful."
          status="Visible"
        />
        <TrustCard
          icon="↺"
          title="Memory"
          detail="Snapshots and activity preserve how the intent changed over time."
          status="Reversible"
        />
        <TrustCard
          icon="⌕"
          title="Explainability"
          detail="Context, decisions and actions remain connected to the intent that produced them."
          status="Traceable"
        />
        <TrustCard
          icon="✓"
          title="Human-first AI"
          detail="AI can propose, focus attention and surface tension without silently taking ownership."
          status="Bounded"
        />
      </section>

      <section className="trust-flow">
        <div className="trust-flow-head">
          <span className="eyebrow">The loop</span>
          <h2>Intent → Context → Action → Result → Memory</h2>
        </div>

        <div className="flow-rail">
          {[
            ["01", "Intent", "What matters"],
            ["02", "Context", "What informs it"],
            ["03", "Action", "What follows"],
            ["04", "Result", "What happened"],
            ["05", "Memory", "What changed"],
          ].map(([number, title, detail], index) => (
            <div className="flow-step" key={title}>
              <span>{number}</span>
              <strong>{title}</strong>
              <small>{detail}</small>
              {index !== 4 && <i>→</i>}
            </div>
          ))}
        </div>
      </section>

      <section className="trust-code-card">
        <div>
          <span className="eyebrow">WebMCP</span>
          <h2>Humans and agents can touch the same interface.</h2>
          <p>
            The page exposes intent-native tools for inspection, focus,
            evolution, contradiction surfacing and branching.
          </p>
        </div>

        <div className="tool-stack">
          {[
            "inspect_intent",
            "add_intent_node",
            "focus_attention",
            "surface_contradiction",
            "propose_intent_evolution",
            "fork_intent",
          ].map((tool) => (
            <span key={tool} className="tool-chip">
              {tool}
            </span>
          ))}
        </div>
      </section>

      <section className="reset-section">
        <div>
          <span className="eyebrow">Demo controls</span>
          <h2>Return to a clean state</h2>
          <p>
            Resetting is safe for the local demo and does not affect external
            services.
          </p>
        </div>
        <button className="button button-quiet" onClick={clearWorkspace}>
          Reset workspace
        </button>
      </section>
    </div>
  );

  const homeView = (
    <div className="home-view">
      <div className="home-noise" />

      <header className="home-header">
        <button
          className="brand"
          onClick={() => openView("home")}
          aria-label="INTENT"
        >
          <span className="brand-mark">I</span>
          <span className="brand-word">INTENT</span>
        </button>

        <div className="home-header-actions">
          <button
            className="home-text-link"
            onClick={() => openView("graph")}
          >
            See the map
          </button>
          <button
            className="home-outline-button"
            onClick={() => openView("intent")}
          >
            Enter INTENT
          </button>
        </div>
      </header>

      <main className="home-main">
        <section className="hero">
          <div className="hero-copy">
            <span className="hero-kicker">Human × Agent × World</span>

            <h1>
              Start with
              <br />
              <em>what matters.</em>
            </h1>

            <p className="hero-description">
              INTENT is a shared space where humans and AI can shape, question,
              and evolve the same intent before taking action.
            </p>

            <div className="hero-actions">
              <button
                className="hero-primary"
                onClick={() => openView("intent")}
              >
                Start shaping <span>→</span>
              </button>
              <button
                className="hero-secondary"
                onClick={() => openView("graph")}
              >
                Explore the map
              </button>
            </div>

            <div className="hero-note">
              AI should not just execute what we say.
              <strong> It should understand what we mean.</strong>
            </div>
          </div>

          <div className="orbit-stage">
            <div className="orbit-aura" />
            <div className="orbit-ring orbit-ring-one" />
            <div className="orbit-ring orbit-ring-two" />
            <div className="orbit-ring orbit-ring-three" />

            <div className="orbit-core">
              <span className="orbit-core-label">INTENT</span>
              <span className="orbit-core-copy">
                The space between
                <br />
                wanting and doing.
              </span>
            </div>

            {[
              {
                title: "Goal",
                detail: "What matters",
                angle: 8,
              },
              {
                title: "Constraint",
                detail: "What must hold",
                angle: 58,
              },
              {
                title: "Value",
                detail: "Why it matters",
                angle: 114,
              },
              {
                title: "Unknown",
                detail: "What stays open",
                angle: 178,
              },
              {
                title: "Decision",
                detail: "What you choose",
                angle: 236,
              },
              {
                title: "Action",
                detail: "What follows",
                angle: 300,
              },
            ].map((item) => (
              <div
                key={item.title}
                className="orbit-card"
                style={
                  {
                    "--angle": `${item.angle}deg`,
                  } as CSSProperties
                }
              >
                <span className="orbit-card-dot" />
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="home-statement">
          <div>
            <span className="eyebrow">A different interface category</span>
            <h2>
              Not a chatbot.
              <br />
              Not another task runner.
            </h2>
          </div>

          <p>
            The object being shaped is not the conversation. It is the intent
            underneath the conversation—the goals, boundaries, values,
            unknowns and tradeoffs that keep changing as the human understands
            more.
          </p>
        </section>

        <section className="home-theatre">
          <div className="theatre-head">
            <div>
              <span className="eyebrow">The signature interaction</span>
              <h2>Want → understand → tension → decide → evolve.</h2>
            </div>
            <span className="theatre-caption">One living loop</span>
          </div>

          <div className="theatre-track">
            {[
              ["01", "Want", "Start from what matters."],
              ["02", "Understand", "Make the intent legible."],
              ["03", "Surface", "See what conflicts."],
              ["04", "Decide", "Keep the human in control."],
              ["05", "Evolve", "Let the intent change."],
            ].map(([number, title, detail]) => (
              <div className="theatre-step" key={number}>
                <span>{number}</span>
                <strong>{title}</strong>
                <p>{detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="home-map-promo">
          <div className="promo-copy">
            <span className="eyebrow">Graph</span>
            <h2>
              One map.
              <br />
              Everything connected.
            </h2>
            <p>
              Intent, context, files, decisions, actions and outputs stop
              feeling like separate products because they are not separate
              things.
            </p>
            <button
              className="button button-primary"
              onClick={() => openView("graph")}
            >
              Enter the graph →
            </button>
          </div>

          <div className="mini-graph">
            <div className="mini-graph-center">INTENT</div>
            {["Context", "Decision", "Action", "File", "Unknown"].map(
              (label, index) => (
                <div
                  key={label}
                  className={`mini-node mini-node-${index}`}
                >
                  {label}
                </div>
              ),
            )}
            <svg viewBox="0 0 100 100" aria-hidden="true">
              {[16, 31, 47, 63, 79].map((x, index) => (
                <line
                  key={x}
                  x1="50"
                  y1="50"
                  x2={x}
                  y2={index % 2 === 0 ? 19 : 82}
                />
              ))}
            </svg>
          </div>
        </section>

        <section className="home-principles">
          <div>
            <span className="eyebrow">The product principle</span>
            <h2>
              Put the complexity
              <br />
              <em>behind the clarity.</em>
            </h2>
          </div>

          <div className="principle-grid">
            {[
              [
                "01",
                "Human-first",
                "The system can be capable without making the human invisible.",
              ],
              [
                "02",
                "Context-native",
                "Files, sources, decisions and history belong to the same mental model.",
              ],
              [
                "03",
                "Explainable",
                "AI activity should answer: what changed, why, and what needs me.",
              ],
              [
                "04",
                "Reversible",
                "Branches, snapshots and memory make exploration safe.",
              ],
            ].map(([number, title, detail]) => (
              <div className="principle" key={number}>
                <span>{number}</span>
                <strong>{title}</strong>
                <p>{detail}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="home-footer">
          <div>
            <span className="brand-word">INTENT</span>
            <small>Start with what matters.</small>
          </div>
          <div className="footer-right">
            <span>Human × Agent × World</span>
            <button onClick={() => openView("trust")}>Trust & boundaries</button>
          </div>
        </footer>
      </main>
    </div>
  );

  return (
    <div className={`app-shell ${focusMode ? "focus-mode" : ""}`}>
      {view === "home" ? (
        homeView
      ) : (
        <>
          {sidebar}

          <div
            className={`sidebar-backdrop ${
              sidebarOpen ? "sidebar-backdrop-visible" : ""
            }`}
            onClick={() => setSidebarOpen(false)}
          />

          <main className="app-main">
            {topbar}

            <div className="content-stage">
              {view === "intent" && workView}
              {view === "graph" && graphView}
              {view === "files" && filesView}
              {view === "search" && searchView}
              {view === "activity" && activityView}
              {view === "trust" && trustView}
            </div>
          </main>

          <button
            className="floating-plus"
            onClick={() => setPlusOpen((current) => !current)}
            aria-label="Create"
            aria-expanded={plusOpen}
          >
            <span className={plusOpen ? "plus-rotated" : ""}>+</span>
          </button>

          {plusMenu}

          {detailOpen && activeNode && (
            <ModalShell
              title="Intent point"
              eyebrow={KIND_LABEL[activeNode.kind]}
              onClose={() => setDetailOpen(false)}
            >
              <div className="modal-node">
                <div className="modal-node-mark">
                  {KIND_ICON[activeNode.kind]}
                </div>

                <h2>{activeNode.title}</h2>
                <p>{activeNode.detail}</p>

                <div className="modal-stat-grid">
                  <div>
                    <span>Status</span>
                    <strong>{activeNode.status}</strong>
                  </div>
                  <div>
                    <span>Confidence</span>
                    <strong>
                      {Math.round(activeNode.confidence * 100)}%
                    </strong>
                  </div>
                  <div>
                    <span>Source</span>
                    <strong>{activeNode.source ?? "—"}</strong>
                  </div>
                  <div>
                    <span>Added</span>
                    <strong>{relativeTime(activeNode.createdAt)}</strong>
                  </div>
                </div>

                <div className="modal-divider" />

                <div className="modal-actions">
                  {activeNode.status === "open" ? (
                    <button
                      className="button button-primary"
                      onClick={() => {
                        resolveNode(activeNode.id);
                        setDetailOpen(false);
                      }}
                    >
                      Resolve
                    </button>
                  ) : (
                    <button
                      className="button button-secondary"
                      onClick={generateAgentProposal}
                    >
                      Explore with agent
                    </button>
                  )}

                  <button
                    className="button button-quiet"
                    onClick={() => {
                      setDetailOpen(false);
                      openView("graph");
                    }}
                  >
                    See in graph
                  </button>
                </div>
              </div>
            </ModalShell>
          )}

          {selectedDecision && (
            <ModalShell
              title={selectedDecision.title}
              eyebrow="Human decision"
              onClose={() => setSelectedDecisionId(null)}
            >
              <div className="decision-modal">
                <p className="decision-question">
                  {selectedDecision.question}
                </p>

                <div className="choice-list">
                  {selectedDecision.options.map((option) => (
                    <button
                      key={option}
                      className={`choice ${
                        selectedDecision.choice === option
                          ? "choice-selected"
                          : ""
                      }`}
                      onClick={() =>
                        chooseDecision(selectedDecision.id, option)
                      }
                    >
                      <span>
                        {selectedDecision.choice === option ? "✓" : "○"}
                      </span>
                      <strong>{option}</strong>
                    </button>
                  ))}
                </div>

                <div className="modal-divider" />

                <div className="decision-footnote">
                  <span>
                    {selectedDecision.status === "decided"
                      ? "This decision is now part of the intent memory."
                      : "Choosing an option records a human decision rather than an AI assumption."}
                  </span>
                </div>
              </div>
            </ModalShell>
          )}

          {activityOpen && (
            <ModalShell
              title="Activity"
              eyebrow="Recent movement"
              onClose={() => setActivityOpen(false)}
            >
              <div className="quick-activity">
                {activity.slice(0, 8).map((item) => (
                  <div key={item.id} className="quick-activity-row">
                    <span
                      className={`timeline-avatar avatar-${item.actor}`}
                    >
                      {item.actor === "agent"
                        ? "✦"
                        : item.actor === "human"
                          ? "Y"
                          : "·"}
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                      <small>{relativeTime(item.createdAt)}</small>
                    </div>
                  </div>
                ))}

                <button
                  className="button button-primary full-width"
                  onClick={() => {
                    setActivityOpen(false);
                    openView("activity");
                  }}
                >
                  Open full activity →
                </button>
              </div>
            </ModalShell>
          )}

          {globalSearchOpen && (
            <ModalShell
              title="Search everything"
              eyebrow="⌘K"
              onClose={() => setGlobalSearchOpen(false)}
              wide
            >
              <div className="global-search-modal">
                <div className="search-bar-large">
                  <span>⌕</span>
                  <input
                    autoFocus
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search intent, context, decisions, actions or memory..."
                  />
                </div>

                <div className="global-search-results">
                  {resultSet.length === 0 ? (
                    <div className="global-search-empty">
                      <span>⌕</span>
                      <strong>
                        {searchQuery.trim()
                          ? "No result found"
                          : "Start typing to search the whole space"}
                      </strong>
                    </div>
                  ) : (
                    resultSet.slice(0, 10).map((result) => (
                      <button
                        key={`${result.type}-${result.id}`}
                        className="search-result"
                        onClick={() => {
                          setGlobalSearchOpen(false);

                          if (result.type === "node") {
                            focusNode(result.id);
                            openView("intent");
                          } else if (result.type === "file") {
                            setSelectedFileId(result.id);
                            openView("files");
                          } else if (result.type === "decision") {
                            setSelectedDecisionId(result.id);
                            openView("intent");
                          } else if (result.type === "activity") {
                            openView("activity");
                          } else {
                            openView("intent");
                          }
                        }}
                      >
                        <span className="search-result-icon">
                          {result.type === "file"
                            ? "□"
                            : result.type === "decision"
                              ? "◈"
                              : result.type === "activity"
                                ? "◒"
                                : "◎"}
                        </span>
                        <span className="search-result-copy">
                          <strong>{result.title}</strong>
                          <small>{compactText(result.detail, 160)}</small>
                        </span>
                        <span className="search-result-meta">
                          {result.meta}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </ModalShell>
          )}

          <div className="toast-stack">
            {toasts.map((toast) => (
              <div
                key={toast.id}
                className={`toast toast-${toast.tone ?? "neutral"}`}
              >
                <span className="toast-icon">
                  {toast.tone === "good"
                    ? "✓"
                    : toast.tone === "warning"
                      ? "!"
                      : "·"}
                </span>
                <div>
                  <strong>{toast.title}</strong>
                  {toast.detail && <span>{toast.detail}</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <style jsx global>{`
        :root {
          --bg: #f4f4f1;
          --paper: #fbfbf8;
          --paper-2: #f8f8f5;
          --ink: #121212;
          --muted: #73736f;
          --muted-2: #979792;
          --line: rgba(20, 20, 18, 0.09);
          --line-strong: rgba(20, 20, 18, 0.16);
          --shadow-soft:
            0 20px 60px rgba(20, 20, 20, 0.06),
            0 4px 16px rgba(20, 20, 20, 0.03);
          --shadow-deep:
            0 40px 100px rgba(20, 20, 20, 0.13),
            0 10px 30px rgba(20, 20, 20, 0.07);
          --radius-xl: 30px;
          --radius-lg: 22px;
          --radius-md: 16px;
          --radius-sm: 11px;
          --ease: cubic-bezier(0.2, 0.7, 0.2, 1);
        }

        * {
          box-sizing: border-box;
        }

        html {
          min-height: 100%;
          scroll-behavior: smooth;
        }

        body {
          margin: 0;
          min-height: 100%;
          background: var(--bg);
          color: var(--ink);
          font-family:
            Inter,
            ui-sans-serif,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          -webkit-font-smoothing: antialiased;
          text-rendering: optimizeLegibility;
        }

        button,
        input,
        textarea {
          font: inherit;
        }

        button {
          border: 0;
          cursor: pointer;
        }

        button:disabled {
          cursor: default;
          opacity: 0.55;
        }

        a {
          color: inherit;
        }

        ::selection {
          background: rgba(18, 18, 18, 0.14);
        }

        .app-shell {
          min-height: 100vh;
          background:
            radial-gradient(
              circle at 78% 12%,
              rgba(255, 255, 255, 0.95),
              transparent 27%
            ),
            linear-gradient(180deg, #f8f8f5 0%, var(--bg) 100%);
        }

        .sidebar {
          position: fixed;
          inset: 0 auto 0 0;
          z-index: 50;
          width: 260px;
          border-right: 1px solid var(--line);
          background: rgba(248, 248, 245, 0.88);
          backdrop-filter: blur(18px);
        }

        .sidebar-inner {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 20px 14px;
        }

        .brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          align-self: flex-start;
          padding: 7px 8px;
          border-radius: 12px;
          background: transparent;
          color: var(--ink);
        }

        .brand:hover {
          background: rgba(20, 20, 20, 0.045);
        }

        .brand-mark {
          display: grid;
          place-items: center;
          width: 28px;
          height: 28px;
          border: 1px solid rgba(20, 20, 20, 0.16);
          border-radius: 8px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: -0.04em;
          background: #fff;
          box-shadow: 0 5px 14px rgba(20, 20, 20, 0.07);
        }

        .brand-word {
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.14em;
        }

        .sidebar-section {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin-top: 34px;
        }

        .sidebar-caption {
          padding: 0 11px 8px;
          color: var(--muted-2);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          min-height: 42px;
          padding: 0 11px;
          border: 1px solid transparent;
          border-radius: 12px;
          background: transparent;
          color: #5e5e59;
          font-size: 13px;
          text-align: left;
          transition:
            transform 180ms var(--ease),
            background 180ms var(--ease),
            color 180ms var(--ease),
            border-color 180ms var(--ease);
        }

        .nav-item:hover {
          color: var(--ink);
          transform: translateX(2px);
          background: rgba(20, 20, 20, 0.04);
        }

        .nav-item-active {
          color: var(--ink);
          background: #fff;
          border-color: var(--line);
          box-shadow: 0 4px 16px rgba(20, 20, 20, 0.035);
        }

        .nav-icon {
          display: inline-grid;
          place-items: center;
          width: 18px;
          color: #4f4f4b;
          font-size: 16px;
        }

        .nav-meta {
          margin-left: auto;
          color: var(--muted-2);
          font-size: 10px;
        }

        .sidebar-spacer {
          flex: 1;
        }

        .sidebar-status {
          margin: 10px 2px 12px;
          padding: 14px;
          border: 1px solid var(--line);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.54);
        }

        .status-line {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #373733;
          font-size: 11px;
          font-weight: 700;
        }

        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #aaaaa4;
          box-shadow: 0 0 0 4px rgba(100, 100, 100, 0.08);
        }

        .status-dot.live {
          background: #20201e;
          box-shadow:
            0 0 0 4px rgba(20, 20, 20, 0.08),
            0 0 0 1px rgba(255, 255, 255, 0.65) inset;
        }

        .sidebar-status .status-copy {
          margin-top: 9px;
          color: var(--muted);
          font-size: 11px;
          line-height: 1.55;
        }

        .sidebar-home {
          display: flex;
          align-items: center;
          gap: 9px;
          min-height: 42px;
          padding: 0 11px;
          border-radius: 12px;
          background: transparent;
          color: var(--muted);
          font-size: 12px;
          text-align: left;
        }

        .sidebar-home:hover {
          background: rgba(20, 20, 20, 0.04);
          color: var(--ink);
        }

        .app-main {
          min-height: 100vh;
          margin-left: 260px;
        }

        .topbar {
          position: sticky;
          top: 0;
          z-index: 30;
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 68px;
          padding: 0 34px;
          border-bottom: 1px solid var(--line);
          background: rgba(248, 248, 245, 0.82);
          backdrop-filter: blur(18px);
        }

        .topbar-left,
        .topbar-right,
        .breadcrumbs,
        .inline-actions,
        .home-header,
        .home-header-actions {
          display: flex;
          align-items: center;
        }

        .breadcrumbs {
          gap: 8px;
          color: var(--muted);
          font-size: 11px;
        }

        .breadcrumbs button {
          padding: 0;
          background: none;
          color: var(--ink);
          font-weight: 800;
          letter-spacing: 0.08em;
        }

        .breadcrumbs span:last-child {
          color: #8c8c86;
        }

        .mobile-menu {
          display: none;
          margin-right: 10px;
          padding: 6px 8px;
          border-radius: 8px;
          background: transparent;
          color: var(--ink);
        }

        .topbar-right {
          gap: 8px;
        }

        .topbar-search {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          min-width: 220px;
          padding: 8px 10px;
          border: 1px solid var(--line);
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.6);
          color: var(--muted);
          font-size: 11px;
          text-align: left;
        }

        .topbar-search:hover {
          background: #fff;
          border-color: var(--line-strong);
          color: var(--ink);
        }

        kbd {
          margin-left: auto;
          padding: 3px 6px;
          border: 1px solid var(--line);
          border-bottom-color: rgba(20, 20, 20, 0.16);
          border-radius: 6px;
          background: #f6f6f2;
          color: var(--muted-2);
          font-size: 9px;
        }

        .agent-indicator {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 11px;
          border: 1px solid var(--line);
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.48);
          color: var(--muted);
          font-size: 10px;
          font-weight: 700;
        }

        .agent-indicator-live {
          color: var(--ink);
        }

        .agent-indicator-core {
          position: relative;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #999993;
        }

        .agent-indicator-live .agent-indicator-core {
          background: #191917;
          box-shadow:
            0 0 0 4px rgba(20, 20, 20, 0.06),
            0 0 14px rgba(20, 20, 20, 0.28);
        }

        .circle-button {
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          border: 1px solid var(--line);
          border-radius: 50%;
          background: #fff;
          color: var(--ink);
          font-size: 14px;
        }

        .circle-button:hover {
          transform: translateY(-1px);
          border-color: var(--line-strong);
          box-shadow: 0 8px 20px rgba(20, 20, 20, 0.06);
        }

        .circle-button.small {
          width: 30px;
          height: 30px;
        }

        .content-stage {
          width: min(1480px, calc(100vw - 260px));
          margin: 0 auto;
          padding: 48px 46px 100px;
        }

        .view-content {
          display: flex;
          flex-direction: column;
          gap: 22px;
        }

        .eyebrow {
          display: inline-block;
          color: var(--muted-2);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }

        .button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 40px;
          padding: 0 14px;
          border: 1px solid transparent;
          border-radius: 11px;
          font-size: 11px;
          font-weight: 700;
          transition:
            transform 170ms var(--ease),
            border-color 170ms var(--ease),
            background 170ms var(--ease),
            box-shadow 170ms var(--ease);
        }

        .button:hover {
          transform: translateY(-1px);
        }

        .button-primary {
          background: var(--ink);
          color: white;
          box-shadow: 0 8px 24px rgba(18, 18, 18, 0.14);
        }

        .button-primary:hover {
          box-shadow: 0 14px 30px rgba(18, 18, 18, 0.18);
        }

        .button-secondary {
          border-color: var(--line);
          background: #fff;
          color: var(--ink);
          box-shadow: 0 4px 16px rgba(20, 20, 20, 0.03);
        }

        .button-quiet {
          background: transparent;
          color: var(--muted);
        }

        .button-quiet:hover {
          background: rgba(20, 20, 20, 0.04);
          color: var(--ink);
        }

        .text-button {
          padding: 0;
          background: none;
          color: var(--ink);
          font-size: 11px;
          font-weight: 800;
        }

        .text-button:hover {
          text-decoration: underline;
          text-underline-offset: 4px;
        }

        .intent-hero {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 36px;
          padding: 24px 0 10px;
        }

        .intent-hero-copy {
          max-width: 970px;
        }

        .intent-display {
          display: block;
          max-width: 980px;
          margin-top: 15px;
          padding: 0;
          background: transparent;
          color: var(--ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(34px, 4vw, 68px);
          line-height: 1.04;
          letter-spacing: -0.045em;
          text-align: left;
        }

        .intent-display:hover {
          opacity: 0.78;
        }

        .intent-meta-row {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 22px;
        }

        .meta-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 26px;
          padding: 0 9px;
          border: 1px solid var(--line);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.52);
          color: #6a6a65;
          font-size: 10px;
          font-weight: 600;
        }

        .meta-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #20201e;
        }

        .meta-pill.warning {
          color: #4e4e4a;
          border-color: rgba(20, 20, 20, 0.16);
        }

        .intent-hero-actions {
          display: flex;
          gap: 8px;
        }

        .intent-editor {
          margin-top: 13px;
        }

        .intent-editor textarea {
          width: min(980px, 100%);
          padding: 18px 0 12px;
          border: 0;
          border-bottom: 1px solid var(--line-strong);
          outline: none;
          resize: vertical;
          background: transparent;
          color: var(--ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(32px, 4vw, 64px);
          line-height: 1.06;
          letter-spacing: -0.045em;
        }

        .intent-editor-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-top: 10px;
          color: var(--muted);
          font-size: 10px;
        }

        .surface-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(330px, 0.8fr);
          gap: 16px;
        }

        .surface-grid-bottom {
          align-items: stretch;
        }

        .surface-card {
          min-width: 0;
          padding: 24px;
          border: 1px solid var(--line);
          border-radius: var(--radius-lg);
          background: rgba(255, 255, 255, 0.55);
          box-shadow: var(--shadow-soft);
        }

        .surface-card:hover {
          border-color: rgba(20, 20, 20, 0.12);
        }

        .surface-card-large {
          min-height: 100%;
        }

        .surface-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 20px;
        }

        .surface-heading h2 {
          margin: 6px 0 0;
          font-size: 18px;
          line-height: 1.15;
          letter-spacing: -0.03em;
        }

        .surface-count {
          display: inline-grid;
          place-items: center;
          min-width: 30px;
          min-height: 30px;
          padding: 0 8px;
          border: 1px solid var(--line);
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.8);
          color: var(--muted);
          font-size: 10px;
          font-weight: 800;
        }

        .node-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .node-card {
          min-height: 174px;
          padding: 15px;
          border: 1px solid var(--line);
          border-radius: 16px;
          background: rgba(252, 252, 249, 0.84);
          color: var(--ink);
          text-align: left;
          transition:
            transform 180ms var(--ease),
            border-color 180ms var(--ease),
            box-shadow 180ms var(--ease),
            background 180ms var(--ease);
        }

        .node-card:hover {
          transform: translateY(-2px);
          border-color: rgba(20, 20, 20, 0.16);
          background: #fff;
          box-shadow: 0 15px 34px rgba(20, 20, 20, 0.07);
        }

        .node-card-active {
          border-color: rgba(20, 20, 20, 0.22);
          box-shadow:
            0 0 0 1px rgba(20, 20, 20, 0.06),
            0 18px 38px rgba(20, 20, 20, 0.07);
          background: #fff;
        }

        .node-card-unknown {
          background:
            radial-gradient(circle at 86% 16%, rgba(0, 0, 0, 0.035), transparent 38%),
            #fbfbf8;
        }

        .node-card-top,
        .node-card-bottom,
        .proposal-card-top,
        .proposal-footer,
        .graph-header-actions,
        .search-scope,
        .context-header,
        .activity-header,
        .trust-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .node-kind {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.11em;
        }

        .kind-goal {
          color: #1b1b1a;
        }

        .kind-constraint {
          color: #62625d;
        }

        .kind-value {
          color: #32322f;
        }

        .kind-unknown {
          color: #7d7d78;
        }

        .kind-context {
          color: #575752;
        }

        .kind-decision {
          color: #32322f;
        }

        .kind-action {
          color: #4a4a46;
        }

        .kind-output {
          color: #5d5d58;
        }

        .node-confidence {
          color: var(--muted-2);
          font-size: 9px;
          font-weight: 700;
        }

        .node-card strong {
          display: block;
          margin-top: 24px;
          font-size: 14px;
          line-height: 1.22;
          letter-spacing: -0.02em;
        }

        .node-card p {
          min-height: 47px;
          margin: 7px 0 0;
          color: var(--muted);
          font-size: 11px;
          line-height: 1.55;
        }

        .node-card-bottom {
          margin-top: 15px;
          color: var(--muted-2);
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .attention-card {
          display: flex;
          flex-direction: column;
          min-height: 310px;
          padding: 18px;
          border: 1px solid var(--line);
          border-radius: 18px;
          background:
            radial-gradient(
              circle at 80% 0%,
              rgba(20, 20, 20, 0.045),
              transparent 34%
            ),
            #fbfbf8;
        }

        .attention-mark {
          display: grid;
          place-items: center;
          width: 46px;
          height: 46px;
          margin-bottom: 22px;
          border: 1px solid var(--line);
          border-radius: 14px;
          background: white;
          font-size: 18px;
          box-shadow: 0 8px 20px rgba(20, 20, 20, 0.04);
        }

        .attention-card h3 {
          margin: 6px 0 8px;
          font-size: 18px;
          letter-spacing: -0.03em;
        }

        .attention-card p {
          margin: 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.65;
        }

        .attention-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: auto;
          padding-top: 22px;
          color: var(--muted-2);
          font-size: 10px;
        }

        .decision-list,
        .action-list,
        .file-list,
        .snapshot-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .decision-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 11px;
          border: 1px solid transparent;
          border-radius: 13px;
          background: rgba(255, 255, 255, 0.35);
        }

        .decision-row:hover,
        .decision-row-active {
          border-color: var(--line);
          background: #fff;
        }

        .decision-main {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          padding: 0;
          background: transparent;
          color: var(--ink);
          text-align: left;
        }

        .decision-glyph {
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          width: 31px;
          height: 31px;
          border: 1px solid var(--line);
          border-radius: 9px;
          background: #fbfbf8;
          font-size: 11px;
        }

        .decision-main strong,
        .decision-main span {
          display: block;
        }

        .decision-main strong {
          overflow: hidden;
          max-width: 420px;
          font-size: 12px;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .decision-main div span {
          margin-top: 3px;
          color: var(--muted);
          font-size: 10px;
        }

        .decision-state {
          flex: 0 0 auto;
        }

        .decision-choice,
        .decision-open,
        .approval-badge,
        .trust-status {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          padding: 0 8px;
          border: 1px solid var(--line);
          border-radius: 999px;
          background: #fff;
          color: var(--muted);
          font-size: 9px;
          font-weight: 800;
        }

        .decision-choice {
          color: var(--ink);
        }

        .action-row {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          padding: 10px;
          border: 1px solid transparent;
          border-radius: 13px;
          background: rgba(255, 255, 255, 0.34);
          color: var(--ink);
          text-align: left;
        }

        .action-row:hover {
          border-color: var(--line);
          background: #fff;
        }

        .action-state {
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          width: 30px;
          height: 30px;
          border: 1px solid var(--line);
          border-radius: 9px;
          background: #fafaf7;
          font-size: 11px;
        }

        .action-state-in-progress {
          border-style: dashed;
        }

        .action-state-done {
          background: #efefeb;
        }

        .action-copy {
          display: block;
          min-width: 0;
        }

        .action-copy strong,
        .action-copy small {
          display: block;
        }

        .action-copy strong {
          font-size: 11px;
        }

        .action-copy small {
          margin-top: 2px;
          color: var(--muted);
          font-size: 9px;
          line-height: 1.4;
        }

        .action-owner {
          margin-left: auto;
          color: var(--muted-2);
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        .proposal-surface {
          display: grid;
          grid-template-columns: minmax(290px, 0.85fr) minmax(0, 1.25fr);
          gap: 16px;
          padding: 24px;
          border: 1px solid rgba(20, 20, 20, 0.12);
          border-radius: var(--radius-lg);
          background:
            radial-gradient(
              circle at 16% 0%,
              rgba(20, 20, 20, 0.055),
              transparent 35%
            ),
            linear-gradient(135deg, #eeeeeb, #f9f9f6);
          box-shadow: var(--shadow-soft);
        }

        .proposal-intro {
          padding: 10px 14px 10px 2px;
        }

        .proposal-intro h2 {
          max-width: 460px;
          margin: 8px 0 10px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(24px, 3vw, 40px);
          line-height: 1.08;
          letter-spacing: -0.035em;
        }

        .proposal-intro p {
          max-width: 460px;
          margin: 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.65;
        }

        .proposal-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 22px;
        }

        .proposal-column {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .proposal-card,
        .proposal-empty {
          padding: 16px;
          border: 1px solid var(--line);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.74);
          box-shadow: 0 10px 22px rgba(20, 20, 20, 0.04);
        }

        .proposal-card-top {
          color: var(--muted-2);
          font-size: 9px;
          font-weight: 700;
        }

        .proposal-kind {
          color: var(--ink);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .proposal-card h3 {
          margin: 16px 0 7px;
          font-size: 15px;
          letter-spacing: -0.025em;
        }

        .proposal-card p {
          margin: 0;
          color: var(--muted);
          font-size: 11px;
          line-height: 1.58;
        }

        .proposal-change {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin-top: 14px;
          padding: 11px;
          border: 1px solid var(--line);
          border-radius: 11px;
          background: #fbfbf8;
        }

        .proposal-change span {
          color: var(--muted-2);
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .proposal-change strong {
          font-size: 10px;
          line-height: 1.5;
        }

        .proposal-footer {
          margin-top: 14px;
        }

        .proposal-empty {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 100%;
        }

        .proposal-empty-mark {
          display: grid;
          place-items: center;
          width: 38px;
          height: 38px;
          flex: 0 0 auto;
          border: 1px solid var(--line);
          border-radius: 11px;
          background: #fff;
        }

        .proposal-empty strong,
        .proposal-empty span {
          display: block;
        }

        .proposal-empty strong {
          font-size: 11px;
        }

        .proposal-empty span {
          margin-top: 3px;
          color: var(--muted);
          font-size: 9px;
          line-height: 1.45;
        }

        .continuity-strip {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px 20px;
          border-top: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
          color: var(--muted);
        }

        .continuity-step {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .continuity-step span {
          display: inline-grid;
          place-items: center;
          width: 24px;
          height: 24px;
          border: 1px solid var(--line);
          border-radius: 8px;
          font-size: 8px;
        }

        .continuity-step strong {
          font-size: 11px;
          color: var(--ink);
        }

        .continuity-step small {
          color: var(--muted);
          font-size: 9px;
        }

        .continuity-active span {
          background: var(--ink);
          color: white;
        }

        .continuity-line {
          flex: 1;
          height: 1px;
          background: var(--line);
        }

        .graph-header,
        .context-header,
        .search-header,
        .activity-header,
        .trust-header {
          padding: 10px 0 8px;
        }

        .graph-header h1,
        .context-header h1,
        .search-header h1,
        .activity-header h1,
        .trust-header h1 {
          margin: 7px 0 8px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(34px, 4vw, 60px);
          line-height: 1.03;
          letter-spacing: -0.05em;
        }

        .graph-header p,
        .context-header p,
        .search-header p,
        .activity-header p,
        .trust-header p {
          max-width: 760px;
          margin: 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.62;
        }

        .graph-shell {
          position: relative;
          min-height: 690px;
          overflow: hidden;
          border: 1px solid var(--line);
          border-radius: 28px;
          background:
            radial-gradient(
              circle at 50% 46%,
              rgba(20, 20, 20, 0.08),
              transparent 22%
            ),
            linear-gradient(180deg, #fdfdf9 0%, #f4f4f0 100%);
          box-shadow: var(--shadow-deep);
        }

        .graph-toolbar {
          position: absolute;
          top: 16px;
          left: 16px;
          z-index: 4;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          padding: 7px;
          border: 1px solid var(--line);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.74);
          backdrop-filter: blur(12px);
        }

        .graph-legend {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 23px;
          padding: 0 7px;
          border: 1px solid var(--line);
          border-radius: 999px;
          color: var(--muted);
          font-size: 8px;
          background: rgba(255, 255, 255, 0.72);
        }

        .legend-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          border: 1px solid #666;
          background: #fff;
        }

        .legend-intent {
          background: #111;
          border-color: #111;
        }

        .legend-unknown {
          border-style: dashed;
        }

        .graph-canvas {
          position: absolute;
          inset: 0;
          transform-origin: 50% 50%;
          transition: transform 180ms var(--ease);
        }

        .graph-grid {
          position: absolute;
          inset: 0;
          opacity: 0.32;
          background-image:
            linear-gradient(
              rgba(20, 20, 20, 0.06) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(20, 20, 20, 0.06) 1px,
              transparent 1px
            );
          background-size: 36px 36px;
          mask-image: radial-gradient(circle at center, black, transparent 78%);
        }

        .graph-lines {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          overflow: visible;
        }

        .graph-lines line {
          stroke: rgba(30, 30, 28, 0.14);
          stroke-width: 0.22;
          vector-effect: non-scaling-stroke;
        }

        .graph-node {
          position: absolute;
          display: grid;
          place-items: center;
          padding: 10px;
          transform: translate(-50%, -50%);
          border: 1px solid var(--line-strong);
          border-radius: 50%;
          background:
            radial-gradient(
              circle at 40% 28%,
              rgba(255, 255, 255, 0.98),
              rgba(241, 241, 236, 0.88)
            );
          color: var(--ink);
          box-shadow:
            0 18px 42px rgba(20, 20, 20, 0.1),
            0 3px 8px rgba(20, 20, 20, 0.05);
          transition:
            transform 200ms var(--ease),
            box-shadow 200ms var(--ease),
            border-color 200ms var(--ease);
        }

        .graph-node:hover {
          transform: translate(-50%, -50%) scale(1.045);
          border-color: rgba(20, 20, 20, 0.28);
          box-shadow:
            0 26px 60px rgba(20, 20, 20, 0.14),
            0 8px 20px rgba(20, 20, 20, 0.07);
          z-index: 6;
        }

        .graph-intent {
          width: 180px !important;
          height: 180px !important;
          border-radius: 40%;
          border-color: rgba(20, 20, 20, 0.18);
          background:
            radial-gradient(
              circle at 50% 22%,
              rgba(255, 255, 255, 0.95),
              rgba(225, 225, 220, 0.9)
            );
          box-shadow:
            inset 0 0 0 1px rgba(255, 255, 255, 0.56),
            0 28px 72px rgba(20, 20, 20, 0.15);
        }

        .graph-unknown {
          border-style: dashed;
        }

        .graph-node-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          max-width: 120px;
          text-align: center;
        }

        .graph-node-inner b {
          font-size: 10px;
          line-height: 1.25;
        }

        .graph-intent .graph-node-inner b {
          font-size: 15px;
          letter-spacing: 0.08em;
        }

        .graph-node-inner small {
          margin-top: 4px;
          color: var(--muted);
          font-size: 8px;
          line-height: 1.35;
        }

        .graph-footer {
          position: absolute;
          right: 16px;
          bottom: 16px;
          left: 16px;
          z-index: 5;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .graph-footer > div {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          color: var(--muted);
          font-size: 9px;
        }

        .graph-insight-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .insight-card {
          min-height: 185px;
          padding: 20px;
          border: 1px solid var(--line);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.52);
        }

        .insight-card h3 {
          margin: 8px 0 8px;
          font-size: 15px;
          letter-spacing: -0.025em;
        }

        .insight-card p {
          margin: 0;
          color: var(--muted);
          font-size: 11px;
          line-height: 1.58;
        }

        .insight-stat {
          display: inline-flex;
          margin-top: 20px;
          color: var(--ink);
          font-size: 10px;
          font-weight: 800;
        }

        .dropzone {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 8px;
          min-height: 250px;
          padding: 24px;
          border: 1px dashed rgba(20, 20, 20, 0.18);
          border-radius: 24px;
          background:
            radial-gradient(
              circle at 50% 0%,
              rgba(255, 255, 255, 0.85),
              transparent 50%
            ),
            #f7f7f3;
          text-align: center;
          transition:
            border-color 180ms var(--ease),
            background 180ms var(--ease),
            transform 180ms var(--ease);
        }

        .dropzone-active {
          border-color: rgba(20, 20, 20, 0.38);
          background: #fefefb;
          transform: scale(1.005);
        }

        .dropzone-icon {
          display: grid;
          place-items: center;
          width: 54px;
          height: 54px;
          margin-bottom: 5px;
          border: 1px solid var(--line);
          border-radius: 16px;
          background: white;
          font-size: 22px;
          box-shadow: 0 12px 24px rgba(20, 20, 20, 0.05);
        }

        .dropzone strong {
          font-size: 15px;
        }

        .dropzone > span {
          max-width: 480px;
          color: var(--muted);
          font-size: 10px;
          line-height: 1.55;
        }

        .dropzone .button {
          margin-top: 10px;
        }

        .context-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.72fr);
          gap: 16px;
        }

        .file-row {
          display: flex;
          align-items: center;
          gap: 11px;
          width: 100%;
          min-height: 68px;
          padding: 9px 11px;
          border: 1px solid transparent;
          border-radius: 13px;
          background: rgba(255, 255, 255, 0.33);
          color: var(--ink);
          text-align: left;
        }

        .file-row:hover,
        .file-row-active {
          border-color: var(--line);
          background: #fff;
        }

        .file-mark {
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          width: 34px;
          height: 34px;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: #fbfbf8;
        }

        .file-copy {
          display: block;
          min-width: 0;
        }

        .file-copy strong,
        .file-copy small {
          display: block;
        }

        .file-copy strong {
          overflow: hidden;
          max-width: 500px;
          font-size: 11px;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .file-copy small {
          overflow: hidden;
          margin-top: 3px;
          color: var(--muted);
          font-size: 9px;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .file-tag {
          margin-left: auto;
          color: var(--muted-2);
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .file-arrow {
          color: var(--muted-2);
          font-size: 11px;
        }

        .file-detail {
          display: flex;
          flex-direction: column;
          min-height: 330px;
        }

        .file-detail-icon {
          display: grid;
          place-items: center;
          width: 50px;
          height: 50px;
          margin-bottom: 22px;
          border: 1px solid var(--line);
          border-radius: 13px;
          background: white;
          font-size: 19px;
        }

        .file-detail h3 {
          margin: 6px 0 8px;
          font-size: 18px;
          letter-spacing: -0.03em;
        }

        .file-detail p {
          margin: 0;
          color: var(--muted);
          font-size: 11px;
          line-height: 1.62;
        }

        .tag-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 18px;
        }

        .tag {
          min-height: 22px;
          padding: 0 7px;
          border: 1px solid var(--line);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.64);
          color: var(--muted);
          font-size: 8px;
          line-height: 22px;
        }

        .detail-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: auto;
          padding-top: 20px;
          color: var(--muted-2);
          font-size: 9px;
        }

        .search-main {
          max-width: 1060px;
        }

        .search-bar-large {
          display: flex;
          align-items: center;
          gap: 11px;
          min-height: 64px;
          padding: 0 18px;
          border: 1px solid var(--line-strong);
          border-radius: 17px;
          background: rgba(255, 255, 255, 0.7);
          box-shadow: 0 12px 26px rgba(20, 20, 20, 0.04);
        }

        .search-bar-large > span {
          color: var(--muted);
          font-size: 18px;
        }

        .search-bar-large input {
          min-width: 0;
          flex: 1;
          border: 0;
          outline: none;
          background: transparent;
          color: var(--ink);
          font-size: 16px;
        }

        .search-bar-large input::placeholder {
          color: #aaa9a3;
        }

        .search-scope {
          justify-content: flex-start;
          gap: 10px;
          margin: 12px 2px 18px;
          color: var(--muted-2);
          font-size: 9px;
        }

        .search-results,
        .global-search-results {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .search-result {
          display: flex;
          align-items: center;
          gap: 11px;
          min-height: 66px;
          padding: 9px 12px;
          border: 1px solid transparent;
          border-radius: 13px;
          background: rgba(255, 255, 255, 0.34);
          color: var(--ink);
          text-align: left;
        }

        .search-result:hover {
          border-color: var(--line);
          background: #fff;
        }

        .search-result-icon {
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          width: 33px;
          height: 33px;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: #fbfbf8;
          font-size: 12px;
        }

        .search-result-copy {
          display: block;
          min-width: 0;
        }

        .search-result-copy strong,
        .search-result-copy small {
          display: block;
        }

        .search-result-copy strong {
          font-size: 11px;
        }

        .search-result-copy small {
          max-width: 600px;
          margin-top: 3px;
          color: var(--muted);
          font-size: 9px;
          line-height: 1.45;
        }

        .search-result-meta {
          margin-left: auto;
          color: var(--muted-2);
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }

        .search-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 420px;
          padding: 30px;
          border: 1px dashed var(--line-strong);
          border-radius: 24px;
          text-align: center;
        }

        .search-orbit {
          position: relative;
          width: 280px;
          height: 150px;
          margin-bottom: 20px;
          border: 1px solid var(--line);
          border-radius: 50%;
          opacity: 0.72;
        }

        .search-orbit span {
          position: absolute;
          padding: 5px 8px;
          border: 1px solid var(--line);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.78);
          color: var(--muted);
          font-size: 8px;
        }

        .search-orbit span:nth-child(1) {
          left: 106px;
          top: -12px;
        }

        .search-orbit span:nth-child(2) {
          right: -12px;
          top: 55px;
        }

        .search-orbit span:nth-child(3) {
          left: 75px;
          bottom: -12px;
        }

        .search-orbit span:nth-child(4) {
          left: -17px;
          top: 55px;
        }

        .search-orbit span:nth-child(5) {
          left: 105px;
          top: 57px;
          background: var(--ink);
          color: white;
          border-color: var(--ink);
        }

        .search-placeholder strong {
          font-family: Georgia, "Times New Roman", serif;
          font-size: 28px;
          letter-spacing: -0.04em;
        }

        .search-placeholder p {
          max-width: 450px;
          margin: 8px 0 0;
          color: var(--muted);
          font-size: 11px;
          line-height: 1.6;
        }

        .activity-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.7fr);
          gap: 16px;
        }

        .timeline {
          display: flex;
          flex-direction: column;
        }

        .timeline-row {
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr);
          gap: 12px;
          padding: 16px 0;
          border-top: 1px solid var(--line);
        }

        .timeline-row:first-child {
          border-top: 0;
          padding-top: 2px;
        }

        .timeline-avatar {
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: #fafaf6;
          color: var(--ink);
          font-size: 11px;
        }

        .avatar-agent {
          background: #efefeb;
        }

        .avatar-human {
          background: #fff;
        }

        .timeline-meta {
          display: flex;
          align-items: center;
          gap: 7px;
          color: var(--muted-2);
          font-size: 8px;
        }

        .timeline-meta strong {
          color: var(--ink);
          font-size: 9px;
        }

        .timeline-body h3 {
          margin: 6px 0 5px;
          font-size: 12px;
        }

        .timeline-body p {
          margin: 0;
          color: var(--muted);
          font-size: 10px;
          line-height: 1.58;
        }

        .snapshot-row {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 54px;
          padding: 8px 9px;
          border: 1px solid transparent;
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.32);
          color: var(--ink);
          text-align: left;
        }

        .snapshot-row:hover {
          border-color: var(--line);
          background: #fff;
        }

        .snapshot-icon {
          display: grid;
          place-items: center;
          width: 29px;
          height: 29px;
          border: 1px solid var(--line);
          border-radius: 9px;
          background: #fbfbf8;
          font-size: 11px;
        }

        .snapshot-row > span:nth-child(2) {
          min-width: 0;
        }

        .snapshot-row strong,
        .snapshot-row small {
          display: block;
        }

        .snapshot-row strong {
          overflow: hidden;
          max-width: 180px;
          font-size: 10px;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .snapshot-row small {
          margin-top: 2px;
          color: var(--muted-2);
          font-size: 8px;
        }

        .snapshot-row > span:last-child {
          margin-left: auto;
          color: var(--muted-2);
          font-size: 8px;
          white-space: nowrap;
        }

        .trust-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .trust-card {
          min-height: 200px;
          padding: 20px;
          border: 1px solid var(--line);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.53);
        }

        .trust-icon {
          display: grid;
          place-items: center;
          width: 42px;
          height: 42px;
          border: 1px solid var(--line);
          border-radius: 12px;
          background: white;
          font-size: 16px;
        }

        .trust-card h3 {
          margin: 22px 0 8px;
          font-size: 15px;
          letter-spacing: -0.02em;
        }

        .trust-card p {
          margin: 0;
          color: var(--muted);
          font-size: 10px;
          line-height: 1.6;
        }

        .trust-card-status {
          display: inline-flex;
          margin-top: 19px;
          color: var(--ink);
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .trust-flow,
        .trust-code-card,
        .reset-section {
          padding: 24px;
          border: 1px solid var(--line);
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.52);
        }

        .trust-flow-head h2,
        .trust-code-card h2,
        .reset-section h2 {
          margin: 7px 0 0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 27px;
          line-height: 1.1;
          letter-spacing: -0.035em;
        }

        .flow-rail {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
          margin-top: 24px;
        }

        .flow-step {
          position: relative;
          display: flex;
          flex-direction: column;
          min-height: 120px;
          padding: 15px;
          border: 1px solid var(--line);
          border-radius: 15px;
          background: #fafaf7;
        }

        .flow-step > span {
          color: var(--muted-2);
          font-size: 8px;
        }

        .flow-step strong {
          margin-top: auto;
          font-size: 11px;
        }

        .flow-step small {
          margin-top: 3px;
          color: var(--muted);
          font-size: 8px;
        }

        .flow-step i {
          position: absolute;
          top: 50%;
          right: -8px;
          z-index: 2;
          width: 16px;
          height: 16px;
          transform: translateY(-50%);
          display: grid;
          place-items: center;
          border: 1px solid var(--line);
          border-radius: 50%;
          background: var(--bg);
          color: var(--muted);
          font-size: 8px;
          font-style: normal;
        }

        .trust-code-card {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(320px, 0.85fr);
          gap: 24px;
          background:
            radial-gradient(
              circle at 76% 0%,
              rgba(20, 20, 20, 0.055),
              transparent 33%
            ),
            #f0f0ec;
        }

        .trust-code-card p {
          max-width: 640px;
          margin: 10px 0 0;
          color: var(--muted);
          font-size: 11px;
          line-height: 1.62;
        }

        .tool-stack {
          display: flex;
          flex-wrap: wrap;
          align-content: center;
          gap: 7px;
        }

        .tool-chip {
          padding: 8px 9px;
          border: 1px solid var(--line-strong);
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.64);
          color: #3d3d39;
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            Monaco,
            Consolas,
            monospace;
          font-size: 9px;
        }

        .reset-section {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .reset-section p {
          margin: 7px 0 0;
          color: var(--muted);
          font-size: 10px;
        }

        .floating-plus {
          position: fixed;
          right: 28px;
          bottom: 28px;
          z-index: 60;
          display: grid;
          place-items: center;
          width: 56px;
          height: 56px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 18px;
          background: #141412;
          color: #fff;
          box-shadow:
            0 26px 54px rgba(20, 20, 20, 0.22),
            0 8px 22px rgba(20, 20, 20, 0.14);
          font-size: 26px;
          transition:
            transform 180ms var(--ease),
            box-shadow 180ms var(--ease);
        }

        .floating-plus:hover {
          transform: translateY(-3px) scale(1.02);
          box-shadow:
            0 34px 70px rgba(20, 20, 20, 0.24),
            0 12px 26px rgba(20, 20, 20, 0.16);
        }

        .floating-plus span {
          display: block;
          transition: transform 200ms var(--ease);
        }

        .plus-rotated {
          transform: rotate(45deg);
        }

        .plus-menu {
          position: fixed;
          right: 28px;
          bottom: 98px;
          z-index: 59;
          width: min(480px, calc(100vw - 30px));
          padding: 16px;
          border: 1px solid rgba(20, 20, 20, 0.12);
          border-radius: 20px;
          background: rgba(252, 252, 249, 0.94);
          backdrop-filter: blur(18px);
          box-shadow: 0 34px 80px rgba(20, 20, 20, 0.15);
          animation: rise-in 220ms var(--ease);
        }

        .plus-menu-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          padding: 6px 4px 14px;
        }

        .plus-menu-head h3 {
          margin: 5px 0 0;
          font-size: 16px;
        }

        .plus-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
        }

        .plus-grid button {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          min-height: 70px;
          padding: 11px;
          border: 1px solid transparent;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.45);
          color: var(--ink);
          text-align: left;
        }

        .plus-grid button:hover {
          border-color: var(--line);
          background: #fff;
        }

        .plus-grid button > span {
          display: grid;
          place-items: center;
          width: 28px;
          height: 28px;
          flex: 0 0 auto;
          border: 1px solid var(--line);
          border-radius: 9px;
          background: #fbfbf8;
          font-size: 11px;
        }

        .plus-grid strong,
        .plus-grid small {
          display: block;
        }

        .plus-grid strong {
          font-size: 10px;
        }

        .plus-grid small {
          margin-top: 3px;
          color: var(--muted);
          font-size: 8px;
          line-height: 1.4;
        }

        .toast-stack {
          position: fixed;
          right: 24px;
          bottom: 98px;
          z-index: 70;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
          pointer-events: none;
        }

        .toast {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 280px;
          max-width: min(430px, calc(100vw - 40px));
          padding: 11px 13px;
          border: 1px solid var(--line);
          border-radius: 13px;
          background: rgba(250, 250, 247, 0.95);
          box-shadow: 0 18px 40px rgba(20, 20, 20, 0.12);
          backdrop-filter: blur(14px);
          animation: rise-in 220ms var(--ease);
        }

        .toast-icon {
          display: grid;
          place-items: center;
          width: 24px;
          height: 24px;
          border: 1px solid var(--line);
          border-radius: 8px;
          background: white;
          font-size: 10px;
        }

        .toast-good .toast-icon {
          background: #ecece8;
        }

        .toast-warning .toast-icon {
          background: #e6e6e2;
        }

        .toast strong,
        .toast span {
          display: block;
        }

        .toast strong {
          font-size: 10px;
        }

        .toast div > span {
          margin-top: 2px;
          color: var(--muted);
          font-size: 9px;
          line-height: 1.4;
        }

        .home-view {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          background:
            radial-gradient(
              circle at 67% 22%,
              rgba(0, 0, 0, 0.065),
              transparent 27%
            ),
            radial-gradient(
              circle at 35% 84%,
              rgba(0, 0, 0, 0.035),
              transparent 20%
            ),
            #f3f3ef;
        }

        .home-noise {
          position: fixed;
          inset: 0;
          pointer-events: none;
          opacity: 0.11;
          mix-blend-mode: multiply;
          background-image:
            radial-gradient(
              circle at 20% 30%,
              rgba(0, 0, 0, 0.5) 0.5px,
              transparent 0.6px
            ),
            radial-gradient(
              circle at 70% 65%,
              rgba(0, 0, 0, 0.35) 0.5px,
              transparent 0.6px
            );
          background-size: 13px 13px, 17px 17px;
        }

        .home-header {
          position: relative;
          z-index: 3;
          justify-content: space-between;
          padding: 26px 42px;
        }

        .home-header-actions {
          gap: 18px;
        }

        .home-text-link {
          padding: 9px 4px;
          background: transparent;
          color: #5d5d58;
          font-size: 11px;
          font-weight: 700;
        }

        .home-text-link:hover {
          color: var(--ink);
        }

        .home-outline-button {
          min-height: 38px;
          padding: 0 14px;
          border: 1px solid var(--line-strong);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.4);
          color: var(--ink);
          font-size: 10px;
          font-weight: 800;
        }

        .home-outline-button:hover {
          background: #fff;
          transform: translateY(-1px);
        }

        .home-main {
          position: relative;
          z-index: 2;
          width: min(1460px, calc(100vw - 60px));
          margin: 0 auto;
        }

        .hero {
          display: grid;
          grid-template-columns: minmax(0, 0.95fr) minmax(480px, 1.05fr);
          align-items: center;
          gap: 38px;
          min-height: 730px;
          padding: 54px 14px 72px;
        }

        .hero-copy {
          position: relative;
          z-index: 4;
          max-width: 700px;
          padding-left: 24px;
        }

        .hero-kicker {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          color: var(--muted-2);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.17em;
          text-transform: uppercase;
        }

        .hero-kicker::before {
          content: "";
          width: 22px;
          height: 1px;
          background: rgba(20, 20, 20, 0.24);
        }

        .hero h1 {
          margin: 18px 0 24px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(64px, 8vw, 122px);
          line-height: 0.87;
          letter-spacing: -0.065em;
          font-weight: 400;
        }

        .hero h1 em {
          color: #666661;
          font-style: italic;
        }

        .hero-description {
          max-width: 530px;
          margin: 0;
          color: #5f5f5a;
          font-size: clamp(15px, 1.5vw, 19px);
          line-height: 1.6;
        }

        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
          margin-top: 27px;
        }

        .hero-primary,
        .hero-secondary {
          min-height: 47px;
          padding: 0 16px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 800;
        }

        .hero-primary {
          display: inline-flex;
          align-items: center;
          gap: 16px;
          background: var(--ink);
          color: #fff;
          box-shadow: 0 20px 38px rgba(20, 20, 20, 0.16);
        }

        .hero-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 28px 46px rgba(20, 20, 20, 0.2);
        }

        .hero-primary span {
          font-size: 15px;
        }

        .hero-secondary {
          border: 1px solid var(--line-strong);
          background: rgba(255, 255, 255, 0.5);
          color: var(--ink);
        }

        .hero-secondary:hover {
          background: #fff;
          transform: translateY(-1px);
        }

        .hero-note {
          margin-top: 44px;
          padding-top: 15px;
          border-top: 1px solid var(--line);
          color: var(--muted-2);
          font-size: 10px;
          line-height: 1.6;
        }

        .hero-note strong {
          color: var(--ink);
        }

        .orbit-stage {
          position: relative;
          min-height: 670px;
          perspective: 1200px;
        }

        .orbit-aura {
          position: absolute;
          inset: 15% 8% 15% 5%;
          border-radius: 50%;
          background:
            radial-gradient(
              circle,
              rgba(0, 0, 0, 0.10) 0%,
              rgba(0, 0, 0, 0.035) 34%,
              transparent 67%
            );
          filter: blur(18px);
        }

        .orbit-ring {
          position: absolute;
          left: 50%;
          top: 50%;
          border: 1px solid rgba(20, 20, 20, 0.1);
          border-radius: 50%;
          transform: translate(-50%, -50%) rotateX(70deg);
        }

        .orbit-ring-one {
          width: 430px;
          height: 430px;
        }

        .orbit-ring-two {
          width: 570px;
          height: 570px;
          opacity: 0.75;
        }

        .orbit-ring-three {
          width: 700px;
          height: 700px;
          opacity: 0.4;
        }

        .orbit-core {
          position: absolute;
          left: 50%;
          top: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          width: 238px;
          height: 238px;
          transform: translate(-50%, -50%);
          border: 1px solid rgba(20, 20, 20, 0.16);
          border-radius: 40%;
          background:
            radial-gradient(
              circle at 45% 23%,
              rgba(255, 255, 255, 0.96),
              rgba(220, 220, 215, 0.86)
            );
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.7),
            0 40px 70px rgba(20, 20, 20, 0.16),
            0 15px 30px rgba(20, 20, 20, 0.09);
          text-align: center;
        }

        .orbit-core-label {
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.15em;
        }

        .orbit-core-copy {
          margin-top: 11px;
          color: var(--muted);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 15px;
          line-height: 1.36;
        }

        .orbit-card {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 170px;
          transform:
            rotate(var(--angle))
            translateY(-265px)
            rotate(calc(var(--angle) * -1));
        }

        .orbit-card > div {
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 53px;
          padding: 8px 10px;
          border: 1px solid rgba(20, 20, 20, 0.1);
          border-radius: 13px;
          background: rgba(250, 250, 247, 0.72);
          backdrop-filter: blur(10px);
          box-shadow: 0 12px 30px rgba(20, 20, 20, 0.06);
        }

        .orbit-card-dot {
          display: block;
          width: 6px;
          height: 6px;
          flex: 0 0 auto;
          border: 1px solid #696965;
          border-radius: 50%;
          background: #fff;
        }

        .orbit-card strong,
        .orbit-card small {
          display: block;
        }

        .orbit-card strong {
          font-size: 9px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .orbit-card small {
          margin-top: 2px;
          color: var(--muted);
          font-size: 8px;
        }

        .home-statement {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(320px, 0.9fr);
          gap: 36px;
          padding: 110px 70px;
          border-top: 1px solid var(--line);
        }

        .home-statement h2,
        .home-principles h2,
        .promo-copy h2 {
          margin: 8px 0 0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(40px, 5vw, 72px);
          line-height: 0.98;
          letter-spacing: -0.055em;
          font-weight: 400;
        }

        .home-statement p,
        .promo-copy p {
          align-self: end;
          max-width: 520px;
          margin: 0;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.75;
        }

        .home-theatre {
          padding: 0 20px 110px;
        }

        .theatre-head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          padding: 28px 0 18px;
          border-top: 1px solid var(--line);
        }

        .theatre-head h2 {
          margin: 6px 0 0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(30px, 4vw, 50px);
          letter-spacing: -0.04em;
          font-weight: 400;
        }

        .theatre-caption {
          color: var(--muted-2);
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .theatre-track {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          border-top: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
        }

        .theatre-step {
          min-height: 190px;
          padding: 24px 18px;
          border-right: 1px solid var(--line);
        }

        .theatre-step:last-child {
          border-right: 0;
        }

        .theatre-step > span {
          color: var(--muted-2);
          font-size: 8px;
        }

        .theatre-step strong {
          display: block;
          margin-top: 58px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 25px;
          font-weight: 400;
          letter-spacing: -0.035em;
        }

        .theatre-step p {
          max-width: 180px;
          margin: 7px 0 0;
          color: var(--muted);
          font-size: 10px;
          line-height: 1.52;
        }

        .home-map-promo {
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(430px, 1.1fr);
          align-items: center;
          gap: 50px;
          min-height: 620px;
          padding: 100px 70px;
          border-top: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
        }

        .promo-copy p {
          margin-top: 20px;
          max-width: 470px;
        }

        .promo-copy .button {
          margin-top: 24px;
        }

        .mini-graph {
          position: relative;
          min-height: 430px;
          overflow: hidden;
          border: 1px solid var(--line);
          border-radius: 28px;
          background:
            radial-gradient(
              circle at 50% 46%,
              rgba(20, 20, 20, 0.085),
              transparent 22%
            ),
            #efefeb;
        }

        .mini-graph::before {
          content: "";
          position: absolute;
          inset: 18%;
          border: 1px solid rgba(20, 20, 20, 0.1);
          border-radius: 50%;
          box-shadow:
            0 0 0 48px rgba(20, 20, 20, 0.015),
            0 0 0 100px rgba(20, 20, 20, 0.012);
        }

        .mini-graph-center {
          position: absolute;
          left: 50%;
          top: 50%;
          display: grid;
          place-items: center;
          width: 118px;
          height: 118px;
          transform: translate(-50%, -50%);
          border: 1px solid rgba(20, 20, 20, 0.17);
          border-radius: 36%;
          background: rgba(255, 255, 255, 0.72);
          box-shadow: 0 22px 50px rgba(20, 20, 20, 0.13);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.13em;
        }

        .mini-node {
          position: absolute;
          display: grid;
          place-items: center;
          min-width: 76px;
          min-height: 30px;
          padding: 0 10px;
          border: 1px solid var(--line-strong);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.74);
          color: var(--muted);
          font-size: 8px;
          box-shadow: 0 8px 20px rgba(20, 20, 20, 0.05);
        }

        .mini-node-0 {
          top: 18%;
          left: 48%;
          transform: translateX(-50%);
        }

        .mini-node-1 {
          top: 53%;
          left: 12%;
        }

        .mini-node-2 {
          top: 54%;
          right: 11%;
        }

        .mini-node-3 {
          right: 18%;
          bottom: 16%;
        }

        .mini-node-4 {
          left: 22%;
          bottom: 17%;
        }

        .mini-graph svg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }

        .mini-graph line {
          stroke: rgba(20, 20, 20, 0.15);
          stroke-width: 0.35;
        }

        .home-principles {
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
          gap: 50px;
          padding: 110px 70px;
        }

        .home-principles h2 em {
          color: var(--muted);
          font-style: italic;
        }

        .principle-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1px;
          align-self: stretch;
          background: var(--line);
        }

        .principle {
          min-height: 175px;
          padding: 22px;
          background: rgba(246, 246, 242, 0.94);
        }

        .principle > span {
          color: var(--muted-2);
          font-size: 8px;
        }

        .principle strong {
          display: block;
          margin-top: 44px;
          font-size: 13px;
        }

        .principle p {
          max-width: 250px;
          margin: 6px 0 0;
          color: var(--muted);
          font-size: 10px;
          line-height: 1.58;
        }

        .home-footer {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          padding: 35px 42px 44px;
          border-top: 1px solid var(--line);
          color: var(--muted);
        }

        .home-footer > div:first-child {
          display: flex;
          align-items: flex-end;
          gap: 12px;
        }

        .home-footer small {
          font-size: 9px;
        }

        .footer-right {
          display: flex;
          align-items: center;
          gap: 14px;
          font-size: 9px;
        }

        .footer-right button {
          padding: 0;
          background: transparent;
          color: var(--muted);
          font-size: 9px;
        }

        .footer-right button:hover {
          color: var(--ink);
        }

        .sidebar-backdrop {
          display: none;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 90;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(18, 18, 16, 0.24);
          backdrop-filter: blur(11px);
          animation: fade-in 180ms ease-out;
        }

        .modal {
          width: min(520px, 100%);
          max-height: min(820px, calc(100vh - 40px));
          overflow: auto;
          padding: 18px;
          border: 1px solid rgba(20, 20, 20, 0.12);
          border-radius: 22px;
          background: rgba(251, 251, 247, 0.97);
          box-shadow: 0 42px 90px rgba(20, 20, 20, 0.22);
          animation: rise-in 200ms var(--ease);
        }

        .modal-wide {
          width: min(820px, 100%);
        }

        .modal-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          padding: 4px 4px 15px;
        }

        .modal-head h3 {
          margin: 5px 0 0;
          font-size: 17px;
          letter-spacing: -0.03em;
        }

        .modal-node {
          padding: 10px 4px 3px;
        }

        .modal-node-mark {
          display: grid;
          place-items: center;
          width: 50px;
          height: 50px;
          margin-bottom: 20px;
          border: 1px solid var(--line);
          border-radius: 14px;
          background: #fff;
          font-size: 18px;
          box-shadow: 0 10px 24px rgba(20, 20, 20, 0.05);
        }

        .modal-node h2 {
          margin: 6px 0 8px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 30px;
          line-height: 1.03;
          letter-spacing: -0.045em;
        }

        .modal-node p {
          margin: 0;
          color: var(--muted);
          font-size: 11px;
          line-height: 1.62;
        }

        .modal-stat-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 7px;
          margin-top: 20px;
        }

        .modal-stat-grid > div {
          padding: 11px;
          border: 1px solid var(--line);
          border-radius: 11px;
          background: #fafaf7;
        }

        .modal-stat-grid span,
        .modal-stat-grid strong {
          display: block;
        }

        .modal-stat-grid span {
          color: var(--muted-2);
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: 0.09em;
        }

        .modal-stat-grid strong {
          margin-top: 5px;
          overflow: hidden;
          font-size: 9px;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .modal-divider {
          height: 1px;
          margin: 20px 0;
          background: var(--line);
        }

        .modal-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .decision-modal {
          padding: 10px 4px 4px;
        }

        .decision-question {
          margin: 0;
          color: #373733;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 22px;
          line-height: 1.18;
          letter-spacing: -0.03em;
        }

        .choice-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 20px;
        }

        .choice {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          min-height: 48px;
          padding: 0 11px;
          border: 1px solid var(--line);
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.55);
          color: var(--ink);
          text-align: left;
        }

        .choice:hover {
          background: #fff;
          border-color: var(--line-strong);
        }

        .choice-selected {
          background: #efefeb;
          border-color: rgba(20, 20, 20, 0.2);
        }

        .choice span {
          font-size: 12px;
        }

        .choice strong {
          font-size: 10px;
        }

        .decision-footnote {
          color: var(--muted);
          font-size: 9px;
          line-height: 1.55;
        }

        .quick-activity {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .quick-activity-row {
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr);
          gap: 9px;
          padding: 10px;
          border: 1px solid var(--line);
          border-radius: 12px;
          background: #fafaf7;
        }

        .quick-activity-row strong,
        .quick-activity-row p,
        .quick-activity-row small {
          display: block;
        }

        .quick-activity-row strong {
          font-size: 10px;
        }

        .quick-activity-row p {
          margin: 3px 0;
          color: var(--muted);
          font-size: 9px;
          line-height: 1.48;
        }

        .quick-activity-row small {
          color: var(--muted-2);
          font-size: 8px;
        }

        .full-width {
          width: 100%;
        }

        .global-search-modal {
          padding: 7px 4px 4px;
        }

        .global-search-results {
          max-height: 520px;
          margin-top: 12px;
          overflow: auto;
        }

        .global-search-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          min-height: 250px;
          gap: 10px;
          border: 1px dashed var(--line);
          border-radius: 14px;
          color: var(--muted);
          text-align: center;
        }

        .global-search-empty span {
          font-size: 26px;
        }

        .global-search-empty strong {
          font-size: 11px;
        }

        .empty-state {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 8px;
          min-height: 200px;
          padding: 22px;
          border: 1px dashed var(--line);
          border-radius: 14px;
          text-align: center;
        }

        .empty-state-icon {
          display: grid;
          place-items: center;
          width: 40px;
          height: 40px;
          margin-bottom: 5px;
          border: 1px solid var(--line);
          border-radius: 12px;
          background: #fff;
          color: var(--muted);
        }

        .empty-state strong {
          font-size: 11px;
        }

        .empty-state p {
          max-width: 310px;
          margin: 0;
          color: var(--muted);
          font-size: 9px;
          line-height: 1.5;
        }

        .empty-state .button {
          margin-top: 7px;
        }

        @keyframes rise-in {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.99);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @media (max-width: 1180px) {
          .sidebar {
            width: 228px;
          }

          .app-main {
            margin-left: 228px;
          }

          .content-stage {
            width: calc(100vw - 228px);
            padding-right: 28px;
            padding-left: 28px;
          }

          .hero {
            grid-template-columns: minmax(0, 0.9fr) minmax(420px, 1fr);
          }

          .orbit-stage {
            transform: scale(0.88);
            transform-origin: center right;
          }

          .home-statement,
          .home-map-promo,
          .home-principles {
            padding-right: 40px;
            padding-left: 40px;
          }
        }

        @media (max-width: 980px) {
          .sidebar {
            transform: translateX(-100%);
            transition: transform 220ms var(--ease);
            box-shadow: 30px 0 80px rgba(20, 20, 20, 0.12);
          }

          .sidebar-open {
            transform: translateX(0);
          }

          .sidebar-backdrop {
            position: fixed;
            inset: 0;
            z-index: 45;
            display: block;
            pointer-events: none;
            opacity: 0;
            background: rgba(20, 20, 20, 0.16);
            backdrop-filter: blur(4px);
            transition: opacity 220ms var(--ease);
          }

          .sidebar-backdrop-visible {
            pointer-events: auto;
            opacity: 1;
          }

          .app-main {
            margin-left: 0;
          }

          .content-stage {
            width: 100%;
          }

          .mobile-menu {
            display: inline-grid;
            place-items: center;
          }

          .topbar-search {
            min-width: 0;
          }

          .topbar-search span:nth-child(2) {
            display: none;
          }

          .surface-grid,
          .context-layout,
          .activity-layout,
          .proposal-surface,
          .trust-code-card,
          .home-map-promo,
          .home-statement,
          .home-principles {
            grid-template-columns: 1fr;
          }

          .hero {
            grid-template-columns: 1fr;
            padding-top: 20px;
          }

          .orbit-stage {
            min-height: 560px;
            transform: none;
          }

          .hero-copy {
            padding-left: 0;
          }

          .flow-rail {
            grid-template-columns: repeat(3, 1fr);
          }

          .flow-step i {
            display: none;
          }
        }

        @media (max-width: 720px) {
          .topbar {
            padding: 0 14px;
          }

          .topbar-right {
            gap: 5px;
          }

          .agent-indicator {
            display: none;
          }

          .content-stage {
            padding: 28px 16px 90px;
          }

          .intent-hero {
            align-items: flex-start;
            flex-direction: column;
          }

          .intent-hero-actions {
            width: 100%;
          }

          .intent-hero-actions .button {
            flex: 1;
          }

          .node-grid,
          .trust-grid,
          .graph-insight-grid {
            grid-template-columns: 1fr;
          }

          .graph-shell {
            min-height: 570px;
          }

          .graph-footer {
            flex-direction: column;
            align-items: flex-start;
          }

          .graph-footer .button {
            width: 100%;
          }

          .graph-toolbar {
            right: 16px;
            overflow: auto;
          }

          .continuity-strip {
            align-items: flex-start;
            flex-direction: column;
          }

          .continuity-line {
            width: 1px;
            height: 18px;
            margin-left: 12px;
          }

          .home-header {
            padding: 20px 18px;
          }

          .home-text-link {
            display: none;
          }

          .home-main {
            width: calc(100vw - 32px);
          }

          .hero {
            min-height: auto;
            padding: 45px 10px 70px;
          }

          .hero h1 {
            font-size: clamp(58px, 18vw, 95px);
          }

          .hero-description {
            font-size: 14px;
          }

          .hero-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .hero-primary,
          .hero-secondary {
            width: 100%;
          }

          .orbit-stage {
            min-height: 420px;
            overflow: hidden;
          }

          .orbit-ring-one {
            width: 270px;
            height: 270px;
          }

          .orbit-ring-two {
            width: 360px;
            height: 360px;
          }

          .orbit-ring-three {
            width: 450px;
            height: 450px;
          }

          .orbit-core {
            width: 150px;
            height: 150px;
            border-radius: 32%;
          }

          .orbit-core-copy {
            font-size: 10px;
          }

          .orbit-card {
            width: 122px;
            transform:
              rotate(var(--angle))
              translateY(-165px)
              rotate(calc(var(--angle) * -1));
          }

          .orbit-card > div {
            min-height: 44px;
          }

          .orbit-card strong {
            font-size: 7px;
          }

          .orbit-card small {
            font-size: 7px;
          }

          .home-statement,
          .home-map-promo,
          .home-principles {
            padding: 75px 14px;
          }

          .home-statement h2,
          .home-principles h2,
          .promo-copy h2 {
            font-size: 45px;
          }

          .theatre-track {
            grid-template-columns: 1fr;
          }

          .theatre-step {
            min-height: 130px;
            border-right: 0;
            border-bottom: 1px solid var(--line);
          }

          .theatre-step:last-child {
            border-bottom: 0;
          }

          .theatre-step strong {
            margin-top: 28px;
          }

          .principle-grid {
            grid-template-columns: 1fr;
          }

          .home-footer {
            align-items: flex-start;
            flex-direction: column;
            padding: 28px 18px 32px;
          }

          .footer-right {
            align-items: flex-start;
            flex-direction: column;
          }

          .floating-plus {
            right: 16px;
            bottom: 16px;
          }

          .plus-menu {
            right: 16px;
            bottom: 84px;
            width: calc(100vw - 32px);
          }

          .plus-grid {
            grid-template-columns: 1fr;
          }

          .toast-stack {
            right: 16px;
            bottom: 84px;
          }

          .toast {
            min-width: 0;
          }

          .modal-backdrop {
            padding: 12px;
          }

          .modal {
            padding: 14px;
          }

          .flow-rail {
            grid-template-columns: 1fr;
          }

          .flow-step {
            min-height: 95px;
          }

          .search-result-meta {
            display: none;
          }

          .search-result-copy small {
            max-width: 240px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          html {
            scroll-behavior: auto;
          }

          *,
          *::before,
          *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
    </div>
  );
}

function EmptyState({
  title,
  detail,
  actionLabel,
  onAction,
}: {
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">·</div>
      <strong>{title}</strong>
      <p>{detail}</p>
      {actionLabel && onAction && (
        <button className="button button-secondary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function InsightCard({
  eyebrow,
  title,
  detail,
  stat,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  stat: string;
}) {
  return (
    <div className="insight-card">
      <span className="eyebrow">{eyebrow}</span>
      <h3>{title}</h3>
      <p>{detail}</p>
      <span className="insight-stat">{stat}</span>
    </div>
  );
}

function TrustCard({
  icon,
  title,
  detail,
  status,
}: {
  icon: string;
  title: string;
  detail: string;
  status: string;
}) {
  return (
    <div className="trust-card">
      <div className="trust-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{detail}</p>
      <span className="trust-card-status">{status}</span>
    </div>
  );
}

function ModalShell({
  eyebrow,
  title,
  onClose,
  children,
  wide = false,
}: {
  eyebrow?: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className={`modal ${wide ? "modal-wide" : ""}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h3>{title}</h3>
          </div>

          <button
            className="circle-button small"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}