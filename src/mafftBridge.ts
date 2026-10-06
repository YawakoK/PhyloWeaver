// MAFFT-server-only integration. The MAFFT sequence list page ("_pickmod.*.html") opens the
// tree viewer with window.open and the two windows call each other's functions directly:
//   viewer -> list : window.opener.reflectphyloweaver(tipNames)  toggles the sequences' checkboxes
//                    (reflectphyloio, the Phylo.io entry point, is accepted as a fallback)
//   list -> viewer : window.relaySelection({ "<seq no>": true|false, ... })  highlights tips
// The list page passes its window name as ?mafftList=<name> so that a viewer only talks to the list
// that opened it when several selections run at once. Both windows must be served from the same
// origin; nothing is sent over the network.

export type MafftHighlightMap = Record<string, boolean>;

type ReflectFn = (names: string[]) => void;
type MafftListWindow = Window & { reflectphyloweaver?: ReflectFn; reflectphyloio?: ReflectFn };

export type MafftViewerWindow = Window & { relaySelection?: (map: MafftHighlightMap) => number | false };

function expectedListName(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("mafftList");
}

function resolveListWindow(): { list: MafftListWindow; reflect: ReflectFn } | null {
  if (typeof window === "undefined") return null;
  try {
    const opener = window.opener as MafftListWindow | null;
    if (!opener || opener.closed) return null;
    const expected = expectedListName();
    if (expected !== null && opener.name !== expected) return null;
    const reflect = typeof opener.reflectphyloweaver === "function"
      ? opener.reflectphyloweaver
      : (typeof opener.reflectphyloio === "function" ? opener.reflectphyloio : null);
    return reflect ? { list: opener, reflect } : null;
  } catch {
    // A cross-origin opener throws on property access; treat it as not linked.
    return null;
  }
}

export function getMafftListWindow(): MafftListWindow | null {
  return resolveListWindow()?.list ?? null;
}

export function sendSelectionToMafft(names: string[]): boolean {
  const target = resolveListWindow();
  if (!target || !names.length) return false;
  try {
    target.reflect.call(target.list, names);
    return true;
  } catch {
    return false;
  }
}

// MAFFT names tips "<seq no>_<title>" and identifies sequences by that leading number.
export function mafftSequenceKey(name: string | undefined): string {
  return (name ?? "").trim().replace(/_.*/, "").replace(/\D/g, "");
}

export function mafftHighlightKeys(map: MafftHighlightMap | null | undefined): Set<string> {
  const keys = new Set<string>();
  if (!map || typeof map !== "object") return keys;
  for (const [key, on] of Object.entries(map)) {
    if (on === true) keys.add(mafftSequenceKey(key));
  }
  keys.delete("");
  return keys;
}

export type MafftCheckState = { checked: Set<string>; present: Set<string> };

// Reads the list page's checkboxes. MAFFT maps "<seq no> - 1" to the checkbox index via the global
// nametable; a sequence whose checkbox is missing has been deleted or is not loaded yet.
export function readMafftChecks(): MafftCheckState | null {
  const list = getMafftListWindow() as (Window & { nametable?: Record<string, number> }) | null;
  if (!list) return null;
  try {
    const table = list.nametable;
    if (!table || typeof table !== "object") return null;
    const checked = new Set<string>();
    const present = new Set<string>();
    for (const [index, boxIndex] of Object.entries(table)) {
      const box = list.document.getElementById(`s${boxIndex}`) as HTMLInputElement | null;
      if (!box) continue;
      const key = String(Number(index) + 1);
      present.add(key);
      if (box.checked) checked.add(key);
    }
    return { checked, present };
  } catch {
    return null;
  }
}

export function mafftCheckSignature(state: MafftCheckState | null): string {
  if (!state) return "";
  return `${[...state.present].join(",")}|${[...state.checked].join(",")}`;
}
