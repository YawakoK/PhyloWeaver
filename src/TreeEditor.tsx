import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import SearchIconSvg from "./assets/icons/Search.svg";
import LogoSvg from "./assets/icons/logo.svg";
import CladogramIconSvg from "./assets/icons/Cladogram.svg";
import PhylogramIconSvg from "./assets/icons/Phylogram.svg";
import RerootIconSvg from "./assets/icons/Reroot.svg";
import AddLeafIconSvg from "./assets/icons/AddLeaf.svg";
import FlipIconSvg from "./assets/icons/Flip.svg";
import DeleteIconSvg from "./assets/icons/Delete.svg";

type LayoutMode = "phylogram" | "cladogram";

type TreeNode = {
  __id?: number;
  __edgeColor?: string;
  __edgeWidth?: number;
  __color?: string;
  __collapsed?: boolean;
  __collapsedTipCount?: number;
  __isCollapsedPlaceholder?: boolean;
  name?: string;
  length?: number;
  children?: TreeNode[];
  [key: string]: unknown;
};

type SelectionState =
  | { type: "node"; id: number }
  | { type: "link"; parentId: number; childId: number };

type ContextMenuState = { visible: boolean; left: number; top: number };

type HierarchyNodeWithLayout = d3.HierarchyNode<TreeNode> & { _x?: number };

type PositionedNode = {
  x: number;
  y: number;
  d: HierarchyNodeWithLayout;
};

type PositionedLink = {
  source?: PositionedNode;
  target?: PositionedNode;
  data: d3.HierarchyLink<TreeNode>;
};

type LayoutSnapshot = {
  nodes: PositionedNode[];
  links: PositionedLink[];
  totalLength: number;
  xExtent: [number, number];
  yExtent: [number, number];
};

const PANEL_CARD_CLASSES = "p-4 rounded-2xl border border-[#e4e4e4] bg-white/95 shadow-lg space-y-4";
const BUTTON_CLASSES = "px-4 py-2 rounded-xl bg-[#e3a827] text-white text-base font-bold  transition-all duration-200 hover:bg-[#e3a827] hover:shadow-xl active:translate-y-[1px] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#e3a827]";
const SECONDARY_BUTTON_CLASSES = "px-4 py-2 rounded-xl bg-[#e3a827] text-white text-base font-bold  transition-all duration-200 hover:bg-[#e3a827] hover:shadow-xl active:translate-y-[1px] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#e3a827]";
const INPUT_CLASSES = "px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#286699] text-base placeholder-slate-400 text-slate-900";
const COLOR_PRESETS = ["#ff4b00","#ff8082","#f6aa00","#03af7a","#4dc4ff","#005aff","#990099","#000000"];
const GITHUB_URL = "https://github.com/YawakoK/PhyloWeaver";
const HISTORY_LIMIT = 50;

type ColorSelectorProps = {
  selectedColor?: string | null;
  onSelect: (color: string)=>void;
};

function ColorSelector({ selectedColor, onSelect }: ColorSelectorProps){
  const [showCustom, setShowCustom] = useState(false);
  const [customValue, setCustomValue] = useState(()=> (selectedColor ?? COLOR_PRESETS[0]).toUpperCase());
  const normalized = selectedColor?.toLowerCase() ?? null;
  const isPresetColor = normalized ? COLOR_PRESETS.some(c=>c.toLowerCase()===normalized) : false;
  useEffect(()=>{
    if(normalized && !isPresetColor){
      setShowCustom(true);
    }
    if(normalized){
      const formatted = normalized.startsWith("#") ? normalized : `#${normalized}`;
      setCustomValue(formatted.toUpperCase());
    }else{
      setCustomValue(prev=>prev || COLOR_PRESETS[0].toUpperCase());
    }
  },[normalized, isPresetColor]);
  const handleHexInput = (value: string)=>{
    let next = value.trim();
    if(!next.startsWith("#")) next = `#${next}`;
    next = `#${next.slice(1).replace(/[^0-9a-fA-F]/g,"")}`;
    next = next.slice(0,7).toUpperCase();
    setCustomValue(next);
    if(/^#([0-9a-fA-F]{6})$/.test(next)){
      onSelect(next.toLowerCase());
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {COLOR_PRESETS.map((color)=>{
          const isActive = normalized === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              onClick={()=>onSelect(color)}
              className={`h-8 w-8 rounded-lg border transition-shadow focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-1 ${isActive ? "border-sky-500 ring-2 ring-sky-400" : "border-slate-200"}`}
              style={{ backgroundColor: color }}
              aria-label={`Select color ${color}`}
            />
          );
        })}
        <button
          type="button"
          onClick={()=>setShowCustom(v=>!v)}
          className="px-3 py-1 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-1"
        >
          {showCustom ? "Hide" : "More"}
        </button>
      </div>
      {showCustom && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="color"
            value={/^#([0-9a-fA-F]{6})$/.test(customValue) ? customValue.toLowerCase() : "#000000"}
            onChange={(e)=>{ const next = e.target.value.toUpperCase(); setCustomValue(next); onSelect(next.toLowerCase()); }}
            className="h-9 w-12 rounded-lg border border-slate-200 bg-transparent p-0"
          />
          <input
            type="text"
            value={customValue}
            onChange={(e)=>handleHexInput(e.target.value)}
            placeholder="#000000"
            className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-1"
          />
          <span className="text-xs text-slate-600">Enter hex code</span>
        </div>
      )}
    </div>
  );
}
/** ---------- NEWICK ---------- */
function parseNewick(newick: string): TreeNode {
  let i = 0;
  function eatWhitespace() {
    while (i < newick.length && /\s/.test(newick[i])) i++;
  }
  function parseSubtree(): TreeNode {
    eatWhitespace();
    const node: TreeNode = {};
    if (newick[i] === "(") {
      i++;
      node.children = [];
      while (true) {
        node.children.push(parseSubtree());
        eatWhitespace();
        if (newick[i] === ",") {
          i++;
          continue;
        }
        if (newick[i] === ")") {
          i++;
          break;
        }
        throw new Error("Newick parse error @ " + i);
      }
    }
    eatWhitespace();
    let name = "";
    while (i < newick.length && ![":", ",", ")", ";"].includes(newick[i])) name += newick[i++];
    name = name.trim();
    if (name) node.name = name;
    if (newick[i] === ":") {
      i++;
      let len = "";
      while (i < newick.length && ![",", ")", ";"].includes(newick[i])) len += newick[i++];
      node.length = parseFloat(len);
      if (Number.isNaN(node.length)) node.length = 0;
    }
    return node;
  }
  const tree = parseSubtree();
  eatWhitespace();
  if (newick[i] === ";") i++;
  return tree;
}
function toNewick(node: TreeNode): string {
  function rec(n: TreeNode): string {
    const name = n.name ? n.name.replace(/[\s\t\n\r]/g, "_") : "";
    const len = typeof n.length === "number" ? `:${+n.length.toFixed(6)}` : "";
    if (n.children?.length) return `(${n.children.map(rec).join(",")})${name}${len}`;
    return `${name || "Unnamed"}${len}`;
  }
  return rec(node) + ";";
}

/** ---------- utils ---------- */
const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o)) as T;
function collectTips(node: TreeNode, arr: TreeNode[] = []): TreeNode[] {
  if (!node.children?.length) arr.push(node);
  else node.children.forEach((c) => collectTips(c, arr));
  return arr;
}
function mapTipCounts(node: TreeNode | null | undefined, map: Map<number, number>): number {
  if (!node) return 0;
  if (!node.children?.length) {
    if (node.__id !== undefined) map.set(node.__id, 1);
    return 1;
  }
  const sum = node.children.reduce((acc, child) => acc + mapTipCounts(child, map), 0);
  if (node.__id !== undefined) map.set(node.__id, sum);
  return sum;
}
let __ID = 1;
const nextId = () => __ID++;
function ensureIds<T extends TreeNode>(n: T): T {
  (function assignIds(x: TreeNode) {
    if (!x.__id) x.__id = nextId();
    x.children?.forEach(assignIds);
  })(n);
  return n;
}
function findById(root: TreeNode, id?: number): TreeNode | null {
  let found: TreeNode | null = null;
  d3.hierarchy<TreeNode>(root).each((d) => {
    if (d.data.__id === id) found = d.data;
  });
  return found;
}
function parentOf(root: TreeNode, childId: number): TreeNode | null {
  let parent: TreeNode | null = null;
  d3.hierarchy<TreeNode>(root).each((d) => {
    d.children?.forEach((c) => {
      if (c.data.__id === childId) parent = d.data;
    });
  });
  return parent;
}
function containsTipId(node: TreeNode, tipId: number): boolean {
  let ok = false;
  d3.hierarchy<TreeNode>(node).each((d) => {
    if (!d.children && d.data.__id === tipId) ok = true;
  });
  return ok;
}

/** ---------- reroot / edit ---------- */
function rerootAt(root: TreeNode, newRootData: TreeNode | null): TreeNode {
  if (!root) return root;
  const nodes: TreeNode[] = [];
  (function collect(n: TreeNode) {
    nodes.push(n);
    n.children?.forEach(collect);
  })(root);
  const parentMap = new Map<TreeNode, TreeNode>();
  const childLen = new Map<TreeNode, number>();
  (function setParents(n: TreeNode) {
    n.children?.forEach((c) => {
      parentMap.set(c, n);
      childLen.set(c, Number.isFinite(c.length) ? (c.length as number) : 0);
      setParents(c);
    });
  })(root);
  let newRoot: TreeNode | null = null;
  for (const n of nodes) {
    if (n === newRootData) {
      newRoot = n;
      break;
    }
  }
  if (!newRoot) return root;
  const adj = new Map<TreeNode, TreeNode[]>(nodes.map((n) => [n, [] as TreeNode[]]));
  for (const c of nodes) {
    const p = parentMap.get(c);
    if (p) {
      adj.get(p)?.push(c);
      adj.get(c)?.push(p);
    }
  }
  function build(curr: TreeNode, prev: TreeNode | null): TreeNode {
    const node: TreeNode = { name: curr.name, length: undefined };
    const children: TreeNode[] = [];
    const neighbors = adj.get(curr) ?? [];
    for (const nb of neighbors) {
      if (nb === prev) continue;
      const ch = build(nb, curr);
      const wasChild = parentMap.get(nb) === curr;
      ch.length = wasChild ? childLen.get(nb) ?? 0 : childLen.get(curr) ?? 0;
      children.push(ch);
    }
    if (children.length) node.children = children;
    return node;
  }
  const r = build(newRoot, null);
  delete r.length;
  return r;
}
function splitEdge(parentNode: TreeNode, childNode: TreeNode, t: number): TreeNode {
  const L = Number.isFinite(childNode.length) ? (childNode.length as number) : 0;
  const eps = Math.max(1e-9, L * 1e-6);
  const tt = Math.min(Math.max(t, eps), Math.max(eps, L - eps));
  const newInternal: TreeNode = { name: "", children: [childNode], length: tt };
  const idx = (parentNode.children || []).findIndex((c) => c === childNode);
  if (idx >= 0) parentNode.children?.splice(idx, 1, newInternal);
  else {
    parentNode.children ??= [];
    parentNode.children.push(newInternal);
  }
  childNode.length = Math.max(0, L - tt);
  return newInternal;
}
function rerootOnEdge(treeRoot: TreeNode, parentId: number, childId: number, frac = 0.5): TreeNode {
  const P = findById(treeRoot, parentId);
  const C = findById(treeRoot, childId);
  if (!P || !C) return treeRoot;
  const L = Number.isFinite(C.length) ? (C.length as number) : 0;
  const newInternal = splitEdge(P, C, L * (Number.isFinite(frac) ? frac : 0.5));
  const rebuilt = rerootAt(treeRoot, newInternal);
  ensureIds(rebuilt);
  return rebuilt;
}
function collapseUnaryInPlace(node: TreeNode): TreeNode {
  if (!node.children?.length) return node;
  node.children.forEach((c) => collapseUnaryInPlace(c));
  for (let i = 0; i < node.children.length; i++) {
    const ch = node.children[i];
    if (ch?.children?.length === 1) {
      const gc = ch.children[0];
      if (Number.isFinite(ch.length)) gc.length = (Number.isFinite(gc.length) ? (gc.length as number) : 0) + (ch.length as number);
      if (ch.__edgeColor && !gc.__edgeColor) gc.__edgeColor = ch.__edgeColor;
      if (typeof ch.__edgeWidth === "number" && ch.__edgeWidth > 0 && gc.__edgeWidth === undefined) {
        gc.__edgeWidth = ch.__edgeWidth;
      }
      node.children.splice(i, 1, gc);
      i--;
    }
  }
  return node;
}

