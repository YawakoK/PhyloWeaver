import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import * as d3 from 'd3';

// Exercise the actual pure tree helpers without mounting the editor or importing
// its SVG assets. Keep the production component intact.
const source = readFileSync(new URL('../src/TreeEditor.tsx', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('/** ---------- NEWICK ---------- */'), source.indexOf('/** ---------- Component ---------- */'));
const { outputText } = ts.transpileModule(helpers, { compilerOptions: { target: ts.ScriptTarget.ES2022 } });
const { parseNewick, toNewick, ensureIds, rerootAt, rerootOnEdge, collapseUnaryInPlace, collapsedPlaceholderLabel, resolveCollapsedLabel, splitEdge } = new Function('d3', `${outputText}\nreturn {parseNewick,toNewick,ensureIds,rerootAt,rerootOnEdge,collapseUnaryInPlace,collapsedPlaceholderLabel,resolveCollapsedLabel,splitEdge};`)(d3);
const parse = text => ensureIds(parseNewick(text));
const nodes = tree => d3.hierarchy(tree).descendants().map(node => node.data);
const tipNames = tree => d3.hierarchy(tree).leaves().map(node => node.data.name).sort();
const byTips = (tree, tips) => nodes(tree).find(node => JSON.stringify(tipNames(node)) === JSON.stringify([...tips].sort()));
const sumLength = tree => nodes(tree).slice(1).reduce((sum, node) => sum + (node.length ?? 0), 0);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

function splitValues(tree) {
  const all = tipNames(tree);
  const result = new Map();
  for (const node of nodes(tree).slice(1)) {
    if (node.support === undefined) continue;
    const part = tipNames(node);
    const rest = all.filter(name => !part.includes(name));
    const key = [JSON.stringify(part), JSON.stringify(rest)].sort().join('|');
    if (!result.has(key)) result.set(key, new Set());
    result.get(key).add(node.support);
  }
  return [...result].map(([key, values]) => [key, [...values].sort()]).sort();
}
function distances(tree) {
  const hierarchy = d3.hierarchy(tree);
  const leaves = hierarchy.leaves().sort((a, b) => a.data.name.localeCompare(b.data.name));
  const result = [];
  for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
    const path = leaves[i].path(leaves[j]);
    let distance = 0;
    for (let k = 1; k < path.length; k++) {
      const child = path[k].parent === path[k - 1] ? path[k] : path[k - 1];
      distance += child.data.length ?? 0;
    }
    result.push(distance);
  }
  return result;
}
function unchangedBiology(before, after) {
  assert.deepEqual(tipNames(after), tipNames(before));
  assert.deepEqual(splitValues(after), splitValues(before));
  near(sumLength(after), sumLength(before));
  distances(before).forEach((value, i) => near(value, distances(after)[i]));
}

const examples = [
  '(((A:1,B:2)90:3,C:4)80:5,D:6,E:7);',
  '(((A:1,B:2)90/0.98:3,C:4)80:5,(D:6,E:7)80:5);',
  '(((A:1,B:2)90:3,C:4)80:5,(D:6,E:7)70:5);',
  '(((A:1,B:2)90:0,C:4)0:0,D:6,E:7);',
  '(((A:1,B:2)90:-0.2,C:4)80:5,D:6,E:7);',
];

test('separates tip/node names, edge support and root labels; round-trips NEWICK', () => {
  const input = '((1_tip:1,123:2)95/0.98:3,(C:1,D:2)12_clade:3)99;';
  const tree = parse(input);
  assert.equal(byTips(tree, ['1_tip', '123']).support, '95/0.98');
  assert.equal(byTips(tree, ['1_tip', '123']).name, undefined);
  assert.equal(byTips(tree, ['C', 'D']).name, '12_clade');
  assert.equal(tree.name, '99');
  assert.equal(tree.support, undefined);
  for (const tip of d3.hierarchy(tree).leaves()) assert.equal(tip.data.support, undefined);
  assert.equal(toNewick(tree), input);
  const moved = collapseUnaryInPlace(rerootAt(tree, byTips(tree, ['1_tip', '123'])));
  const reparsed = parse(toNewick(moved));
  assert.ok(nodes(reparsed).some(node => node.name === '99'));
  unchangedBiology(tree, reparsed);
});

