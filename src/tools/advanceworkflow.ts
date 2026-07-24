import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { DolibarrAPI } from '../api.js';

// ============================================================
// Advance Workflow REST API (server module: advanceworkflow)
// Wraps the module's REST endpoints, base path: <host>/api/index.php/advanceworkflow
// Covers workflows, steps, and the four action kinds (email, condition, PHP
// file-function, database action), plus buttons, tabs and execution logs.
// Permissions per group: workflow / triggermail / logic / function / button /
// tabs / logs. PHP database actions also require admin + the module setting
// ADVANCEWORKFLOW_ENABLE_PHP_ACTIONS.
// ============================================================

type Args = Record<string, unknown>;

const BASE = '/advanceworkflow';

function json(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function requiredId(args: Args, key = 'id'): number {
  const value = args[key];
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Paramètre requis manquant ou invalide: ${key} (doit être un id > 0)`);
  }
  return n;
}

// Collect only the provided keys, then merge any free-form `data` object.
function buildBody(args: Args, keys: string[]): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (args.data && typeof args.data === 'object' && !Array.isArray(args.data)) {
    Object.assign(body, args.data as Record<string, unknown>);
  }
  for (const k of keys) {
    if (args[k] !== undefined) body[k] = args[k];
  }
  return body;
}

// List query params (undefined values dropped by the API layer).
function listParams(args: Args): Record<string, unknown> {
  return {
    sortfield: args.sortfield,
    sortorder: args.sortorder,
    limit: args.limit,
    page: args.page,
    properties: args.properties,
  };
}

// Shared JSON-schema fragments.
const LIST_PROPS = {
  sortfield: { type: 'string', description: 'Sort field (default t.rowid)' },
  sortorder: { type: 'string', enum: ['ASC', 'DESC'], description: 'Sort direction' },
  limit: { type: 'integer', description: 'Max rows (default 100)' },
  page: { type: 'integer', description: 'Zero-based page (offset = limit*page)' },
  properties: { type: 'string', description: 'Comma-separated whitelist of properties to return' },
};
const ID_ONLY: Tool['inputSchema'] = { type: 'object', properties: { id: { type: 'integer', description: 'Record id' } }, required: ['id'] };
const DATA_PASSTHROUGH = { data: { type: 'object', description: 'Additional/other fields to send verbatim in the request body' } };

export const advanceWorkflowTools: Tool[] = [
  // ---------------- Workflows ----------------
  { name: 'aw_list_workflows', description: 'List Advance Workflow workflows.', inputSchema: { type: 'object', properties: { ...LIST_PROPS } } },
  { name: 'aw_get_workflow', description: 'Get one workflow by id.', inputSchema: ID_ONLY },
  {
    name: 'aw_create_workflow',
    description: 'Create a workflow. Provide label and the Dolibarr trigger id it reacts to.',
    inputSchema: { type: 'object', properties: { label: { type: 'string' }, triggerid: { type: 'integer', description: 'c_action_trigger rowid' }, description: { type: 'string' }, ...DATA_PASSTHROUGH }, required: ['label'] },
  },
  { name: 'aw_update_workflow', description: 'Update a workflow (send only changed fields).', inputSchema: { type: 'object', properties: { id: { type: 'integer' }, label: { type: 'string' }, triggerid: { type: 'integer' }, description: { type: 'string' }, ...DATA_PASSTHROUGH }, required: ['id'] } },
  { name: 'aw_delete_workflow', description: 'Delete a workflow.', inputSchema: ID_ONLY },
  { name: 'aw_list_workflow_steps', description: 'List the steps of a workflow.', inputSchema: { type: 'object', properties: { id: { type: 'integer', description: 'Workflow id' }, ...LIST_PROPS }, required: ['id'] } },

  // ---------------- Triggers (lookup) ----------------
  {
    name: 'aw_list_triggers',
    description: "List Dolibarr triggers (c_action_trigger) to resolve the numeric triggerid a workflow binds to. The id is a per-installation rowid — always look it up here, never guess. Optional exact code filter, e.g. BILL_VALIDATE for customer invoice validation.",
    inputSchema: { type: 'object', properties: { code: { type: 'string', description: 'Exact trigger code to filter by, e.g. BILL_VALIDATE (omit to list all)' } } },
  },

  // ---------------- Steps ----------------
  { name: 'aw_get_step', description: 'Get one workflow step by id.', inputSchema: ID_ONLY },
  {
    name: 'aw_create_step',
    description: 'Create a workflow step. actionname: 0=email,1=condition,2=PHP file-function,3=database action; actionid points to that definition.',
    inputSchema: {
      type: 'object',
      properties: {
        fk_workflow: { type: 'integer', description: 'Parent workflow id' },
        label: { type: 'string' },
        actionname: { type: 'integer', enum: [0, 1, 2, 3] },
        actionid: { type: 'integer', description: 'Id of the linked action definition' },
        sortorder: { type: 'integer' },
        next_step: { type: 'integer' },
        true_next_step: { type: 'integer' },
        false_next_step: { type: 'integer' },
        ...DATA_PASSTHROUGH,
      },
      required: ['fk_workflow', 'label', 'actionname'],
    },
  },
  { name: 'aw_update_step', description: 'Update a workflow step.', inputSchema: { type: 'object', properties: { id: { type: 'integer' }, label: { type: 'string' }, actionname: { type: 'integer' }, actionid: { type: 'integer' }, sortorder: { type: 'integer' }, next_step: { type: 'integer' }, true_next_step: { type: 'integer' }, false_next_step: { type: 'integer' }, ...DATA_PASSTHROUGH }, required: ['id'] } },
  { name: 'aw_delete_step', description: 'Delete a workflow step.', inputSchema: ID_ONLY },

  // ---------------- Email actions ----------------
  { name: 'aw_list_emails', description: 'List email actions.', inputSchema: { type: 'object', properties: { ...LIST_PROPS } } },
  { name: 'aw_get_email', description: 'Get one email action (includes subject/body from its template).', inputSchema: ID_ONLY },
  {
    name: 'aw_create_email',
    description: 'Create an email action. from_type/to_type: 0=system,1=specific address,2=current user,3=object creator,4=object modifier,5=thirdparty,6=Dolibarr contact.',
    inputSchema: {
      type: 'object',
      properties: {
        label: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' },
        from_type: { type: 'integer' }, to_type: { type: 'integer' },
        from_address: { type: 'string' }, to_address: { type: 'string' },
        from_contact: { type: 'integer' }, to_contact: { type: 'integer' },
        cc: { type: 'string' }, bcc: { type: 'string' }, joinfiles: { type: 'integer', enum: [0, 1] },
      },
      required: ['label', 'subject', 'body'],
    },
  },
  {
    name: 'aw_update_email',
    description: 'Update an email action (same fields as create).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer' }, label: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' },
        from_type: { type: 'integer' }, to_type: { type: 'integer' }, from_address: { type: 'string' }, to_address: { type: 'string' },
        from_contact: { type: 'integer' }, to_contact: { type: 'integer' }, cc: { type: 'string' }, bcc: { type: 'string' }, joinfiles: { type: 'integer' },
      },
      required: ['id', 'label', 'subject', 'body'],
    },
  },
  { name: 'aw_delete_email', description: 'Delete an email action (and its email template).', inputSchema: ID_ONLY },

  // ---------------- Conditions ----------------
  { name: 'aw_list_conditions', description: 'List condition (logic) definitions.', inputSchema: { type: 'object', properties: { ...LIST_PROPS } } },
  { name: 'aw_get_condition', description: 'Get one condition by id.', inputSchema: ID_ONLY },
  {
    name: 'aw_create_condition',
    description: "Create a condition. Expression example: total_ht:>:'100' AND status:==:'1'.",
    inputSchema: { type: 'object', properties: { label: { type: 'string' }, conditions: { type: 'string', description: 'Condition expression' }, true_next_step: { type: 'integer' }, false_next_step: { type: 'integer' }, ...DATA_PASSTHROUGH }, required: ['label', 'conditions'] },
  },
  { name: 'aw_update_condition', description: 'Update a condition.', inputSchema: { type: 'object', properties: { id: { type: 'integer' }, label: { type: 'string' }, conditions: { type: 'string' }, true_next_step: { type: 'integer' }, false_next_step: { type: 'integer' }, ...DATA_PASSTHROUGH }, required: ['id'] } },
  { name: 'aw_delete_condition', description: 'Delete a condition.', inputSchema: ID_ONLY },

  // ---------------- PHP file-functions (checkfunction) ----------------
  { name: 'aw_list_functions', description: 'List PHP file-function references (functions defined in lib/functions.php).', inputSchema: { type: 'object', properties: { ...LIST_PROPS } } },
  { name: 'aw_get_function', description: 'Get one file-function reference by id.', inputSchema: ID_ONLY },
  {
    name: 'aw_create_function',
    description: 'Create a file-function reference. functionname must exist in lib/functions.php to run. arguments is a JSON array string.',
    inputSchema: { type: 'object', properties: { label: { type: 'string' }, functionname: { type: 'string' }, arguments: { type: 'string', description: 'JSON array of argument expressions' }, nextstep: { type: 'integer' }, ...DATA_PASSTHROUGH }, required: ['label', 'functionname'] },
  },
  { name: 'aw_update_function', description: 'Update a file-function reference.', inputSchema: { type: 'object', properties: { id: { type: 'integer' }, label: { type: 'string' }, functionname: { type: 'string' }, arguments: { type: 'string' }, nextstep: { type: 'integer' }, ...DATA_PASSTHROUGH }, required: ['id'] } },
  { name: 'aw_delete_function', description: 'Delete a file-function reference.', inputSchema: ID_ONLY },

  // ---------------- Database actions (declarative + PHP) ----------------
  { name: 'aw_list_dbactions', description: 'List database actions (declarative and PHP).', inputSchema: { type: 'object', properties: {} } },
  { name: 'aw_get_dbaction', description: 'Get one database action by id.', inputSchema: ID_ONLY },
  {
    name: 'aw_create_dbaction',
    description: "Create a database action. exec_mode 'declarative' (operations: [{type:set_field|set_extrafield|append_note,target,value}]) or 'php' (phpcode function body; requires admin + ADVANCEWORKFLOW_ENABLE_PHP_ACTIONS).",
    inputSchema: {
      type: 'object',
      properties: {
        label: { type: 'string' },
        exec_mode: { type: 'string', enum: ['declarative', 'php'] },
        code: { type: 'string', description: 'Optional unique code (auto-generated if omitted)' },
        description: { type: 'string' },
        operations: { type: 'array', description: 'Declarative operations', items: { type: 'object', properties: { type: { type: 'string' }, target: { type: 'string' }, value: { type: 'string' } } } },
        phpcode: { type: 'string', description: 'PHP function body ($object,$db,$user,$langs,$conf available; return 0/-1)' },
      },
      required: ['label'],
    },
  },
  {
    name: 'aw_update_dbaction',
    description: 'Update a database action (mode is fixed at creation). Send operations for declarative, phpcode for php.',
    inputSchema: { type: 'object', properties: { id: { type: 'integer' }, label: { type: 'string' }, description: { type: 'string' }, operations: { type: 'array' }, phpcode: { type: 'string' } }, required: ['id'] },
  },
  { name: 'aw_delete_dbaction', description: 'Delete a database action.', inputSchema: ID_ONLY },

  // ---------------- Buttons ----------------
  { name: 'aw_list_buttons', description: 'List workflow buttons.', inputSchema: { type: 'object', properties: { ...LIST_PROPS } } },
  { name: 'aw_get_button', description: 'Get one button by id.', inputSchema: ID_ONLY },
  { name: 'aw_create_button', description: 'Create a button. Pass its fields inside the data object.', inputSchema: { type: 'object', properties: { ...DATA_PASSTHROUGH }, required: ['data'] } },
  { name: 'aw_update_button', description: 'Update a button.', inputSchema: { type: 'object', properties: { id: { type: 'integer' }, ...DATA_PASSTHROUGH }, required: ['id'] } },
  { name: 'aw_delete_button', description: 'Delete a button.', inputSchema: ID_ONLY },

  // ---------------- Tabs ----------------
  { name: 'aw_list_tabs', description: 'List workflow tabs.', inputSchema: { type: 'object', properties: { ...LIST_PROPS } } },
  { name: 'aw_get_tab', description: 'Get one tab by id.', inputSchema: ID_ONLY },
  { name: 'aw_create_tab', description: 'Create a tab. Pass its fields inside the data object.', inputSchema: { type: 'object', properties: { ...DATA_PASSTHROUGH }, required: ['data'] } },
  { name: 'aw_update_tab', description: 'Update a tab.', inputSchema: { type: 'object', properties: { id: { type: 'integer' }, ...DATA_PASSTHROUGH }, required: ['id'] } },
  { name: 'aw_delete_tab', description: 'Delete a tab.', inputSchema: ID_ONLY },

  // ---------------- Logs (read + delete) ----------------
  { name: 'aw_list_logs', description: 'List workflow execution logs.', inputSchema: { type: 'object', properties: { ...LIST_PROPS } } },
  { name: 'aw_get_log', description: 'Get one execution log by id.', inputSchema: ID_ONLY },
  { name: 'aw_delete_log', description: 'Delete an execution log.', inputSchema: ID_ONLY },
];

export async function handleAdvanceWorkflowTool(name: string, args: Args, api: DolibarrAPI): Promise<string> {
  switch (name) {
    // ---- Workflows ----
    case 'aw_list_workflows':
      return json(await api.get(`${BASE}/workflows`, listParams(args)));
    case 'aw_get_workflow':
      return json(await api.get(`${BASE}/workflows/${requiredId(args)}`));
    case 'aw_create_workflow':
      return json(await api.post(`${BASE}/workflows`, buildBody(args, ['label', 'triggerid', 'description'])));
    case 'aw_update_workflow':
      return json(await api.put(`${BASE}/workflows/${requiredId(args)}`, buildBody(args, ['label', 'triggerid', 'description'])));
    case 'aw_delete_workflow':
      return json(await api.delete(`${BASE}/workflows/${requiredId(args)}`));
    case 'aw_list_workflow_steps':
      return json(await api.get(`${BASE}/workflows/${requiredId(args)}/steps`, listParams(args)));

    // ---- Triggers ----
    case 'aw_list_triggers':
      return json(await api.get(`${BASE}/triggers`, { code: args.code }));

    // ---- Steps ----
    case 'aw_get_step':
      return json(await api.get(`${BASE}/steps/${requiredId(args)}`));
    case 'aw_create_step':
      return json(await api.post(`${BASE}/steps`, buildBody(args, ['fk_workflow', 'label', 'actionname', 'actionid', 'sortorder', 'next_step', 'true_next_step', 'false_next_step'])));
    case 'aw_update_step':
      return json(await api.put(`${BASE}/steps/${requiredId(args)}`, buildBody(args, ['label', 'actionname', 'actionid', 'sortorder', 'next_step', 'true_next_step', 'false_next_step'])));
    case 'aw_delete_step':
      return json(await api.delete(`${BASE}/steps/${requiredId(args)}`));

    // ---- Emails ----
    case 'aw_list_emails':
      return json(await api.get(`${BASE}/emails`, listParams(args)));
    case 'aw_get_email':
      return json(await api.get(`${BASE}/emails/${requiredId(args)}`));
    case 'aw_create_email':
      return json(await api.post(`${BASE}/emails`, buildBody(args, ['label', 'subject', 'body', 'from_type', 'to_type', 'from_address', 'to_address', 'from_contact', 'to_contact', 'cc', 'bcc', 'joinfiles'])));
    case 'aw_update_email':
      return json(await api.put(`${BASE}/emails/${requiredId(args)}`, buildBody(args, ['label', 'subject', 'body', 'from_type', 'to_type', 'from_address', 'to_address', 'from_contact', 'to_contact', 'cc', 'bcc', 'joinfiles'])));
    case 'aw_delete_email':
      return json(await api.delete(`${BASE}/emails/${requiredId(args)}`));

    // ---- Conditions ----
    case 'aw_list_conditions':
      return json(await api.get(`${BASE}/conditions`, listParams(args)));
    case 'aw_get_condition':
      return json(await api.get(`${BASE}/conditions/${requiredId(args)}`));
    case 'aw_create_condition':
      return json(await api.post(`${BASE}/conditions`, buildBody(args, ['label', 'conditions', 'true_next_step', 'false_next_step'])));
    case 'aw_update_condition':
      return json(await api.put(`${BASE}/conditions/${requiredId(args)}`, buildBody(args, ['label', 'conditions', 'true_next_step', 'false_next_step'])));
    case 'aw_delete_condition':
      return json(await api.delete(`${BASE}/conditions/${requiredId(args)}`));

    // ---- Functions ----
    case 'aw_list_functions':
      return json(await api.get(`${BASE}/functions`, listParams(args)));
    case 'aw_get_function':
      return json(await api.get(`${BASE}/functions/${requiredId(args)}`));
    case 'aw_create_function':
      return json(await api.post(`${BASE}/functions`, buildBody(args, ['label', 'functionname', 'arguments', 'nextstep'])));
    case 'aw_update_function':
      return json(await api.put(`${BASE}/functions/${requiredId(args)}`, buildBody(args, ['label', 'functionname', 'arguments', 'nextstep'])));
    case 'aw_delete_function':
      return json(await api.delete(`${BASE}/functions/${requiredId(args)}`));

    // ---- Database actions ----
    case 'aw_list_dbactions':
      return json(await api.get(`${BASE}/dbactions`));
    case 'aw_get_dbaction':
      return json(await api.get(`${BASE}/dbactions/${requiredId(args)}`));
    case 'aw_create_dbaction':
      return json(await api.post(`${BASE}/dbactions`, buildBody(args, ['label', 'exec_mode', 'code', 'description', 'operations', 'phpcode'])));
    case 'aw_update_dbaction':
      return json(await api.put(`${BASE}/dbactions/${requiredId(args)}`, buildBody(args, ['label', 'description', 'operations', 'phpcode'])));
    case 'aw_delete_dbaction':
      return json(await api.delete(`${BASE}/dbactions/${requiredId(args)}`));

    // ---- Buttons ----
    case 'aw_list_buttons':
      return json(await api.get(`${BASE}/buttons`, listParams(args)));
    case 'aw_get_button':
      return json(await api.get(`${BASE}/buttons/${requiredId(args)}`));
    case 'aw_create_button':
      return json(await api.post(`${BASE}/buttons`, buildBody(args, [])));
    case 'aw_update_button':
      return json(await api.put(`${BASE}/buttons/${requiredId(args)}`, buildBody(args, [])));
    case 'aw_delete_button':
      return json(await api.delete(`${BASE}/buttons/${requiredId(args)}`));

    // ---- Tabs ----
    case 'aw_list_tabs':
      return json(await api.get(`${BASE}/tabs`, listParams(args)));
    case 'aw_get_tab':
      return json(await api.get(`${BASE}/tabs/${requiredId(args)}`));
    case 'aw_create_tab':
      return json(await api.post(`${BASE}/tabs`, buildBody(args, [])));
    case 'aw_update_tab':
      return json(await api.put(`${BASE}/tabs/${requiredId(args)}`, buildBody(args, [])));
    case 'aw_delete_tab':
      return json(await api.delete(`${BASE}/tabs/${requiredId(args)}`));

    // ---- Logs ----
    case 'aw_list_logs':
      return json(await api.get(`${BASE}/logs`, listParams(args)));
    case 'aw_get_log':
      return json(await api.get(`${BASE}/logs/${requiredId(args)}`));
    case 'aw_delete_log':
      return json(await api.delete(`${BASE}/logs/${requiredId(args)}`));

    default:
      throw new Error(`Outil advanceworkflow inconnu : ${name}`);
  }
}
