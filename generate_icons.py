import zlib
import struct
import math

def create_png(filename, size):
    # Generates a clean gradient icon with a stylized sound wave / speaker mark
    width = size
    height = size
    
    raw_data = bytearray()
    center_x = width / 2.0
    center_y = height / 2.0
    radius = width * 0.46
    
    for y in range(height):
        raw_data.append(0)  # filter type 0 (None)
        for x in range(width):
            dx = (x + 0.5) - center_x
            dy = (y + 0.5) - center_y
            dist = math.sqrt(dx * dx + dy * dy)
            
            # Rounded squircle / circle background
            # Gradient from deep violet (#4F46E5) to vibrant magenta (#9333EA)
            t = (x + y) / (width + height)
            bg_r = int(79 * (1 - t) + 147 * t)
            bg_g = int(70 * (1 - t) + 51 * t)
            bg_b = int(229 * (1 - t) + 234 * t)
            
            # Anti-aliasing corner mask
            edge_dist = radius - dist
            alpha = max(0.0, min(1.0, edge_dist + 0.5))
            
            # Waveform bars in the center
            # 3 vertical rounded bars
            bar_color = False
            # Normalize coord from -1 to 1
            nx = dx / (width * 0.35)
            ny = dy / (height * 0.35)
            
            # Bar 1 (left)
            if abs(nx - (-0.5)) < 0.12 and abs(ny) < 0.35:
                bar_color = True
            # Bar 2 (center, taller)
            elif abs(nx - 0.0) < 0.12 and abs(ny) < 0.65:
                bar_color = True
            # Bar 3 (right)
            elif abs(nx - 0.5) < 0.12 and abs(ny) < 0.45:
                bar_color = True
                
            if bar_color and alpha > 0.3:
                r, g, b, a = 255, 255, 255, int(255 * alpha)
            else:
                r, g, b, a = bg_r, bg_g, bg_b, int(255 * alpha)
                
            raw_data.extend([r, g, b, a])
            
    # PNG signature
    png = bytearray(b'\x89PNG\r\n\x1a\n')
    
    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data)
    png.extend(struct.pack('>I', 13) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc))
    
    # IDAT chunk
    compressed = zlib.compress(bytes(raw_data), 9)
    idat_crc = zlib.crc32(b'IDAT' + compressed)
    png.extend(struct.pack('>I', len(compressed)) + b'IDAT' + compressed + struct.pack('>I', idat_crc))
    
    # IEND chunk
    iend_crc = zlib.crc32(b'IEND')
    png.extend(struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc))
    
    with open(filename, 'wb') as f:
        f.write(png)

for sz in [16, 48, 128]:
    create_png(f"/Users/eric/elevenlabs-voice-reader/icons/icon-{sz}.png", sz)
print("Icons generated successfully!")
