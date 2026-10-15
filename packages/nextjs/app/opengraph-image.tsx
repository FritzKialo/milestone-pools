import { ogSize, renderOgCard } from "~~/lib/ogCard";

export const alt = "Milestone Pools: fund work in steps and pay only for what is delivered";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return renderOgCard();
}
