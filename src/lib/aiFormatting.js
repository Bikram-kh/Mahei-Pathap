// Convert only actual Markdown HTML break nodes, preserving code examples literally.
// All other raw HTML is left for the renderer to discard.
export function remarkLineBreaks() {
  return function transform(tree) {
    function visit(node) {
      if (!node.children) return;
      node.children = node.children.map(child => {
        if (child.type === 'html' && /^<br\s*\/?\s*>$/i.test(child.value.trim())) return { type: 'break' };
        visit(child);
        return child;
      });
    }
    visit(tree);
  };
}
