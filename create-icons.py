#!/usr/bin/env python3
"""Create square PNG icons from landscape fmb-logo.png"""

from PIL import Image
import os

input_path = "public/fmb-logo.png"
output_dir = "public"

# Open the original logo
logo = Image.open(input_path)
print(f"Original logo size: {logo.size}")

# Convert to RGBA if needed (for transparency support)
if logo.mode != 'RGBA':
    logo = logo.convert('RGBA')

# Create 192x192 icon
size_192 = 192
canvas_192 = Image.new('RGBA', (size_192, size_192), (255, 255, 255, 0))  # Transparent background

# Calculate scaling to fit logo in canvas while maintaining aspect ratio
logo_aspect = logo.width / logo.height
canvas_aspect = size_192 / size_192

if logo_aspect > canvas_aspect:
    # Logo is wider - scale by width
    new_width = int(size_192 * 0.85)
    new_height = int(new_width / logo_aspect)
else:
    # Logo is taller - scale by height
    new_height = int(size_192 * 0.85)
    new_width = int(new_height * logo_aspect)

logo_192 = logo.resize((new_width, new_height), Image.Resampling.LANCZOS)

# Center the logo
x = (size_192 - new_width) // 2
y = (size_192 - new_height) // 2
canvas_192.paste(logo_192, (x, y), logo_192)

# Save 192x192
output_192 = os.path.join(output_dir, "fmb-logo-192.png")
canvas_192.save(output_192, "PNG")
print(f"✓ Created {output_192}")

# Create 512x512 icon
size_512 = 512
canvas_512 = Image.new('RGBA', (size_512, size_512), (255, 255, 255, 0))  # Transparent background

# Scale logo for 512x512
if logo_aspect > canvas_aspect:
    new_width = int(size_512 * 0.85)
    new_height = int(new_width / logo_aspect)
else:
    new_height = int(size_512 * 0.85)
    new_width = int(new_height * logo_aspect)

logo_512 = logo.resize((new_width, new_height), Image.Resampling.LANCZOS)

# Center the logo
x = (size_512 - new_width) // 2
y = (size_512 - new_height) // 2
canvas_512.paste(logo_512, (x, y), logo_512)

# Save 512x512
output_512 = os.path.join(output_dir, "fmb-logo-512.png")
canvas_512.save(output_512, "PNG")
print(f"✓ Created {output_512}")

print("\n✓ Square PNG icons created successfully!")
print(f"  - fmb-logo-192.png (192x192)")
print(f"  - fmb-logo-512.png (512x512)")
