import React from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from "react-native-svg";
import { palette } from "../../constants/palette";

/** Deterministic pseudo-random from seed */
function seeded(seed: number) {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

type TreeShape = "pine" | "conical" | "rounded";

/** Single tree path — pine (tall skinny), conical (layered tiers), rounded (bushy). */
function treePath(
  x: number,
  baseY: number,
  width: number,
  height: number,
  shape: TreeShape,
  lean: number
): string {
  const tipX = x + width / 2 + lean;
  const r = x + width;
  switch (shape) {
    case "pine":
      return `M${x} ${baseY} L${tipX} ${baseY - height} L${r} ${baseY} Z`;
    case "conical":
      return `M${x} ${baseY} L${x + width * 0.2} ${baseY - height * 0.45} L${tipX} ${baseY - height} L${x + width * 0.8} ${baseY - height * 0.45} L${r} ${baseY} Z`;
    case "rounded":
      return `M${x} ${baseY} Q${tipX} ${baseY - height * 0.6} ${tipX} ${baseY - height} Q${r} ${baseY - height * 0.6} ${r} ${baseY} Z`;
    default:
      return `M${x} ${baseY} L${tipX} ${baseY - height} L${r} ${baseY} Z`;
  }
}

function TreeLayer({
  baseY,
  color,
  count,
  baseSpacing,
  baseTreeHeight,
  rowSeed,
}: {
  baseY: number;
  color: string;
  count: number;
  baseSpacing: number;
  baseTreeHeight: number;
  rowSeed: number;
}) {
  const paths: string[] = [];
  let x = -baseSpacing;
  const shapes: TreeShape[] = ["pine", "conical", "rounded"];

  for (let i = 0; i < count; i++) {
    const s1 = seeded(rowSeed + i * 31);
    const s2 = seeded(rowSeed + i * 47 + 7);
    const s3 = seeded(rowSeed + i * 73 + 13);
    const s4 = seeded(rowSeed + i * 97 + 23);

    const shape = shapes[Math.floor(s1 * 3)];
    const heightMult = 0.55 + s2 * 1.15;
    const widthMult = 0.35 + s3 * 0.95;
    const lean = (s4 - 0.5) * 8;
    const yOffset = (seeded(rowSeed + i * 59) - 0.5) * 12;
    const spacingJitter = 0.85 + seeded(rowSeed + i * 11) * 0.35;

    const tw = baseSpacing * widthMult * 0.9;
    const th = baseTreeHeight * heightMult;
    const y = baseY - yOffset;

    paths.push(treePath(x, y, tw, th, shape, lean));
    x += baseSpacing * spacingJitter;
  }

  return <Path d={paths.join(" ")} fill={color} fillRule="evenodd" />;
}

export function ForestBackground() {
  const { width, height } = useWindowDimensions();

  const hills = [
    { color: "#B8DEB8", yBase: 0.68, amp: 28, freq: 0.6, smooth: 8 },
    { color: "#96D096", yBase: 0.75, amp: 22, freq: 0.9, smooth: 10 },
    { color: "#75C275", yBase: 0.82, amp: 16, freq: 1.3, smooth: 12 },
    { color: "#52A852", yBase: 0.88, amp: 11, freq: 1.8, smooth: 14 },
    { color: "#358035", yBase: 0.94, amp: 6, freq: 2.4, smooth: 16 },
  ];

  const hillPaths = hills.map(({ color, yBase, amp, freq, smooth }) => {
    const pts: string[] = [`M0 ${height + 30}`];
    for (let i = 0; i <= width + 30; i += smooth) {
      const t = i / width;
      const y =
        height * yBase +
        Math.sin(t * freq * Math.PI * 3) * amp +
        Math.sin(t * freq * 1.7 * Math.PI * 2) * (amp * 0.4);
      pts.push(`L${i} ${y}`);
    }
    pts.push(`L${width + 30} ${height + 30} Z`);
    return <Path key={color} d={pts.join(" ")} fill={color} />;
  });

  const treeLayers = [
    { color: "#A8D8A8", baseY: height * 0.7, spacing: 52, treeHeight: 28, count: 24, seed: 101 },
    { color: "#88C888", baseY: height * 0.76, spacing: 42, treeHeight: 38, count: 28, seed: 202 },
    { color: "#68B868", baseY: height * 0.82, spacing: 34, treeHeight: 48, count: 32, seed: 303 },
    { color: "#48A048", baseY: height * 0.88, spacing: 28, treeHeight: 58, count: 36, seed: 404 },
    { color: "#2E7A2E", baseY: height * 0.94, spacing: 22, treeHeight: 72, count: 42, seed: 505 },
  ];

  return (
    <LinearGradient
      colors={[
        "#EFFAF4",
        "#E5F6ED",
        "#D9F1E4",
        "#CAEBD8",
        "#B8E3CA",
        "#A3D9B9",
        "#8BCEA8",
        "#72C297",
        "#58B586",
        "#3FA676",
        "#2D9364",
      ]}
      locations={[0, 0.06, 0.14, 0.22, 0.32, 0.42, 0.52, 0.64, 0.76, 0.88, 1]}
      style={[StyleSheet.absoluteFill, { zIndex: 0 }]}
      pointerEvents="none"
    >
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id="skyGlow" x1="0.5" y1="0" x2="0.5" y2="1" gradientUnits="objectBoundingBox">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.18" />
            <Stop offset="0.06" stopColor="#E8F8F0" stopOpacity="0.1" />
            <Stop offset="0.2" stopColor="transparent" stopOpacity="0" />
          </SvgLinearGradient>
          <SvgLinearGradient id="horizonWarmth" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
            <Stop offset="0.55" stopColor="transparent" stopOpacity="0" />
            <Stop offset="0.78" stopColor="#2E7A4A" stopOpacity="0.08" />
            <Stop offset="0.92" stopColor="#1E5A36" stopOpacity="0.18" />
            <Stop offset="1" stopColor="#143D24" stopOpacity="0.22" />
          </SvgLinearGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#skyGlow)" />
        {hillPaths}
        {treeLayers.map((layer, i) => (
          <TreeLayer
            key={i}
            baseY={layer.baseY}
            color={layer.color}
            count={layer.count}
            baseSpacing={layer.spacing}
            baseTreeHeight={layer.treeHeight}
            rowSeed={layer.seed}
          />
        ))}
        <Rect width={width} height={height} fill="url(#horizonWarmth)" />
      </Svg>
    </LinearGradient>
  );
}
