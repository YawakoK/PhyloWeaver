# PhyloWeaver: Interactive phylogeny editor

**PhyloWeaver** is a browser-based tool for interactive editing and visualization of phylogenetic trees.  
It provides an intuitive interface for manipulating tree topology, adjusting layouts, and producing high-quality figures for research and teaching.

https://yawak.jp/PhyloWeaver/

---

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

---

## Getting Started (Local Development)

This project uses **React**, **TypeScript**, and **Vite**.

### Clone and install

```bash
git clone https://github.com/YawakoK/PhyloWeaver.git
cd PhyloWeaver
npm install
