#!/usr/bin/env python3
#
# Playing cards back side design
# ------------------------------
# Generates a vector design and saves it as SVG file
# Design 1
# * rounded rectangle
# * rectangle with blue cross hatch lines
#
# Questions, comments - bdr1976@gmail.com - Bas de Reuver, aug 2025

from math import cos, sin, pi

WHITE_COLOR = "#ffffff" # blue

CARD_COLOR = "#1e4495" # blue
#CARD_COLOR = "#0099d5" # light blue
#CARD_COLOR = "#bf1e2e" # red
#CARD_COLOR = "#387058" # green
#CARD_COLOR = "#000000" # black

#!/usr/bin/env python3
import svgwrite
from math import sin, cos, pi

def main():
    # Canvas
    W, H = 250, 350
    dwg = svgwrite.Drawing("player_card_back_design_1.svg", size=(W, H))

    # card outline
    margin = 10
    rect_w, rect_h = W - 2*margin, H - 2*margin
    dwg.add(dwg.rect(
        insert=(0, 0),
        size=(W, H),
        rx=10, ry=10,
        fill="none",
        stroke="#000",
        stroke_width=1
    ))

    # Outer rounded rectangle
    margin = 15
    rect_w, rect_h = W - 2*margin, H - 2*margin
    dwg.add(dwg.rect(
        insert=(margin, margin),
        size=(rect_w, rect_h),
        rx=10, ry=10,
        fill="none",
        stroke=CARD_COLOR,
        stroke_width=3
    ))

    # Inner rectangle size and margin
    margin = 20
    rect_w, rect_h = W - 2*margin, H - 2*margin

    # Define pattern for dotted crosshatch
    pat_size_x = rect_w / 21
    pat_size_y = rect_h / (0.5 * 31)
    hatch = dwg.pattern(
        id="dotted_hatch",
        size=(pat_size_x, pat_size_y),
        patternUnits="userSpaceOnUse"
    )

    # Style for dotted stroke: 1px line, dot every ~3px
    line_style_1 = {"stroke": CARD_COLOR, "stroke_width": 1.5}
    line_style_2 = {"stroke": CARD_COLOR, "stroke_width": 0.5}

    # Add diagonal lines with dotted style
    hatch.add(dwg.line(start=(0, 0), end=(pat_size_x, pat_size_y), **line_style_1))   # ↘
    hatch.add(dwg.line(start=(pat_size_x, 0), end=(0, pat_size_y), **line_style_1))   # ↙

    #hatch.add(dwg.line(start=(pat_size_h, 0), end=(pat_size_h, pat_size), **line_style_2))   # down
    #hatch.add(dwg.line(start=(0,pat_size_h), end=(pat_size, pat_size_h), **line_style_2))   # left right

    # Add pattern to defs
    dwg.defs.add(hatch)

    # Draw square filled with dotted crosshatch
    print(f"rect_w={rect_w} rect_h={rect_h}" )
    dwg.add(dwg.rect(
        insert=(margin, margin),
        size=(rect_w, rect_h),
        fill="url(#dotted_hatch)",
        stroke=CARD_COLOR,
        stroke_width=1
    ))

    # Circle with star in center
#    cx, cy = W//2, H//2
#    points = []
#
#    # jump across circle (180 degree) but with addition step ( +10 degrees)
#    # will return to start in 36 steps
#    r_circle = 40
#    dwg.add(dwg.circle(center=(cx, cy), r=r_circle, fill="white", stroke=CARD_COLOR, stroke_width=2))
#
#    r_circle = 40 - 2
#    angle_deg = 0
#    step = (180 + 10)
#    for _ in range(36):
#        angle_rad = math.radians(angle_deg)  # convert to radians
#        x = cx + r_circle * math.cos(angle_rad)
#        y = cy + r_circle * math.sin(angle_rad)
#        points.append((x, y))
#        angle_deg = angle_deg + step
#
#    dwg.add(dwg.polygon(
#        points=points,
#        fill="none",
#        stroke=CARD_COLOR
#        #stroke_width=0.5,
#        #fill_rule="evenodd"  # alternates fill in intersecting regions
#    ))

    # Save
    dwg.save()
    print("Ready generating file player_card_back_design_1.svg")

if __name__ == "__main__":
    main()
