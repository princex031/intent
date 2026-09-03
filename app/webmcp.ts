export type IntentNodeType =
  | "goal"
  | "constraint"
  | "value"
  | "unknown";

export type IntentNode = {
  id: string;
  type: IntentNodeType;
  label: string;
  relevance: number;
  uncertainty: number;
};

export type Activity = {
  id: string;
  action: string;
  detail: string;
  time: string;
};

export type Contradiction = {
  id: string;
  first: string;
  second: string;
  resolvedAs: string | null;
};

export type EvolutionProposal = {
  version: number;
  reason: string;
  humanApprovalRequired: boolean;
};

export type IntentFork = {
  forkId: string;
  label: string;
  sourceVersion: number;
  score: number;
  summary: string;
};

export type AgentProposal = {
  id: string;
  title: string;
  detail: string;
  type: IntentNodeType;
  accepted: boolean;
};

export type IntentSnapshot = {
  id: string;
  version: number;
  label: string;
  createdAt: string;
  text: string;
  nodes: IntentNode[];
  activeNode: string;
};

export type IntentAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
};

export type IntentState = {
  text: string;
  nodes: IntentNode[];
  activeNode: string;
  version: number;

  activities: Activity[];
  history: string[];

  contradiction: Contradiction | null;
  evolution: EvolutionProposal | null;
  forks: IntentFork[];

  assumptions: string[];
  proposals: AgentProposal[];
  snapshots: IntentSnapshot[];
  attachments: IntentAttachment[];

  pulse: number;
  clarity: number;
  uncertainty: number;
  resonance: number;
  meaningDrift: number;
  decisionDebt: number;

  lastChangedAt: string;
};

export const intentState: IntentState = {
  text: "",
  nodes: [],
  activeNode: "",
  version: 1,

  activities: [],
  history: [],

  contradiction: null,
  evolution: null,
  forks: [],

  assumptions: [],
  proposals: [],
  snapshots: [],
  attachments: [],

  pulse: 0,
  clarity: 0,
  uncertainty: 0,
  resonance: 0,
  meaningDrift: 0,
  decisionDebt: 0,

  lastChangedAt: "",
};

type Listener = () => void;

