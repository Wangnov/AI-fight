#!/usr/bin/env python3
"""Reinforce generated stage backgrounds with exact LobeHub logo silhouettes."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SCENE_DIR = ROOT / "public/sprites/scene"
LOGO_DIR = ROOT / "tools/asset_refs/logo_refs"


@dataclass(frozen=True)
class LogoPlacement:
    image: str
    logo: str
    center: tuple[int, int]
    size: int
    color: tuple[int, int, int]
    opacity: float = 0.88


PLACEMENTS = [
    LogoPlacement("menu_bg.png", "openai", (255, 170), 124, (54, 236, 255), 0.58),
    LogoPlacement("menu_bg.png", "anthropic", (640, 168), 122, (255, 177, 70), 0.58),
    LogoPlacement("menu_bg.png", "grok", (1025, 170), 126, (165, 120, 255), 0.62),
    LogoPlacement("bg_arena_altman_dario.png", "openai", (320, 190), 170, (50, 230, 255), 0.72),
    LogoPlacement("bg_arena_altman_dario.png", "anthropic", (965, 180), 185, (255, 178, 55), 0.72),
    LogoPlacement("bg_arena_altman_dario.png", "claude", (1110, 345), 78, (255, 130, 40), 0.54),
    LogoPlacement("bg_arena_altman_elon.png", "openai", (320, 190), 170, (50, 230, 255), 0.72),
    LogoPlacement("bg_arena_altman_elon.png", "grok", (970, 185), 190, (160, 130, 255), 0.76),
    LogoPlacement("bg_arena_dario_elon.png", "anthropic", (320, 180), 185, (255, 178, 55), 0.72),
    LogoPlacement("bg_arena_dario_elon.png", "claude", (185, 345), 78, (255, 130, 40), 0.54),
    LogoPlacement("bg_arena_dario_elon.png", "grok", (970, 185), 190, (160, 130, 255), 0.76),
    LogoPlacement("bg_arena_mirror.png", "openai", (365, 176), 118, (58, 224, 255), 0.58),
    LogoPlacement("bg_arena_mirror.png", "anthropic", (640, 176), 118, (255, 178, 55), 0.58),
    LogoPlacement("bg_arena_mirror.png", "grok", (915, 176), 122, (165, 120, 255), 0.6),
]


def load_logo(name: str, size: int, color: tuple[int, int, int], opacity: float) -> Image.Image:
    source = Image.open(LOGO_DIR / f"{name}.png").convert("RGBA")
    source.thumbnail((size, size), Image.Resampling.LANCZOS)
    alpha = source.getchannel("A").point(lambda value: round(value * opacity))
    logo = Image.new("RGBA", source.size, (*color, 0))
    logo.putalpha(alpha)
    return logo


def paste_with_glow(base: Image.Image, logo: Image.Image, center: tuple[int, int], color: tuple[int, int, int]) -> None:
    x = center[0] - logo.width // 2
    y = center[1] - logo.height // 2
    glow = Image.new("RGBA", logo.size, (*color, 0))
    glow_alpha = logo.getchannel("A").filter(ImageFilter.GaussianBlur(14)).point(
        lambda value: min(150, value * 2)
    )
    glow.putalpha(glow_alpha)
    base.alpha_composite(glow, (x, y))
    base.alpha_composite(logo, (x, y))


def main() -> int:
    for path_name in sorted({placement.image for placement in PLACEMENTS}):
        path = SCENE_DIR / path_name
        base = Image.open(path).convert("RGBA")
        for placement in [item for item in PLACEMENTS if item.image == path_name]:
            logo = load_logo(placement.logo, placement.size, placement.color, placement.opacity)
            paste_with_glow(base, logo, placement.center, placement.color)
        base.convert("RGB").save(path)
        print(f"LOGOS {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
