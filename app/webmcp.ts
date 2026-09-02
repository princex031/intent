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
  activeNode: "goal",
  version: 1,
};

export function inspectIntent() {
  return {
    intent: intentState.text,
    nodes: intentState.nodes,
    activeNode: intentState.activeNode,
    version: intentState.version,
  };
}

export function addIntentNode(
  type: IntentNodeType,
  label: string
) {
  const node: IntentNode = {
    id: crypto.randomUUID(),
    type,
    label,
  };

  intentState.nodes.push(node);

  return node;
}

export function focusAttention(nodeId: string) {
  intentState.activeNode = nodeId;

  return {
    focusedNode: nodeId,
    sharedAttention: true,
  };
}

export function surfaceContradiction(
  first: string,
  second: string
) {
  return {
    type: "contradiction",
    first,
    second,
    requiresHumanDecision: true,
  };
}

export function evolveIntent(reason: string) {
  intentState.version += 1;

  return {
    version: intentState.version,
    reason,
    humanApprovalRequired: true,
  };
}

export function forkIntent(label: string) {
  return {
    forkId: crypto.randomUUID(),
    label,
    sourceVersion: intentState.version,
  };
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
      modelContext?: WebMCPContext;
    }
  ).modelContext;

  if (!modelContext) {
    console.log("WebMCP is not available in this browser.");
    return;
  }

  if (activeController) {
    activeController.abort();
    activeController = null;
  }

  const controller = new AbortController();
  activeController = controller;

  try {
    await modelContext.registerTool(
      {
        name: "inspect_intent",
        title: "Inspect Intent",
        description:
          "Inspect the user's current living intent, including goals, constraints, values, unknowns, current focus, and version.",
        inputSchema: {
          type: "object",
          properties: {},
        },
        execute: async () => inspectIntent(),
      },
      {
        signal: controller.signal,
      }
    );

    await modelContext.registerTool(
      {
        name: "add_intent_node",
        title: "Add Intent Node",
        description:
          "Add a meaningful goal, constraint, value, or unknown to the user's living intent.",
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
          },
          required: ["type", "label"],
        },
        execute: async ({
          type,
          label,
        }: {
          type: IntentNodeType;
          label: string;
        }) => addIntentNode(type, label),
      },
      {
        signal: controller.signal,
      }
    );

    await modelContext.registerTool(
      {
        name: "focus_attention",
        title: "Focus Attention",
        description:
          "Focus shared human-agent attention on a specific intent node.",
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
      {
        signal: controller.signal,
      }
    );

    await modelContext.registerTool(
      {
        name: "surface_contradiction",
        title: "Surface Contradiction",
        description:
          "Surface a tension between two competing parts of an intent and require a human decision.",
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
      {
        signal: controller.signal,
      }
    );

    await modelContext.registerTool(
      {
        name: "propose_intent_evolution",
        title: "Propose Intent Evolution",
        description:
          "Propose an evolution of the user's intent when new information changes its meaning, priorities, or constraints. Human approval is required.",
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
      {
        signal: controller.signal,
      }
    );

    await modelContext.registerTool(
      {
        name: "fork_intent",
        title: "Fork Intent",
        description:
          "Create an alternate possibility space from the current intent without changing the original intent.",
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
      {
        signal: controller.signal,
      }
    );

    console.log("INTENT WebMCP tools registered.");
  } catch (error) {
    if (!controller.signal.aborted) {
      console.error("WebMCP registration failed:", error);
    }
  }
}

export function unregisterIntentTools() {
  if (activeController) {
    activeController.abort();
    activeController = null;
    console.log("INTENT WebMCP tools unregistered.");
  }
}