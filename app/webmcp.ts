"use client";

export type NodeKind =
  | "goal"
  | "constraint"
  | "value"
  | "unknown"
  | "context"
  | "decision"
  | "action"
  | "output";

export type NodeStatus = "active" | "resolved" | "open" | "blocked";

export type IntentNode = {
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

export type IntentSnapshot = {
  id: string;
  label: string;
  createdAt: number;
  text: string;
  nodes: IntentNode[];
  activeNodeId: string | null;
  attention: string[];
  tensions: IntentTension[];
};

export type IntentTension = {
  id: string;
  title: string;
  detail: string;
  nodeIds: string[];
  severity: "low" | "medium" | "high";
  status: "open" | "resolved";
  createdAt: number;
};

export type IntentHistoryEntry = {
  id: string;
  type:
    | "intent"
    | "node"
    | "attention"
    | "tension"
    | "evolution"
    | "snapshot"
    | "restore"
    | "fork"
    | "merge"
    | "proposal";
  title: string;
  detail: string;
  actor: "human" | "agent" | "system";
  createdAt: number;
};

export type IntentEdgeType =
  | "supports"
  | "constrains"
  | "informs"
  | "depends_on"
  | "produces"
  | "conflicts"
  | "derived_from"
  | "references";

export type IntentEdge = {
  id: string;
  from: string;
  to: string;
  type: IntentEdgeType;
  confidence: number;
  createdAt: number;
};

export type IntentGraphObjectType =
  | "intent"
  | "node"
  | "file"
  | "decision"
  | "action"
  | "output"
  | "source";

export type IntentGraphObject = {
  id: string;
  type: IntentGraphObjectType;
  label: string;
  detail: string;
};

export type IntentProposal = {
  id: string;
  type:
    | "clarification"
    | "evolution"
    | "contradiction"
    | "action"
    | "context";
  title: string;
  explanation: string;
  proposedChange: string;
  confidence: number;
  requiresHumanDecision: boolean;
  createdAt: number;
  status: "pending" | "accepted" | "rejected";
  changes?: {
    intent?: string;
    addNodes?: IntentNode[];
    resolveNodeIds?: string[];
  };
};

export type IntentState = {
  text: string;
  nodes: IntentNode[];
  activeNodeId: string | null;
  attention: string[];
  tensions: IntentTension[];
  history: IntentHistoryEntry[];
  snapshots: IntentSnapshot[];
  proposals: IntentProposal[];
  edges: IntentEdge[];
  version: number;
  updatedAt: number;
};

export type IntentSubscriber = (state: IntentState) => void;

const STORAGE_KEY = "intent-engine-state-v3";

let listeners = new Set<IntentSubscriber>();

let state: IntentState = {
  text: "",
  nodes: [],
  activeNodeId: null,
  attention: [],
  tensions: [],
  history: [],
  snapshots: [],
  proposals: [],
  edges: [],
  version: 0,
  updatedAt: Date.now(),
};

let hydrated = false;

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now()
    .toString(36)
    .slice(-6)}`;
}

function now() {
  return Date.now();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function emit() {
  state = {
    ...state,
    updatedAt: now(),
  };

  persist();

  listeners.forEach((listener) => {
    try {
      listener(clone(state));
    } catch {
      // Subscriber errors must not break the shared state engine.
    }
  });
}

function persist() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Local persistence is opportunistic.
  }
}

export function hydrateIntent() {
  if (hydrated || typeof window === "undefined") return state;

  hydrated = true;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) return state;

    const parsed = JSON.parse(raw) as Partial<IntentState>;

    state = normalizeState({
      ...state,
      ...parsed,
    });
  } catch {
    state = createEmptyState();
  }

  return clone(state);
}

function normalizeState(input: IntentState): IntentState {
  return {
    text: typeof input.text === "string" ? input.text : "",
    nodes: Array.isArray(input.nodes) ? input.nodes : [],
    activeNodeId:
      typeof input.activeNodeId === "string" ? input.activeNodeId : null,
    attention: Array.isArray(input.attention) ? input.attention : [],
    tensions: Array.isArray(input.tensions) ? input.tensions : [],
    history: Array.isArray(input.history) ? input.history : [],
    snapshots: Array.isArray(input.snapshots) ? input.snapshots : [],
    proposals: Array.isArray(input.proposals) ? input.proposals : [],
    edges: Array.isArray(input.edges) ? input.edges : [],
    version:
      typeof input.version === "number" && Number.isFinite(input.version)
        ? input.version
        : 0,
    updatedAt:
      typeof input.updatedAt === "number" ? input.updatedAt : Date.now(),
  };
}

function createEmptyState(): IntentState {
  return {
    text: "",
    nodes: [],
    activeNodeId: null,
    attention: [],
    tensions: [],
    history: [],
    snapshots: [],
    proposals: [],
    edges: [],
    version: 0,
    updatedAt: now(),
  };
}

function addHistory(
  type: IntentHistoryEntry["type"],
  title: string,
  detail: string,
  actor: IntentHistoryEntry["actor"],
) {
  state.history = [
    {
      id: id("history"),
      type,
      title,
      detail,
      actor,
      createdAt: now(),
    },
    ...state.history,
  ].slice(0, 250);
}

function addEdge(
  from: string,
  to: string,
  type: IntentEdgeType,
  confidence = 0.8,
) {
  if (!from || !to || from === to) return null;

  const exists = state.edges.some(
    (edge) =>
      edge.from === from &&
      edge.to === to &&
      edge.type === type,
  );

  if (exists) return null;

  const edge: IntentEdge = {
    id: id("edge"),
    from,
    to,
    type,
    confidence,
    createdAt: now(),
  };

  state.edges = [...state.edges, edge];

  return edge;
}

function inferEdgeType(
  from: IntentNode,
  to: IntentNode,
): IntentEdgeType {
  if (to.kind === "constraint") return "constrains";
  if (to.kind === "unknown") return "conflicts";
  if (to.kind === "context") return "informs";
  if (to.kind === "decision") return "depends_on";
  if (to.kind === "action") return "produces";
  if (to.kind === "output") return "produces";
  if (from.kind === "value") return "supports";

  return "supports";
}

export function subscribeIntent(listener: IntentSubscriber) {
  hydrateIntent();

  listeners.add(listener);

  listener(clone(state));

  return () => {
    listeners.delete(listener);
  };
}

export function getIntentState() {
  hydrateIntent();
  return clone(state);
}

export function resetIntentState() {
  state = createEmptyState();

  addHistory(
    "intent",
    "Intent space reset",
    "The local intent space returned to a clean state.",
    "system",
  );

  state.version += 1;
  emit();

  return clone(state);
}

export function setIntent(
  text: string,
  actor: "human" | "agent" | "system" = "human",
) {
  hydrateIntent();

  const nextText = text.trim();

  if (!nextText) {
    return {
      ok: false,
      reason: "Intent cannot be empty.",
    };
  }

  const previous = state.text;

  state.text = nextText;
  state.version += 1;

  addHistory(
    "intent",
    "Intent updated",
    previous
      ? `Intent changed from "${previous}" to "${nextText}".`
      : "The first living intent was established.",
    actor,
  );

  rebuildRelationships();

  emit();

  return {
    ok: true,
    previous,
    current: nextText,
    version: state.version,
  };
}

export function addIntentNode(
  node:
    | Omit<IntentNode, "id" | "createdAt" | "status" | "confidence">
    | {
        kind: NodeKind;
        title: string;
        detail: string;
        status?: NodeStatus;
        confidence?: number;
        source?: string;
        relatedTo?: string[];
      },
  options: {
    actor?: "human" | "agent" | "system";
    confidence?: number;
    source?: string;
  } = {},
) {
  hydrateIntent();

  const created: IntentNode = {
    id: id(node.kind),
    kind: node.kind,
    title: node.title.trim(),
    detail: node.detail.trim(),
    status:
      "status" in node && node.status
        ? node.status
        : node.kind === "unknown"
          ? "open"
          : "active",
    confidence: clampConfidence(
      options.confidence ??
        ("confidence" in node && typeof node.confidence === "number"
          ? node.confidence
          : 0.82),
    ),
    createdAt: now(),
    source:
      options.source ??
      ("source" in node ? node.source : undefined) ??
      options.actor ??
      "human",
    relatedTo:
      "relatedTo" in node && Array.isArray(node.relatedTo)
        ? node.relatedTo
        : [],
  };

  state.nodes = [created, ...state.nodes];
  state.activeNodeId = created.id;
  state.version += 1;

  const actor = options.actor ?? "human";

  addHistory(
    "node",
    `${prettyKind(created.kind)} added`,
    created.title,
    actor,
  );

  const existingIntentNode = state.nodes.find(
    (item) => item.id !== created.id && item.kind === "goal",
  );

  if (existingIntentNode) {
    addEdge(
      existingIntentNode.id,
      created.id,
      inferEdgeType(existingIntentNode, created),
      0.79,
    );
  }

  created.relatedTo?.forEach((relatedId) => {
    const related = state.nodes.find((item) => item.id === relatedId);

    if (related) {
      addEdge(
        related.id,
        created.id,
        inferEdgeType(related, created),
        0.84,
      );
    }
  });

  emit();

  return {
    ok: true,
    node: clone(created),
  };
}

export function updateIntentNode(
  nodeId: string,
  patch: Partial<
    Pick<
      IntentNode,
      "title" | "detail" | "status" | "confidence" | "source"
    >
  >,
  actor: "human" | "agent" | "system" = "human",
) {
  hydrateIntent();

  const index = state.nodes.findIndex((node) => node.id === nodeId);

  if (index === -1) {
    return {
      ok: false,
      reason: "Node not found.",
    };
  }

  const before = state.nodes[index];

  const updated: IntentNode = {
    ...before,
    ...patch,
    confidence:
      patch.confidence === undefined
        ? before.confidence
        : clampConfidence(patch.confidence),
  };

  state.nodes = [...state.nodes];
  state.nodes[index] = updated;

  state.version += 1;

  addHistory(
    "node",
    "Intent point updated",
    updated.title,
    actor,
  );

  emit();

  return {
    ok: true,
    before: clone(before),
    node: clone(updated),
  };
}

export function resolveIntentNode(
  nodeId: string,
  actor: "human" | "agent" | "system" = "human",
) {
  return updateIntentNode(
    nodeId,
    {
      status: "resolved",
    },
    actor,
  );
}

export function removeIntentNode(
  nodeId: string,
  actor: "human" | "agent" | "system" = "human",
) {
  hydrateIntent();

  const node = state.nodes.find((item) => item.id === nodeId);

  if (!node) {
    return {
      ok: false,
      reason: "Node not found.",
    };
  }

  state.nodes = state.nodes.filter((item) => item.id !== nodeId);
  state.edges = state.edges.filter(
    (edge) => edge.from !== nodeId && edge.to !== nodeId,
  );
  state.attention = state.attention.filter(
    (item) => item !== nodeId,
  );
  state.tensions = state.tensions.map((tension) => ({
    ...tension,
    nodeIds: tension.nodeIds.filter((idValue) => idValue !== nodeId),
  }));

  if (state.activeNodeId === nodeId) {
    state.activeNodeId = state.nodes[0]?.id ?? null;
  }

  state.version += 1;

  addHistory(
    "node",
    "Intent point removed",
    node.title,
    actor,
  );

  emit();

  return {
    ok: true,
    removed: clone(node),
  };
}

export function focusAttention(nodeId: string) {
  hydrateIntent();

  const node = state.nodes.find((item) => item.id === nodeId);

  if (!node) {
    return {
      ok: false,
      reason: "Node not found.",
    };
  }

  state.activeNodeId = nodeId;
  state.attention = [
    nodeId,
    ...state.attention.filter((item) => item !== nodeId),
  ].slice(0, 12);

  addHistory(
    "attention",
    "Attention focused",
    `Focused on "${node.title}".`,
    "agent",
  );

  state.version += 1;
  emit();

  return {
    ok: true,
    focused: clone(node),
  };
}

export function clearAttention(nodeId?: string) {
  hydrateIntent();

  if (nodeId) {
    state.attention = state.attention.filter(
      (item) => item !== nodeId,
    );

    if (state.activeNodeId === nodeId) {
      state.activeNodeId = state.attention[0] ?? null;
    }
  } else {
    state.attention = [];
  }

  state.version += 1;
  emit();

  return {
    ok: true,
    attention: [...state.attention],
  };
}

export function surfaceContradiction(
  title: string,
  detail: string,
  nodeIds: string[] = [],
  severity: IntentTension["severity"] = "medium",
) {
  hydrateIntent();

  const tension: IntentTension = {
    id: id("tension"),
    title: title.trim(),
    detail: detail.trim(),
    nodeIds: [...new Set(nodeIds)],
    severity,
    status: "open",
    createdAt: now(),
  };

  state.tensions = [tension, ...state.tensions];

  tension.nodeIds.forEach((nodeId) => {
    const node = state.nodes.find((item) => item.id === nodeId);

    if (node) {
      state.edges = [
        ...state.edges,
        {
          id: id("edge"),
          from: tension.id,
          to: node.id,
          type: "conflicts",
          confidence: 0.77,
          createdAt: now(),
        },
      ];
    }
  });

  addHistory(
    "tension",
    "Contradiction surfaced",
    tension.title,
    "agent",
  );

  state.version += 1;
  emit();

  return {
    ok: true,
    tension: clone(tension),
    requiresHumanDecision: true,
  };
}

export function resolveContradiction(
  tensionId: string,
  resolution?: string,
) {
  hydrateIntent();

  const index = state.tensions.findIndex(
    (tension) => tension.id === tensionId,
  );

  if (index === -1) {
    return {
      ok: false,
      reason: "Tension not found.",
    };
  }

  const tension = state.tensions[index];

  state.tensions = [...state.tensions];
  state.tensions[index] = {
    ...tension,
    status: "resolved",
  };

  if (resolution?.trim()) {
    state.history = [
      {
        id: id("history"),
        type: "tension",
        title: "Contradiction resolved",
        detail: `${tension.title}: ${resolution.trim()}`,
        actor: "human",
        createdAt: now(),
      },
      ...state.history,
    ];
  }

  state.version += 1;
  emit();

  return {
    ok: true,
    tension: clone(state.tensions[index]),
  };
}

export function evolveIntent(
  nextIntent: string,
  reason = "Intent evolved.",
) {
  hydrateIntent();

  const before = state.text.trim();
  const next = nextIntent.trim();

  if (!next) {
    return {
      ok: false,
      reason: "The evolved intent cannot be empty.",
    };
  }

  if (before === next) {
    return {
      ok: false,
      reason: "The evolved intent is identical to the current intent.",
    };
  }

  createSnapshot("Before intent evolution", false);

  state.text = next;
  state.version += 1;

  addHistory(
    "evolution",
    "Intent evolved",
    reason,
    "human",
  );

  rebuildRelationships();

  emit();

  return {
    ok: true,
    before,
    after: next,
    reason,
    version: state.version,
  };
}

export function proposeIntentEvolution(
  proposal: Omit<
    IntentProposal,
    "id" | "createdAt" | "status"
  >,
) {
  hydrateIntent();

  const created: IntentProposal = {
    ...proposal,
    id: id("proposal"),
    createdAt: now(),
    status: "pending",
    confidence: clampConfidence(proposal.confidence),
    requiresHumanDecision:
      proposal.requiresHumanDecision !== false,
  };

  state.proposals = [created, ...state.proposals].slice(0, 100);

  addHistory(
    "proposal",
    "Intent evolution proposed",
    created.title,
    "agent",
  );

  state.version += 1;
  emit();

  return {
    ok: true,
    proposal: clone(created),
    requiresHumanDecision: created.requiresHumanDecision,
  };
}

export function createAgentProposal(
  input: {
    type?: IntentProposal["type"];
    title: string;
    explanation: string;
    proposedChange: string;
    confidence?: number;
    requiresHumanDecision?: boolean;
    changes?: IntentProposal["changes"];
  },
) {
  return proposeIntentEvolution({
    type: input.type ?? "evolution",
    title: input.title,
    explanation: input.explanation,
    proposedChange: input.proposedChange,
    confidence: input.confidence ?? 0.8,
    requiresHumanDecision: input.requiresHumanDecision ?? true,
    changes: input.changes,
  });
}

export function acceptAgentProposal(proposalId: string) {
  hydrateIntent();

  const index = state.proposals.findIndex(
    (proposal) => proposal.id === proposalId,
  );

  if (index === -1) {
    return {
      ok: false,
      reason: "Proposal not found.",
    };
  }

  const proposal = state.proposals[index];

  if (proposal.status !== "pending") {
    return {
      ok: false,
      reason: `Proposal is already ${proposal.status}.`,
    };
  }

  createSnapshot("Before accepting agent proposal", false);

  const changes = proposal.changes;

  if (changes?.intent) {
    state.text = changes.intent.trim();
  }

  if (changes?.addNodes?.length) {
    for (const incoming of changes.addNodes) {
      const created: IntentNode = {
        ...incoming,
        id: incoming.id || id(incoming.kind),
        createdAt: incoming.createdAt || now(),
      };

      state.nodes = [
        created,
        ...state.nodes.filter((node) => node.id !== created.id),
      ];
    }
  }

  if (changes?.resolveNodeIds?.length) {
    state.nodes = state.nodes.map((node) =>
      changes.resolveNodeIds?.includes(node.id)
        ? {
            ...node,
            status: "resolved",
          }
        : node,
    );
  }

  state.proposals = [...state.proposals];
  state.proposals[index] = {
    ...proposal,
    status: "accepted",
  };

  addHistory(
    "proposal",
    "Agent proposal accepted",
    proposal.title,
    "human",
  );

  state.version += 1;

  rebuildRelationships();
  emit();

  return {
    ok: true,
    proposal: clone(state.proposals[index]),
    state: clone(state),
  };
}

export function rejectAgentProposal(proposalId: string) {
  hydrateIntent();

  const index = state.proposals.findIndex(
    (proposal) => proposal.id === proposalId,
  );

  if (index === -1) {
    return {
      ok: false,
      reason: "Proposal not found.",
    };
  }

  const proposal = state.proposals[index];

  if (proposal.status !== "pending") {
    return {
      ok: false,
      reason: `Proposal is already ${proposal.status}.`,
    };
  }

  state.proposals = [...state.proposals];
  state.proposals[index] = {
    ...proposal,
    status: "rejected",
  };

  addHistory(
    "proposal",
    "Agent proposal declined",
    proposal.title,
    "human",
  );

  state.version += 1;
  emit();

  return {
    ok: true,
    proposal: clone(state.proposals[index]),
  };
}

export function createSnapshot(
  label = "Checkpoint",
  emitState = true,
): IntentSnapshot {
  hydrateIntent();

  const snapshot: IntentSnapshot = {
    id: id("snapshot"),
    label: label.trim() || "Checkpoint",
    createdAt: now(),
    text: state.text,
    nodes: clone(state.nodes),
    activeNodeId: state.activeNodeId,
    attention: [...state.attention],
    tensions: clone(state.tensions),
  };

  state.snapshots = [snapshot, ...state.snapshots].slice(0, 40);

  addHistory(
    "snapshot",
    "Intent remembered",
    snapshot.label,
    "human",
  );

  state.version += 1;

  if (emitState) {
    emit();
  } else {
    persist();
  }

  return clone(snapshot);
}

export function restoreSnapshot(snapshotId: string) {
  hydrateIntent();

  const snapshot = state.snapshots.find(
    (item) => item.id === snapshotId,
  );

  if (!snapshot) {
    return {
      ok: false,
      reason: "Snapshot not found.",
    };
  }

  state.text = snapshot.text;
  state.nodes = clone(snapshot.nodes);
  state.activeNodeId = snapshot.activeNodeId;
  state.attention = [...snapshot.attention];
  state.tensions = clone(snapshot.tensions);

  addHistory(
    "restore",
    "Intent restored",
    snapshot.label,
    "human",
  );

  rebuildRelationships();

  state.version += 1;
  emit();

  return {
    ok: true,
    snapshot: clone(snapshot),
    state: clone(state),
  };
}

export function forkIntent(
  label = "New possibility",
): IntentSnapshot {
  hydrateIntent();

  const snapshot: IntentSnapshot = {
    id: id("fork"),
    label: label.trim() || "New possibility",
    createdAt: now(),
    text: state.text,
    nodes: clone(state.nodes),
    activeNodeId: state.activeNodeId,
    attention: [...state.attention],
    tensions: clone(state.tensions),
  };

  state.snapshots = [snapshot, ...state.snapshots].slice(0, 40);

  addHistory(
    "fork",
    "Intent branch created",
    snapshot.label,
    "human",
  );

  state.version += 1;
  emit();

  return clone(snapshot);
}

export function mergeFork(
  snapshotId: string,
  options: {
    mergeText?: boolean;
    mergeNodes?: boolean;
    mergeTensions?: boolean;
  } = {},
) {
  hydrateIntent();

  const snapshot = state.snapshots.find(
    (item) => item.id === snapshotId,
  );

  if (!snapshot) {
    return {
      ok: false,
      reason: "Fork or snapshot not found.",
    };
  }

  createSnapshot("Before merge", false);

  if (options.mergeText) {
    state.text = snapshot.text;
  }

  if (options.mergeNodes) {
    const existing = new Map(
      state.nodes.map((node) => [node.id, node]),
    );

    snapshot.nodes.forEach((node) => {
      existing.set(node.id, node);
    });

    state.nodes = [...existing.values()];
  }

  if (options.mergeTensions) {
    const existing = new Map(
      state.tensions.map((tension) => [tension.id, tension]),
    );

    snapshot.tensions.forEach((tension) => {
      existing.set(tension.id, tension);
    });

    state.tensions = [...existing.values()];
  }

  addHistory(
    "merge",
    "Intent branch merged",
    snapshot.label,
    "human",
  );

  rebuildRelationships();

  state.version += 1;
  emit();

  return {
    ok: true,
    mergedFrom: snapshot.label,
    state: clone(state),
  };
}

export function getIntentDiff(
  left: IntentSnapshot | IntentState,
  right: IntentSnapshot | IntentState,
) {
  const leftNodes = new Map(left.nodes.map((node) => [node.id, node]));
  const rightNodes = new Map(
    right.nodes.map((node) => [node.id, node]),
  );

  const added = right.nodes.filter((node) => !leftNodes.has(node.id));
  const removed = left.nodes.filter((node) => !rightNodes.has(node.id));

  const changed = right.nodes.filter((node) => {
    const previous = leftNodes.get(node.id);

    if (!previous) return false;

    return (
      previous.title !== node.title ||
      previous.detail !== node.detail ||
      previous.status !== node.status ||
      Math.abs(previous.confidence - node.confidence) > 0.001
    );
  });

  return {
    textChanged: left.text !== right.text,
    previousText: left.text,
    nextText: right.text,
    added: clone(added),
    removed: clone(removed),
    changed: clone(changed),
    addedCount: added.length,
    removedCount: removed.length,
    changedCount: changed.length,
  };
}

export function compressIntent() {
  hydrateIntent();

  const goals = state.nodes.filter((node) => node.kind === "goal");
  const constraints = state.nodes.filter(
    (node) => node.kind === "constraint",
  );
  const values = state.nodes.filter(
    (node) => node.kind === "value",
  );
  const unknowns = state.nodes.filter(
    (node) => node.kind === "unknown" && node.status === "open",
  );

  return {
    intent: state.text,
    goals: goals.map((node) => node.title),
    constraints: constraints.map((node) => node.title),
    values: values.map((node) => node.title),
    unresolved: unknowns.map((node) => node.title),
    openTensions: state.tensions
      .filter((tension) => tension.status === "open")
      .map((tension) => tension.title),
    summary: buildIntentSummary(),
  };
}

export function counterfactualLens(
  proposedChange: string,
) {
  hydrateIntent();

  const change = proposedChange.trim();

  const constraints = state.nodes
    .filter((node) => node.kind === "constraint")
    .map((node) => node.title);

  const values = state.nodes
    .filter((node) => node.kind === "value")
    .map((node) => node.title);

  const unknowns = state.nodes
    .filter(
      (node) =>
        node.kind === "unknown" && node.status === "open",
    )
    .map((node) => node.title);

  return {
    proposal: change,
    likelyBenefits: [
      "Creates another possibility without overwriting the current intent.",
      "Makes tradeoffs easier to inspect before action.",
    ],
    watchFor: [
      ...constraints.slice(0, 3),
      ...values.slice(0, 2),
      ...state.tensions
        .filter((tension) => tension.status === "open")
        .slice(0, 3)
        .map((tension) => tension.title),
    ],
    unresolvedQuestions: unknowns.slice(0, 5),
    recommendation:
      unknowns.length > 0
        ? "Resolve or intentionally accept the remaining unknowns before making the change irreversible."
        : "Explore the change as a branch first, then decide.",
    requiresHumanDecision: true,
  };
}

export function intentDNA() {
  hydrateIntent();

  const counts = state.nodes.reduce<Record<NodeKind, number>>(
    (accumulator, node) => {
      accumulator[node.kind] += 1;
      return accumulator;
    },
    {
      goal: 0,
      constraint: 0,
      value: 0,
      unknown: 0,
      context: 0,
      decision: 0,
      action: 0,
      output: 0,
    },
  );

  const avgConfidence =
    state.nodes.length > 0
      ? state.nodes.reduce((sum, node) => sum + node.confidence, 0) /
        state.nodes.length
      : 0;

  return {
    counts,
    averageConfidence: Number(avgConfidence.toFixed(2)),
    version: state.version,
    intentLength: state.text.length,
    openTensionCount: state.tensions.filter(
      (tension) => tension.status === "open",
    ).length,
    unresolvedNodeCount: state.nodes.filter(
      (node) => node.status === "open",
    ).length,
    relationshipCount: state.edges.length,
    snapshotCount: state.snapshots.length,
  };
}

export function searchIntent(query: string) {
  hydrateIntent();

  const needle = query.trim().toLowerCase();

  if (!needle) {
    return [];
  }

  const results: Array<{
    id: string;
    type: "intent" | "node" | "tension" | "history" | "proposal";
    title: string;
    detail: string;
    score: number;
  }> = [];

  if (state.text.toLowerCase().includes(needle)) {
    results.push({
      id: "intent",
      type: "intent",
      title: "Current intent",
      detail: state.text,
      score: 1,
    });
  }

  state.nodes.forEach((node) => {
    const titleMatch = node.title
      .toLowerCase()
      .includes(needle);

    const detailMatch = node.detail
      .toLowerCase()
      .includes(needle);

    if (titleMatch || detailMatch) {
      results.push({
        id: node.id,
        type: "node",
        title: node.title,
        detail: node.detail,
        score: titleMatch ? 0.96 : 0.76,
      });
    }
  });

  state.tensions.forEach((tension) => {
    if (
      tension.title.toLowerCase().includes(needle) ||
      tension.detail.toLowerCase().includes(needle)
    ) {
      results.push({
        id: tension.id,
        type: "tension",
        title: tension.title,
        detail: tension.detail,
        score: 0.82,
      });
    }
  });

  state.history.forEach((entry) => {
    if (
      entry.title.toLowerCase().includes(needle) ||
      entry.detail.toLowerCase().includes(needle)
    ) {
      results.push({
        id: entry.id,
        type: "history",
        title: entry.title,
        detail: entry.detail,
        score: 0.6,
      });
    }
  });

  state.proposals.forEach((proposal) => {
    if (
      proposal.title.toLowerCase().includes(needle) ||
      proposal.explanation.toLowerCase().includes(needle) ||
      proposal.proposedChange.toLowerCase().includes(needle)
    ) {
      results.push({
        id: proposal.id,
        type: "proposal",
        title: proposal.title,
        detail: proposal.explanation,
        score: 0.7,
      });
    }
  });

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 40)
    .map((result) => clone(result));
}

export function getGraph() {
  hydrateIntent();

  const objects: IntentGraphObject[] = [
    {
      id: "intent",
      type: "intent",
      label: "Intent",
      detail: state.text,
    },
  ];

  state.nodes.forEach((node) => {
    objects.push({
      id: node.id,
      type: "node",
      label: node.title,
      detail: node.detail,
    });
  });

  return {
    objects,
    edges: clone(state.edges),
    version: state.version,
  };
}

export function getRelatedObjects(objectId: string) {
  hydrateIntent();

  const edges = state.edges.filter(
    (edge) => edge.from === objectId || edge.to === objectId,
  );

  const relatedIds = new Set<string>();

  edges.forEach((edge) => {
    relatedIds.add(edge.from === objectId ? edge.to : edge.from);
  });

  const nodes = state.nodes.filter((node) =>
    relatedIds.has(node.id),
  );

  return {
    edges: clone(edges),
    nodes: clone(nodes),
  };
}

export function rebuildRelationships() {
  const meaningfulNodes = state.nodes.filter(
    (node) => node.status !== "blocked",
  );

  const existingEdges: IntentEdge[] = [];

  meaningfulNodes.forEach((node) => {
    if (
      state.activeNodeId &&
      state.activeNodeId !== node.id
    ) {
      const active = meaningfulNodes.find(
        (item) => item.id === state.activeNodeId,
      );

      if (active) {
        const type = inferEdgeType(active, node);

        if (shouldRelate(active, node)) {
          existingEdges.push({
            id: id("edge"),
            from: active.id,
            to: node.id,
            type,
            confidence: relationshipConfidence(active, node),
            createdAt: now(),
          });
        }
      }
    }
  });

  for (let i = 0; i < meaningfulNodes.length; i += 1) {
    for (let j = i + 1; j < meaningfulNodes.length; j += 1) {
      const left = meaningfulNodes[i];
      const right = meaningfulNodes[j];

      if (!shouldRelate(left, right)) continue;

      const type = inferRelationship(left, right);

      existingEdges.push({
        id: id("edge"),
        from: left.id,
        to: right.id,
        type,
        confidence: relationshipConfidence(left, right),
        createdAt: now(),
      });
    }
  }

  const unique = new Map<string, IntentEdge>();

  existingEdges.forEach((edge) => {
    const key = `${edge.from}|${edge.to}|${edge.type}`;

    if (!unique.has(key)) {
      unique.set(key, edge);
    }
  });

  state.edges = [...unique.values()].slice(0, 400);

  return clone(state.edges);
}

function shouldRelate(left: IntentNode, right: IntentNode) {
  if (left.id === right.id) return false;

  if (
    left.kind === "goal" ||
    right.kind === "goal"
  ) {
    return true;
  }

  if (
    left.kind === "constraint" ||
    right.kind === "constraint"
  ) {
    return true;
  }

  if (
    left.kind === "value" &&
    (right.kind === "decision" ||
      right.kind === "goal")
  ) {
    return true;
  }

  if (
    left.kind === "unknown" ||
    right.kind === "unknown"
  ) {
    return true;
  }

  if (
    left.kind === "context" ||
    right.kind === "context"
  ) {
    return true;
  }

  return (
    left.kind === "decision" &&
    right.kind === "action"
  );
}

function inferRelationship(
  left: IntentNode,
  right: IntentNode,
): IntentEdgeType {
  if (
    left.kind === "unknown" ||
    right.kind === "unknown"
  ) {
    return "conflicts";
  }

  if (left.kind === "constraint") {
    return "constrains";
  }

  if (right.kind === "constraint") {
    return "constrains";
  }

  if (left.kind === "context" || right.kind === "context") {
    return "informs";
  }

  if (left.kind === "decision" && right.kind === "action") {
    return "depends_on";
  }

  if (left.kind === "action" && right.kind === "output") {
    return "produces";
  }

  if (left.kind === "value" || right.kind === "value") {
    return "supports";
  }

  return "derived_from";
}

function relationshipConfidence(
  left: IntentNode,
  right: IntentNode,
) {
  let score = (left.confidence + right.confidence) / 2;

  if (
    left.kind === "goal" ||
    right.kind === "goal"
  ) {
    score += 0.08;
  }

  if (
    left.kind === "unknown" ||
    right.kind === "unknown"
  ) {
    score -= 0.1;
  }

  return clampConfidence(score);
}

function buildIntentSummary() {
  if (!state.text) {
    return "No living intent has been established yet.";
  }

  const goals = state.nodes
    .filter((node) => node.kind === "goal")
    .slice(0, 3)
    .map((node) => node.title);

  const constraints = state.nodes
    .filter((node) => node.kind === "constraint")
    .slice(0, 3)
    .map((node) => node.title);

  const unknowns = state.nodes
    .filter(
      (node) =>
        node.kind === "unknown" && node.status === "open",
    )
    .slice(0, 3)
    .map((node) => node.title);

  const sections = [
    `Intent: ${state.text}`,
    goals.length
      ? `Goals: ${goals.join(", ")}`
      : "Goals: not yet explicit.",
    constraints.length
      ? `Constraints: ${constraints.join(", ")}`
      : "Constraints: not yet explicit.",
    unknowns.length
      ? `Open questions: ${unknowns.join(", ")}`
      : "Open questions: none explicitly marked.",
  ];

  return sections.join(" ");
}

function prettyKind(kind: NodeKind) {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

/* -------------------------------------------------------------------------- */
/* WebMCP                                                                        */
/* -------------------------------------------------------------------------- */

type ModelContextToolConfig = {
  description: string;
  inputSchema?: Record<string, unknown>;
  execute: (
    args?: Record<string, unknown>,
    context?: unknown,
  ) => Promise<unknown> | unknown;
};

type ModelContextLike = {
  registerTool?: (
    name: string,
    config: ModelContextToolConfig,
  ) => void | (() => void);
};

type DocumentWithModelContext = Document & {
  modelContext?: ModelContextLike;
};

let webMCPAbortController: AbortController | null = null;
let webMCPCleanups: Array<() => void> = [];
let webMCPRegistered = false;

function getModelContext(): ModelContextLike | null {
  if (typeof document === "undefined") {
    return null;
  }

  const modelContext = (
    document as DocumentWithModelContext
  ).modelContext;

  if (!modelContext?.registerTool) {
    return null;
  }

  return modelContext;
}

function toolResult(
  ok: boolean,
  extra: Record<string, unknown> = {},
) {
  return {
    ok,
    ...extra,
    timestamp: new Date().toISOString(),
    stateVersion: state.version,
  };
}

export function registerIntentTools() {
  const modelContext = getModelContext();

  if (!modelContext?.registerTool) {
    return {
      ok: false,
      registered: false,
      reason: "WebMCP modelContext is not available in this browser.",
      tools: [],
    };
  }

  unregisterIntentTools();

  webMCPAbortController = new AbortController();
  webMCPCleanups = [];

  const register = (
    name: string,
    config: ModelContextToolConfig,
  ) => {
    if (!modelContext.registerTool) return;

    try {
      const cleanup = modelContext.registerTool(name, config);

      if (typeof cleanup === "function") {
        webMCPCleanups.push(cleanup);
      }
    } catch {
      // The tool remains unavailable rather than breaking the application.
    }
  };

  register("inspect_intent", {
    description:
      "Inspect the current INTENT state. Returns the living intent, intent nodes, unresolved questions, tensions, relationships, proposals, history summary and safe-to-share context.",
    inputSchema: {
      type: "object",
      properties: {
        includeHistory: {
          type: "boolean",
          description:
            "Whether to include recent human-readable history.",
        },
        includeGraph: {
          type: "boolean",
          description:
            "Whether to include intent relationships.",
        },
      },
    },
    execute: async (args = {}) => {
      hydrateIntent();

      const includeHistory = args.includeHistory !== false;
      const includeGraph = args.includeGraph !== false;

      return toolResult(true, {
        intent: state.text,
        nodes: clone(state.nodes),
        tensions: clone(state.tensions),
        activeNodeId: state.activeNodeId,
        attention: [...state.attention],
        proposals: clone(
          state.proposals.filter(
            (proposal) => proposal.status === "pending",
          ),
        ),
        summary: buildIntentSummary(),
        dna: intentDNA(),
        history: includeHistory
          ? clone(state.history.slice(0, 30))
          : undefined,
        graph: includeGraph
          ? {
              edges: clone(state.edges),
              version: state.version,
            }
          : undefined,
      });
    },
  });

  register("add_intent_node", {
    description:
      "Add an intent-native object to INTENT. Valid kinds are goal, constraint, value, unknown, context, decision, action and output. Adding the object changes shared intent state and becomes visible to the human.",
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
        title: {
          type: "string",
          description: "A concise human-readable title.",
        },
        detail: {
          type: "string",
          description:
            "Why this point matters to the current intent.",
        },
        confidence: {
          type: "number",
          minimum: 0,
          maximum: 1,
        },
      },
      required: ["kind", "title", "detail"],
    },
    execute: async (args = {}) => {
      const kind = String(args.kind) as NodeKind;
      const title = String(args.title ?? "").trim();
      const detail = String(args.detail ?? "").trim();

      const validKinds: NodeKind[] = [
        "goal",
        "constraint",
        "value",
        "unknown",
        "context",
        "decision",
        "action",
        "output",
      ];

      if (!validKinds.includes(kind)) {
        return toolResult(false, {
          reason: "Invalid node kind.",
          validKinds,
        });
      }

      if (!title || !detail) {
        return toolResult(false, {
          reason: "title and detail are required.",
        });
      }

      const result = addIntentNode(
        {
          kind,
          title,
          detail,
          source: "WebMCP agent",
        },
        {
          actor: "agent",
          confidence:
            typeof args.confidence === "number"
              ? args.confidence
              : 0.82,
          source: "WebMCP agent",
        },
      );

      return toolResult(Boolean(result.ok), {
        node: result.node,
        requiresHumanDecision:
          kind === "decision" || kind === "constraint",
      });
    },
  });

  register("focus_attention", {
    description:
      "Focus the human's attention on a specific existing intent point without changing its meaning. Useful when the agent identifies something that deserves inspection.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: {
          type: "string",
        },
        query: {
          type: "string",
          description:
            "Optional title query when a node ID is not known.",
        },
      },
    },
    execute: async (args = {}) => {
      hydrateIntent();

      let nodeId =
        typeof args.nodeId === "string"
          ? args.nodeId
          : "";

      if (!nodeId && typeof args.query === "string") {
        const query = args.query.toLowerCase();

        const match = state.nodes.find(
          (node) =>
            node.title.toLowerCase().includes(query) ||
            node.detail.toLowerCase().includes(query),
        );

        nodeId = match?.id ?? "";
      }

      if (!nodeId) {
        return toolResult(false, {
          reason: "No matching intent point was found.",
        });
      }

      const result = focusAttention(nodeId);

      return toolResult(Boolean(result.ok), {
        focused: result.focused,
        state: result.ok ? clone(state) : undefined,
      });
    },
  });

  register("surface_contradiction", {
    description:
      "Surface a possible conflict, contradiction or tradeoff in the living intent. The tool must not silently resolve the tension. It creates an explicit human-review point.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
        },
        detail: {
          type: "string",
        },
        nodeIds: {
          type: "array",
          items: {
            type: "string",
          },
        },
        severity: {
          type: "string",
          enum: ["low", "medium", "high"],
        },
      },
      required: ["title", "detail"],
    },
    execute: async (args = {}) => {
      const title = String(args.title ?? "").trim();
      const detail = String(args.detail ?? "").trim();

      if (!title || !detail) {
        return toolResult(false, {
          reason: "title and detail are required.",
        });
      }

      const nodeIds = Array.isArray(args.nodeIds)
        ? args.nodeIds.map(String)
        : [];

      const allowedSeverity: IntentTension["severity"][] = [
        "low",
        "medium",
        "high",
      ];

      const severity = allowedSeverity.includes(
        args.severity as IntentTension["severity"],
      )
        ? (args.severity as IntentTension["severity"])
        : "medium";

      const result = surfaceContradiction(
        title,
        detail,
        nodeIds,
        severity,
      );

      return toolResult(Boolean(result.ok), {
        tension: result.tension,
        requiresHumanDecision: true,
        message:
          "The contradiction was surfaced but not resolved.",
      });
    },
  });

  register("propose_intent_evolution", {
    description:
      "Propose a meaningful evolution of the living intent. Material changes must remain visible to the human and require explicit human approval rather than being silently applied.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
        },
        explanation: {
          type: "string",
        },
        proposedChange: {
          type: "string",
        },
        confidence: {
          type: "number",
          minimum: 0,
          maximum: 1,
        },
        type: {
          type: "string",
          enum: [
            "clarification",
            "evolution",
            "contradiction",
            "action",
            "context",
          ],
        },
        nextIntent: {
          type: "string",
          description:
            "Optional candidate next version of the intent. It is proposed, not automatically applied.",
        },
      },
      required: ["title", "explanation", "proposedChange"],
    },
    execute: async (args = {}) => {
      const proposal = createAgentProposal({
        type:
          typeof args.type === "string"
            ? (args.type as IntentProposal["type"])
            : "evolution",
        title: String(args.title ?? ""),
        explanation: String(args.explanation ?? ""),
        proposedChange: String(args.proposedChange ?? ""),
        confidence:
          typeof args.confidence === "number"
            ? args.confidence
            : 0.81,
        requiresHumanDecision: true,
        changes:
          typeof args.nextIntent === "string"
            ? {
                intent: args.nextIntent,
              }
            : undefined,
      });

      return toolResult(Boolean(proposal.ok), {
        proposal: proposal.proposal,
        requiresHumanDecision: true,
        applied: false,
      });
    },
  });

  register("fork_intent", {
    description:
      "Create a reversible branch of the current intent so an alternative possibility can be explored without overwriting the current state.",
    inputSchema: {
      type: "object",
      properties: {
        label: {
          type: "string",
        },
      },
      required: ["label"],
    },
    execute: async (args = {}) => {
      const label =
        typeof args.label === "string"
          ? args.label
          : "Agent exploration";

      const fork = forkIntent(label);

      return toolResult(true, {
        fork,
        currentIntent: state.text,
        requiresHumanDecision: false,
        message:
          "A reversible branch was created; the current intent was not overwritten.",
      });
    },
  });

  webMCPRegistered = true;

  return {
    ok: true,
    registered: true,
    tools: [
      "inspect_intent",
      "add_intent_node",
      "focus_attention",
      "surface_contradiction",
      "propose_intent_evolution",
      "fork_intent",
    ],
  };
}

export function unregisterIntentTools() {
  webMCPAbortController?.abort();

  webMCPCleanups.forEach((cleanup) => {
    try {
      cleanup();
    } catch {
      // Best effort.
    }
  });

  webMCPCleanups = [];
  webMCPAbortController = null;
  webMCPRegistered = false;
}

export function isWebMCPRegistered() {
  return webMCPRegistered;
}

/* -------------------------------------------------------------------------- */
/* Utility compatibility exports                                              */
/* -------------------------------------------------------------------------- */

export function addAttachments(
  attachments: Array<{
    id?: string;
    name: string;
    type?: string;
    detail?: string;
  }>,
) {
  hydrateIntent();

  const nodes = attachments.map((attachment) => ({
    kind: "context" as const,
    title: attachment.name,
    detail:
      attachment.detail ??
      `Context attached to the current intent: ${attachment.name}.`,
    confidence: 0.86,
    source: "attachment",
  }));

  const created = nodes.map((node) =>
    addIntentNode(
      node,
      {
        actor: "human",
        confidence: node.confidence,
        source: node.source,
      },
    ),
  );

  return {
    ok: true,
    added: created.map((item) => item.node),
  };
}

export function createIntentFromText(
  text: string,
) {
  const result = setIntent(text, "human");

  if (!result.ok) {
    return result;
  }

  return {
    ...result,
    state: clone(state),
  };
}

export function getOpenQuestions() {
  hydrateIntent();

  return clone(
    state.nodes.filter(
      (node) =>
        node.kind === "unknown" &&
        node.status === "open",
    ),
  );
}

export function getOpenTensions() {
  hydrateIntent();

  return clone(
    state.tensions.filter(
      (tension) => tension.status === "open",
    ),
  );
}

export function getPendingProposals() {
  hydrateIntent();

  return clone(
    state.proposals.filter(
      (proposal) => proposal.status === "pending",
    ),
  );
}

export function getHistory(limit = 50) {
  hydrateIntent();

  return clone(state.history.slice(0, Math.max(1, limit)));
}

export function getSnapshots(limit = 20) {
  hydrateIntent();

  return clone(state.snapshots.slice(0, Math.max(1, limit)));
}

export function getVersion() {
  hydrateIntent();
  return state.version;
}

export function exportIntentState() {
  hydrateIntent();

  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      version: state.version,
      state,
    },
    null,
    2,
  );
}

export function importIntentState(serialized: string) {
  try {
    const parsed = JSON.parse(serialized) as {
      state?: Partial<IntentState>;
    };

    const incoming = parsed.state ?? parsed;

    state = normalizeState({
      ...createEmptyState(),
      ...incoming,
    } as IntentState);

    rebuildRelationships();

    addHistory(
      "restore",
      "Intent state imported",
      "A previously exported INTENT state was restored.",
      "human",
    );

    state.version += 1;
    emit();

    return {
      ok: true,
      state: clone(state),
    };
  } catch {
    return {
      ok: false,
      reason: "The supplied INTENT state could not be imported.",
    };
  }
}

export const intentState = {
  get value() {
    hydrateIntent();
    return clone(state);
  },

  get text() {
    hydrateIntent();
    return state.text;
  },

  get nodes() {
    hydrateIntent();
    return clone(state.nodes);
  },

  get activeNode() {
    hydrateIntent();

    return (
      state.nodes.find(
        (node) => node.id === state.activeNodeId,
      ) ?? null
    );
  },

  get tensions() {
    hydrateIntent();
    return clone(state.tensions);
  },

  get proposals() {
    hydrateIntent();
    return clone(state.proposals);
  },

  get snapshots() {
    hydrateIntent();
    return clone(state.snapshots);
  },

  get version() {
    hydrateIntent();
    return state.version;
  },
};