for (const input of examples) {
  test(`preserves all splits and distances at every internal node and edge: ${input}`, () => {
    const original = parse(input);
    for (const target of nodes(original)) {
      const fresh = parse(input);
      const node = byTips(fresh, tipNames(target));
      if (node.children?.length) {
        const moved = collapseUnaryInPlace(rerootAt(fresh, node));
        unchangedBiology(original, moved);
        unchangedBiology(original, parse(toNewick(moved)));
      }
      if (node === fresh) continue;
      const parent = nodes(fresh).find(candidate => candidate.children?.includes(node));
      const moved = collapseUnaryInPlace(rerootOnEdge(fresh, parent.__id, node.__id));
      unchangedBiology(original, moved);
      unchangedBiology(original, parse(toNewick(moved)));
      near(moved.children[0].length, moved.children[1].length);
      for (let i = 0; i < 6; i++) {
        const before = toNewick(moved);
        const selected = moved.children[i % 2];
        const repeated = collapseUnaryInPlace(rerootOnEdge(moved, moved.__id, selected.__id));
        assert.equal(toNewick(repeated), before);
      }
    }
  });
}

test('root-adjacent reroot uses the complete edge and honors explicit fractions', () => {
  const tree = parse('((A:1,B:1)90:2,(C:1,D:1)90:6);');
  const id = tree.children[0].__id;
  rerootOnEdge(tree, tree.__id, id);
  assert.deepEqual(tree.children.map(node => node.length), [4, 4]);
  rerootOnEdge(tree, tree.__id, id, 0.25);
  assert.deepEqual(tree.children.map(node => node.length), [6, 2]);
  rerootOnEdge(tree, tree.__id, id, 0.25);
  assert.deepEqual(tree.children.map(node => node.length), [6, 2]);
});

test('zero-length edges never acquire artificial positive length', () => {
  const tree = parse('(A:0,B:0,C:0);');
  const moved = collapseUnaryInPlace(rerootOnEdge(tree, tree.__id, tree.children[0].__id));
  assert.ok(nodes(moved).slice(1).every(node => node.length === 0));
});

test('edge styles follow support while node names and colors stay on their nodes', () => {
  const tree = parse('(((A:1,B:1)AB:2,C:1)ABC:3,D:1,E:1)Root;');
  const ab = byTips(tree, ['A', 'B']);
  const abc = byTips(tree, ['A', 'B', 'C']);
  ab.support = '90'; ab.__edgeColor = '#ff0000'; ab.__edgeWidth = 3; ab.__color = '#0000ff';
  abc.support = '80';
  const moved = collapseUnaryInPlace(rerootAt(tree, ab));
  assert.equal(moved.name, 'AB'); assert.equal(moved.__color, '#0000ff');
  assert.equal(moved.support, undefined); assert.equal(moved.__edgeColor, undefined);
  const reversedEdge = nodes(moved).find(node => node.name === 'ABC');
  assert.equal(reversedEdge.support, '90'); assert.equal(reversedEdge.__edgeColor, '#ff0000'); assert.equal(reversedEdge.__edgeWidth, 3);
  const reparsed = parse(toNewick(moved));
  assert.equal(nodes(reparsed).find(node => node.name === 'ABC').support, '90');
  unchangedBiology(tree, reparsed);
});

test('repeated moves through different branches retain rooted supports and distances', () => {
  const input = '(((A:0.1,B:0.2)1:0.05,C:0.03)1:0.111416,((D:0.04,E:0.05)1:0.02,(F:0.02,G:0.03)1:0.01)1:0.111416);';
  const original = parse(input);
  let tree = parse(input);
  for (const label of ['A', 'D', 'B', 'G', 'C', 'F', 'A']) {
    const target = nodes(tree).find(node => node.name === label);
    const parent = nodes(tree).find(node => node.children?.includes(target));
    tree = collapseUnaryInPlace(rerootOnEdge(tree, parent.__id, target.__id));
    unchangedBiology(original, tree);
    tree = parse(toNewick(tree));
    unchangedBiology(original, tree);
  }
});

