import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { DolibarrAPI } from '../api.js';

// ============================================================
// Advance Module Builder REST API (server module: advancemodulebuilder)
// Thin wrapper over Dolibarr's NATIVE Module Builder, exposed as REST.
// Base path: <host>/api/index.php/advancemodulebuilderapi
// All operations require the `modulebuilder -> run` permission.
// Unlike the old manifest-driven aimodulebuilder, these endpoints edit the
// generated files on disk directly — there is NO regenerate/validate step.
// ============================================================

type Args = Record<string, unknown>;

const BASE = '/advancemodulebuilderapi';

function json(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function requiredString(args: Args, key: string): string {
  const value = args[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Paramètre requis manquant: ${key}`);
  }
  return value;
}

function optionalObject(args: Args, key: string): Record<string, unknown> {
  const value = args[key];
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Le paramètre ${key} doit être un objet JSON`);
  }
  return value as Record<string, unknown>;
}

function requiredObject(args: Args, key: string): Record<string, unknown> {
  const value = args[key];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Le paramètre requis ${key} doit être un objet JSON`);
  }
  return value as Record<string, unknown>;
}

function seg(value: string): string {
  return encodeURIComponent(value);
}

function queryString(params: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

export const advanceModuleBuilderTools: Tool[] = [
  // ---------------- Module ----------------
  {
    name: 'amb_list_modules',
    description: 'List all custom modules managed by the (Advance) Module Builder.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'amb_create_module',
    description: 'Create a new module skeleton (native initmodule). Generates core/modules/modX.class.php, langs, sql/, etc. under htdocs/custom/<module>.',
    inputSchema: {
      type: 'object',
      properties: {
        module_name: { type: 'string', description: 'Module name, alphanumeric (e.g. MyShop)' },
        version: { type: 'string', description: 'Version (default 1.0)' },
        family: { type: 'string', description: 'Module family (default other)' },
        idmodule: { type: 'string', description: 'Numeric module id (default 500000)' },
        editorname: { type: 'string' },
        editorurl: { type: 'string' },
        picto: { type: 'string', description: 'Picto / icon (e.g. fa-cube, default fa-file)' },
      },
      required: ['module_name'],
    },
  },
  {
    name: 'amb_delete_module',
    description: 'Delete a module entirely (files + descriptor). Destructive — confirm with the user first.',
    inputSchema: {
      type: 'object',
      properties: { module: { type: 'string', description: 'Module name' } },
      required: ['module'],
    },
  },
  {
    name: 'amb_set_module_property',
    description: 'Update a module descriptor property (desc|version|family|picto|editor_name|editor_url).',
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string' },
        key: { type: 'string', description: 'desc|version|family|picto|editor_name|editor_url' },
        value: { type: 'string', description: 'New value' },
      },
      required: ['module', 'key', 'value'],
    },
  },
  {
    name: 'amb_add_language',
    description: 'Add a language translation set to the module.',
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string' },
        langcode: { type: 'string', description: 'Language code, e.g. fr_FR' },
      },
      required: ['module', 'langcode'],
    },
  },
  {
    name: 'amb_build_package',
    description: 'Build the distributable zip package into module/bin.',
    inputSchema: {
      type: 'object',
      properties: { module: { type: 'string' } },
      required: ['module'],
    },
  },
  {
    name: 'amb_generate_doc',
    description: 'Generate the module documentation (HTML).',
    inputSchema: {
      type: 'object',
      properties: { module: { type: 'string' } },
      required: ['module'],
    },
  },
  {
    name: 'amb_save_file',
    description: "Overwrite a file's content inside the module (keeps a .back copy). Path is relative to the module directory.",
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string' },
        file: { type: 'string', description: 'Path relative to the module directory' },
        content: { type: 'string', description: 'New file content' },
      },
      required: ['module', 'file', 'content'],
    },
  },
  {
    name: 'amb_delete_file',
    description: 'Delete a file from the module. Pass objectname when removing an API object file.',
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string' },
        file: { type: 'string', description: 'Path relative to the install root' },
        objectname: { type: 'string', description: 'Object name (when removing an API object)' },
      },
      required: ['module', 'file'],
    },
  },

  // ---------------- Objects / tables ----------------
  {
    name: 'amb_add_object',
    description: 'Create an object/table (class + SQL + card/list/lib + menus) in the module.',
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string' },
        objectname: { type: 'string', description: 'Object name, e.g. Order' },
        options: {
          type: 'object',
          description: 'Optional flags: includerefgeneration, includedocgeneration, generatepermissions (0/1)',
        },
      },
      required: ['module', 'objectname'],
    },
  },
  {
    name: 'amb_delete_object',
    description: 'Delete an object and its files, menus and permissions. Destructive — confirm first.',
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string' },
        objectname: { type: 'string' },
      },
      required: ['module', 'objectname'],
    },
  },
  {
    name: 'amb_add_extrafields',
    description: 'Add the extrafields support files and flag the object as extrafield-managed.',
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string' },
        objectname: { type: 'string' },
      },
      required: ['module', 'objectname'],
    },
  },
  {
    name: 'amb_init_object_page',
    description: 'Generate an object sub-page: contact | document | note | agenda.',
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string' },
        objectname: { type: 'string' },
        page: { type: 'string', description: 'contact|document|note|agenda' },
      },
      required: ['module', 'objectname', 'page'],
    },
  },
  {
    name: 'amb_drop_table',
    description: "Drop the object's DB table (only if empty). Set extrafields=1 to also drop the _extrafields table. Destructive — confirm first.",
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string' },
        objectname: { type: 'string' },
        extrafields: { type: 'number', description: '1 to also drop the _extrafields table' },
      },
      required: ['module', 'objectname'],
    },
  },

  // ---------------- Fields / properties ----------------
  {
    name: 'amb_add_field',
    description: 'Add a field/property to an object. field requires name, label, type; optional visible, enabled, position, notnull, index, default, arrayofkeyval, searchall, css, …',
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string' },
        objectname: { type: 'string' },
        field: { type: 'object', description: 'Field definition: name, label, type (required) + optional attributes' },
      },
      required: ['module', 'objectname', 'field'],
    },
  },
  {
    name: 'amb_edit_field',
    description: 'Update a field/property (re-applies the definition). name is forced to {property}.',
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string' },
        objectname: { type: 'string' },
        property: { type: 'string', description: 'Existing property name to update' },
        field: { type: 'object', description: 'New field definition' },
      },
      required: ['module', 'objectname', 'property', 'field'],
    },
  },
  {
    name: 'amb_delete_field',
    description: 'Delete a field/property from the object. Destructive — confirm first.',
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string' },
        objectname: { type: 'string' },
        property: { type: 'string' },
      },
      required: ['module', 'objectname', 'property'],
    },
  },

  // ---------------- REST API & parts ----------------
  {
    name: 'amb_init_api',
    description: "Generate the REST API class for the module's objects (initapi). With no object it produces a clean empty API class.",
    inputSchema: {
      type: 'object',
      properties: { module: { type: 'string' } },
      required: ['module'],
    },
  },
  {
    name: 'amb_init_part',
    description: 'Initialise a module part: hook | trigger | widget | emailing | css | js | cli | doc | phpunit.',
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string' },
        part: { type: 'string', description: 'hook|trigger|widget|emailing|css|js|cli|doc|phpunit' },
      },
      required: ['module', 'part'],
    },
  },

  // ---------------- Permissions ----------------
  {
    name: 'amb_add_permission',
    description: 'Add a permission to the module.',
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string' },
        label: { type: 'string', description: 'Permission label' },
        object: { type: 'string', description: 'Object the permission applies to' },
        crud: { type: 'string', description: 'read|write|delete' },
        id: { type: 'string', description: 'Optional numeric permission id' },
      },
      required: ['module', 'label', 'object', 'crud'],
    },
  },
  {
    name: 'amb_edit_permission',
    description: 'Update a permission by its 1-based counter.',
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string' },
        counter: { type: 'number', description: '1-based permission index' },
        right: { type: 'object', description: 'New permission definition' },
      },
      required: ['module', 'counter', 'right'],
    },
  },
  {
    name: 'amb_delete_permission',
    description: 'Delete a permission by its 1-based index.',
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string' },
        permskey: { type: 'number', description: '1-based permission index' },
      },
      required: ['module', 'permskey'],
    },
  },

  // ---------------- Menus ----------------
  {
    name: 'amb_add_menu',
    description: 'Add a menu entry. menu requires type, titre, url; optional fk_menu, mainmenu, leftmenu, enabled, objects, perms, target, user.',
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string' },
        menu: { type: 'object', description: 'Menu definition: type, titre, url (required) + optional fields' },
      },
      required: ['module', 'menu'],
    },
  },
  {
    name: 'amb_edit_menu',
    description: 'Update a menu entry by its 0-based index.',
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string' },
        menukey: { type: 'number', description: '0-based menu index' },
        menu: { type: 'object', description: 'New menu definition' },
      },
      required: ['module', 'menukey', 'menu'],
    },
  },
  {
    name: 'amb_delete_menu',
    description: 'Delete a menu entry by its 0-based index.',
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string' },
        menukey: { type: 'number', description: '0-based menu index' },
      },
      required: ['module', 'menukey'],
    },
  },

  // ---------------- Dictionaries ----------------
  {
    name: 'amb_add_dictionary',
    description: 'Create a dictionary (a c_ prefix is added if missing).',
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string' },
        dicname: { type: 'string' },
        label: { type: 'string' },
      },
      required: ['module', 'dicname', 'label'],
    },
  },
  {
    name: 'amb_update_dictionary',
    description: "Rename a dictionary's label by its 1-based index.",
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string' },
        key: { type: 'number', description: '1-based dictionary index' },
        label: { type: 'string' },
      },
      required: ['module', 'key', 'label'],
    },
  },
  {
    name: 'amb_delete_dictionary',
    description: 'Delete a dictionary and drop its table. Destructive — confirm first.',
    inputSchema: {
      type: 'object',
      properties: {
        module: { type: 'string' },
        dicname: { type: 'string' },
      },
      required: ['module', 'dicname'],
    },
  },
];

export async function handleAdvanceModuleBuilderTool(name: string, args: Args, api: DolibarrAPI): Promise<string> {
  switch (name) {
    // ---------------- Module ----------------
    case 'amb_list_modules':
      return json(await api.get(`${BASE}/modules`));
    case 'amb_create_module': {
      const body: Record<string, unknown> = { module_name: requiredString(args, 'module_name') };
      for (const k of ['version', 'family', 'idmodule', 'editorname', 'editorurl', 'picto']) {
        if (args[k] !== undefined) body[k] = args[k];
      }
      return json(await api.post(`${BASE}/modules`, body));
    }
    case 'amb_delete_module':
      return json(await api.delete(`${BASE}/modules/${seg(requiredString(args, 'module'))}`));
    case 'amb_set_module_property':
      return json(await api.put(`${BASE}/modules/${seg(requiredString(args, 'module'))}/property`, {
        key: requiredString(args, 'key'),
        value: requiredString(args, 'value'),
      }));
    case 'amb_add_language':
      return json(await api.post(`${BASE}/modules/${seg(requiredString(args, 'module'))}/languages`, {
        langcode: requiredString(args, 'langcode'),
      }));
    case 'amb_build_package':
      return json(await api.post(`${BASE}/modules/${seg(requiredString(args, 'module'))}/package`));
    case 'amb_generate_doc':
      return json(await api.post(`${BASE}/modules/${seg(requiredString(args, 'module'))}/doc`));
    case 'amb_save_file':
      return json(await api.put(`${BASE}/modules/${seg(requiredString(args, 'module'))}/file`, {
        file: requiredString(args, 'file'),
        content: requiredString(args, 'content'),
      }));
    case 'amb_delete_file': {
      const qs = queryString({ file: requiredString(args, 'file'), objectname: args.objectname });
      return json(await api.delete(`${BASE}/modules/${seg(requiredString(args, 'module'))}/file${qs}`));
    }

    // ---------------- Objects / tables ----------------
    case 'amb_add_object': {
      const body: Record<string, unknown> = { objectname: requiredString(args, 'objectname') };
      if (args.options !== undefined) body.options = optionalObject(args, 'options');
      return json(await api.post(`${BASE}/modules/${seg(requiredString(args, 'module'))}/objects`, body));
    }
    case 'amb_delete_object':
      return json(await api.delete(`${BASE}/modules/${seg(requiredString(args, 'module'))}/objects/${seg(requiredString(args, 'objectname'))}`));
    case 'amb_add_extrafields':
      return json(await api.post(`${BASE}/modules/${seg(requiredString(args, 'module'))}/objects/${seg(requiredString(args, 'objectname'))}/extrafields`));
    case 'amb_init_object_page':
      return json(await api.post(`${BASE}/modules/${seg(requiredString(args, 'module'))}/objects/${seg(requiredString(args, 'objectname'))}/pages/${seg(requiredString(args, 'page'))}`));
    case 'amb_drop_table': {
      const qs = queryString({ extrafields: args.extrafields });
      return json(await api.delete(`${BASE}/modules/${seg(requiredString(args, 'module'))}/objects/${seg(requiredString(args, 'objectname'))}/table${qs}`));
    }

    // ---------------- Fields / properties ----------------
    case 'amb_add_field':
      return json(await api.post(`${BASE}/modules/${seg(requiredString(args, 'module'))}/objects/${seg(requiredString(args, 'objectname'))}/properties`, {
        field: requiredObject(args, 'field'),
      }));
    case 'amb_edit_field':
      return json(await api.put(`${BASE}/modules/${seg(requiredString(args, 'module'))}/objects/${seg(requiredString(args, 'objectname'))}/properties/${seg(requiredString(args, 'property'))}`, {
        field: requiredObject(args, 'field'),
      }));
    case 'amb_delete_field':
      return json(await api.delete(`${BASE}/modules/${seg(requiredString(args, 'module'))}/objects/${seg(requiredString(args, 'objectname'))}/properties/${seg(requiredString(args, 'property'))}`));

    // ---------------- REST API & parts ----------------
    case 'amb_init_api':
      return json(await api.post(`${BASE}/modules/${seg(requiredString(args, 'module'))}/api`));
    case 'amb_init_part':
      return json(await api.post(`${BASE}/modules/${seg(requiredString(args, 'module'))}/parts/${seg(requiredString(args, 'part'))}`));

    // ---------------- Permissions ----------------
    case 'amb_add_permission': {
      const body: Record<string, unknown> = {
        label: requiredString(args, 'label'),
        object: requiredString(args, 'object'),
        crud: requiredString(args, 'crud'),
      };
      if (args.id !== undefined) body.id = args.id;
      return json(await api.post(`${BASE}/modules/${seg(requiredString(args, 'module'))}/permissions`, body));
    }
    case 'amb_edit_permission':
      return json(await api.put(`${BASE}/modules/${seg(requiredString(args, 'module'))}/permissions/${seg(String(args.counter))}`, {
        right: requiredObject(args, 'right'),
      }));
    case 'amb_delete_permission':
      return json(await api.delete(`${BASE}/modules/${seg(requiredString(args, 'module'))}/permissions/${seg(String(args.permskey))}`));

    // ---------------- Menus ----------------
    case 'amb_add_menu':
      return json(await api.post(`${BASE}/modules/${seg(requiredString(args, 'module'))}/menus`, {
        menu: requiredObject(args, 'menu'),
      }));
    case 'amb_edit_menu':
      return json(await api.put(`${BASE}/modules/${seg(requiredString(args, 'module'))}/menus/${seg(String(args.menukey))}`, {
        menu: requiredObject(args, 'menu'),
      }));
    case 'amb_delete_menu':
      return json(await api.delete(`${BASE}/modules/${seg(requiredString(args, 'module'))}/menus/${seg(String(args.menukey))}`));

    // ---------------- Dictionaries ----------------
    case 'amb_add_dictionary':
      return json(await api.post(`${BASE}/modules/${seg(requiredString(args, 'module'))}/dictionaries`, {
        dicname: requiredString(args, 'dicname'),
        label: requiredString(args, 'label'),
      }));
    case 'amb_update_dictionary':
      return json(await api.put(`${BASE}/modules/${seg(requiredString(args, 'module'))}/dictionaries/${seg(String(args.key))}`, {
        label: requiredString(args, 'label'),
      }));
    case 'amb_delete_dictionary':
      return json(await api.delete(`${BASE}/modules/${seg(requiredString(args, 'module'))}/dictionaries/${seg(requiredString(args, 'dicname'))}`));

    default:
      throw new Error(`Outil Advance Module Builder inconnu: ${name}`);
  }
}
