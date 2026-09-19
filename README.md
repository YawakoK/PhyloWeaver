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
  - Edit leaf labels / branch length 
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
https://yawak.jp/PhyloWeaver/?newick=((A:0.1,B:0.2)95/0.98:0.3,(C:0.3,D:0.4)88/0.92:0.5);
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
- Build links with `URLSearchParams` so paths and inline NEWICK are correctly encoded.

Species color tables use the following format, including blank lines and `#` comments:

```text
# Mammals
species_color: HOMSA 0xFF6600
# Sauropsids
species_color: MELGA 0xFF66FF
```

Leaf names are split on `_`; the second field is matched exactly, including case. For example, `11_HOMSA_ENSP00000296271` gets `#FF6600`. The color applies to the leaf label and node dot, not branches or internal nodes. Unmatched names (including `query` unless added to the table) retain their default color. Colors may use `0xRRGGBB` or `#RRGGBB`; the last entry wins for duplicate keys. Colors are applied on initial loading and are included in the editable tree history and image exports. Plain NEWICK export does not preserve colors.

If either file cannot be read or the color table is malformed, an error appears in the Data tab and the existing tree is retained.

To deploy on your server, run `npm run build` and serve the **entire contents of `dist/`**, including `index.html`, CSS and assets, under `/PhyloWeaver/`. Copying only an `index-*.js` file is insufficient. To deploy at another path, build with `npm run build -- --base=/tools/PhyloWeaver/` (substitute the desired path).



## Supported formats

* **Input:** Newick (`.nwk`, `.newick`, `.tre`, `.tree`)
* **Output** Newick (`.nwk`), Leave name list (`.txt`), Images (`.svg`, `.png`, `.pdf`)

## Development notes

* **Framework:** React + TypeScript
* **Build tool:** Vite
* **Visualization:** D3.js
* **Styling:** Tailwind CSS


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
