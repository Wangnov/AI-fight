#!/usr/bin/env python3
"""Reinforce generated stage backgrounds with exact LobeHub logo silhouettes."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


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
    panel: tuple[int, int] | None = None


PLACEMENTS = [
    LogoPlacement("menu_bg.png", "openai", (270, 190), 150, (54, 236, 255), 0.78, (230, 190)),
    LogoPlacement("menu_bg.png", "anthropic", (640, 185), 145, (255, 177, 70), 0.78, (230, 190)),
    LogoPlacement("menu_bg.png", "grok", (1010, 190), 155, (165, 120, 255), 0.82, (230, 190)),
    LogoPlacement("bg_arena_altman_dario.png", "openai", (320, 190), 180, (50, 230, 255), 0.86, (260, 210)),
    LogoPlacement("bg_arena_altman_dario.png", "anthropic", (965, 180), 195, (255, 178, 55), 0.86, (260, 220)),
    LogoPlacement("bg_arena_altman_dario.png", "claude", (1110, 345), 86, (255, 130, 40), 0.64, None),
    LogoPlacement("bg_arena_altman_elon.png", "openai", (320, 190), 180, (50, 230, 255), 0.86, (260, 210)),
    LogoPlacement("bg_arena_altman_elon.png", "grok", (970, 185), 205, (160, 130, 255), 0.9, (280, 220)),
    LogoPlacement("bg_arena_dario_elon.png", "anthropic", (320, 180), 195, (255, 178, 55), 0.86, (260, 220)),
    LogoPlacement("bg_arena_dario_elon.png", "claude", (185, 345), 86, (255, 130, 40), 0.64, None),
    LogoPlacement("bg_arena_dario_elon.png", "grok", (970, 185), 205, (160, 130, 255), 0.9, (280, 220)),
    LogoPlacement("bg_arena_mirror.png", "openai", (365, 176), 132, (58, 224, 255), 0.72, None),
    LogoPlacement("bg_arena_mirror.png", "anthropic", (640, 176), 132, (255, 178, 55), 0.72, None),
    LogoPlacement("bg_arena_mirror.png", "grok", (915, 176), 140, (165, 120, 255), 0.74, None),
]


def load_logo(name: str, size: int, color: tuple[int, int, int], opacity: float) -> Image.Image:
    source = Image.open(LOGO_DIR / f"{name}.png").convert("RGBA")
    source.thumbnail((size, size), Image.Resampling.LANCZOS)
    alpha = source.getchannel("A").point(lambda value: round(value * opacity))
    logo = Image.new("RGBA", source.size, (*color, 0))
    logo.putalpha(alpha)
    return logo


def add_panel(base: Image.Image, center: tuple[int, int], size: tuple[int, int], color: tuple[int, int, int]) -> None:
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    w, h = size
    x = center[0] - w // 2
    y = center[1] - h // 2
    draw.rounded_rectangle(
        (x, y, x + w, y + h),
        radius=14,
        fill=(4, 8, 18, 118),
        outline=(*color, 130),
        width=3,
    )
    blurred = overlay.filter(ImageFilter.GaussianBlur(8))
    base.alpha_composite(blurred)
    base.alpha_composite(overlay)


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
            if placement.panel:
                add_panel(base, placement.center, placement.panel, placement.color)
            logo = load_logo(placement.logo, placement.size, placement.color, placement.opacity)
            paste_with_glow(base, logo, placement.center, placement.color)
        base.convert("RGB").save(path)
        print(f"LOGOS {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
