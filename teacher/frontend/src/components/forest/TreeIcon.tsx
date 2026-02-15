import React from "react";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { palette } from "../../constants/palette";

interface TreeIconProps {
  size?: number;
  color?: string;
}

/** Minimalist tree silhouette — refined geometric canopy, subtle stem. */
export function TreeIcon({ size = 48, color = palette.primary }: TreeIconProps) {
  const id = `tree-grad-${size}-${color.replace("#", "")}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Defs>
        <LinearGradient id={id} x1="24" y1="2" x2="24" y2="42" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor={color} stopOpacity={0.9} />
          <Stop offset="100%" stopColor={color} stopOpacity={0.65} />
        </LinearGradient>
      </Defs>
      <Path
        d="M24 5 L10 36 Q10 42 24 42 Q38 42 38 36 Z"
        fill={`url(#${id})`}
      />
      <Path d="M22 36 L22 44 L26 44 L26 36 Z" fill={palette.forestBark} fillOpacity={0.5} />
    </Svg>
  );
}