const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeIntent(listener: Listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function timeNow() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function touch(pulse = 0.8) {
  intentState.pulse = Math.min(
    1,
    Math.max(intentState.pulse * 0.68, pulse)
  );

  intentState.lastChangedAt = new Date().toISOString();
}

function recalculate() {
  const count = intentState.nodes.length;

  const uncertainty =
    count === 0
      ? 0
      : intentState.nodes.reduce(
          (sum, node) => sum + node.uncertainty,
          0
        ) / count;

  const relevance =
    count === 0
      ? 0
      : intentState.nodes.reduce(
          (sum, node) => sum + node.relevance,
          0
        ) / count;

  const goals = intentState.nodes.filter(
    (node) => node.type === "goal"
  ).length;

  const values = intentState.nodes.filter(
    (node) => node.type === "value"
  ).length;

  const constraints = intentState.nodes.filter(
    (node) => node.type === "constraint"
  ).length;

  intentState.uncertainty = uncertainty;

  intentState.clarity = Math.max(
    0,
    Math.min(
      1,
      0.55 +
        relevance * 0.2 +
        goals * 0.04 +
        values * 0.05 +
        constraints * 0.04 -
        uncertainty * 0.34
    )
  );

  intentState.resonance = Math.max(
    0,
    Math.min(
      1,
      0.32 +
        relevance * 0.28 +
        goals * 0.06 +
        values * 0.1 +
        constraints * 0.04
    )
  );

  intentState.decisionDebt = Math.min(
    1,
    (intentState.contradiction ? 0.3 : 0) +
      uncertainty * 0.32 +
      intentState.assumptions.length * 0.045
  );

  intentState.meaningDrift = Math.min(
    1,
    Math.max(
      0,
      (intentState.version - 1) * 0.075 +
        (intentState.evolution ? 0.1 : 0)
    )
  );
}

export function recordActivity(
  action: string,
  detail: string
) {
  const activity: Activity = {
    id: crypto.randomUUID(),
    action,
    detail,
    time: timeNow(),
  };

  intentState.activities = [
    activity,
    ...intentState.activities,
  ].slice(0, 20);

  touch(0.88);
  recalculate();
  notify();

  return activity;
}

export function inspectIntent() {
  recalculate();

  return {
    ...intentState,
    nodes: [...intentState.nodes],
    activities: [...intentState.activities],
    history: [...intentState.history],
    assumptions: [...intentState.assumptions],
    proposals: [...intentState.proposals],
    snapshots: [...intentState.snapshots],
    forks: [...intentState.forks],
    attachments: [...intentState.attachments],
  };
}

export function setIntent(text: string) {
  const trimmed = text.trim();

  intentState.text = trimmed;
  intentState.nodes = [];
  intentState.activeNode = "";
  intentState.version = 1;

  intentState.activities = [];
  intentState.contradiction = null;
  intentState.evolution = null;
  intentState.forks = [];
  intentState.assumptions = [];
  intentState.proposals = [];
  intentState.snapshots = [];
  intentState.attachments = [];

  intentState.pulse = 0.92;
  intentState.clarity = 0.58;
  intentState.uncertainty = 0.28;
  intentState.resonance = 0.5;
  intentState.meaningDrift = 0;
  intentState.decisionDebt = 0;

  intentState.lastChangedAt = new Date().toISOString();

  if (trimmed) {
    intentState.history = [
      trimmed,
      ...intentState.history.filter(
        (item) => item !== trimmed
      ),
    ].slice(0, 8);
  }

  notify();

  return inspectIntent();
}

export function addIntentNode(
  type: IntentNodeType,
  label: string,
  relevance = 0.7,
  track = false,
  uncertainty = 0.25
) {
  const node: IntentNode = {
    id: crypto.randomUUID(),
    type,
    label,
    relevance: Math.min(1, Math.max(0, relevance)),
    uncertainty: Math.min(1, Math.max(0, uncertainty)),
  };

  intentState.nodes = [...intentState.nodes, node];

  if (!intentState.activeNode) {
    intentState.activeNode = node.id;
  }

  touch(track ? 0.84 : 0.58);
  recalculate();

  if (track) {
    recordActivity("Intent expanded", `${type} → ${label}`);
  } else {
    notify();
  }

  return node;
}

export function focusAttention(nodeId: string) {
  const node = intentState.nodes.find(
    (item) => item.id === nodeId
  );

  if (!node) {
    return {
      success: false,
      message: "Intent node not found.",
      focusedNode: null,
    };
  }

  intentState.activeNode = nodeId;

  intentState.nodes = intentState.nodes.map((item) => {
    if (item.id === nodeId) {
      return {
        ...item,
        relevance: 1,
      };
    }

    return {
      ...item,
      relevance: Math.max(0.18, item.relevance * 0.82),
    };
  });

  touch(1);
  recalculate();

  recordActivity("Gravity shifted", `Focus → ${node.label}`);

  return {
    success: true,
    focusedNode: {
      ...node,
      relevance: 1,
    },
  };
}

export function surfaceContradiction(
  first: string,
  second: string
) {
  const contradiction: Contradiction = {
    id: crypto.randomUUID(),
    first,
    second,
    resolvedAs: null,
  };

  intentState.contradiction = contradiction;

  touch(0.97);
  recalculate();

  recordActivity(
    "Friction surfaced",
    `${first} ↔ ${second}`
  );

  return {
    type: "friction",
    ...contradiction,
  };
}

export function resolveContradiction(
  choice: "first" | "second"
) {
  if (!intentState.contradiction) {
    return {
      success: false,
      message: "No active friction.",
    };
  }

  const selected =
    choice === "first"
      ? intentState.contradiction.first
      : intentState.contradiction.second;

  intentState.contradiction = {
    ...intentState.contradiction,
    resolvedAs: selected,
  };

  touch(0.91);
  recalculate();

  recordActivity(
    "Tradeoff resolved",
    `Priority → ${selected}`
  );

  return {
    success: true,
    selected,
  };
}

export function evolveIntent(reason: string) {
  intentState.version += 1;

  const evolution: EvolutionProposal = {
    version: intentState.version,
    reason,
    humanApprovalRequired: true,
  };

  intentState.evolution = evolution;

  touch(0.93);
  recalculate();

  recordActivity(
    "Intent shifted",
    `Version ${evolution.version} proposed`
  );

  return evolution;
}

export function forkIntent(label: string) {
  const score =
    Math.round(
      Math.min(
        1,
        Math.max(
          0,
          0.5 +
            intentState.resonance * 0.25 -
            intentState.uncertainty * 0.1
        )
      ) * 100
    ) / 100;

  const fork: IntentFork = {
    forkId: crypto.randomUUID(),
    label,
    sourceVersion: intentState.version,
    score,
    summary:
      "A parallel direction with its own tradeoffs.",
  };

  intentState.forks = [
    fork,
    ...intentState.forks,
  ].slice(0, 8);

  createSnapshot(
    `Branch point v${intentState.version}`
  );

  touch(0.9);
  recalculate();

  recordActivity(
    "Branch created",
    `${label} from v${intentState.version}`
  );

  return fork;
}

export function mergeForks(
  forkId: string,
  insight: string
) {
  const fork = intentState.forks.find(
    (item) => item.forkId === forkId
  );

  if (!fork) {
    return {
      success: false,
      message: "Branch not found.",
    };
  }

  addIntentNode(
    "goal",
    insight,
    0.84,
    false,
    0.22
  );

  recordActivity(
    "Insight merged",
    `${fork.label} → ${insight}`
  );

  return {
    success: true,
    fork,
    mergedInsight: insight,
  };
}

export function addAssumption(
  assumption: string
) {
  const cleaned = assumption.trim();

  if (!cleaned) {
    return {
      success: false,
      message: "Empty assumption.",
    };
  }

  intentState.assumptions = [
    cleaned,
    ...intentState.assumptions.filter(
      (item) => item !== cleaned
    ),
  ].slice(0, 10);

  touch(0.72);
  recalculate();

  recordActivity("Anchor added", cleaned);

  return {
    success: true,
    assumption: cleaned,
  };
}

export function setNodeUncertainty(
  nodeId: string,
  uncertainty: number
) {
  const exists = intentState.nodes.some(
    (node) => node.id === nodeId
  );

  if (!exists) {
    return {
      success: false,
      message: "Intent node not found.",
    };
  }

  intentState.nodes = intentState.nodes.map((node) =>
    node.id === nodeId
      ? {
          ...node,
          uncertainty: Math.min(
            1,
            Math.max(0, uncertainty)
          ),
        }
      : node
  );

  touch(0.7);
  recalculate();
  notify();

  return {
    success: true,
    nodeId,
    uncertainty,
  };
}

export function createAgentProposals() {
  const proposals: AgentProposal[] = [
    {
      id: crypto.randomUUID(),
      title: "Protect what makes this matter",
      detail:
        "Keep the core value visible before adding more complexity.",
      type: "constraint",
      accepted: false,
    },
    {
      id: crypto.randomUUID(),
      title:
        "Turn the biggest unknown into a question",
      detail:
        "Identify what should be learned before committing further.",
      type: "unknown",
      accepted: false,
    },
    {
      id: crypto.randomUUID(),
      title: "Let impact decide the next move",
      detail:
        "Use the intended effect as the strongest decision filter.",
      type: "goal",
      accepted: false,
    },
  ];

  intentState.proposals = proposals;

  recordActivity(
    "Signal arrived",
    "Three agent suggestions are ready."
  );

  return proposals;
}

export function acceptAgentProposal(
  proposalId: string
) {
  const proposal = intentState.proposals.find(
    (item) => item.id === proposalId
  );

  if (!proposal) {
    return {
      success: false,
      message: "Proposal not found.",
    };
  }

  intentState.proposals = intentState.proposals.map(
    (item) =>
      item.id === proposalId
        ? {
            ...item,
            accepted: true,
          }
        : item
  );

  addIntentNode(
    proposal.type,
    proposal.title,
    0.78,
    false,
    0.2
  );

  recordActivity(
    "Signal accepted",
    proposal.title
  );

  return {
    success: true,
    proposal,
  };
}

export function rejectAgentProposal(
  proposalId: string
) {
  intentState.proposals =
    intentState.proposals.filter(
      (item) => item.id !== proposalId
    );

  recordActivity(
    "Signal dismissed",
    "The direction was left untouched."
  );

  return {
    success: true,
  };
}

export function createSnapshot(
  label = `Snapshot v${intentState.version}`
) {
  const snapshot: IntentSnapshot = {
    id: crypto.randomUUID(),
    version: intentState.version,
    label,
    createdAt: timeNow(),
    text: intentState.text,
    nodes: intentState.nodes.map((node) => ({
      ...node,
    })),
    activeNode: intentState.activeNode,
  };

  intentState.snapshots = [
    snapshot,
    ...intentState.snapshots.filter(
      (item) => item.version !== snapshot.version
    ),
  ].slice(0, 10);

  return snapshot;
}

export function restoreSnapshot(
  snapshotId: string
) {
  const snapshot = intentState.snapshots.find(
    (item) => item.id === snapshotId
  );

  if (!snapshot) {
    return {
      success: false,
      message: "Snapshot not found.",
    };
  }

  intentState.text = snapshot.text;
  intentState.nodes = snapshot.nodes.map(
    (node) => ({ ...node })
  );
  intentState.activeNode = snapshot.activeNode;
  intentState.version = snapshot.version;

  touch(0.95);
  recalculate();

  recordActivity(
    "Snapshot restored",
    snapshot.label
  );

  return {
    success: true,
    snapshot,
  };
}

export function getIntentDiff(
  snapshotId: string
) {
  const snapshot = intentState.snapshots.find(
    (item) => item.id === snapshotId
  );

  if (!snapshot) {
    return {
      success: false,
      message: "Snapshot not found.",
    };
  }

  const before = new Map(
    snapshot.nodes.map((node) => [
      node.id,
      node,
    ])
  );

  const added = intentState.nodes.filter(
    (node) => !before.has(node.id)
  );

  const changed = intentState.nodes.filter(
    (node) => {
      const previous = before.get(node.id);

      if (!previous) return false;

      return (
        previous.label !== node.label ||
        Math.abs(
          previous.relevance - node.relevance
        ) > 0.08 ||
        Math.abs(
          previous.uncertainty - node.uncertainty
        ) > 0.08
      );
    }
  );

  return {
    success: true,
    fromVersion: snapshot.version,
    toVersion: intentState.version,
    added,
    changed,
    currentText: intentState.text,
    previousText: snapshot.text,
  };
}

export function compressIntent() {
  const strongest = [...intentState.nodes]
    .sort(
      (a, b) =>
        b.relevance - a.relevance
    )
    .slice(0, 3)
    .map((node) => node.label);

  return {
    success: true,
    essence:
      strongest.length > 0
        ? strongest.join(" · ")
        : intentState.text,
    clarity: intentState.clarity,
  };
}

export function counterfactualLens(
  nodeId: string
) {
  const node = intentState.nodes.find(
    (item) => item.id === nodeId
  );

  if (!node) {
    return {
      success: false,
      message: "Intent node not found.",
    };
  }

  return {
    success: true,
    question:
      `What changes if "${node.label}" matters twice as much?`,
    projectedFocus: 1,
    affected: intentState.nodes
      .filter((item) => item.id !== nodeId)
      .slice(0, 4)
      .map((item) => ({
        id: item.id,
        label: item.label,
        projectedRelevance:
          Math.min(
            1,
            item.relevance * 0.72
          ),
      })),
  };
}

export function intentDNA() {
  const signature =
    intentState.nodes
      .map(
        (node) =>
          `${node.type[0].toUpperCase()}${Math.round(
            node.relevance * 9
          )}`
      )
      .join("-");

  return {
    signature: signature || "I0",
    description:
      "A compact fingerprint of what currently matters.",
  };
}

export function addAttachments(
  files: File[]
) {
  const additions: IntentAttachment[] =
    files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type,
    }));

  intentState.attachments = [
    ...intentState.attachments,
    ...additions,
  ].slice(0, 12);

  touch(0.76);
  recalculate();

  recordActivity(
    "Context added",
    `${additions.length} file${
      additions.length === 1
        ? ""
        : "s"
    } attached`
  );

  return additions;
}

