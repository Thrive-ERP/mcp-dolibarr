import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { DolibarrAPI } from '../api.js';

export const documentTools: Tool[] = [
  { name: 'list_documents', description: "Lister les documents/fichiers attachés à un objet Dolibarr", inputSchema: { type: 'object', properties: { modulepart: { type: 'string', description: "Module: 'invoice', 'proposal', 'order', 'product', 'thirdparty', 'project', 'contract', 'intervention', 'ticket', 'supplier_invoice'" }, id: { type: 'number', description: "ID de l'objet" }, ref: { type: 'string', description: 'Référence de l\'objet (alternative à id)' } }, required: ['modulepart'] } },
  { name: 'get_document', description: "Télécharger/obtenir un document (retourne base64)", inputSchema: { type: 'object', properties: { modulepart: { type: 'string', description: "Module: 'invoice', 'proposal', 'order', etc." }, original_file: { type: 'string', description: 'Chemin du fichier (obtenu via list_documents)' } }, required: ['modulepart', 'original_file'] } },
  { name: 'upload_document', description: "Uploader/attacher un fichier (image, PDF, document) à un objet Dolibarr. Le contenu doit être encodé en base64 (fileencoding='base64'). Pour une image produit, mettre modulepart='product', la ref du produit et generatethumbs=1.", inputSchema: { type: 'object', properties: { modulepart: { type: 'string', description: "Module: 'product', 'invoice', 'proposal', 'order', 'thirdparty', 'project', 'contract', 'intervention', 'ticket', 'supplier_invoice'" }, ref: { type: 'string', description: "Référence de l'objet auquel attacher le fichier (ex: PROD2, FA1701-001)" }, filename: { type: 'string', description: 'Nom du fichier avec extension (ex: photo.jpg, contrat.pdf)' }, filecontent: { type: 'string', description: 'Contenu du fichier encodé en base64' }, fileencoding: { type: 'string', description: "Encodage du contenu; utiliser 'base64' pour tout binaire (image/PDF)" }, subdir: { type: 'string', description: 'Sous-dossier optionnel dans le répertoire de l\'objet' }, overwriteifexists: { type: 'number', description: '1 pour écraser un fichier de même nom, 0 sinon (défaut 0)' }, generatethumbs: { type: 'number', description: '1 pour générer les miniatures (recommandé pour les images produit)' } }, required: ['modulepart', 'ref', 'filename', 'filecontent'] } },
  { name: 'delete_document', description: "Supprimer un document attaché", inputSchema: { type: 'object', properties: { modulepart: { type: 'string' }, original_file: { type: 'string', description: 'Chemin complet du fichier' } }, required: ['modulepart', 'original_file'] } },
  { name: 'generate_document_pdf', description: "Générer/regénérer le PDF d'un document Dolibarr", inputSchema: { type: 'object', properties: { modulepart: { type: 'string', description: "Module: 'invoice', 'proposal', 'order', 'contract', 'intervention'" }, id: { type: 'number', description: "ID de l'objet" }, langcode: { type: 'string', description: "Langue (ex: 'fr_FR')" } }, required: ['modulepart', 'id'] } },
];

export async function handleDocumentTool(name: string, args: Record<string, unknown>, api: DolibarrAPI): Promise<string> {
  switch (name) {
    case 'list_documents': {
      const params: Record<string, unknown> = { modulepart: args.modulepart };
      if (args.id) params.id = args.id;
      if (args.ref) params.ref = args.ref;
      const data = await api.get('/documents', params);
      return JSON.stringify(data, null, 2);
    }
    case 'get_document': {
      const data = await api.get('/documents/download', { modulepart: args.modulepart, original_file: args.original_file });
      return JSON.stringify(data, null, 2);
    }
    case 'upload_document': {
      const payload: Record<string, unknown> = {
        filename: args.filename,
        modulepart: args.modulepart,
        ref: args.ref,
        subdir: (args.subdir as string) || '',
        filecontent: args.filecontent,
        fileencoding: (args.fileencoding as string) || 'base64',
        overwriteifexists: args.overwriteifexists ?? 0,
        createdirifnotexists: 1,
      };
      if (args.generatethumbs !== undefined) payload.generateThumbs = args.generatethumbs;
      const data = await api.post('/documents/upload', payload);
      return `✅ Fichier "${args.filename}" attaché à ${args.modulepart} ${args.ref}.\n${JSON.stringify(data, null, 2)}`;
    }
    case 'delete_document': {
      await api.delete(`/documents?modulepart=${args.modulepart}&original_file=${encodeURIComponent(args.original_file as string)}`);
      return `✅ Document supprimé.`;
    }
    case 'generate_document_pdf': {
      const data = await api.get(`/documents/builddoc`, { modulepart: args.modulepart, original_file: args.id, langcode: args.langcode || 'fr_FR' });
      return `✅ PDF généré pour ${args.modulepart} #${args.id}.\n${JSON.stringify(data, null, 2)}`;
    }
    default: throw new Error(`Outil inconnu: ${name}`);
  }
}
