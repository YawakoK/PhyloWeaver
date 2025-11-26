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


