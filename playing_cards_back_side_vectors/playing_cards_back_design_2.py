#!/usr/bin/env python3
#
# Playing cards back side design
# ------------------------------
# Generates a vector design and saves it as SVG file
# Design 2
# * rounded rectangle
# * rectangle with blue cross hatch lines
#
# Questions, comments - bdr1976@gmail.com - Bas de Reuver, aug 2025

import math
import svgwrite

WHITE_COLOR = "#ffffff" # blue

CARD_COLOR = "#1e4495" # blue
#CARD_COLOR = "#0099d5" # light blue
#CARD_COLOR = "#bf1e2e" # red
#CARD_COLOR = "#387058" # green
#CARD_COLOR = "#000000" # black



def define_flower(dwg):
    cx, cy = 0, 0      # center
    R = 15             # base radius
    Rb = 5             # inner flower radius
    A = 3              # amplitude of bulges
    n = 4              # number of petals

    fl_grp = dwg.g(id="flower")

    # --- Outer sinusoidal "petal" shape ---
    pts = []
    lns = []
    steps = 360   # smoothness of the curve
    for i in range(steps+1):
        # flower outline points
        theta = 2*math.pi * i / steps
        r = R + abs(A * math.cos(n*theta))
        x = cx + r * math.cos(theta)
        y = cy + r * math.sin(theta)
        pts.append((x, y))
        # flower lines (every 30 degrees
        if i % 10 == 0:
            x2 = cx + Rb * math.cos(theta)
            y2 = cy + Rb * math.sin(theta)
            lns.append([x, y, x2, y2])

    # Draw as closed polygon
    fl_grp.add(dwg.polygon(points=pts, fill="white", stroke=CARD_COLOR, stroke_width=0.5))

    # Draw flower lines
    for (x1, y1, x2, y2) in lns:
        fl_grp.add(dwg.line(start=(x1, y1), end=(x2, y2), stroke=CARD_COLOR, stroke_width=0.5))

    # --- Central circle (unfilled) ---
    fl_grp.add(dwg.circle(center=(cx, cy), r=Rb,
                       fill="none", stroke=CARD_COLOR, stroke_width=1))

    # Draw save flower as symbol
    dwg.defs.add(fl_grp)

def draw_elipse_flower(dwg, cx, cy, rx, ry):

    # cx, cy = center point
    # rx, ry = ellipse radii

    angle = 0
    for i in range(18):
        
        # Ellipse center is below top end by ry
        ellipse_cx = cx
        ellipse_cy = cy + ry

        ellipse = dwg.ellipse(
            center=(ellipse_cx, ellipse_cy),
            r=(rx, ry),
            fill=CARD_COLOR,
            stroke="none",
            stroke_width=1
        )

        # Correct: rotate around top end using keyword argument
        ellipse.rotate(angle, center=(cx, cy))
        angle = angle + 20

        dwg.add(ellipse)

    rx = rx - 1    # adjust ellipse radii
    ry = ry - 1
    angle = 0
    for i in range(18):
        
        # Ellipse center is below top end by ry
        ellipse_cx = cx
        ellipse_cy = cy + ry

        ellipse = dwg.ellipse(
            center=(ellipse_cx, ellipse_cy),
            r=(rx, ry),
            fill="none",
            stroke="white",
            stroke_width=2
        )

        # Correct: rotate around top end using keyword argument
        ellipse.rotate(angle, center=(cx, cy))
        angle = angle + 20

        dwg.add(ellipse)

