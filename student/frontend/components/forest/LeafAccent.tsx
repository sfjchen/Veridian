import React from "react";
import Svg, { Path } from "react-native-svg";
import { palette } from "@/constants/palette";

interface LeafAccentProps {
  size?: number;
  color?: string;
}

/** Refined single-leaf accent — clean curve, subtle. */
export function LeafAccent({ size = 24, color = palette.forestLeaf }: LeafAccentProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.5 C8 7 5 12 5 16 C5 19.5 8 21.5 12 21.5 C16 21.5 19 19.5 19 16 C19 12 16 7 12 2.5 Z"
        fill={color}
        fillOpacity={0.82}
      />
    </Svg>
  );
}
