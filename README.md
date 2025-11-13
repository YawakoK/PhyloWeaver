# PhyloWeaver: Interactive phylogeny editor

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
  - Edit tip labels / branch length
- **Two layout modes**
  - Phylogram (branch lengths)
  - Cladogram (equal branch lengths)
- **Search function**
  - Highlight nodes by taxon name
- **Styling options**
  - Adjust branch width, colors, and other display settings
- **Export options**
  - Export the current view as NEWICK file, tip list, and image (SVG/PDF/PNG).


## Supported formats

* **Input:** Newick (`.nwk`, `.newick`, `.tre`, `.tree`)

## Development notes

* **Framework:** React + TypeScript
* **Build tool:** Vite
* **Visualization:** D3.js
* **Styling:** Tailwind CSS

The source code is modular and organized to simplify extension and customization.


## Citation

If you use PhyloWeaver in academic work, please cite:

> Kawaguchi YW. (2025) *PhyloWeaver: an interactive web editor for phylogenetic trees.* 



## License

This project is licensed under the **MIT License**.
See the [LICENSE](LICENSE) file for details.