type WebMCPContext = {
  registerTool: (
    tool: {
      name: string;
      title?: string;
      description: string;
      inputSchema: Record<string, unknown>;
      execute: (
        input: any
      ) => Promise<unknown>;
    },
    options?: {
      signal?: AbortSignal;
    }
  ) => Promise<void>;
};

let activeController:
  | AbortController
  | null = null;

export async function registerIntentTools() {
  if (typeof document === "undefined") {
    return;
  }

  const modelContext = (
    document as Document & {
      modelContext?: WebMCPContext | null;
    }
  ).modelContext;

  if (!modelContext) {
    console.log(
      "WebMCP is not available."
    );
    return;
  }

  if (activeController) {
    activeController.abort();
  }

  const controller =
    new AbortController();

  activeController = controller;

  try {
    await modelContext.registerTool(
      {
        name: "inspect_intent",
        title: "Inspect Intent",
        description:
          "Inspect the current living intent, its nodes, memory, activity, uncertainty, contradictions and evolution.",
        inputSchema: {
          type: "object",
          properties: {},
        },
        execute: async () =>
          inspectIntent(),
      },
      { signal: controller.signal }
    );

    await modelContext.registerTool(
      {
        name: "add_intent_node",
        title: "Add Intent Node",
        description:
          "Add a goal, constraint, value, or unknown to the living intent.",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: [
                "goal",
                "constraint",
                "value",
                "unknown",
              ],
            },
            label: {
              type: "string",
            },
            relevance: {
              type: "number",
            },
          },
          required: [
            "type",
            "label",
          ],
        },
        execute: async ({
          type,
          label,
          relevance,
        }: {
          type: IntentNodeType;
          label: string;
          relevance?: number;
        }) =>
          addIntentNode(
            type,
            label,
            relevance ?? 0.7,
            true,
            0.25
          ),
      },
      { signal: controller.signal }
    );

    await modelContext.registerTool(
      {
        name: "focus_attention",
        title: "Focus Attention",
        description:
          "Shift shared attention to one part of the living intent.",
        inputSchema: {
          type: "object",
          properties: {
            nodeId: {
              type: "string",
            },
          },
          required: ["nodeId"],
        },
        execute: async ({
          nodeId,
        }: {
          nodeId: string;
        }) => focusAttention(nodeId),
      },
      { signal: controller.signal }
    );

    await modelContext.registerTool(
      {
        name: "surface_contradiction",
        title: "Surface Contradiction",
        description:
          "Surface a tension between two competing parts of the intent.",
        inputSchema: {
          type: "object",
          properties: {
            first: {
              type: "string",
            },
            second: {
              type: "string",
            },
          },
          required: [
            "first",
            "second",
          ],
        },
        execute: async ({
          first,
          second,
        }: {
          first: string;
          second: string;
        }) =>
          surfaceContradiction(
            first,
            second
          ),
      },
      { signal: controller.signal }
    );

    await modelContext.registerTool(
      {
        name: "propose_intent_evolution",
        title: "Propose Intent Evolution",
        description:
          "Suggest a meaningful change to the intent while requiring human approval.",
        inputSchema: {
          type: "object",
          properties: {
            reason: {
              type: "string",
            },
          },
          required: ["reason"],
        },
        execute: async ({
          reason,
        }: {
          reason: string;
        }) => evolveIntent(reason),
      },
      { signal: controller.signal }
    );

    await modelContext.registerTool(
      {
        name: "fork_intent",
        title: "Fork Intent",
        description:
          "Create another possibility without changing the original intent.",
        inputSchema: {
          type: "object",
          properties: {
            label: {
              type: "string",
            },
          },
          required: ["label"],
        },
        execute: async ({
          label,
        }: {
          label: string;
        }) => forkIntent(label),
      },
      { signal: controller.signal }
    );

    console.log(
      "INTENT WebMCP tools registered."
    );
  } catch (error) {
    if (!controller.signal.aborted) {
      console.error(
        "INTENT WebMCP registration failed:",
        error
      );
    }
  }
}

export function unregisterIntentTools() {
  if (activeController) {
    activeController.abort();
    activeController = null;
  }
}