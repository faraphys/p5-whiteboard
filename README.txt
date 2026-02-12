============================================================ INTERACTIVE
PHYSICS WHITEBOARD – DETAILED README
============================================================

OVERVIEW

The Interactive Whiteboard is a browser-based drawing and annotation
environment designed for STEM teaching. It supports stylus input,
layers, LaTeX math rendering, coordinate systems, export functions, and
slide embedding.

Designed for: - Tablets & stylus devices - Classroom projection -
Embedded slide usage - Persistent per-slide annotations

MAIN FEATURES

Drawing & Annotation

-   Pressure-sensitive pen drawing
-   Highlighter tool
-   Shape drawing tools
-   Text & LaTeX rendering
-   Layered annotation system
-   Grid & snapping support

Mathematical Tools

-   Coordinate system generator (multiple variants)
-   Geometry shapes (triangle, ellipse, shadow box, etc.)
-   Angle indication for right triangle
-   Infinite-style canvas movement (pan + zoom)

Persistence & Export

-   Automatic per-slide saving
-   JSON export/import
-   PNG export
-   PDF export

INTERFACE STRUCTURE

Top Row (Quick Controls)

-   Pointer tool (Esc)
-   Expand / Collapse toolbar (X)
-   Drag handle

Utility Row

-   Shortcuts overview
-   Zoom in (Z)
-   Zoom out (U)
-   Reset view (R)
-   Pan tool (M)

Export Row

-   PNG export
-   PDF export
-   Save JSON
-   Load JSON

DRAWING TOOLS

Pointer (Esc) - Select and move text objects - General navigation

Pen (P) - Adjustable width - Adjustable smoothing - Adjustable
transparency - Full color palette

Eraser (E) - Removes strokes without affecting text

Highlighter (H) - Wide, transparent stroke for emphasis

Fill (F) - Fills enclosed areas bounded by strokes

Laser (O) - Temporary highlighting tool (no permanent strokes)

Text / LaTeX (T) - Plain text - Inline math: ... - Display math:
...
 - Adjustable size

Lasso (L) - Select & move multiple objects

SHAPES

Available shapes: - Line - Arrow - Rectangle - Circle - Ellipse - Right
triangle - Shadow box - Coordinate systems - Title ribbon box

Coordinate Systems

∟ Coord. System 1 - First quadrant only

⊢ Coord. System 2 - First + fourth quadrant

✛ Coord. System 3 - Full four quadrants

All coordinate systems: - Snap origin to grid - Grid spacing matches
canvas grid

STYLING CONTROLS

Color Palette - Predefined teaching-friendly colors

Stroke Width - Adjustable via number keys

Transparency - Adjustable opacity levels

Smoothness (A) - Controls stroke smoothing level

LAYERS

-   Multiple independent drawing layers
-   Toggle visibility
-   Select active layer
-   Cycle layers (Y)

GRID & SNAP

Snap Toggle (N) - Snap shapes and coord systems to grid

Background Modes (G) - Transparent - Dots - Grid

NAVIGATION

Pan Tool (M) - Moves entire canvas

Zoom In (Z) Zoom Out (U)

Reset View (R) - Reset zoom to 100% - Reset pan to original position

SHORTCUT SUMMARY

Esc = Pointer P = Pen E = Eraser H = Highlighter F = Fill T = Text L =
Lasso O = Laser S = Cycle Shapes G = Background mode N = Snap toggle Y =
Cycle layers A = Cycle smoothness Z = Zoom in U = Zoom out R = Reset
view M = Pan

DESIGN PHILOSOPHY

The whiteboard emphasizes:

-   Low cognitive load
-   Fast annotation workflow
-   Mathematical clarity
-   Robust export
-   Reliable classroom usage
-   Student note curation

TECHNICAL NOTES

Dependencies: - p5.js - MathJax - jsPDF - canvg

Storage: - Uses browser localStorage - Slide-based key system

END OF DOCUMENT
