![](src/assets/icons/logo.svg)

## Overview

**PhyloWeaver** is a browser-based tool for interactive editing and visualization of phylogenetic trees.  
It provides an intuitive interface for manipulating tree topology, adjusting layouts, and producing high-quality figures for research and teaching.

https://yawak.jp/PhyloWeaver/

## Features

- **Newick import**
  - Load phylogenetic trees in standard Newick format.
- **Interactive editing**
  - Reroot trees
  - Flip subtrees
  - Add / delete leaves
  - Collapse / expand clades, and name a collapsed clade
  - Edit leaf labels, internal node labels / branch length 
- **Two layout modes**
  - Phylogram (branch lengths)
  - Cladogram (equal branch lengths)
- **Search function**
  - Highlight nodes by taxon name
- **Styling options**
  - Adjust branch width, colors, and other display settings
  - Change leave name, size, color and highlight
  - Change node size and color
- **Export options**
  - Export the current view as NEWICK file, tip list, and image (SVG/PDF/PNG).

### URL-based tree loading

PhyloWeaver can also load a tree directly from a URL query parameter.  
If a URL of the form

```text
https://yawak.jp/PhyloWeaver/?newick=((A:0.1,B:0.2)95/0.98:0.3,(C:0.3,D:0.4):0.5);
```
is opened in the browser, the newick parameter is decoded and used as the initial tree.

### Loading tree files and species colors

For large trees, pass a file URL instead of putting the NEWICK contents in the URL:

```text
https://example.org/PhyloWeaver/?newickUrl=/results/tree.nwk&colorsUrl=/results/species-colors.txt
```

This is an example deployment URL; replace both file paths with the files for the current result.
Both files must be served from the same origin (scheme, host, and port) as PhyloWeaver, without redirects. Relative paths resolve against the PhyloWeaver page URL. The browser downloads these files and processes them locally; no tree data is uploaded.

- `newickUrl`: NEWICK file URL. Takes precedence over `newick` if both are provided.
- `colorsUrl`: optional species color table URL; also works with inline `newick`.
- `showSupport=1`: enable **Show support values** on startup. Omit it or use `showSupport=0` to start with support values hidden. This also works with inline `newick` or without a tree parameter. The checkbox remains editable after startup.
- Build links with `URLSearchParams` so paths and inline NEWICK are correctly encoded.

For a tree with bootstrap support values, append `&showSupport=1` to the example URL above. This only changes visibility; it does not calculate support values.

Species color tables use the following format, including blank lines and `#` comments:

```text
# Mammals
species_color: HOMSA 0xFF6600
# Sauropsids
species_color: MELGA 0xFF66FF
```

Leaf names are split on `_`; the second field is matched exactly, including case. For example, `11_HOMSA_ENSP00000296271` gets `#FF6600`. The color applies to the leaf label and node dot, not branches or internal nodes. Unmatched names (including `query` unless added to the table) retain their default color. Colors may use `0xRRGGBB` or `#RRGGBB`; the last entry wins for duplicate keys. Colors are applied on initial loading and are included in the editable tree history and image exports. Plain NEWICK export does not preserve colors.

If either file cannot be read or the color table is malformed, an error appears in the Tree tab and the existing tree is retained.

To deploy on your server, run `npm run build` and serve the **entire contents of `dist/`**, including `index.html`, CSS and assets, under `/PhyloWeaver/`. Copying only an `index-*.js` file is insufficient. To deploy at another path, build with `npm run build -- --base=/tools/PhyloWeaver/` (substitute the desired path).

### Support values and rerooting

Numeric internal labels, including paired values such as `95/0.98`, are interpreted as support for the edge leading to that node. Tip names and other internal node names are kept separate. A label on the root itself remains a node label, visible with **Internal node labels**.

**Support values** in the Style tab can be placed either at the **Node** the branch leads to (above and left of the node point, the default) or on the **Branch** they annotate (centred above its midpoint). Switching placement resets the offset fields to suitable defaults for it; adjust them afterwards as needed. Internal node labels sit below and left of the node, so support at the node and a node label can be shown together without colliding.

The separate **Interpret values as node-associated** checkbox is off by default. When enabled, subsequent reroots keep support values on their original nodes, including a node that becomes the root. Newly inserted nodes receive no support, and annotated nodes are retained when removing redundant branching points. This does not recalculate support for clades whose membership changes. Switching the checkbox does not undo earlier reroots or change the label placement. The interpretation is an editor setting, not encoded in NEWICK; select it again in a new browser session. Root support is written as `[&support=VALUE]` so it can be read back without becoming a node name.

### Naming internal nodes and collapsed clades

The **Name** field in the Edit tab applies to internal nodes as well as tips. Naming an expanded internal node turns on **Internal node labels** so the name is visible; clearing the field removes the name. Internal names are written in the usual NEWICK label position, and any support on the same edge is preserved with `[&support=VALUE]`. A numeric name is marked with `[&nodeLabel]` so that reimport does not mistake it for support.

For a **collapsed** clade the field holds the whole caption drawn beside the triangle, the parenthesised leaf count included, and whatever you type is used verbatim — `Mammalia [12 spp.]` as readily as the default `Mammalia (12)`. Leaving the field empty restores the generated caption, which keeps following the clade if its size changes. The caption is a display setting: it is not written to NEWICK, and the node's own name is what appears again when the clade is expanded.

Rerooting with the default branch interpretation preserves support for the same split of tips, together with branch lengths. Selecting a branch places the root at its midpoint. For either branch adjacent to an existing binary root, the two lengths are combined before splitting them equally; repeating this operation does not keep shortening one side. Selecting an internal node still roots at that node.

Matching support values on the two sides of a former binary root can be merged. If the values differ, both annotated segments are retained rather than discarding one. Named internal nodes are also retained when removing redundant branching points.

NEWICK export normally writes support in the numeric internal-label position. If a node has both a name and edge support, or a tip edge has support, `[&support=VALUE]` preserves that additional value. Numeric node names moved from the root are marked with `[&nodeLabel]` to distinguish them from support on reimport. PhyloWeaver reads these comments; other viewers may ignore them.



## Supported formats

* **Input:** Newick (`.nwk`, `.newick`, `.tre`, `.tree`)
* **Output** Newick (`.nwk`), Leave name list (`.txt`), Images (`.svg`, `.png`, `.pdf`)

## Development notes

* **Framework:** React + TypeScript
* **Build tool:** Vite
* **Visualization:** D3.js
* **Styling:** Tailwind CSS
* **Tree regression checks:** `npm test`


## Citation

If you use PhyloWeaver in academic work, please cite:

> Kawaguchi YW. (2025) PhyloWeaver: an interactive web editor for phylogenetic trees. Available at https://yawak.jp/PhyloWeaver/; DOI: 10.5281/zenodo.17637612

[![DOI](https://zenodo.org/badge/1095063348.svg)](https://doi.org/10.5281/zenodo.17637612)

## Data Privacy

PhyloWeaver processes all data locally in your browser.  
Your Newick files are **not uploaded**, **not stored**, and **never transmitted** to any server.

## License

This project is licensed under the **MIT License**.
See the [LICENSE](LICENSE) file for details.
