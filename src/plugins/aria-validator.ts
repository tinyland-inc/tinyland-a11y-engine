




import type { EvaluationPlugin } from '../types';

const plugin: EvaluationPlugin = {
  id: 'aria-validator',
  name: 'ARIA Validator',
  version: '1.0.0',
  rules: [
    {
      id: 'aria-valid-roles',
      name: 'ARIA roles must be valid',
      description: 'Elements must use valid ARIA roles',
      category: 'ARIA',
      severity: 'error',
      wcagCriteria: ['4.1.2'],
      selector: '[role]',
      evaluate: async (element: Element) => {
        const role = element.getAttribute('role');
        const validRoles = [
          'alert', 'alertdialog', 'application', 'article', 'banner',
          'button', 'cell', 'checkbox', 'columnheader', 'combobox',
          'complementary', 'contentinfo', 'definition', 'dialog', 'directory',
          'document', 'feed', 'figure', 'form', 'grid', 'gridcell',
          'group', 'heading', 'img', 'link', 'list', 'listbox',
          'listitem', 'log', 'main', 'marquee', 'math', 'menu',
          'menubar', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
          'navigation', 'none', 'note', 'option', 'presentation',
          'progressbar', 'radio', 'radiogroup', 'region', 'row',
          'rowgroup', 'rowheader', 'scrollbar', 'search', 'searchbox',
          'separator', 'slider', 'spinbutton', 'status', 'switch',
          'tab', 'table', 'tablist', 'tabpanel', 'term', 'textbox',
          'timer', 'toolbar', 'tooltip', 'tree', 'treegrid', 'treeitem'
        ];
        
        if (role && !validRoles.includes(role)) {
          return {
            severity: 'error',
            message: `Invalid ARIA role: ${role}`,
            category: 'ARIA',
            wcagCriteria: ['4.1.2'],
            details: { role }
          };
        }
        
        return null;
      }
    }
  ]
};

export default plugin;