test('invalid or stale edge selections leave the tree unchanged', () => {
  const tree = parse('((A:1,B:1)90:2,C:1,D:1);');
  const before = toNewick(tree);
  rerootOnEdge(tree, tree.__id, byTips(tree, ['A']).__id);
  assert.equal(toNewick(tree), before);
});

test('collapsed captions default to the clade name plus the leaf count', () => {
  assert.equal(collapsedPlaceholderLabel('Mammalia', 12), 'Mammalia (12)');
  assert.equal(collapsedPlaceholderLabel('  ', 12), '(12)');
  assert.equal(collapsedPlaceholderLabel(undefined, 0), '(0)');
  // Without an override the count keeps following the clade.
  assert.equal(resolveCollapsedLabel({ name: 'Mammalia' }, 12), 'Mammalia (12)');
  assert.equal(resolveCollapsedLabel({ name: 'Mammalia' }, 13), 'Mammalia (13)');
  // An override replaces the caption wholesale, parentheses included.
  assert.equal(resolveCollapsedLabel({ name: 'Mammalia', __collapsedLabel: 'Mammals [12 spp.]' }, 12), 'Mammals [12 spp.]');
  assert.equal(resolveCollapsedLabel({ name: 'Mammalia', __collapsedLabel: '' }, 12), '');
});

test('a node name and its edge support survive together through a reroot', () => {
  // Naming an internal node must not cost it the support on the same edge.
  const tree = parse('((A:1,B:2)clade[&support=95]:3,(C:1,D:2):3);');
  const moved = collapseUnaryInPlace(rerootAt(tree, byTips(tree, ['C', 'D'])));
  const clade = byTips(moved, ['A', 'B']);
  assert.equal(clade.name, 'clade');
  assert.equal(clade.support, '95');
  assert.equal(byTips(parse(toNewick(moved)), ['A', 'B']).support, '95');
});

test('splitting an edge to add a leaf does not invent support for the new split', () => {
  // splitEdge duplicates support because rerooting halves one edge into two parts of
  // the same split. Adding a leaf changes the upper split, so the caller clears it.
  const tree = parse('((A:1,B:1)90:2,C:1,D:1);');
  const clade = byTips(tree, ['A', 'B']);
  const upper = splitEdge(tree, clade, 1);
  assert.equal(upper.support, '90', 'splitEdge itself still carries support across');
  delete upper.support;
  upper.children.push({ __id: 999, name: 'New', length: 1 });
  ensureIds(tree);
  assert.equal(byTips(tree, ['A', 'B']).support, '90');
  assert.equal(byTips(tree, ['A', 'B', 'New']).support, undefined);
  assert.equal(toNewick(tree), '(((A:1,B:1)90:1,New:1):1,C:1,D:1);');
});

test('an unreadable support comment is skipped, not treated as a broken file', () => {
  // Any other unrecognised comment is ignored, and a third-party annotation using
  // this spelling must not cost the reader the whole tree.
  const tree = parse('((A:1,B:1)[&support=90%]:2,(C:1,D:1)[&&NHX:B=70]:2);');
  assert.deepEqual(tipNames(tree), ['A', 'B', 'C', 'D']);
  assert.equal(byTips(tree, ['A', 'B']).support, undefined);
  assert.equal(byTips(tree, ['C', 'D']).support, undefined);
  // A well-formed one still reads, including alongside a name.
  const ok = parse('((A:1,B:1)clade[&support=95/0.99]:2,C:1,D:1);');
  assert.equal(byTips(ok, ['A', 'B']).support, '95/0.99');
  assert.equal(byTips(ok, ['A', 'B']).name, 'clade');
});

const nodeValues = tree => nodes(tree)
  .filter(node => node.support !== undefined)
  .map(node => [node.__id, node.support])
  .sort((a, b) => a[0] - b[0]);

