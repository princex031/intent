export type IntentNodeType =
  | "goal"
  | "constraint"
  | "value"
  | "unknown";

export type IntentNode = {
  id: string;
  type: IntentNodeType;
  label: string;
  relevance?: number;
};

export type IntentState = {
  text: string;
  nodes: IntentNode[];
  activeNode: string;
  version: number;
};

export const intentState: IntentState = {
  text: "",
  nodes: [],
  activeNode: "",
  version: 1,
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

export function inspectIntent() {
  return {
    intent: intentState.text,
    nodes: intentState.nodes,
    activeNode: intentState.activeNode,
    version: intentState.version,
  };
}

export function setIntent(text: string) {
  intentState.text = text;
  intentState.version = 1;
  notify();

  return inspectIntent();
}

export function resetIntentNodes() {
  intentState.nodes = [];
  intentState.activeNode = "";
  notify();
}

export function addIntentNode(
  type: IntentNodeType,
  label: string,
  relevance = 0.7
) {
  const node: IntentNode = {
    id: crypto.randomUUID(),
    type,
    label,
    relevance,
  };

  intentState.nodes.push(node);

  if (!intentState.activeNode) {
    intentState.activeNode = node.id;
  }

  notify();

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

  intentState.nodes = intentState.nodes.map((item) => ({
    ...item,
    relevance:
      item.id === nodeId
        ? 1
        : Math.max(0.35, (item.relevance ?? 0.7) * 0.9),
  }));

  notify();

  return {
    success: true,
    focusedNode: node,
    sharedAttention: true,
  };
}

export function surfaceContradiction(
  first: string,
  second: string
) {
  const result = {
    type: "contradiction",
    first,
    second,
    requiresHumanDecision: true,
  };

  notify();

  return result;
}

export function evolveIntent(reason: string) {
  intentState.version += 1;

  const result = {
    version: intentState.version,
    reason,
    humanApprovalRequired: true,
  };

  notify();

  return result;
}

export function forkIntent(label: string) {
  const result = {
    forkId: crypto.randomUUID(),
    label,
    sourceVersion: intentState.version,
  };

  notify();

  return result;
}

type WebMCPContext = {
  registerTool: (
    tool: {
      name: string;
      title?: string;
      description: string;
      inputSchema: Record<string, unknown>;
      execute: (input: any) => Promise<unknown>;
    },
    options?: {
      signal?: AbortSignal;
    }
  ) => Promise<void>;
};

let activeController: AbortController | null = null;

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
    console.log("WebMCP is not available.");
    return;
  }

  if (activeController) {
    activeController.abort();
  }

  const controller = new AbortController();
  activeController = controller;

  try {
    await modelContext.registerTool(
      {
        name: "inspect_intent",
        title: "Inspect Intent",
        description:
          "Inspect the current living intent and its structured nodes.",
        inputSchema: {
          type: "object",
          properties: {},
        },
        execute: async () => inspectIntent(),
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
          required: ["type", "label"],
        },
        execute: async ({
          type,
          label,
          relevance,
        }: {
          type: IntentNodeType;
          label: string;
          relevance?: number;
        }) => addIntentNode(type, label, relevance),
      },
      { signal: controller.signal }
    );

    await modelContext.registerTool(
      {
        name: "focus_attention",
        title: "Focus Attention",
        description:
          "Focus shared human-agent attention on one intent node.",
        inputSchema: {
          type: "object",
          properties: {
            nodeId: {
              type: "string",
            },
          },
          required: ["nodeId"],
        },
        execute: async ({ nodeId }: { nodeId: string }) =>
          focusAttention(nodeId),
      },
      { signal: controller.signal }
    );

    await modelContext.registerTool(
      {
        name: "surface_contradiction",
        title: "Surface Contradiction",
        description:
          "Surface a tension between two competing parts of an intent and require human resolution.",
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
          required: ["first", "second"],
        },
        execute: async ({
          first,
          second,
        }: {
          first: string;
          second: string;
        }) => surfaceContradiction(first, second),
      },
      { signal: controller.signal }
    );

    await modelContext.registerTool(
      {
        name: "propose_intent_evolution",
        title: "Propose Intent Evolution",
        description:
          "Propose a change to the user's intent while requiring human approval.",
        inputSchema: {
          type: "object",
          properties: {
            reason: {
              type: "string",
            },
          },
          required: ["reason"],
        },
        execute: async ({ reason }: { reason: string }) =>
          evolveIntent(reason),
      },
      { signal: controller.signal }
    );

    await modelContext.registerTool(
      {
        name: "fork_intent",
        title: "Fork Intent",
        description:
          "Create an alternate possibility space without changing the original intent.",
        inputSchema: {
          type: "object",
          properties: {
            label: {
              type: "string",
            },
          },
          required: ["label"],
        },
        execute: async ({ label }: { label: string }) =>
          forkIntent(label),
      },
      { signal: controller.signal }
    );

    console.log("INTENT WebMCP tools registered.");
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