def main():
    # Canvas
    W, H = 250, 350
    dwg = svgwrite.Drawing("player_card_back_design_2.svg", size=(W, H))

    # playing card outline
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


    # Draw extra inner rectangle
    margin = 20
    rect_w, rect_h = W - 2*margin, H - 2*margin
    print(f"rect_w={rect_w} rect_h={rect_h}" )
    dwg.add(dwg.rect(
        insert=(margin, margin),
        size=(rect_w, rect_h),
        fill="none",
        stroke=CARD_COLOR,
        stroke_width=1
    ))

    # Inner rectangle size and margin
    margin = 25
    rect_w, rect_h = W - 2*margin, H - 2*margin

    # Define pattern for dotted crosshatch
    print(f"rect_w={rect_w} rect_h={rect_h}" )
    pat_size_x = rect_w / 20
    pat_size_y = rect_h / (0.5 * 30)
    hatch = dwg.pattern(
        id="dotted_hatch",
        size=(pat_size_x, pat_size_y),
        patternUnits="userSpaceOnUse",
        insert=(margin, margin) # Note: shift origin of cross-hatch pattern to upper-left corner of fill rectangle
    )

    # Style for dotted stroke: 1px line, dot every ~3px
    line_style_1 = {"stroke": CARD_COLOR, "stroke_width": 1.5}
    line_style_2 = {"stroke": CARD_COLOR, "stroke_width": 0.5}

    # Thick diagonal lines
    hatch.add(dwg.line(start=(0, 0), end=(pat_size_x, pat_size_y), **line_style_1))   # ↘
    hatch.add(dwg.line(start=(pat_size_x, 0), end=(0, pat_size_y), **line_style_1))   # ↙

    # Thinner diagonal lines
    hatch.add(dwg.line(start=((pat_size_x/2), 0), end=((pat_size_x/2), pat_size_y), **line_style_2))   # down
    hatch.add(dwg.line(start=(0,(pat_size_y/2)), end=(pat_size_x, (pat_size_y/2)), **line_style_2))   # left right

    hatch.add(dwg.line(start=(pat_size_x, 0), end=(pat_size_x, pat_size_y), **line_style_2))   # down
    hatch.add(dwg.line(start=(0,pat_size_y), end=(pat_size_x, pat_size_y), **line_style_2))   # left right

    # Add pattern to defs
    dwg.defs.add(hatch)

    # Draw square filled with crosshatch
    print(f"rect_w={rect_w} rect_h={rect_h}" )
    dwg.add(dwg.rect(
        insert=(margin, margin),
        size=(rect_w, rect_h),
        fill="url(#dotted_hatch)",
        stroke=CARD_COLOR,
        stroke_width=1
    ))

    # Repeating square with an X around the inner rectangle
    sq_size = 20
    step = 4
    def draw_square_with_x(x, y):
        dwg.add(dwg.rect((x, y), (sq_size, sq_size), fill="none", stroke=CARD_COLOR, stroke_width=1))
        dwg.add(dwg.line((x, y), (x+sq_size, y+sq_size), stroke=CARD_COLOR, stroke_width=1))
        dwg.add(dwg.line((x+sq_size, y), (x, y+sq_size), stroke=CARD_COLOR, stroke_width=1))

    # decorative circles outer margin
    box_margin = 20
    bx, by = box_margin, box_margin
    bw, bh = W - 2*box_margin, H - 2*box_margin
    step = 4

    # Top row
    for x in range(bx+3, bx+bw, step):
        dwg.add(dwg.circle(center=(x, by-2), r=1.5, fill="none", stroke=CARD_COLOR, stroke_width=0.5))
    # Bottom row
    for x in range(bx+3, bx+bw, step):
        dwg.add(dwg.circle(center=(x, by+bh+2), r=1.5, fill="none", stroke=CARD_COLOR, stroke_width=0.5))
    #    draw_square_with_x(x, by + bh + step - sq_size)
    # Left column
    for y in range(by+3, by+bh, step):
        dwg.add(dwg.circle(center=(bx-2, y), r=1.5, fill="none", stroke=CARD_COLOR, stroke_width=0.5))
    # Right column
    for y in range(by+3, by+bh, step):
        dwg.add(dwg.circle(center=(bx+bw+2, y), r=1.5, fill="none", stroke=CARD_COLOR, stroke_width=0.5))

    # Circle with star in center
    cx, cy = W//2, H//2

    # Draw big flower in center
    draw_elipse_flower(dwg, cx, cy, 15, 20)
    
    # draw flower in center
    offset = 50
    define_flower(dwg)
    dwg.add(dwg.use("#flower", insert=(0+offset, 0+offset)))
    dwg.add(dwg.use("#flower", insert=(W-offset, 0+offset)))
    dwg.add(dwg.use("#flower", insert=(0+offset, H-offset)))
    dwg.add(dwg.use("#flower", insert=(W-offset, H-offset)))

    # Save
    dwg.save()
    print("player_card_back_design_2.svg")

if __name__ == "__main__":
    main()
