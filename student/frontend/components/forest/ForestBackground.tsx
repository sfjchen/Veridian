import React, { useMemo } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient as SvgRadialGradient,
  G,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

/* -- Deterministic PRNG -------------------- */

function seeded(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

/* -- Mountain baseline via layered sine waves -- */

function mountainBaseY(
  x: number,
  viewW: number,
  viewH: number,
  fraction: number,
  amp: number,
  seed: number
): number {
  const t = x / viewW;
  const p1 = seeded(seed) * Math.PI * 2;
  const p2 = seeded(seed + 1) * Math.PI * 2;
  const p3 = seeded(seed + 2) * Math.PI * 2;
  const p4 = seeded(seed + 3) * Math.PI * 2;
  // Added a little extra high-frequency noise for "rockier" terrain
  return (
    viewH * fraction +
    Math.sin(t * Math.PI * 2.2 + p1) * amp +
    Math.sin(t * Math.PI * 4.7 + p2) * amp * 0.35 +
    Math.sin(t * Math.PI * 8.3 + p3) * amp * 0.12 +
    Math.sin(t * Math.PI * 13.7 + p4) * amp * 0.05
  );
}

/* -- Tree generation ----------------------- */

interface Tree {
  cx: number;
  w: number;
  h: number;
  kind: "conifer"; // Removed "rounded" to strictly enforce pine look
  variation: number;
}

function scatterTrees(
  viewW: number,
  density: number,
  wMin: number,
  wMax: number,
  hMin: number,
  hMax: number,
  roundChance: number,
  seed: number
): Tree[] {
  if (density <= 0) return [];
  const out: Tree[] = [];
  const gap = 100 / density;
  let x = -gap * seeded(seed);
  let i = 0;

  // Adjusted loop to create occasional "clumps" typical of firewatch style
  while (x < viewW + wMax) {
    const isClump = seeded(seed + i * 99) > 0.7;
    const clumpOffset = isClump ? (seeded(seed + i * 11) - 0.5) * gap * 0.2 : 0;

    out.push({
      cx: x + (seeded(seed + i * 47) - 0.5) * gap * 0.6 + clumpOffset,
      w: wMin + seeded(seed + i * 17) * (wMax - wMin),
      h: hMin + seeded(seed + i * 31) * (hMax - hMin),
      kind: "conifer", // Force conifer for Firewatch style
      variation: seeded(seed + i * 109),
    });
    x += gap + (seeded(seed + i * 59) - 0.5) * gap * 0.3;
    i++;
  }
  return out;
}

/* -- Ridge silhouette path (mountains + trees) -- */

// UPDATED: Sharper, narrower falloff for background trees to look like distinct spikes
function crownHeightAtX(
  x: number,
  tree: Tree,
  baseY: number
): number {
  const halfW = tree.w / 2;
  const d = Math.abs(x - tree.cx) / Math.max(halfW, 0.0001);
  if (d >= 1) return baseY;

  // Linear to Concave falloff creates sharper spikes than the previous convex domes
  // Firewatch trees in the distance look like saw teeth.
  const sharpness = 0.5 + tree.variation * 0.5; // 0.5 to 1.0
  const shape = Math.pow(1 - d, sharpness);

  // Add a little "jaggedness" to the slope if we are close to the center
  const noise = (Math.sin(d * 20 + tree.variation * 10) * 0.05 * (1-d));

  const crown = (shape + noise) * tree.h;
  return baseY - crown;
}

function ridgePath(
  viewW: number,
  viewH: number,
  baseYFrac: number,
  amp: number,
  mSeed: number,
  trees: Tree[]
): string {
  const withBase = trees.map((t) => ({
    ...t,
    bY: mountainBaseY(t.cx, viewW, viewH, baseYFrac, amp, mSeed),
  }));

  // Reduced step size slightly for sharper peaks in the distance
  const step = 3;
  const pad = 12;
  const pts: string[] = [`M${-pad} ${viewH + pad}`];

  for (let x = -pad; x <= viewW + pad; x += step) {
    const base = mountainBaseY(x, viewW, viewH, baseYFrac, amp, mSeed);
    let y = base;

    for (const t of withBase) {
      const l = t.cx - t.w / 2;
      const r = t.cx + t.w / 2;
      if (x < l || x > r) continue;

      const ty = crownHeightAtX(x, t, t.bY);
      if (ty < y) y = ty;
    }

    pts.push(`L${Math.round(x)} ${Math.round(y * 10) / 10}`);
  }

  pts.push(`L${viewW + pad} ${viewH + pad} Z`);
  return pts.join(" ");
}

/* -- Bird silhouette ----------------------- */

function birdPath(
  x: number,
  y: number,
  size: number,
  seed: number
): string {
  const spread = size * (0.8 + seeded(seed) * 0.4);
  const dip = size * 0.3 * (0.7 + seeded(seed + 1) * 0.6);
  return [
    `M${x - spread} ${y - dip}`,
    `Q${x - spread * 0.3} ${y + dip * 0.5} ${x} ${y}`,
    `Q${x + spread * 0.3} ${y + dip * 0.5} ${x + spread} ${y - dip}`,
  ].join(" ");
}

/* -- Layer schema -------------------------- */

interface LayerDef {
  baseY: number;
  ampFrac: number;
  color: string;
  density: number;
  roundChance: number;
  wRange: [number, number];
  hFrac: [number, number];
  seed: number;
  treeMode: "ridge" | "separate";
}

const LAYERS: LayerDef[] = [
  // Far mountains -- smooth ridge
  { baseY: 0.30, ampFrac: 0.058, color: "#C8DCC8", density: 0.35, roundChance: 0,   wRange: [8, 14],   hFrac: [0.015, 0.03],   seed: 10,  treeMode: "separate" },
  // Distant ridge -- sharper, narrower spikes
  { baseY: 0.37, ampFrac: 0.050, color: "#AED0AE", density: 1.2, roundChance: 0,    wRange: [20, 25],   hFrac: [0.03, 0.06],    seed: 30,  treeMode: "separate" },
  // Mid-far -- dense forest
  { baseY: 0.45, ampFrac: 0.042, color: "#88BE88", density: 1.8, roundChance: 0,    wRange: [40, 60],   hFrac: [0.05, 0.09],    seed: 60,  treeMode: "separate" },
  // Mid -- jagged profile
  { baseY: 0.54, ampFrac: 0.034, color: "#58A258", density: 2.0, roundChance: 0,    wRange: [80, 120],   hFrac: [0.07, 0.12],    seed: 100, treeMode: "separate" },
  // Near-mid -- distinct tall pines
  { baseY: 0.65, ampFrac: 0.026, color: "#358435", density: 2.5, roundChance: 0,    wRange: [100, 120],   hFrac: [0.10, 0.18],    seed: 150, treeMode: "separate" },
  // Near -- render distinct individual trees on top of ridge
  { baseY: 0.78, ampFrac: 0.018, color: "#1C6420", density: 1.1, roundChance: 0,    wRange: [160, 190],  hFrac: [0.15, 0.28],    seed: 210, treeMode: "separate" },
  // Foreground -- largest individual trees
  { baseY: 0.93, ampFrac: 0.008, color: "#0C3010", density: 0.85, roundChance: 0,    wRange: [180, 200],  hFrac: [0.20, 0.35],     seed: 280, treeMode: "separate" },
];

/* -- UPDATED: Firewatch Style Tree Generator -- */
// Uses a jagged, tiered logic instead of smooth curves

function nearTreeCrownPath(tree: Tree, baseY: number): string {
  const j = (n: number) => seeded(tree.variation * 1000 + n);

  // Config for the tree style
  const tiers = 30 + Math.floor(j(1) * 8); // How many branch layers
  const tipHeight = tree.h;
  const tipX = tree.cx + (j(2) - 0.5) * tree.w * 0.1; // Top isn't always perfectly center
  const tipY = baseY - tipHeight;

  // We will build the left side path downwards, then the right side path upwards
  const leftPts: string[] = [];
  const rightPts: string[] = [];

  // Start at top
  leftPts.push(`M${tipX} ${tipY}`);

  // Generate Tiers
  for (let i = 0; i < tiers; i++) {
    const t = (i + 1) / tiers; // Progress 0 -> 1
    const tPrev = i / tiers;

    // Non-linear width growth (concave profile looks more like a tall pine)
    const widthFactor = Math.pow(t, 1.2);

    // Base y position for this tier
    const layerY = tipY + t * tipHeight * 0.95; // 0.95 keeps trunk room at bottom

    // Randomize the "jaggedness" of this specific branch
    const branchLenL = tree.w * 0.5 * widthFactor * (0.7 + j(10 + i) * 0.6);
    const branchLenR = tree.w * 0.5 * widthFactor * (0.7 + j(50 + i) * 0.6);

    // Calculate branch tip coordinates
    // Firewatch trees often have branches that swoop down or up slightly
    const drop = tree.h * 0.02;
    const branchY_L = layerY + (j(20 + i) - 0.5) * drop;
    const branchY_R = layerY + (j(60 + i) - 0.5) * drop;

    const bx_L = tree.cx - branchLenL;
    const bx_R = tree.cx + branchLenR;

    // "Tuck" point - where the branch goes back in towards the trunk
    // Firewatch style is very jagged/serrated.
    // The tuck shouldn't go all the way to center, creating a "saw" effect.
    const tuckRatio = 0.4 + j(80 + i) * 0.2; // How deep the cut is
    const nextY = tipY + (t + 1/tiers) * tipHeight * 0.95;
    const tuckY = (branchY_L + nextY) / 2; // Midpoint vertical

    const tx_L = tree.cx - branchLenL * tuckRatio;
    const tx_R = tree.cx + branchLenR * tuckRatio;

    // Add points
    leftPts.push(`L${bx_L} ${branchY_L}`); // Out to branch tip
    leftPts.push(`L${tx_L} ${tuckY}`);     // Back in towards trunk

    // Store right points to be added in reverse order later
    rightPts.push(`L${bx_R} ${branchY_R}`);
    rightPts.push(`L${tx_R} ${tuckY}`);
  }

  // Base of the tree (trunk area)
  const trunkW = tree.w * 0.15;
  leftPts.push(`L${tree.cx - trunkW} ${baseY}`);
  leftPts.push(`L${tree.cx + trunkW} ${baseY}`);

  // Combine: Top -> Left Side -> Bottom -> Right Side (Reverse) -> Close
  // Note: We need to reverse the logic for right points to draw upwards
  const reversedRight: string[] = [];
  for(let k = tiers - 1; k >= 0; k--) {
     // Reconstruct the logic to push in correct drawing order (bottom to top)
     // Or simpler: just reverse the pairs we stored.
     // But strictly, we stored (Tip, Tuck).
     // Drawing up, we need (Tuck, Tip) of the previous layer...
     // actually simpler to just trace the points.
  }

  // Let's just rebuild right side string simply to avoid order confusion
  const rightString: string[] = [];
  // Add bottom trunk connection
  // rightString.push(`L${tree.cx + trunkW} ${baseY}`); // Already added via leftPts logic

  // Iterate backwards from bottom tier to top
  for (let i = tiers - 1; i >= 0; i--) {
     const t = (i + 1) / tiers;
     const widthFactor = Math.pow(t, 1.2);
     const layerY = tipY + t * tipHeight * 0.95;

     const branchLenR = tree.w * 0.5 * widthFactor * (0.7 + j(50 + i) * 0.6);
     const drop = tree.h * 0.02;
     const branchY_R = layerY + (j(60 + i) - 0.5) * drop;
     const bx_R = tree.cx + branchLenR;

     const tuckRatio = 0.4 + j(80 + i) * 0.2;
     const nextY = tipY + (t + 1/tiers) * tipHeight * 0.95;
     const tuckY = (branchY_R + nextY) / 2;
     const tx_R = tree.cx + branchLenR * tuckRatio;

     // Drawing UP: From trunk/tuck TO branch tip
     // We are at the "tuck" position from the previous loop roughly
     rightString.push(`L${tx_R} ${tuckY}`);
     rightString.push(`L${bx_R} ${branchY_R}`);
  }

  return [
    ...leftPts,
    ...rightString,
    `L${tipX} ${tipY}`, // Close loop at top
    "Z"
  ].join(" ");
}

/* -- Component ----------------------------- */

export function ForestBackground() {
  const { width, height } = useWindowDimensions();
  const scaleRef = Math.min(width, height);

  const layerRender = useMemo(
    () =>
      LAYERS.map((l) => {
        const amp = scaleRef * l.ampFrac;
        const treeMinHeight = scaleRef * l.hFrac[0];
        const treeMaxHeight = scaleRef * l.hFrac[1];
        const trees = scatterTrees(
          width,
          l.density,
          l.wRange[0],
          l.wRange[1],
          treeMinHeight,
          treeMaxHeight,
          l.roundChance,
          l.seed
        );
        const ridge = ridgePath(
          width,
          height,
          l.baseY,
          amp,
          l.seed + 500,
          l.treeMode === "ridge" ? trees : []
        );
        const separateTrees =
          l.treeMode === "separate"
            ? trees
                .map((t, i) => {
                  // Create broader silhouette variety
                  const bucket = seeded(l.seed + i * 13);
                  // Firewatch trees are often tall and skinny (conifers)
                  const widthScale = bucket < 0.4 ? 1.0 : bucket < 0.85 ? 0.8 : 0.6;
                  const heightScale = bucket < 0.4 ? 0.9 : bucket < 0.85 ? 1.1 : 1.3;

                  const jitterX =
                    Math.sin(i * 1.17 + seeded(l.seed) * 8) * t.w * 0.18 +
                    (seeded(l.seed + i * 97) - 0.5) * t.w * 0.35;

                  const tree = {
                    ...t,
                    cx: t.cx + jitterX,
                    w: t.w * widthScale,
                    h: t.h * heightScale,
                  };

                  // Firewatch has clusters.
                  const keep = seeded(l.seed + i * 29) > 0.15;
                  return { tree, keep };
                })
                .filter((x) => x.keep)
                .map(({ tree }) => {
                const baseY = mountainBaseY(
                  tree.cx,
                  width,
                  height,
                  l.baseY,
                  amp,
                  l.seed + 500
                );
                return {
                  crownPath: nearTreeCrownPath(tree, baseY),
                };
              })
            : [];
        return {
          color: l.color,
          ridge,
          separateTrees,
        };
      }),
    [width, height, scaleRef]
  );

  const birds = useMemo(() => {
    const n = 6 + Math.floor(seeded(42) * 4);
    return Array.from({ length: n }, (_, i) => ({
      d: birdPath(
        width * (0.15 + seeded(700 + i * 13) * 0.7),
        height * (0.05 + seeded(700 + i * 17) * 0.17),
        3 + seeded(700 + i * 23) * 6,
        700 + i * 37
      ),
      opacity: 0.18 + seeded(700 + i * 41) * 0.28,
    }));
  }, [width, height]);

  return (
    <LinearGradient
      colors={["#F0F7F0", "#E6F0E8", "#D8E8DA", "#CADCCC", "#BCD4BE"]}
      locations={[0, 0.18, 0.42, 0.68, 1]}
      style={[StyleSheet.absoluteFill, { zIndex: 0 }]}
      pointerEvents="none"
    >
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Warm-green horizon glow */}
          <SvgRadialGradient
            id="sunGlow"
            cx={width * 0.5}
            cy={height * 0.30}
            rx={width * 0.55}
            ry={height * 0.28}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor="#D8ECBE" stopOpacity="0.55" />
            <Stop offset="0.45" stopColor="#D0E8C4" stopOpacity="0.22" />
            <Stop offset="1" stopColor="transparent" stopOpacity="0" />
          </SvgRadialGradient>

          {/* Bottom vignette */}
          <SvgLinearGradient
            id="bottomVignette"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
            gradientUnits="objectBoundingBox"
          >
            <Stop offset="0.78" stopColor="transparent" stopOpacity="0" />
            <Stop offset="0.93" stopColor="#061408" stopOpacity="0.22" />
            <Stop offset="1" stopColor="#040E06" stopOpacity="0.50" />
          </SvgLinearGradient>

        </Defs>

        <Rect width={width} height={height} fill="url(#sunGlow)" />

        {/* Silhouette layers */}
        {layerRender.map((layer, i) => (
          <G key={i}>
            <Path d={layer.ridge} fill={layer.color} />
            {layer.separateTrees.map((tree, ti) => (
              <G key={`t-${i}-${ti}`}>
                <Path d={tree.crownPath} fill={layer.color} />
              </G>
            ))}
          </G>
        ))}

        {/* Birds */}
        <G>
          {birds.map((b, i) => (
            <Path
              key={`b${i}`}
              d={b.d}
              fill="none"
              stroke="#5A7A5A"
              strokeWidth={1.2}
              strokeLinecap="round"
              opacity={b.opacity}
            />
          ))}
        </G>

        <Rect width={width} height={height} fill="url(#bottomVignette)" />
      </Svg>
    </LinearGradient>
  );
}
