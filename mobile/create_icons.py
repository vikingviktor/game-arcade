from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, filename):
    # Create gradient background
    img = Image.new('RGB', (size, size))
    draw = ImageDraw.Draw(img)
    
    # Draw gradient background (purple to blue, matching game theme)
    for y in range(size):
        r = int(102 + (118 - 102) * y / size)  # 667eea to 764ba2
        g = int(126 + (75 - 126) * y / size)
        b = int(234 + (162 - 234) * y / size)
        draw.rectangle([(0, y), (size, y+1)], fill=(r, g, b))
    
    # Draw rounded square frame
    padding = size // 8
    draw.rounded_rectangle(
        [(padding, padding), (size - padding, size - padding)],
        radius=size // 10,
        outline='white',
        width=size // 40
    )
    
    # Draw game controller/arcade symbol
    center = size // 2
    
    # Joystick base
    joystick_radius = size // 6
    draw.ellipse(
        [(center - joystick_radius, center + size // 8),
         (center + joystick_radius, center + size // 8 + joystick_radius * 2)],
        fill='white'
    )
    
    # Joystick stick
    stick_width = size // 20
    draw.rectangle(
        [(center - stick_width, center - size // 6),
         (center + stick_width, center + size // 8 + joystick_radius)],
        fill='white'
    )
    
    # Joystick ball
    ball_radius = size // 12
    draw.ellipse(
        [(center - ball_radius, center - size // 6 - ball_radius),
         (center + ball_radius, center - size // 6 + ball_radius)],
        fill='#FFD700',  # Gold
        outline='white',
        width=size // 60
    )
    
    # Action buttons (like ABXY on controller)
    button_radius = size // 16
    button_offset = size // 5
    
    # Right buttons
    for i, pos in enumerate([(button_offset, 0), (0, button_offset)]):
        x = center + button_offset + pos[0]
        y = center + pos[1]
        draw.ellipse(
            [(x - button_radius, y - button_radius),
             (x + button_radius, y + button_radius)],
            fill='#FF6B6B',  # Red
            outline='white',
            width=size // 80
        )
    
    img.save(filename)
    print(f"Created {filename}")

# Create both icon sizes
create_icon(192, 'icon-192.png')
create_icon(512, 'icon-512.png')

print("\nIcons created successfully!")
print("Upload these files to your GitHub repo in the mobile folder.")