for (const input of examples) {
  test(`node interpretation retains values on their original nodes at every reroot: ${input}`, () => {
    const original = parse(input);
    const expected = nodeValues(original);
    function check(moved) {
      assert.deepEqual(nodeValues(moved), expected);
      assert.deepEqual(tipNames(moved), tipNames(original));
      near(sumLength(moved), sumLength(original));
      distances(original).forEach((value, i) => near(value, distances(moved)[i]));
      const reparsed = parse(toNewick(moved));
      assert.deepEqual(nodes(reparsed).map(node => node.support).filter(value => value !== undefined).sort(), expected.map(([, value]) => value).sort());
      assert.equal(reparsed.support, moved.support);
    }
    for (const target of nodes(original)) {
      const fresh = structuredClone(original);
      const node = nodes(fresh).find(candidate => candidate.__id === target.__id);
      if (node.children?.length) check(collapseUnaryInPlace(rerootAt(fresh, node, 'node'), 'node'));
      if (node === fresh) continue;
      const parent = nodes(fresh).find(candidate => candidate.children?.includes(node));
      const moved = collapseUnaryInPlace(rerootOnEdge(fresh, parent.__id, node.__id, 0.5, 'node'), 'node');
      check(moved);
      near(moved.children[0].length, moved.children[1].length);
      for (let i = 0; i < 4; i++) {
        const before = toNewick(moved);
        const selected = moved.children[i % 2];
        rerootOnEdge(moved, moved.__id, selected.__id, 0.5, 'node');
        assert.equal(toNewick(moved), before);
        assert.deepEqual(nodeValues(moved), expected);
      }
    }
  });
}

test('node support stays on the new root while branch color and width follow the original edge', () => {
  const tree = parse('(((A:1,B:1)AB[&support=90]:2,C:1)ABC[&support=80]:3,D:1,E:1)Root;');
  const ab = byTips(tree, ['A', 'B']);
  ab.__edgeColor = '#ff0000'; ab.__edgeWidth = 3; ab.__color = '#0000ff';
  const moved = collapseUnaryInPlace(rerootAt(tree, ab, 'node'), 'node');
  assert.equal(moved.name, 'AB'); assert.equal(moved.support, '90'); assert.equal(moved.__color, '#0000ff');
  assert.equal(moved.__edgeColor, undefined); assert.equal(moved.__edgeWidth, undefined);
  const reversed = nodes(moved).find(node => node.name === 'ABC');
  assert.equal(reversed.support, '80'); assert.equal(reversed.__edgeColor, '#ff0000'); assert.equal(reversed.__edgeWidth, 3);
  const reparsed = parse(toNewick(moved));
  assert.equal(reparsed.name, 'AB'); assert.equal(reparsed.support, '90');
  assert.equal(nodes(reparsed).find(node => node.name === 'ABC').support, '80');
});

test('node support is neither duplicated onto inserted nodes nor merged between unary nodes', () => {
  const tree = parse('(((A:1,B:1)90:1)90:1,C:1,D:1);');
  const expected = nodeValues(tree);
  const child = tree.children[0];
  const inserted = splitEdge(tree, child, 0.5, 'node');
  assert.equal(inserted.support, undefined);
  assert.equal(child.support, '90');
  collapseUnaryInPlace(tree, 'node');
  assert.deepEqual(nodeValues(tree), expected);
});

test('repeated node-mode reroots preserve values including one on an earlier root', () => {
  const tree = parse('(((1_tip:1,123:1)95/0.98:2,C:1)80:3,D:1,E:1);');
  const expected = nodeValues(tree);
  const internalIds = nodes(tree).filter(node => node.support !== undefined).map(node => node.__id);
  let moved = tree;
  for (const id of [...internalIds, ...internalIds.reverse()]) {
    const node = nodes(moved).find(candidate => candidate.__id === id);
    moved = collapseUnaryInPlace(rerootAt(moved, node, 'node'), 'node');
    assert.deepEqual(nodeValues(moved), expected);
    assert.equal(parse(toNewick(moved)).support, moved.support);
  }
  assert.ok(d3.hierarchy(moved).leaves().every(tip => tip.data.support === undefined));
});
