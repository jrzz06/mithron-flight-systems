import type { CinematicMediaAsset } from "@/config/types";

export const localMedia = {
  heroAg10Poster: {
    id: "hero-ag10-poster",
    src: "/media/mithron/hero/ag10-command.webp",
    alt: "Mithron AG10 sprayer drone floating over a cinematic smart-farming field",
    kind: "image",
    local: true,
    role: "hero",
    width: 1600,
    height: 900
  },
  heroAg10Loop: {
    id: "hero-ag10-loop",
    src: "/media/mithron/hero/ag10-command.webp",
    alt: "Mithron AG10 cinematic smart-farming hero scene",
    kind: "image",
    local: true,
    role: "hero",
    width: 1600,
    height: 900,
    poster: "/media/mithron/hero/ag10-command.webp"
  },
  storyPrecisionSpray: {
    id: "story-precision-spray",
    src: "/media/mithron/story/precision-spray.webp",
    alt: "Mithron precision spraying over crop rows",
    kind: "image",
    local: true,
    role: "story",
    width: 1200,
    height: 900
  },
  storyTerrainRadar: {
    id: "story-terrain-radar",
    src: "/media/mithron/story/terrain-radar.webp",
    alt: "Mithron terrain radar and obstacle avoidance visualization",
    kind: "image",
    local: true,
    role: "story",
    width: 1200,
    height: 900
  },
  storyMissionPlanning: {
    id: "story-mission-planning",
    src: "/media/mithron/story/mission-planning.webp",
    alt: "Mithron autonomous mission planning and mapping workflow",
    kind: "image",
    local: true,
    role: "story",
    width: 1200,
    height: 900
  }
} satisfies Record<string, CinematicMediaAsset>;

export function getCriticalMediaManifest(): CinematicMediaAsset[] {
  return Object.values(localMedia);
}