/** ---------- Component ---------- */
export default function TreeEditor(){
  const EXAMPLE="((A:0.1,B:0.2)95/0.98:0.3,(C:0.3,D:0.4)88/0.92:0.5);";
  const [rawText,setRawText]=useState(EXAMPLE);
  const [tree,setTree]=useState<TreeNode>(()=>ensureIds(parseNewick(EXAMPLE)));
  const [historyStack, setHistoryStack] = useState<TreeNode[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyInitRef = useRef(false);
  const [layout,setLayout]=useState<LayoutMode>("phylogram");
  const [edgeWidth,setEdgeWidth]=useState(1.5);
  const [leafLabelSize,setLeafLabelSize]=useState(15);
  const [nodeLabelSize,setNodeLabelSize]=useState(11);
  const [branchLabelSize,setBranchLabelSize]=useState(10);
  const [supportLabelSize,setSupportLabelSize]=useState(10);
  const [branchLenOffsetX,setBranchLenOffsetX]=useState(0);
  const [branchLenOffsetY,setBranchLenOffsetY]=useState(-4);
  const [bootstrapOffsetX,setBootstrapOffsetX]=useState(0);
  const [bootstrapOffsetY,setBootstrapOffsetY]=useState(-18);
  const [nodeLabelOffsetX,setNodeLabelOffsetX]=useState(-4);
  const [nodeLabelOffsetY,setNodeLabelOffsetY]=useState(-6);
  const [xOffset,setXOffset]=useState(5);
  const [yGap,setYGap]=useState(50);
  const [italic,setItalic]=useState(false);
  const [showNodeLabels,setShowNodeLabels]=useState(false);
  const [showBranchLen,setShowBranchLen]=useState(false);
  const [showBootstrap,setShowBootstrap]=useState(false);
  const [showNodeDots,setShowNodeDots]=useState(false);
  const [leafNodeDotSize,setLeafNodeDotSize]=useState(2.5);
  const [internalNodeDotSize,setInternalNodeDotSize]=useState(3.5);
  const [search,setSearch]=useState("");
  const [searchFocusIndex,setSearchFocusIndex]=useState(0);
  const [zoomK,setZoomK]=useState(1);
  const [branchLengthInput,setBranchLengthInput]=useState("");
  const [branchWidthInput,setBranchWidthInput]=useState(()=>String(1.5));
  const [tipNameInput,setTipNameInput]=useState("");
  const [useRegex,setUseRegex]=useState(false);
  const [regexError,setRegexError]=useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"data" | "selection" | "rendering" | "export">("data");
  const [searchPopoverOpen, setSearchPopoverOpen] = useState(false);
  const [paneDimensions, setPaneDimensions] = useState({ w: 1200, h: 600 });
  const [autoLayoutVersion, setAutoLayoutVersion] = useState(0);
  const textMeasureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const menuDragHandlers = useRef<{ move: (ev: MouseEvent)=>void; up: (ev?: MouseEvent)=>void } | null>(null);
  const tipCount = useMemo(()=>collectTips(tree).length, [tree]);
  const tipCountsById = useMemo<Map<number, number>>(()=>{
    const map = new Map<number, number>();
    mapTipCounts(tree, map);
    return map;
  },[tree]);
  const displayTree = useMemo<TreeNode>(()=> {
    function cloneNode(n: TreeNode): TreeNode {
      const copy: TreeNode = { ...n };
      if(n.__collapsed && n.children?.length){
        const tipTotal = n.__id !== undefined ? tipCountsById.get(n.__id) : undefined;
        copy.__collapsedTipCount = tipTotal;
        copy.__isCollapsedPlaceholder = true;
        delete copy.children;
        return copy;
      }
      if(n.children?.length){
        copy.children = n.children.map(child=>cloneNode(child));
      }else if(copy.children){
        delete copy.children;
      }
      return copy;
    }
    return cloneNode(tree);
  },[tree, tipCountsById]);

  const measureLabelWidth = useCallback((text: string, fontSize: number, italicFlag: boolean)=>{
    if(!textMeasureCanvasRef.current){
      textMeasureCanvasRef.current=document.createElement("canvas");
    }
    const ctx=textMeasureCanvasRef.current.getContext("2d");
    if(!ctx) return text.length * fontSize * 0.6;
    ctx.font=`${italicFlag?"italic":"normal"} ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    const metrics=ctx.measureText(text);
    return metrics.width;
  },[]);

  const IconAddLeaf = () => (
    <img src={AddLeafIconSvg} alt="Add leaf" width={64} height={32} className="w-16 h-8 object-contain" aria-hidden="true" draggable={false} />
  );
  const IconDelete = () => (
    <img src={DeleteIconSvg} alt="Delete" width={64} height={32} className="w-16 h-8 object-contain" aria-hidden="true" draggable={false} />
  );
  const IconFlip = () => (
    <img src={FlipIconSvg} alt="Flip" width={64} height={32} className="w-16 h-8 object-contain" aria-hidden="true" draggable={false} />
  );
  const IconReroot = () => (
    <img
      src={RerootIconSvg}
      alt="Reroot"
      width={64}
      height={32}
      className="w-16 h-8 object-contain"
      aria-hidden="true"
      draggable={false}
    />
  );
  const IconSearch = () => (
    <img
      src={SearchIconSvg}
      alt="Search"
      className="h-6 w-6 select-none pointer-events-none"
      aria-hidden="true"
      draggable={false}
    />
  );
  const IconLayoutPhylo = ({ active }: { active: boolean }) => (
    <img
      src={PhylogramIconSvg}
      alt="Phylogram layout"
      className={`h-6 w-6 ${active ? "opacity-100" : "opacity-60"}`}
      aria-hidden="true"
      draggable={false}
    />
  );
  const IconLayoutClado = ({ active }: { active: boolean }) => (
    <img
      src={CladogramIconSvg}
      alt="Cladogram layout"
      className={`h-6 w-6 ${active ? "opacity-100" : "opacity-60"}`}
      aria-hidden="true"
      draggable={false}
    />
  );

  // Horizontal scale width adjustable via UI
  const [xScaleWidth, setXScaleWidth] = useState(()=>1200);
  const [autoWidthHint, setAutoWidthHint] = useState(()=>1200);
  const horizontalScaleMax = useMemo(()=>{
    const base = Math.max(200, autoWidthHint || 200);
    const limit = Math.round(base * 10);
    return Math.max(400, Math.min(100000, limit));
  },[autoWidthHint]);
  const clampHorizontalWidth = useCallback((value: number)=>{
    const numeric = Number.isFinite(value) ? value : autoWidthHint;
    return Math.max(200, Math.min(horizontalScaleMax, numeric || 200));
  },[horizontalScaleMax, autoWidthHint]);
  // PNG export scale multiplier for crisp output
  const [pngScale, setPngScale] = useState(3); // crisp 3x default

  const svgRef=useRef<SVGSVGElement|null>(null); const gRef=useRef<SVGGElement|null>(null); const rightPaneRef=useRef<HTMLDivElement|null>(null); const zoomRef=useRef<d3.ZoomBehavior<SVGSVGElement, unknown>|null>(null);
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const paneSizeRef = useRef<{w:number;h:number}>({ w: 1200, h: 600 });
  const userAdjustedZoomRef = useRef<boolean>(false);
  const userSetWidthRef = useRef<boolean>(false);
  const userSetYGapRef = useRef<boolean>(false);
  const baseTranslateX = 80;
  const baseTranslateY = 320;
  const treeViewYOffset = 30;

  const refreshPaneDimensions = useCallback(()=>{
    const pane = rightPaneRef.current;
    if(!pane) return paneDimensions;
    const rect = pane.getBoundingClientRect();
    const style = typeof window !== "undefined" ? getComputedStyle(pane) : null;
    const padX = style ? ((parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)) : 0;
    const padY = style ? ((parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)) : 0;
    const width = Math.max(360, (rect?.width ?? pane.clientWidth ?? paneDimensions.w) - padX);
    const height = Math.max(320, (rect?.height ?? pane.clientHeight ?? paneDimensions.h) - padY);
    const next = { w: width, h: height };
    paneSizeRef.current = next;
    if(Math.abs(width - paneDimensions.w) > 0.5 || Math.abs(height - paneDimensions.h) > 0.5){
      setPaneDimensions(next);
    }
    return next;
  },[paneDimensions]);

  useEffect(()=>{
    if(historyInitRef.current) return;
    historyInitRef.current = true;
    setHistoryStack([clone(tree)]);
    setHistoryIndex(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const longestLabelWidthPx = useMemo(()=>{
    const root = d3.hierarchy<TreeNode>(displayTree);
    let max = 0;
    root.leaves().forEach(leaf=>{
      const name = leaf.data.name || "Unnamed";
      const widthPx = measureLabelWidth(name, leafLabelSize, italic);
      if(widthPx > max) max = widthPx;
    });
    return max;
  },[displayTree, leafLabelSize, italic, measureLabelWidth]);
  const getCollapsedTriangleMetrics = useCallback((tipTotal?: number)=>{
    const safeCount = Number.isFinite(tipTotal) && tipTotal ? Math.max(1, Number(tipTotal)) : 1;
    const maxHeight = Math.max(leafLabelSize + 6, Math.min(Math.max(leafLabelSize * 1.5, 18), yGap * 0.8));
    const widthBoost = Math.log10(safeCount + 1) * 18;
    const width = Math.min(200, Math.max(24, maxHeight * 1.2 + widthBoost));
    return { width, height: maxHeight };
  },[leafLabelSize, yGap]);

  const computeAutoHorizontalScale = useCallback(()=>{
    const { w: measuredWidth, h: measuredHeight } = refreshPaneDimensions();
    const paneEl = rightPaneRef.current;
    const paneWidthRaw = paneEl ? (paneEl.clientWidth || paneEl.getBoundingClientRect().width) : measuredWidth;
    const paneWidth = Number.isFinite(paneWidthRaw) && paneWidthRaw > 0 ? paneWidthRaw : 900;
    const paneHeight = Number.isFinite(measuredHeight) && measuredHeight > 0 ? measuredHeight : paneDimensions.h;
    const usableCanvasWidth = Math.max(360, paneWidth - 48);
    const labelReserve = Math.max(140, longestLabelWidthPx + Math.max(12, xOffset) + 60);
    const branchSpace = Math.max(200, Math.floor(usableCanvasWidth - labelReserve));

    const root = d3.hierarchy<TreeNode>(displayTree);
    let maxAccumLen = 0;
    let minPositiveLen = Number.POSITIVE_INFINITY;
    (function walk(node: d3.HierarchyNode<TreeNode>, acc = 0){
      const increment = Number.isFinite(node.data.length) ? Number(node.data.length) : 0;
      if(increment > 1e-12 && increment < minPositiveLen) minPositiveLen = increment;
      const next = acc + increment;
      if(!node.children?.length){
        if(next > maxAccumLen) maxAccumLen = next;
      }else{
        node.children.forEach(child=>walk(child, next));
      }
    })(root, 0);

    const maxDepth = d3.max(root.descendants().map(d=>d.depth)) ?? 1;
    let recommendedWidth = branchSpace;
    if(layout === "phylogram" && maxAccumLen > 1e-7){
      const pxPerUnitFromPane = branchSpace / Math.max(1e-9, maxAccumLen);
      const effectivePaneHeight = Math.max(360, Number.isFinite(paneHeight) && paneHeight > 0 ? paneHeight : 600);
      const targetMinBranchPx = Math.min(1200, Math.max(220, Math.round(effectivePaneHeight * 1.1)));
      const isTinyBranchScenario =
        Number.isFinite(minPositiveLen) &&
        minPositiveLen < Number.POSITIVE_INFINITY &&
        minPositiveLen > 0 &&
        (minPositiveLen / Math.max(maxAccumLen, 1e-9)) <= 0.05;
      let pxPerUnit = pxPerUnitFromPane;
      if(isTinyBranchScenario && minPositiveLen){
        const detailPxPerUnitRaw = targetMinBranchPx / Math.max(minPositiveLen, 1e-9);
        const maxDetailBoost = pxPerUnitFromPane * 60;
        const detailPxPerUnit = maxDetailBoost > 0 ? Math.min(detailPxPerUnitRaw, maxDetailBoost) : detailPxPerUnitRaw;
        pxPerUnit = Math.max(pxPerUnit, detailPxPerUnit);
      }
      recommendedWidth = Math.round(Math.max(branchSpace, maxAccumLen * pxPerUnit));
    }else{
      const basePerDepth = Math.round(Math.max(80, branchSpace / Math.max(3, maxDepth)));
      recommendedWidth = Math.max(branchSpace, basePerDepth * Math.max(1, maxDepth));
    }
    recommendedWidth = Math.max(400, Math.min(80000, recommendedWidth));
    return Math.round(recommendedWidth);
  },[refreshPaneDimensions, longestLabelWidthPx, xOffset, displayTree, layout, paneDimensions.h]);

  useEffect(()=>{
    const recommended = computeAutoHorizontalScale();
    setAutoWidthHint(recommended);
    if(userSetWidthRef.current) return;
    setXScaleWidth(prev=> prev === recommended ? prev : recommended);
  },[computeAutoHorizontalScale, autoLayoutVersion]);

  const commitTree = useCallback((nextTree: TreeNode, options?: { preserveZoom?: boolean; skipHistory?: boolean })=>{
    if(options?.preserveZoom) {
      userAdjustedZoomRef.current = true;
    } else {
      userAdjustedZoomRef.current = false;
      userSetWidthRef.current = false;
      userSetYGapRef.current = false;
      setAutoLayoutVersion((v)=>v+1);
    }
    const snapshot = clone(nextTree);
    setTree(snapshot);
    if(!options?.skipHistory){
      setHistoryStack(prev=>{
        const trimmed = historyIndex >= 0 ? prev.slice(0, historyIndex + 1) : [];
        trimmed.push(snapshot);
        const limited = trimmed.length > HISTORY_LIMIT ? trimmed.slice(trimmed.length - HISTORY_LIMIT) : trimmed;
        setHistoryIndex(limited.length - 1);
        return limited;
      });
    }
  },[historyIndex]);


  // Layout computation
  const { nodes, links, totalLength, xExtent, yExtent } = useMemo<LayoutSnapshot>(()=>{
    const root=d3.hierarchy<TreeNode>(displayTree) as HierarchyNodeWithLayout;
    let idx=0; const yMap=new Map<d3.HierarchyNode<TreeNode>, number>();
    (function post(d: d3.HierarchyNode<TreeNode>){
      if(!d.children?.length){ yMap.set(d, idx++ * yGap); return; }
      d.children.forEach(post);
      const childValues = d.children.map(c=>yMap.get(c) ?? 0);
      yMap.set(d, d3.mean(childValues) ?? 0);
    })(root);

    let maxDepth=0; root.each(d=>{ if(!d.children) maxDepth=Math.max(maxDepth,d.depth); });
    (function assignX(d: HierarchyNodeWithLayout){
      if(!d.parent) d._x=0;
      else if(layout==='phylogram') d._x = (d.parent._x ?? 0) + (Number.isFinite(d.data.length)?Number(d.data.length):0);
      else d._x = (!d.children?.length)? maxDepth : d.depth;
      d.children?.forEach(child=>assignX(child as HierarchyNodeWithLayout));
    })(root);

    const xMax=d3.max(root.descendants().map(d=>(d as HierarchyNodeWithLayout)._x ?? 0)) ?? 1;
    const xScale=d3.scaleLinear().domain([0, Math.max(1,xMax)]).range([0, xScaleWidth]);
    const nodes: PositionedNode[]=root.descendants().map(d=>{
      const layoutNode=d as HierarchyNodeWithLayout;
      return { x:xScale(layoutNode._x ?? 0), y:yMap.get(d) ?? 0, d:layoutNode };
    });
    const nodeMap=new Map<HierarchyNodeWithLayout, PositionedNode>(nodes.map(n=>[n.d,n]));
    const links: PositionedLink[]=root.links().map(l=>({
      source: nodeMap.get(l.source as HierarchyNodeWithLayout),
      target: nodeMap.get(l.target as HierarchyNodeWithLayout),
      data:l
    }));

    const labelPad = Math.max(4, xOffset);
    const xs=nodes.map(n=>n.x), ys=nodes.map(n=>n.y);
    const labelAdjustedMax = nodes.reduce((max, n)=>{
      if(n.d.children?.length) return Math.max(max, n.x);
      const isCollapsed = Boolean(n.d.data.__isCollapsedPlaceholder);
      const collapsedMetrics = isCollapsed ? getCollapsedTriangleMetrics(n.d.data.__collapsedTipCount) : null;
      const trimmed = (n.d.data.name ?? "").toString().trim();
      const collapsedCount = typeof n.d.data.__collapsedTipCount === "number" ? n.d.data.__collapsedTipCount : 0;
      const labelText = isCollapsed ? `(${collapsedCount})` : (trimmed || "Unnamed");
      const offset = (collapsedMetrics?.width ?? 0) + labelPad;
      const approx = measureLabelWidth(labelText, leafLabelSize, !isCollapsed && italic) + offset;
      return Math.max(max, n.x + approx);
    }, Math.max(...xs, 0));
    const xExtent:[number,number]=[Math.min(...xs,0), Math.max(labelAdjustedMax,0)];
    const yExtent:[number,number]=[Math.min(...ys,0), Math.max(...ys,0)];
    return { nodes, links, totalLength: Math.max(1,xMax), xExtent, yExtent };
  },[displayTree, layout, yGap, xScaleWidth, leafLabelSize, xOffset, italic, measureLabelWidth, getCollapsedTriangleMetrics]);

  /** ---------- ScaleBar: HTML overlay (onscreen) ---------- */
  function formatScaleUnits(value: number){
    if(!Number.isFinite(value)) return "";
    if(value === 0) return "0";
    const abs = Math.abs(value);
    if(abs < 1e-6) return value.toExponential(2);
    let decimals: number;
    if(abs >= 100) decimals = 0;
    else if(abs >= 10) decimals = 1;
    else if(abs >= 1) decimals = 2;
    else decimals = Math.min(6, Math.ceil(Math.abs(Math.log10(abs))) + 1);
    const fixed = value.toFixed(decimals);
    return fixed.replace(/(\.\d*?[1-9])0+$/,"$1").replace(/\.0+$/,"");
  }
  function ScaleBarHTML({ totalLength, zoomK }: { totalLength: number; zoomK?: number }) {
    if(layout !== "phylogram") return null;
    if(!Number.isFinite(totalLength) || totalLength <= 0) return null;
    const basePxPerUnit = xScaleWidth / Math.max(1e-9, totalLength);
    const pxPerUnit = basePxPerUnit * Math.max(zoomK || 1, 1e-6);
    const scale = computeScaleBar(pxPerUnit, 32, 200);
    if(!scale) return null;
    const label = formatScaleUnits(scale.units);
    if(!label) return null;
    return (
      <div className="absolute left-6 top-4 bg-transparent px-3 py-2 rounded-xl border border-transparent text-s text-slate-700">
        <div className="flex flex-col gap-1">
          <div className="h-[2px] bg-slate-700" style={{ width: scale.px }} />
          <span className="text-[0.7rem] font-medium text-slate-700">{label}</span>
        </div>
      </div>
    );
  }

  // Selection & context menu
  const [selection,setSelection]=useState<SelectionState | null>(null);
  const [menu,setMenu]=useState<ContextMenuState>({visible:false,left:0,top:0});

  const selectedBranchNode = useMemo<TreeNode | null>(()=>{
    if(!selection) return null;
    const targetId = selection.type === 'link' ? selection.childId : selection.id;
    return targetId ? findById(tree, targetId) : null;
  },[selection, tree]);

  useEffect(()=>{
    if(selectedBranchNode && Number.isFinite(selectedBranchNode.length)){
      setBranchLengthInput(String(selectedBranchNode.length));
    }else{
      setBranchLengthInput("");
    }
    const widthValue =
      selectedBranchNode && typeof selectedBranchNode.__edgeWidth === "number" && selectedBranchNode.__edgeWidth > 0
        ? selectedBranchNode.__edgeWidth
        : edgeWidth;
    setBranchWidthInput(String(widthValue));
    if(selectedBranchNode && !selectedBranchNode.children?.length){
      setTipNameInput(selectedBranchNode.name || "");
    }else{
      setTipNameInput("");
    }
  },[selectedBranchNode, edgeWidth]);

  const activeSelectionColor = useMemo(()=>{
    if(!selection || !selectedBranchNode) return null;
    return selection.type==='link'
      ? (selectedBranchNode.__edgeColor ?? null)
      : (selectedBranchNode.__color ?? null);
  },[selection, selectedBranchNode]);
  const canCollapseSelection = Boolean(selectedBranchNode?.children?.length && !selectedBranchNode.__collapsed);
  const canExpandSelection = Boolean(selectedBranchNode?.__collapsed);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex >= 0 && historyIndex < historyStack.length - 1;

  const handleUndo = useCallback(()=>{
    if(historyIndex <= 0) return;
    const target = historyStack[historyIndex - 1];
    setHistoryIndex(historyIndex - 1);
    commitTree(clone(target), { preserveZoom: true, skipHistory: true });
  },[historyIndex, historyStack, commitTree]);

  const handleRedo = useCallback(()=>{
    if(historyIndex < 0 || historyIndex >= historyStack.length - 1) return;
    const target = historyStack[historyIndex + 1];
    setHistoryIndex(historyIndex + 1);
    commitTree(clone(target), { preserveZoom: true, skipHistory: true });
  },[historyIndex, historyStack, commitTree]);

  const hideContextMenu = useCallback(()=>{
    setMenu(prev=> prev.visible ? { ...prev, visible:false } : prev);
  },[]);

  const clearSelectionState = useCallback(()=>{
    setSelection(null);
    hideContextMenu();
  },[hideContextMenu]);

  const handleCanvasBackgroundClick = useCallback((e: React.MouseEvent<HTMLDivElement>)=>{
    if(e.target !== e.currentTarget) return;
    e.stopPropagation();
    clearSelectionState();
  },[clearSelectionState]);

  const handleSvgBlankClick = useCallback((e: React.MouseEvent<SVGSVGElement>)=>{
    e.stopPropagation();
    clearSelectionState();
  },[clearSelectionState]);

  // Zoom interaction setup
  useEffect(()=>{
    const svgEl = svgRef.current;
    const gEl = gRef.current;
    if(!svgEl || !gEl) return;
    const svg=d3.select<SVGSVGElement, unknown>(svgEl);
    const g=d3.select<SVGGElement, unknown>(gEl);
    const onZoom=(ev: d3.D3ZoomEvent<SVGSVGElement, unknown>)=>{
      if(ev.sourceEvent) userAdjustedZoomRef.current = true;
      g.attr("transform", `translate(${ev.transform.x + baseTranslateX},${ev.transform.y + baseTranslateY}) scale(${ev.transform.k})`);
      zoomTransformRef.current = ev.transform;
      setZoomK(ev.transform.k||1);
    };
    const zoom=d3.zoom<SVGSVGElement, unknown>().on("zoom", onZoom);
    zoomRef.current=zoom;
    svg.call(zoom);
    return ()=>{
      svg.on(".zoom", null);
    };
  },[baseTranslateX, baseTranslateY]);

  // Observe right pane size (used for manual resets)

  // Auto-fit on first render and when core layout knobs change
  const fitToViewport = useCallback(()=>{
    const svgNode=svgRef.current; if(!svgNode||!zoomRef.current) return;
    const pad=60;
    const size = paneSizeRef.current;
    const svgW=svgNode.clientWidth||size.w;
    const svgH=svgNode.clientHeight||size.h;
    const minx=Math.min(xExtent[0],0), maxx=Math.max(xExtent[1],0);
    const miny=Math.min(yExtent[0],0), maxy=Math.max(yExtent[1],0);
    const gw=Math.max(1,maxx-minx), gh=Math.max(1,maxy-miny);
    const viewableWidth = Math.max(1, svgW - pad*2);
    const viewableHeight = Math.max(1, svgH - pad*2);
    const kx = viewableWidth / gw;
    const ky = viewableHeight / gh;
    const k = Math.max(1e-6, Math.min(kx, ky));
    const x=pad - baseTranslateX - k*minx;
    const y=pad + treeViewYOffset - baseTranslateY - k*miny;
    const svgSelection = d3.select<SVGSVGElement, unknown>(svgNode);
    svgSelection
      .transition()
      .duration(250)
      .call(zoomRef.current.transform, d3.zoomIdentity.translate(x,y).scale(k));
    userAdjustedZoomRef.current = false;
  },[xExtent, yExtent, baseTranslateX, baseTranslateY, treeViewYOffset]);

  const didFirstFitRef = useRef(false);

  const handleHorizontalScaleSlider = useCallback((value: number)=>{
    userSetWidthRef.current = true;
    setXScaleWidth(clampHorizontalWidth(value));
    requestAnimationFrame(()=>fitToViewport());
  },[clampHorizontalWidth, fitToViewport]);

  const handleManualYGapChange = useCallback((value: number)=>{
    userSetYGapRef.current = true;
    setYGap(prev=>{
      const numeric = Number.isFinite(value) ? value : prev;
      const next = Math.max(12, Math.min(200, numeric));
      if(next === prev) return prev;
      requestAnimationFrame(()=>fitToViewport());
      return next;
    });
  },[fitToViewport]);

  const focusOnPoint = useCallback((targetX: number, targetY: number, options?: { scale?: number; preserveScale?: boolean })=>{
    const svgNode = svgRef.current;
    const zoomBehavior = zoomRef.current;
    if(!svgNode || !zoomBehavior) return;
    const { w, h } = paneSizeRef.current;
    const centerX = w / 2;
    const centerY = h / 2;
    const minScale = 1.35;
    const maxScale = 4;
    const currentTransform = zoomTransformRef.current ?? d3.zoomIdentity;
    const preserve = Boolean(options?.preserveScale);
    const baseScale = (()=> {
      if(Number.isFinite(options?.scale)) return options?.scale as number;
      if(preserve) return Number.isFinite(currentTransform.k) ? currentTransform.k : zoomK;
      return zoomK;
    })();
    const targetScale = preserve
      ? Math.min(maxScale, Math.max(0.1, Number.isFinite(baseScale) ? baseScale : 1))
      : Math.min(maxScale, Math.max(minScale, Number.isFinite(baseScale) ? baseScale : minScale));
    const tx = centerX - baseTranslateX - targetScale * targetX;
    const ty = centerY - baseTranslateY - targetScale * targetY;
    const svgSelection = d3.select<SVGSVGElement, unknown>(svgNode);
    svgSelection
      .transition()
      .duration(preserve ? 120 : 250)
      .call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(targetScale));
    userAdjustedZoomRef.current = true;
  },[baseTranslateX, baseTranslateY, zoomK]);

  const applyAutoHorizontalScale = useCallback(()=>{
    userSetWidthRef.current = false;
    const recommended = computeAutoHorizontalScale();
    setAutoWidthHint(recommended);
    setXScaleWidth(prev=> prev === recommended ? prev : recommended);
    requestAnimationFrame(()=>fitToViewport());
  },[computeAutoHorizontalScale, fitToViewport]);

  const computeAutoVerticalSpacing = useCallback(()=>{
    const paneHeight = Math.max(200, paneDimensions.h - 160);
    const leaves = Math.max(1, tipCount);
    const spacing = Math.max(16, Math.min(140, Math.floor(paneHeight / Math.max(1, leaves))));
    return spacing;
  },[paneDimensions.h, tipCount]);

  const autoAdjustVerticalSpacing = useCallback(()=>{
    const spacing = computeAutoVerticalSpacing();
    userSetYGapRef.current = false;
    setYGap(prev=>{
      if(prev === spacing) return prev;
      requestAnimationFrame(()=>fitToViewport());
      return spacing;
    });
  },[computeAutoVerticalSpacing, fitToViewport]);
  useEffect(()=>{
    const pane=rightPaneRef.current;
    if(!pane) return;
    const ro=new ResizeObserver((entries)=>{
      for(const entry of entries){
        const target = entry.target as HTMLElement;
        const rect = target?.getBoundingClientRect();
        const width = rect?.width ?? entry.contentRect.width;
        const height = rect?.height ?? entry.contentRect.height;
        const style = target ? getComputedStyle(target) : null;
        const padX = style ? ((parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)) : 0;
        const padY = style ? ((parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)) : 0;
        const nextDimensions = {
          w: Math.max(360, width - padX),
          h: Math.max(320, height - padY),
        };
        paneSizeRef.current = nextDimensions;
        setPaneDimensions(nextDimensions);
        const recommended = computeAutoHorizontalScale();
        setAutoWidthHint(recommended);
        if(!userSetWidthRef.current){
          setXScaleWidth(prev=> prev === recommended ? prev : recommended);
        }
        if(!userSetYGapRef.current){
          const spacing = computeAutoVerticalSpacing();
          setYGap(prev=> Math.abs(prev - spacing) > 0.5 ? spacing : prev);
        }
      }
    });
    ro.observe(pane);
    return ()=>ro.disconnect();
  },[computeAutoHorizontalScale, computeAutoVerticalSpacing]);
  useEffect(()=>{
    if(userSetYGapRef.current) return;
    const spacing = computeAutoVerticalSpacing();
    if(Math.abs(yGap - spacing) > 0.5){
      setYGap(spacing);
      requestAnimationFrame(()=>fitToViewport());
    }
  },[computeAutoVerticalSpacing, fitToViewport, yGap, autoLayoutVersion, xScaleWidth]);
  useEffect(()=>{
    // Auto-fit on initial render only
    if(!didFirstFitRef.current){
      didFirstFitRef.current=true;
      const id=requestAnimationFrame(fitToViewport);
      return ()=>cancelAnimationFrame(id);
    }
  },[fitToViewport]);
  useEffect(()=>{
    if(userSetWidthRef.current) return;
    const recommended = computeAutoHorizontalScale();
    setAutoWidthHint(recommended);
    if(recommended && recommended !== xScaleWidth){
      setXScaleWidth(recommended);
    }
  },[computeAutoHorizontalScale, xScaleWidth]);
  useEffect(()=>{
    if(userAdjustedZoomRef.current) return;
    const id=requestAnimationFrame(fitToViewport);
    return ()=>cancelAnimationFrame(id);
  },[tree, layout, yGap, xScaleWidth, fitToViewport]);

  const handleLayoutModeChange = (mode: LayoutMode) => {
    if(layout === mode){
      fitToViewport();
      return;
    }
    userAdjustedZoomRef.current = false;
    setLayout(mode);
    requestAnimationFrame(fitToViewport);
  };

  // Search highlights
  const { matchSet: searchSet, error: searchSetError } = useMemo<{
    matchSet: Set<number>;
    error: string | null;
  }>(()=>{
    const empty = new Set<number>();
    const raw = search ?? "";
    if(!raw) return { matchSet: empty, error: null };
    if(useRegex){
      try{
        const regex = new RegExp(raw, "i");
        const result = new Set<number>();
        d3.hierarchy<TreeNode>(tree).each(d=>{
          if(!d.children){
            const nm=d.data.name||"";
            if(regex.test(nm) && d.data.__id !== undefined) result.add(d.data.__id);
          }
        });
        return { matchSet: result, error: null };
      }catch(err){
        return { matchSet: empty, error: (err as Error).message };
      }
    }
    const query = raw.toLowerCase();
    const result = new Set<number>();
    d3.hierarchy<TreeNode>(tree).each(d=>{
      if(!d.children){
        const nm=(d.data.name||"").toLowerCase();
        if(nm.includes(query) && d.data.__id !== undefined) result.add(d.data.__id);
      }
    });
    return { matchSet: result, error: null };
  },[search, tree, useRegex]);

  useEffect(()=>{ setRegexError(searchSetError); },[searchSetError]);

  const searchMatches = useMemo(()=> {
    if(!searchSet.size) return [];
    const ordered = nodes
      .map((n)=> {
        const nodeId = n.d.data.__id;
        if(nodeId === undefined || !searchSet.has(nodeId)) return null;
        return { id: nodeId, x: n.x, y: n.y };
      })
      .filter((d): d is { id: number; x: number; y: number } => Boolean(d));
    return ordered;
  },[nodes, searchSet]);

  const activeSearchTarget = searchMatches.length
    ? searchMatches[Math.min(searchFocusIndex, searchMatches.length - 1)]
    : null;
  const activeSearchNodeId = activeSearchTarget?.id ?? null;
  const hasSearchMatches = searchMatches.length > 0;
  const searchPositionLabel = hasSearchMatches ? `${searchFocusIndex + 1} / ${searchMatches.length}` : "0 / 0";

  useEffect(()=>{
    setSearchFocusIndex(0);
  },[search, useRegex]);

  useEffect(()=>{
    if(!searchMatches.length){
      setSearchFocusIndex(0);
      return;
    }
    setSearchFocusIndex(prev=>{
      const next = Math.max(0, Math.min(prev, searchMatches.length - 1));
      return next;
    });
  },[searchMatches.length]);

  const handleSearchNavigate = useCallback((direction: 1 | -1)=>{
    setSearchFocusIndex(prev=>{
      const count = searchMatches.length;
      if(count <= 0) return 0;
      const next = (prev + direction + count) % count;
      const target = searchMatches[next];
      if(target) focusOnPoint(target.x, target.y, { preserveScale: true });
      return next;
    });
  },[searchMatches, focusOnPoint]);

  // Loading helpers
  function handleFileLoad(files: FileList | null){
    const f=files?.[0]; if(!f) return;
    const reader=new FileReader();
    reader.onload=()=>{ try{ setRawText(String(reader.result)); setActiveTab("data"); }catch(e){ const message = e instanceof Error ? e.message : String(e); alert("Failed to read NEWICK: "+message);} };
    reader.readAsText(f);
  }
  function applyText(){ try{ commitTree(ensureIds(parseNewick(rawText))); }catch(e){ const message = e instanceof Error ? e.message : String(e); alert("Failed to parse NEWICK: "+message);} }
  function loadExample(){ const s=EXAMPLE; setRawText(s); try{ commitTree(ensureIds(parseNewick(s))); }catch(e){ const message = e instanceof Error ? e.message : String(e); alert("Failed to parse example: "+message);} }

  function openMenuAt(cx: number, cy: number){
    const pane=rightPaneRef.current; if(!pane) return;
    const r=pane.getBoundingClientRect(); setMenu({visible:true,left:cx - r.left, top:cy - r.top});
  }
  function onClickNode(n: PositionedNode, e: React.MouseEvent<SVGGElement, MouseEvent>){
    if(n.d.data.__id === undefined) return;
    setSelection({type:'node', id:n.d.data.__id});
    openMenuAt(e.clientX,e.clientY);
    e.stopPropagation();
  }
  function onClickLink(l: PositionedLink, e: React.MouseEvent<SVGGElement, MouseEvent>){
    if(!l.source || !l.target) return;
    const parentId=l.source.d.data.__id;
    const childId=l.target.d.data.__id;
    if(parentId === undefined || childId === undefined) return;
    setSelection({type:'link', parentId, childId});
    openMenuAt(e.clientX,e.clientY); e.stopPropagation();
  }

  // Editing actions
  function actionCollapseSelected(){
    if(!selection) return;
    const targetId = selection.type==='node'?selection.id:selection.childId;
    if(targetId === undefined) return;
    const target = findById(tree, targetId);
    if(!target?.children?.length) return;
    target.__collapsed = true;
    commitTree(clone(tree), { preserveZoom: true });
    setMenu({...menu,visible:false});
  }
  function actionExpandSelected(){
    if(!selection) return;
    const targetId = selection.type==='node'?selection.id:selection.childId;
    if(targetId === undefined) return;
    const target = findById(tree, targetId);
    if(!target) return;
    if(target.__collapsed){
      delete target.__collapsed;
      commitTree(clone(tree), { preserveZoom: true });
    }
    setMenu({...menu,visible:false});
  }
  function actionDeleteSelected(){ if(!selection) return;
    if(selection.type==='node'){ const p=parentOf(tree, selection.id); if(!p){ alert('Cannot delete the root node'); return; }
      p.children=(p.children||[]).filter(c=>c.__id!==selection.id); if(!p.children?.length) delete p.children;
    } else { const p=findById(tree, selection.parentId); if(!p?.children) return; p.children=p.children.filter(c=>c.__id!==selection.childId); if(!p.children?.length) delete p.children; }
    collapseUnaryInPlace(tree); setSelection(null); setMenu({...menu,visible:false}); commitTree(clone(tree), { preserveZoom: true });
  }
  function actionAddLeaf(){ if(!selection) return;
    if(selection.type==='link'){ const p=findById(tree, selection.parentId), c=findById(tree, selection.childId); if(!p||!c) return;
      const currentLength = typeof c.length === "number" && Number.isFinite(c.length) ? c.length : 0.1;
      const R=splitEdge(p,c,Math.max(1e-6,currentLength/2));
      R.children??=[];
      R.children.push({__id:nextId(), name:'New', length:Math.max(1e-3,currentLength/2)});
      ensureIds(tree); commitTree(clone(tree), { preserveZoom: true }); setMenu({...menu,visible:false}); return; }
    if(selection.type==='node'){ const t=findById(tree, selection.id); if(!t) return;
      const leaf={__id:nextId(), name:'New', length: layout==='phylogram'?0.1:undefined};
      if(!t.children?.length) t.children=[leaf];
      else if(t.children.length===1) t.children.push(leaf);
      else {
        const existingChildren = t.children ?? [];
        const clonedChildren = existingChildren.map(x=>x);
        const I: TreeNode={__id:nextId(), name:'', children:clonedChildren};
        I.length=undefined; t.children=[I,leaf];
        const lens=clonedChildren.map(ch=>Number.isFinite(ch.length)?Number(ch.length):0).filter(v=>Number.isFinite(v));
        const med=lens.length? lens.sort((a,b)=>a-b)[Math.floor(lens.length/2)]:0.1;
        leaf.length = (layout==='phylogram')? Math.max(1e-3, med||0.1): undefined;
      }
      ensureIds(tree); commitTree(clone(tree), { preserveZoom: true }); setMenu({...menu,visible:false});
    }
  }
  function actionFlipNode(){ if(!selection) return; const id=selection.type==='node'?selection.id:selection.childId; const t=findById(tree,id); if(!t?.children) return; t.children.reverse(); commitTree(clone(tree), { preserveZoom: true }); setMenu({...menu,visible:false}); }
  function ladderizeTipBottom(root: TreeNode, tipId: number){
    const hasTip=(n: TreeNode)=>containsTipId(n,tipId);
    (function rec(n: TreeNode){
      if(!n.children?.length) return;
      n.children.sort((a,b)=>(hasTip(a)?1:0)-(hasTip(b)?1:0));
      const last=n.children[n.children.length-1];
      if(last&&hasTip(last)) rec(last);
    })(root);
  }
  function actionReroot(){ if(!selection) return;
    if(selection.type==='node'){
      const obj=findById(tree,selection.id); if(!obj) return;
      const r0=rerootAt(tree,obj); const r=collapseUnaryInPlace(r0); ensureIds(r);
      if(!obj.children?.length && obj.__id !== undefined) ladderizeTipBottom(r,obj.__id);
      commitTree(clone(r), { preserveZoom: true }); setSelection(null); setMenu({...menu,visible:false});
    }
    else {
      const {parentId,childId}=selection; const r0=rerootOnEdge(tree,parentId,childId,0.5); const r=collapseUnaryInPlace(r0); ensureIds(r);
      const tip=findById(r,childId);
      if(tip && !tip.children?.length && tip.__id !== undefined) ladderizeTipBottom(r, tip.__id);
      commitTree(clone(r), { preserveZoom: true }); setSelection(null); setMenu({...menu,visible:false});
    }
  }
  function actionRenameTip(nm: string){
    if(!selection) return;
    const id=selection.type==='node'?selection.id:selection.childId;
    const t=findById(tree,id); if(!t) return;
    if(t.children?.length){ alert('Only leaf nodes can be renamed'); return; }
    const nextName=(nm ?? tipNameInput ?? "").trim();
    t.name=nextName || 'Unnamed';
    setTipNameInput(t.name);
    commitTree(clone(tree), { preserveZoom: true });
    setMenu({...menu,visible:false});
  }
  function actionEditLength(vs: string, opts?: { keepMenu?: boolean }){
    const candidate = vs ?? branchLengthInput;
    const v=parseFloat(candidate);
    if(Number.isNaN(v)||v<0){ alert('Enter a non-negative number'); return; }
    const id=selection?.type==='link'?selection.childId:selection?.id; if(!id) return;
    const t=findById(tree,id); if(!t) return;
    t.length=v;
    setBranchLengthInput(String(v));
    commitTree(clone(tree), { preserveZoom: true });
    if(!opts?.keepMenu){
      setMenu({...menu,visible:false});
    }
  }
  function actionEditBranchWidth(vs: string, opts?: { keepMenu?: boolean }){
    const candidate = vs ?? branchWidthInput;
    const id=selection?.type==='link'?selection.childId:selection?.id;
    if(!id) return;
    const t=findById(tree,id); if(!t) return;
    const trimmed=(candidate ?? "").trim();
    if(!trimmed){
      delete t.__edgeWidth;
      setBranchWidthInput(String(edgeWidth));
      commitTree(clone(tree), { preserveZoom: true });
      if(!opts?.keepMenu){
        setMenu({...menu,visible:false});
      }
      return;
    }
    const v=parseFloat(trimmed);
    if(Number.isNaN(v) || v<=0){ alert('Enter a positive width (px)'); return; }
    const clamped=Math.max(0.25, Math.min(12, v));
    t.__edgeWidth=clamped;
    setBranchWidthInput(String(clamped));
    commitTree(clone(tree), { preserveZoom: true });
    if(!opts?.keepMenu){
      setMenu({...menu,visible:false});
    }
  }
  function actionColorSelected(c: string){
    if(!selection) return;
    const id=selection.type==='node'?selection.id:selection.childId;
    const t=findById(tree,id); if(!t) return;
    if(selection.type==='link') t.__edgeColor=c; else t.__color=c;
    commitTree(clone(tree), { preserveZoom: true });
  }


  // ---------- Export helpers (render scale bar into standalone SVG) ----------
  function computeScaleBar(pxPerUnit: number, minPx = 24, maxPx = 240){
    if(!Number.isFinite(pxPerUnit) || pxPerUnit <= 0) return null;
    const targetPx=100;
    const rawUnits=targetPx/Math.max(1e-9,pxPerUnit);
    const p10=Math.pow(10, Math.floor(Math.log10(rawUnits)));
    const m=rawUnits/p10;
    const nice = m<1.5?1: m<3.5?2: m<7.5?5:10;
    let units = nice*p10;
    let px = units*pxPerUnit;
    if(px > maxPx){
      const factor = maxPx/px;
      px = maxPx;
      units *= factor;
    }else if(px < minPx){
      const factor = minPx/Math.max(1e-9, px);
      px = minPx;
      units *= factor;
    }
    return { units, px };
  }

  function stripSelectionStylesFromGroup(group: SVGGElement){
    const edgePaths = group.querySelectorAll<SVGPathElement>('[data-base-stroke]');
    edgePaths.forEach(path=>{
      const baseStroke = path.getAttribute('data-base-stroke');
      if(baseStroke) path.setAttribute('stroke', baseStroke);
      const baseWidth = path.getAttribute('data-base-width');
      if(baseWidth) path.setAttribute('stroke-width', baseWidth);
    });
    const nodeCircles = group.querySelectorAll<SVGCircleElement>('[data-base-fill]');
    nodeCircles.forEach(circle=>{
      const baseFill = circle.getAttribute('data-base-fill');
      if(baseFill) circle.setAttribute('fill', baseFill);
    });
  }
  function buildStandaloneSVGBlobWithScaleBar(): Blob | null{
    const gNode=gRef.current; if(!gNode) return null;
    const pad=20;
    const gClone=gNode.cloneNode(true) as SVGGElement;
    gClone.setAttribute("transform","translate(0,0) scale(1)");
    stripSelectionStylesFromGroup(gClone);
    // Measure bounding box via temporary SVG attachment
    const tmp=document.createElementNS("http://www.w3.org/2000/svg","svg"); tmp.setAttribute("xmlns","http://www.w3.org/2000/svg"); tmp.appendChild(gClone);
    document.body.appendChild(tmp); const bbox=gClone.getBBox(); document.body.removeChild(tmp);

    const out=document.createElementNS("http://www.w3.org/2000/svg","svg");
    out.setAttribute("xmlns","http://www.w3.org/2000/svg");
    out.setAttribute("viewBox", `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad*2} ${bbox.height + pad*2}`);
    out.setAttribute("width", String(Math.ceil(bbox.width + pad*2)));
    out.setAttribute("height", String(Math.ceil(bbox.height + pad*2)));
    const fontStack='-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif';
    out.setAttribute("font-family", fontStack);
    out.setAttribute("style", `font-family:${fontStack}; color:#111827;`);

    // Clone the main group without transforms
    const gOut=gNode.cloneNode(true) as SVGGElement;
    gOut.setAttribute("transform","translate(0,0) scale(1)");
    stripSelectionStylesFromGroup(gOut);
    out.appendChild(gOut);

    // Vector scale bar overlay
    if(layout==='phylogram' && Number.isFinite(totalLength) && totalLength>0){
      const pxPerUnit = (xScaleWidth / Math.max(1e-9,totalLength));
      const scale = computeScaleBar(pxPerUnit, 32, 220);
      if(scale){
        const sbG = document.createElementNS("http://www.w3.org/2000/svg","g");
        const sbX = bbox.x - pad + 16, sbY = bbox.y - pad + 18;
        const line = document.createElementNS("http://www.w3.org/2000/svg","rect");
        line.setAttribute("x", sbX.toString()); line.setAttribute("y", sbY.toString());
        line.setAttribute("width", scale.px.toString()); line.setAttribute("height","2");
        line.setAttribute("fill","#111827");
        const txt = document.createElementNS("http://www.w3.org/2000/svg","text");
        txt.setAttribute("x", (sbX + scale.px + 8).toString());
        txt.setAttribute("y", (sbY+4).toString());
        txt.setAttribute("font-size","10"); txt.setAttribute("fill","#111827"); txt.setAttribute("font-family", fontStack);
        const label = formatScaleUnits(scale.units);
        txt.textContent = label || "";
        sbG.appendChild(line); sbG.appendChild(txt); out.appendChild(sbG);
      }
    }

    const src=new XMLSerializer().serializeToString(out);
    return new Blob([src], {type:"image/svg+xml;charset=utf-8"});
  }

  // ---------- Downloads ----------
  function downloadNewick(){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([toNewick(tree)],{type:'text/plain'})); a.download='edited_tree.nwk'; a.click(); }
  function downloadTipList(){ const tips=collectTips(tree).map(t=>t.name||'Unnamed').join('\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([tips],{type:'text/plain'})); a.download='tips.txt'; a.click(); }
  async function downloadSVG(){ const blob=buildStandaloneSVGBlobWithScaleBar(); if(!blob) return; const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='tree.svg'; a.click(); }
  async function downloadPNG(){
    const svgBlob=buildStandaloneSVGBlobWithScaleBar(); if(!svgBlob) return;
    const src=await svgBlob.text(); const { Canvg } = await import('canvg');
    // Derive canvas size from viewBox
    const m=src.match(/viewBox="([^"]+)"/); let w=1200,h=800;
    if(m){ const [,vb]=m; const [, , vbw, vbh]=vb.split(/\s+/).map(parseFloat); w=Math.ceil(vbw); h=Math.ceil(vbh); }
    const scale = Math.max(1, pngScale); // high-resolution PNG scaling factor
    const canvas=document.createElement('canvas'); canvas.width=w*scale; canvas.height=h*scale;
    const ctx=canvas.getContext('2d');
    if(!ctx) return;
    ctx.setTransform(scale,0,0,scale,0,0); // scale internal drawing
    const v=await Canvg.from(ctx, src); await v.render();
    const a=document.createElement('a'); a.href=canvas.toDataURL('image/png'); a.download='tree.png'; a.click();
  }
  async function downloadPDF(){
    // Prefer vector output via svg2pdf.js; fall back to raster if unavailable
    const svgBlob=buildStandaloneSVGBlobWithScaleBar(); if(!svgBlob) return;
    const src=await svgBlob.text();
    const { jsPDF } = await import('jspdf');
    const PDF_FONT = 'helvetica';
    const m=src.match(/viewBox="([^"]+)"/);
    const vbParts=m? m[1].split(/\s+/).map(parseFloat):[0,0,1000,800];
    const vbMinX=Number.isFinite(vbParts[0])?vbParts[0]:0;
    const vbMinY=Number.isFinite(vbParts[1])?vbParts[1]:0;
    const vbwRaw=Number.isFinite(vbParts[2])?vbParts[2]:1000;
    const vbhRaw=Number.isFinite(vbParts[3])?vbParts[3]:800;
    const vbw=Math.max(1, Math.ceil(vbwRaw));
    const vbh=Math.max(1, Math.ceil(vbhRaw));
    try{
      const mod = await import('svg2pdf.js');
      const svg2pdf = (typeof mod === 'function' ? mod : mod.svg2pdf) || mod.default;
      if(typeof svg2pdf !== 'function') throw new Error('svg2pdf function unavailable');
      const div=document.createElement('div');
      div.style.position='fixed'; div.style.left='-9999px'; div.style.top='0'; div.style.width=`${vbw}px`; div.style.height=`${vbh}px`;
      document.body.appendChild(div);
      try{
        div.innerHTML = src;
        const svgEl = div.querySelector('svg');
        if(!svgEl) throw new Error('SVG element not found');
        if(!svgEl.getAttribute('viewBox')) svgEl.setAttribute('viewBox', `${vbMinX} ${vbMinY} ${vbwRaw} ${vbhRaw}`);
        const pdf = new jsPDF({orientation: vbw>vbh?'l':'p', unit:'pt', format:[vbw, vbh]});
        pdf.setFont(PDF_FONT, 'normal');
        await svg2pdf(svgEl, pdf, {
          x:0,
          y:0,
          width:vbw,
          height:vbh,
        });
        pdf.save('tree.pdf');
        return;
      } finally {
        document.body.removeChild(div);
      }
    }catch(err){
      console.warn('svg2pdf.js failed, falling back to raster PDF', err);
    }
    // Raster fallback
    const { Canvg } = await import('canvg');
    const canvas=document.createElement('canvas'); canvas.width=vbw; canvas.height=vbh;
    const ctx=canvas.getContext('2d');
    if(!ctx) return;
    const v=await Canvg.from(ctx, src); await v.render();
    const pdf=new jsPDF({orientation:vbw>vbh?'l':'p', unit:'pt', format:[vbw, vbh]});
    pdf.setFont(PDF_FONT, 'normal');
    pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0,vbw,vbh);
    pdf.save('tree.pdf');
  }

  const selInfo = (()=>{ if(!selection) return 'None'; if(selection.type==='node'){ const t=findById(tree,selection.id); return t?.name||'[node]'; } const t=findById(tree,selection.childId); return t?.name||'[branch]'; })();
  const labelPadding = Math.max(4, xOffset);
  const svgHeight = useMemo(()=>{
    const layoutDriven = Math.max(560, yGap * (tipCount + 2));
    const paneDriven = Math.max(420, paneDimensions.h);
    return Math.max(layoutDriven, paneDriven);
  },[paneDimensions.h, tipCount, yGap]);
  const tabs: { id: typeof activeTab; label: string }[] = [
    { id: "data", label: "Data" },
    { id: "selection", label: "Selection" },
    { id: "rendering", label: "Rendering" },
    { id: "export", label: "Export" },
  ];
  const renderTabContent = () => {
    switch (activeTab) {
      case "data":
        return (
          <div className="space-y-4 text-[0.95rem]">
            <div className="flex gap-3 items-center flex-wrap">
              <label className={`${BUTTON_CLASSES} inline-flex items-center justify-center`}>
                <span>Upload NEWICK</span>
                <input type="file" accept=".nwk,.newick,.tree,.tre,.txt" className="hidden" onChange={(e)=>handleFileLoad(e.target.files)} />
              </label>
              <button className={`${BUTTON_CLASSES} inline-flex items-center justify-center`} onClick={loadExample}>Load example</button>
            </div>
            <p className="text-sm text-slate-600">Uploaded text appears below. Review or edit before applying.</p>
            <textarea className={`${INPUT_CLASSES} w-full h-32 resize-none`} placeholder="Paste NEWICK string" value={rawText} onChange={(e)=>setRawText(e.target.value)} />
            <button className={`${BUTTON_CLASSES} w-full`} onClick={applyText}>Apply NEWICK</button>
            <div className="pt-2 border-t border-slate-200">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Layout preset</span>
              <div className="mt-2 flex gap-2 flex-wrap">
                <button
                  className={`flex-1 min-w-[120px] rounded-xl border px-3 py-2 text-sm font-semibold transition flex items-center justify-center gap-2 ${layout==="phylogram"?"border-[#286699] bg-[#286699]/15 text-[#286699]":"border-slate-200 bg-white text-slate-600 hover:border-[#286699]"}`}
                  onClick={()=>handleLayoutModeChange("phylogram")}
                >
                  <IconLayoutPhylo active={layout==="phylogram"} />
                  <span>Phylogram</span>
                </button>
                <button
                  className={`flex-1 min-w-[120px] rounded-xl border px-3 py-2 text-sm font-semibold transition flex items-center justify-center gap-2 ${layout==="cladogram"?"border-[#286699] bg-[#286699]/15 text-[#286699]":"border-slate-200 bg-white text-slate-600 hover:border-[#286699]"}`}
                  onClick={()=>handleLayoutModeChange("cladogram")}
                >
                  <IconLayoutClado active={layout==="cladogram"} />
                  <span>Cladogram</span>
                </button>
              </div>
            </div>
          </div>
        );
      case "selection":
        return (
          <div className="space-y-3 text-[0.95rem]">
            <div className="text-slate-600">Active selection: <span className="font-mono text-slate-800">{selInfo}</span></div>
            <div className="grid grid-cols-2 gap-2">
              <button className={`${BUTTON_CLASSES} flex flex-row items-center justify-center gap-3 py-3`} onClick={actionReroot}>
                <IconReroot />
                <span className="whitespace-nowrap">Reroot</span>
              </button>
              <button className={`${BUTTON_CLASSES} flex items-center justify-center gap-2`} onClick={actionFlipNode}>
                <IconFlip /> <span>Flip</span>
              </button>
              <button className={`${BUTTON_CLASSES} flex items-center justify-center gap-2`} onClick={actionAddLeaf}>
                <IconAddLeaf /> <span>Add leaf</span>
              </button>
              <button className={`${BUTTON_CLASSES} flex items-center justify-center gap-2`} onClick={actionDeleteSelected}>
                <IconDelete /> <span>Delete</span>
              </button>
              <div className="col-span-2 space-y-2">
                <span className="text-sm font-medium text-slate-700">Edge / label color</span>
                <ColorSelector selectedColor={activeSelectionColor} onSelect={actionColorSelected} />
              </div>
              <div className="col-span-2 space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Length</span>
                <input className={`${INPUT_CLASSES} w-full`} placeholder="Enter & hit ↵" value={branchLengthInput} onChange={(e)=>setBranchLengthInput(e.currentTarget.value)} onKeyDown={(e)=>{ if(e.key==='Enter') actionEditLength(e.currentTarget.value); }} />
              </div>
              <div className="col-span-2 space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Width</span>
                <input className={`${INPUT_CLASSES} w-full`} placeholder="Enter & hit ↵" value={branchWidthInput} onChange={(e)=>setBranchWidthInput(e.currentTarget.value)} onKeyDown={(e)=>{ if(e.key==='Enter') actionEditBranchWidth(e.currentTarget.value); }} />
              </div>
              <div className="col-span-2 space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
                <input className={`${INPUT_CLASSES} w-full`} placeholder="Enter & hit ↵" value={tipNameInput} onChange={(e)=>setTipNameInput(e.currentTarget.value)} onKeyDown={(e)=>{ if(e.key==='Enter') actionRenameTip(e.currentTarget.value); }} />
              </div>
            </div>
          </div>
        );
      case "rendering":
        return (
          <div className="space-y-3 text-[0.95rem]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-600">Layout</span>
              <div className="flex gap-2">
                <button
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition ${layout==="phylogram"?"border-[#286699] bg-[#286699]/15 text-[#286699]":"border-slate-200 bg-white text-slate-500"}`}
                  onClick={()=>handleLayoutModeChange("phylogram")}
                >
                  <IconLayoutPhylo active={layout==="phylogram"} />
                  <span className="text-sm font-medium">Phylogram</span>
                </button>
                <button
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition ${layout==="cladogram"?"border-[#286699] bg-[#286699]/15 text-[#286699]":"border-slate-200 bg-white text-slate-500"}`}
                  onClick={()=>handleLayoutModeChange("cladogram")}
                >
                  <IconLayoutClado active={layout==="cladogram"} />
                  <span className="text-sm font-medium">Cladogram</span>
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3"><label className="text-slate-600">Edge width</label>
              <input type="number" className={`${INPUT_CLASSES} w-24`} value={edgeWidth} step={0.5} onChange={(e)=>setEdgeWidth(parseFloat(e.target.value)||1)} />
            </div>
            <div className="flex items-center justify-between gap-3"><label className="text-slate-600">Leaf label size</label>
              <input type="number" className={`${INPUT_CLASSES} w-24`} value={leafLabelSize} onChange={(e)=>setLeafLabelSize(parseFloat(e.target.value)||15)} />
            </div>
            <div className="flex items-center justify-between gap-3"><label className="text-slate-600">Tip X offset</label>
              <input
                type="number"
                className={`${INPUT_CLASSES} w-24`}
                value={xOffset}
                min={0}
                step={2}
                onChange={(e)=>setXOffset(Math.max(0, parseFloat(e.target.value)||0))}
              />
            </div>
            <div className="flex items-center justify-between gap-3"><label className="text-slate-600">Vertical spacing</label>
              <input type="number" className={`${INPUT_CLASSES} w-24`} value={yGap} onChange={(e)=>handleManualYGapChange(parseFloat(e.target.value))} />
            </div>
            <div className="flex items-center justify-between gap-3"><label className="text-slate-600">Horizontal scale</label>
              <input
                type="number"
                className={`${INPUT_CLASSES} w-28`}
                value={xScaleWidth}
                min={200}
                max={horizontalScaleMax}
                step={50}
                onChange={(e)=>{
                  userSetWidthRef.current = true;
                  const parsed = parseFloat(e.target.value);
                  setXScaleWidth(clampHorizontalWidth(Number.isFinite(parsed) ? parsed : xScaleWidth));
                }}
              />
            </div>
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Show</span>
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 p-3 bg-white/80 shadow-sm space-y-3">
                  <label className="flex items-center gap-2 text-slate-700 font-medium">
                    <input type="checkbox" checked={showNodeLabels} onChange={(e)=>setShowNodeLabels(e.target.checked)} />
                    <span>Internal node labels</span>
                  </label>
                  {showNodeLabels && (
                    <div className="space-y-3 text-sm text-slate-600 pl-1">
                      <div className="flex items-center justify-between gap-3">
                        <span>Text size</span>
                        <input type="number" className={`${INPUT_CLASSES} w-20`} value={nodeLabelSize} onChange={(e)=>setNodeLabelSize(parseFloat(e.target.value)||11)} />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Offset</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">X</span>
                          <input
                            type="number"
                            className={`${INPUT_CLASSES} w-20`}
                            value={nodeLabelOffsetX}
                            step={1}
                            onChange={(e)=>{
                              const next=parseFloat(e.target.value);
                              setNodeLabelOffsetX(Number.isFinite(next)?next:-4);
                            }}
                          />
                          <span className="text-xs text-slate-500">Y</span>
                          <input
                            type="number"
                            className={`${INPUT_CLASSES} w-20`}
                            value={nodeLabelOffsetY}
                            step={1}
                            onChange={(e)=>{
                              const next=parseFloat(e.target.value);
                              setNodeLabelOffsetY(Number.isFinite(next)?next:-6);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-200 p-3 bg-white/80 shadow-sm space-y-3">
                  <label className="flex items-center gap-2 text-slate-700 font-medium">
                    <input type="checkbox" checked={showBranchLen} onChange={(e)=>setShowBranchLen(e.target.checked)} />
                    <span>Branch lengths</span>
                  </label>
                  {showBranchLen && (
                    <div className="space-y-3 text-sm text-slate-600 pl-1">
                      <div className="flex items-center justify-between gap-3">
                        <span>Text size</span>
                        <input type="number" className={`${INPUT_CLASSES} w-20`} value={branchLabelSize} onChange={(e)=>setBranchLabelSize(parseFloat(e.target.value)||10)} />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Offset</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">X</span>
                          <input
                            type="number"
                            className={`${INPUT_CLASSES} w-20`}
                            value={branchLenOffsetX}
                            step={1}
                            onChange={(e)=>{
                              const next=parseFloat(e.target.value);
                              setBranchLenOffsetX(Number.isFinite(next)?next:0);
                            }}
                          />
                          <span className="text-xs text-slate-500">Y</span>
                          <input
                            type="number"
                            className={`${INPUT_CLASSES} w-20`}
                            value={branchLenOffsetY}
                            step={1}
                            onChange={(e)=>{
                              const next=parseFloat(e.target.value);
                              setBranchLenOffsetY(Number.isFinite(next)?next:0);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-200 p-3 bg-white/80 shadow-sm space-y-3">
                  <label className="flex items-center gap-2 text-slate-700 font-medium">
                    <input type="checkbox" checked={showBootstrap} onChange={(e)=>setShowBootstrap(e.target.checked)} />
                    <span>Support values</span>
                  </label>
                  {showBootstrap && (
                    <div className="space-y-3 text-sm text-slate-600 pl-1">
                      <div className="flex items-center justify-between gap-3">
                        <span>Text size</span>
                        <input type="number" className={`${INPUT_CLASSES} w-20`} value={supportLabelSize} onChange={(e)=>setSupportLabelSize(parseFloat(e.target.value)||10)} />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Offset</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">X</span>
                          <input
                            type="number"
                            className={`${INPUT_CLASSES} w-20`}
                            value={bootstrapOffsetX}
                            step={1}
                            onChange={(e)=>{
                              const next=parseFloat(e.target.value);
                              setBootstrapOffsetX(Number.isFinite(next)?next:0);
                            }}
                          />
                          <span className="text-xs text-slate-500">Y</span>
                          <input
                            type="number"
                            className={`${INPUT_CLASSES} w-20`}
                            value={bootstrapOffsetY}
                            step={1}
                            onChange={(e)=>{
                              const next=parseFloat(e.target.value);
                              setBootstrapOffsetY(Number.isFinite(next)?next:0);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-200 p-3 bg-white/80 shadow-sm space-y-3">
                  <label className="flex items-center gap-2 text-slate-700 font-medium">
                    <input type="checkbox" checked={showNodeDots} onChange={(e)=>setShowNodeDots(e.target.checked)} />
                    <span>Node dots</span>
                  </label>
                  {showNodeDots && (
                    <div className="space-y-3 text-sm text-slate-600 pl-1">
                      <div className="flex items-center justify-between gap-3">
                        <span>Leaf size</span>
                        <input
                          type="number"
                          className={`${INPUT_CLASSES} w-20`}
                          value={leafNodeDotSize}
                          min={0}
                          step={0.5}
                          onChange={(e)=>{
                            const next=parseFloat(e.target.value);
                            setLeafNodeDotSize(Number.isFinite(next)?Math.max(0,next):2.5);
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Internal size</span>
                        <input
                          type="number"
                          className={`${INPUT_CLASSES} w-20`}
                          value={internalNodeDotSize}
                          min={0}
                          step={0.5}
                          onChange={(e)=>{
                            const next=parseFloat(e.target.value);
                            setInternalNodeDotSize(Number.isFinite(next)?Math.max(0,next):3.5);
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      case "export":
        return (
          <div className="grid grid-cols-2 gap-2 mt-2 text-[0.95rem]">
            <button className={BUTTON_CLASSES} onClick={downloadNewick}>NEWICK</button>
            <button className={BUTTON_CLASSES} onClick={downloadTipList}>Tip list</button>
            <button className={BUTTON_CLASSES} onClick={downloadSVG}>SVG</button>
            <button className={BUTTON_CLASSES} onClick={downloadPNG}>PNG</button>
            <button className={`${BUTTON_CLASSES} col-span-2`} onClick={downloadPDF}>PDF (vector)</button>
            <div className="col-span-2 flex items-center justify-between">
              <label className="text-slate-600">PNG scale (x)</label>
              <input type="number" className={`${INPUT_CLASSES} w-24`} value={pngScale} min={1} step={1} onChange={(e)=>setPngScale(Math.max(1, parseInt(e.target.value)||3))} />
            </div>
            <label className="col-span-2 flex items-center gap-2 text-slate-600">
              <input type="checkbox" checked={italic} onChange={(e)=>setItalic(e.target.checked)} />
              <span className="text-sm font-medium">Italic tip labels</span>
            </label>
          </div>
        );
      default:
        return null;
    }
  };


  useEffect(()=>{
    return ()=>{
      if(menuDragHandlers.current){
        window.removeEventListener("mousemove", menuDragHandlers.current.move);
        window.removeEventListener("mouseup", menuDragHandlers.current.up);
        menuDragHandlers.current = null;
      }
    };
  },[]);

  const startMenuDrag = (e: React.MouseEvent<HTMLDivElement>)=>{
    e.preventDefault();
    e.stopPropagation();
    const startX=e.clientX;
    const startY=e.clientY;
    const originLeft=menu.left;
    const originTop=menu.top;

    if(menuDragHandlers.current){
      window.removeEventListener("mousemove", menuDragHandlers.current.move);
      window.removeEventListener("mouseup", menuDragHandlers.current.up);
      menuDragHandlers.current=null;
    }

    const move=(ev: MouseEvent)=>{
      ev.preventDefault();
      const dx=ev.clientX-startX;
      const dy=ev.clientY-startY;
      setMenu(prev=>({...prev, left: originLeft + dx, top: originTop + dy}));
    };
    const up=()=>{
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      menuDragHandlers.current=null;
    };
    menuDragHandlers.current={ move, up };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f5f9ff] via-[#eef2ff] to-[#f8faff] text-slate-900" onClick={()=>{ if(menu.visible) setMenu({...menu,visible:false}); if(searchPopoverOpen) setSearchPopoverOpen(false); }}>
      <div className="border-b border-white/30 bg-white/70 backdrop-blur">
        <div className="w-full px-4 sm:px-6 lg:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={LogoSvg} alt="PhyloWeaver" className="h-8 w-auto select-none" draggable={false} />
            <span className="text-sm text-slate-500">Interactive editor for phylogenies</span>
          </div>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-[#286699]/30 bg-white/80 px-4 py-2 text-sm font-semibold text-[#286699] transition hover:bg-[#286699]/10"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 .198a8 8 0 0 0-2.53 15.6c.4.074.547-.174.547-.386 0-.19-.007-.693-.01-1.36-2.226.484-2.695-1.073-2.695-1.073-.364-.924-.89-1.17-.89-1.17-.727-.497.055-.487.055-.487.804.057 1.227.826 1.227.826.715 1.225 1.874.871 2.33.666.073-.518.28-.872.508-1.073-1.777-.202-3.644-.888-3.644-3.953 0-.873.312-1.587.823-2.148-.083-.203-.357-1.016.078-2.12 0 0 .67-.215 2.2.82a7.64 7.64 0 0 1 4.004 0c1.53-1.035 2.2-.82 2.2-.82.437 1.104.163 1.917.08 2.12.513.56.822 1.274.822 2.148 0 3.073-1.87 3.748-3.65 3.947.287.247.543.735.543 1.48 0 1.068-.01 1.93-.01 2.193 0 .214.144.463.55.384A8 8 0 0 0 8 .198" />
            </svg>
            <span>GitHub</span>
          </a>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-10 py-6 flex flex-nowrap gap-6 overflow-x-auto items-start">
        <div className="flex-shrink-0 basis-[400px] max-w-[460px] min-w-[340px]">
          <div className="relative">
            <div className="flex gap-3 mb-4">
              {tabs.map(tab=>(
                <button
                  key={tab.id}
                  onClick={()=>setActiveTab(tab.id)}
                  className={[
                    "px-4 py-2 rounded-xl text-sm font-semibold shadow-md border transition-all duration-150",
                    activeTab===tab.id
                      ? "bg-[#286699] text-white border-[#1d4f7c] shadow-lg"
                      : "bg-[#e4e4e4] text-[#286699] border border-transparent hover:border-[#286699]"
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className={`${PANEL_CARD_CLASSES}`}>
              {renderTabContent()}
            </div>
          </div>
        </div>

        {/* Tree canvas */}
        <div
          ref={rightPaneRef}
          className="flex-1 min-w-[640px] p-4 bg-white rounded-3xl shadow-lg border border-slate-100/80 overflow-auto relative"
          onClick={handleCanvasBackgroundClick}
          style={{ height:"calc(85vh)" }}
        >
          <div className="absolute right-4 top-4 z-30 flex flex-wrap items-end justify-end gap-6">
            <div className="flex flex-col items-end gap-1 text-[0.75rem] font-semibold uppercase tracking-wide text-slate-500">
              <span>↔ Horizontal scale</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-700 w-14 text-right">{Math.round(xScaleWidth)}</span>
                <input
                  type="range"
                  min={200}
                  max={horizontalScaleMax}
                  step={50}
                  value={xScaleWidth}
                  onChange={(e)=>{ e.stopPropagation(); handleHorizontalScaleSlider(parseFloat(e.target.value)); }}
                  className="w-32 accent-[#286699]"
                />
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 text-[0.75rem] font-semibold uppercase tracking-wide text-slate-500">
              <span>↕ Vertical spacing</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-700 w-10 text-right">{Math.round(yGap)}</span>
                <input
                  type="range"
                  min={12}
                  max={200}
                  step={2}
                  value={yGap}
                  onChange={(e)=>{ e.stopPropagation(); handleManualYGapChange(parseFloat(e.target.value)); }}
                  className="w-24 accent-[#286699]"
                />
              </div>
            </div>
            <button
              className={`${SECONDARY_BUTTON_CLASSES} text-base disabled:opacity-40 disabled:cursor-not-allowed`}
              disabled={!canUndo}
              onClick={(e)=>{ e.stopPropagation(); handleUndo(); }}
            >
              Undo
            </button>
            <button
              className={`${SECONDARY_BUTTON_CLASSES} text-base disabled:opacity-40 disabled:cursor-not-allowed`}
              disabled={!canRedo}
              onClick={(e)=>{ e.stopPropagation(); handleRedo(); }}
            >
              Redo
            </button>
            <button
              type="button"
              className="relative flex h-12 w-12 items-center justify-center rounded-full border border-transparent bg-transparent text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-300"
              onClick={(e)=>{ e.stopPropagation(); setSearchPopoverOpen(v=>!v); }}
              aria-label="Search tips"
            >
              <IconSearch />
            </button>
            <button
              className={`${BUTTON_CLASSES} text-base`}
              onClick={(e)=>{
                e.stopPropagation();
                setSelection(null);
                setMenu({...menu,visible:false});
                setSearchPopoverOpen(false);
                applyAutoHorizontalScale();
                requestAnimationFrame(()=>autoAdjustVerticalSpacing());
              }}
            >
              Reset view
            </button>
          </div>
          {searchPopoverOpen && (
            <div className="absolute right-4 top-28 z-30 w-72 rounded-2xl border border-slate-200 bg-white shadow-xl px-4 py-4 text-sm text-slate-700" onClick={(e)=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold">Search tips</span>
                <button className="text-xs text-slate-500" onClick={()=>setSearchPopoverOpen(false)}>Close</button>
              </div>
              <div className="space-y-3">
                <input
                  className={`${INPUT_CLASSES} w-full`}
                  placeholder={useRegex?"Enter regex pattern":"Tip name contains..."}
                  value={search}
                  onChange={(e)=>setSearch(e.target.value)}
                />
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={useRegex} onChange={(e)=>{ setUseRegex(e.target.checked); }} />
                  Use regular expressions
                </label>
                {hasSearchMatches && (
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>{searchPositionLabel}</span>
                    <div className="flex gap-2">
                      <button
                        className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[0.7rem] font-semibold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                        onClick={()=>handleSearchNavigate(-1)}
                        disabled={!hasSearchMatches}
                      >
                        ←
                      </button>
                      <button
                        className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[0.7rem] font-semibold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                        onClick={()=>handleSearchNavigate(1)}
                        disabled={!hasSearchMatches}
                      >
                        →
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <button className={`${SECONDARY_BUTTON_CLASSES} text-xs`} onClick={()=>setSearch("")}>Clear</button>
                  {regexError && <span className="text-xs text-[#a15b3c]">Regex error: {regexError}</span>}
                </div>
              </div>
            </div>
          )}
          <svg
            ref={svgRef}
            width={"100%"}
            height={svgHeight}
            className="border border-transparent rounded-2xl bg-white"
            style={{ display:"block" }}
            onClick={handleSvgBlankClick}
          >
            <g ref={gRef}>
              {/* Edges */}
              {links.map((link, idx)=>{
                const source=link.source;
                const target=link.target;
                if(!source||!target) return null;
                const parentData = (source.d?.data ?? {}) as TreeNode;
                const childData = (target.d?.data ?? {}) as TreeNode;
                const parentId = parentData.__id;
                const childId = childData.__id;
                const parentSelected = parentId !== undefined && selection?.type==='node' && selection?.id===parentId;
                const isSelected = Boolean(selection && selection.type==='link' && parentId !== undefined && childId !== undefined && selection.parentId===parentId && selection.childId===childId);
                const highlightActive = parentSelected || isSelected;
                const customColor = childData.__edgeColor;
                const customWidth = typeof childData.__edgeWidth === 'number' && Number.isFinite(childData.__edgeWidth) ? childData.__edgeWidth : null;
                const highlightColor = '#f0a608ff';
                const baseColor = customColor || '#1f2937';
                const baseWidth = customWidth ?? edgeWidth;
                const pointerWidth = Math.max(12, baseWidth + (highlightActive ? 12 : 8));
                const highlightStrokeWidth = highlightActive ? Math.max(baseWidth + 3, baseWidth * 1.65) : null;
                const midX = (source.x + target.x) / 2;
                const branchLenValue = typeof childData.length === 'number' && Number.isFinite(childData.length) ? childData.length : 0;
                const supportValue = childData.name;
                const parentKey = parentId ?? `p-${idx}`;
                const childKey = childId ?? `c-${idx}`;
                return (
                  <g key={`link-${parentKey}-${childKey}-${idx}`} className="cursor-pointer" onClick={(e)=>onClickLink(link,e)}>
                    <path
                      d={`M${source.x},${source.y} V${target.y} H${target.x}`}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={pointerWidth}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      pointerEvents="stroke"
                    />
                    {highlightActive && highlightStrokeWidth && (
                      <>
                        <path
                          d={`M${source.x},${source.y} V${target.y}`}
                          fill="none"
                          stroke={highlightColor}
                          strokeWidth={highlightStrokeWidth}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          pointerEvents="none"
                          opacity={0.85}
                        />
                        <path
                          d={`M${source.x},${target.y} H${target.x}`}
                          fill="none"
                          stroke={highlightColor}
                          strokeWidth={highlightStrokeWidth}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          pointerEvents="none"
                          opacity={0.85}
                        />
                      </>
                    )}
                    <path
                      d={`M${source.x},${source.y} V${target.y}`}
                      fill="none"
                      stroke={baseColor}
                      strokeWidth={baseWidth}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      pointerEvents="none"
                      data-base-stroke={baseColor}
                      data-base-width={baseWidth}
                    />
                    <path
                      d={`M${source.x},${target.y} H${target.x}`}
                      fill="none"
                      stroke={baseColor}
                      strokeWidth={baseWidth}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      pointerEvents="none"
                      data-base-stroke={baseColor}
                      data-base-width={baseWidth}
                    />
                    {layout==='phylogram' && showBranchLen && (
                      <text x={midX + branchLenOffsetX} y={target.y + branchLenOffsetY} fontSize={branchLabelSize} textAnchor="middle" className="fill-slate-600 select-none">{branchLenValue.toFixed(3)}</text>
                    )}
                    {showBootstrap && typeof supportValue === 'string' && supportValue.trim() && !Number.isNaN(parseFloat(supportValue)) && (
                      <text x={midX + bootstrapOffsetX} y={target.y + bootstrapOffsetY} fontSize={supportLabelSize} textAnchor="middle" className="fill-slate-500 select-none">{supportValue}</text>
                    )}
                  </g>
                );
              })}

              {/* Nodes */}
              {nodes.map((n,i)=>{
                const nodeId = n.d.data.__id;
                const selected=nodeId !== undefined && selection?.type==='node' && selection?.id===nodeId;
                const isDisplayLeaf=!n.d.children?.length;
                const collapsedTipCount = typeof n.d.data.__collapsedTipCount === "number" ? n.d.data.__collapsedTipCount : undefined;
                const isCollapsedLeaf = Boolean(isDisplayLeaf && n.d.data.__isCollapsedPlaceholder);
                const isSimpleLeaf = isDisplayLeaf && !isCollapsedLeaf;
                const nodeColor = n.d.data.__color;
                const r=isDisplayLeaf ? Math.max(0, leafNodeDotSize) : Math.max(0, internalNodeDotSize);
                const baseCircleFill = isDisplayLeaf ? (nodeColor || '#111827') : '#374151';
                const circleStroke = selected ? '#ef4444' : 'transparent';
                const circleStrokeWidth = selected ? Math.max(1.2, r * 0.85) : 0;
                const collapsedMetrics = isCollapsedLeaf ? getCollapsedTriangleMetrics(collapsedTipCount) : null;
                const collapsedWidth = collapsedMetrics?.width ?? 0;
                const textStartX = collapsedWidth + labelPadding;
                const rawName = n.d.data.name ?? "";
                const trimmedName = rawName.trim();
                const collapsedLabelText = isCollapsedLeaf ? `(${collapsedTipCount ?? 0})` : "";
                const leafLabelText = trimmedName || "Unnamed";
                const displayLabelText = isCollapsedLeaf ? collapsedLabelText : leafLabelText;
                const isSearchHit = nodeId !== undefined && searchSet.has(nodeId);
                const isActiveSearchTarget = activeSearchNodeId !== null && nodeId === activeSearchNodeId;
                const highlightPaddingX = 8;
                const highlightPaddingY = 4;
                const highlightBaselineY = 4;
                const shouldItalicize = italic && (isSimpleLeaf || isCollapsedLeaf);
                const highlightable = isSearchHit && (isSimpleLeaf || isCollapsedLeaf);
                const estimatedLabelWidth = highlightable ? measureLabelWidth(displayLabelText, leafLabelSize, shouldItalicize) : 0;
                const highlightWidth = Math.max(estimatedLabelWidth + highlightPaddingX * 2, leafLabelSize * 2);
                const highlightHeight = leafLabelSize + highlightPaddingY * 2;
                const highlightX = textStartX - highlightPaddingX;
                const highlightY = highlightBaselineY - leafLabelSize - highlightPaddingY;
                const labelClasses = [
                  "select-none",
                  highlightable ? "font-semibold" : "",
                  shouldItalicize ? "italic" : "",
                  isCollapsedLeaf ? "font-medium" : ""
                ].filter(Boolean).join(" ");
                const baseLeafFill = nodeColor || '#1f2937';
                const collapsedStrokeColor = nodeColor || '#286699';
                const collapsedFillColor = nodeColor || '#286699';
                const labelFill = isCollapsedLeaf
                  ? (isSearchHit ? '#b91c1c' : collapsedStrokeColor)
                  : (isSimpleLeaf ? (isSearchHit ? '#b91c1c' : baseLeafFill) : '#374151');
                const collapsedHalfHeight = collapsedMetrics ? collapsedMetrics.height/2 : 0;
                return (
                  <g key={i} transform={`translate(${n.x},${n.y})`} className="cursor-pointer" onClick={(e)=>onClickNode(n,e)}>
                    {isCollapsedLeaf && (
                      <title>{`Collapsed subtree (${collapsedTipCount ?? 0} tip${(collapsedTipCount ?? 0) === 1 ? "" : "s"})`}</title>
                    )}
                    {showNodeDots && (
                      <circle
                        r={r}
                        fill={baseCircleFill}
                        stroke={circleStroke}
                        strokeWidth={circleStrokeWidth}
                        data-base-fill={baseCircleFill}
                      />
                    )}
                    {isCollapsedLeaf && collapsedMetrics && (
                      <path
                        d={`M${collapsedWidth},${-collapsedHalfHeight} L0,0 L${collapsedWidth},${collapsedHalfHeight} Z`}
                        fill={collapsedFillColor}
                        fillOpacity={0.18}
                        stroke={collapsedStrokeColor}
                        strokeWidth={selected ? 2.4 : 1.2}
                        pointerEvents="none"
                      />
                    )}
                    {highlightable && (
                      <rect
                        x={highlightX}
                        y={highlightY}
                        width={highlightWidth}
                        height={highlightHeight}
                        rx={highlightHeight/3}
                        fill={isActiveSearchTarget ? "#fde047" : "#fef08a"}
                        stroke={isActiveSearchTarget ? "#f59e0b" : "#f4c84a"}
                        strokeWidth={isActiveSearchTarget ? 1.5 : 1}
                        pointerEvents="none"
                      />
                    )}
                    {isSimpleLeaf && (
                      <text
                        x={textStartX}
                        y={highlightBaselineY}
                        fontSize={leafLabelSize}
                        fill={labelFill}
                        className={labelClasses}
                        style={shouldItalicize ? { fontStyle: "italic" } : undefined}
                      >
                        {displayLabelText}
                      </text>
                    )}
                    {isCollapsedLeaf && (
                      <text
                        x={textStartX}
                        y={highlightBaselineY}
                        fontSize={leafLabelSize}
                        fill={labelFill}
                        className={labelClasses}
                        style={shouldItalicize ? { fontStyle: "italic" } : undefined}
                      >
                        {displayLabelText}
                      </text>
                    )}
                    {!isDisplayLeaf && showNodeLabels && (
                      <text
                        x={nodeLabelOffsetX}
                        y={nodeLabelOffsetY}
                        fontSize={nodeLabelSize}
                        textAnchor="end"
                        className="fill-gray-500 select-none"
                      >
                        {n.d.data.name||''}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* On-screen scale bar */}
          {layout==='phylogram' && <ScaleBarHTML totalLength={totalLength} zoomK={zoomK} />}

          {/* Context menu */}
          {menu.visible && (
            <div className="absolute z-40 bg-white border border-slate-200 rounded-2xl shadow-xl px-3 py-3 text-[0.95rem] text-slate-800" style={{ left:menu.left, top:menu.top, width:260 }} onClick={(e)=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3 cursor-move select-none text-sm font-medium text-slate-600" onMouseDown={startMenuDrag}>
                <span>Selection actions</span>
                <span className="text-xs text-slate-400">Drag</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
              <button className={BUTTON_CLASSES} onClick={actionReroot}>
                Reroot
              </button>
                <button className={BUTTON_CLASSES} onClick={actionFlipNode}>Flip</button>
                <button className={BUTTON_CLASSES} onClick={actionAddLeaf}>Add leaf</button>
                <button className={BUTTON_CLASSES} onClick={actionDeleteSelected}>Delete</button>
                <button
                  className={`${BUTTON_CLASSES} ${!canCollapseSelection ? "opacity-40 cursor-not-allowed" : ""}`}
                  onClick={actionCollapseSelected}
                  disabled={!canCollapseSelection}
                >
                  Collapse
                </button>
                <button
                  className={`${BUTTON_CLASSES} ${!canExpandSelection ? "opacity-40 cursor-not-allowed" : ""}`}
                  onClick={actionExpandSelected}
                  disabled={!canExpandSelection}
                >
                  Expand
                </button>
                <div className="col-span-2 space-y-2">
                  <span className="text-sm font-medium text-slate-700">Edge / label color</span>
                  <ColorSelector selectedColor={activeSelectionColor} onSelect={actionColorSelected} />
                </div>
                <div className="col-span-2 space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Length</span>
                  <div className="flex items-stretch gap-2">
                    <div className="relative flex-1 group">
                      <input
                        className={`${INPUT_CLASSES} w-full pr-8`}
                        placeholder="Enter & hit ↵"
                        value={branchLengthInput}
                        onChange={(e)=>setBranchLengthInput(e.currentTarget.value)}
                        onKeyDown={(e)=>{ if(e.key==='Enter'){ actionEditLength(e.currentTarget.value); } }}
                      />
                      <div className="absolute right-1 top-1 bottom-1 flex flex-col opacity-0 group-hover:opacity-100 transition-opacity text-[0.55rem]" role="group" aria-label="Length nudger">
                        <button
                          className="flex-1 px-1 text-slate-600 hover:text-slate-900 leading-none"
                          onClick={()=>{
                            const current=parseFloat(branchLengthInput);
                            const fallback=selection?findById(tree, selection.type==='link'?selection.childId:selection.id)?.length ?? 0:0;
                            const base=Number.isFinite(current)?current:fallback;
                            actionEditLength(String(Math.max(0, base + 0.1)), { keepMenu:true });
                          }}
                          type="button"
                          title="Increase length"
                        >▲</button>
                        <button
                          className="flex-1 px-1 text-slate-600 hover:text-slate-900 leading-none"
                          onClick={()=>{
                            const current=parseFloat(branchLengthInput);
                            const fallback=selection?findById(tree, selection.type==='link'?selection.childId:selection.id)?.length ?? 0:0;
                            const base=Number.isFinite(current)?current:fallback;
                            actionEditLength(String(Math.max(0, base - 0.1)), { keepMenu:true });
                          }}
                          type="button"
                          title="Decrease length"
                        >▼</button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-span-2 space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Width</span>
                  <div className="flex items-stretch gap-2">
                    <div className="relative flex-1 group">
                      <input
                        className={`${INPUT_CLASSES} w-full pr-8`}
                        placeholder="Enter & hit ↵"
                        value={branchWidthInput}
                        onChange={(e)=>setBranchWidthInput(e.currentTarget.value)}
                        onKeyDown={(e)=>{ if(e.key==='Enter'){ actionEditBranchWidth(e.currentTarget.value); } }}
                      />
                      <div className="absolute right-1 top-1 bottom-1 flex flex-col opacity-0 group-hover:opacity-100 transition-opacity text-[0.55rem]" role="group" aria-label="Width nudger">
                        <button
                          className="flex-1 px-1 text-slate-600 hover:text-slate-900 leading-none"
                          onClick={()=>{
                            const current=parseFloat(branchWidthInput);
                            const fallback=selection?(findById(tree, selection.type==='link'?selection.childId:selection.id)?.__edgeWidth ?? edgeWidth):edgeWidth;
                            const base=Number.isFinite(current)?current:fallback;
                            actionEditBranchWidth(String(base + 0.25), { keepMenu:true });
                          }}
                          type="button"
                          title="Increase width"
                        >▲</button>
                        <button
                          className="flex-1 px-1 text-slate-600 hover:text-slate-900 leading-none"
                          onClick={()=>{
                            const current=parseFloat(branchWidthInput);
                            const fallback=selection?(findById(tree, selection.type==='link'?selection.childId:selection.id)?.__edgeWidth ?? edgeWidth):edgeWidth;
                            const base=Number.isFinite(current)?current:fallback;
                            actionEditBranchWidth(String(Math.max(0.25, base - 0.25)), { keepMenu:true });
                          }}
                          type="button"
                          title="Decrease width"
                        >▼</button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-span-2 space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
                  <input className={`${INPUT_CLASSES} w-full`} placeholder="Enter & hit ↵" value={tipNameInput} onChange={(e)=>setTipNameInput(e.currentTarget.value)} onKeyDown={(e)=>{ if(e.key==='Enter'){ actionRenameTip(e.currentTarget.value); } }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
