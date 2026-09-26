# -*- coding: utf-8 -*-
"""
Master SVG Generator for Captain Gulliver - A Pelican Riding a Bicycle
Compliant with Riding Pelican/shot01/design_spec.json
"""
import math

lines = []
def emit(s):
    lines.append(s)

def polar_to_cart(cx, cy, r, angle_deg):
    rad = math.radians(angle_deg)
    return cx + r * math.cos(rad), cy + r * math.sin(rad)

def describe_arc(cx, cy, r, start_angle, end_angle):
    x1, y1 = polar_to_cart(cx, cy, r, start_angle)
    x2, y2 = polar_to_cart(cx, cy, r, end_angle)
    diff = (end_angle - start_angle) % 360
    large_arc = 1 if diff > 180 else 0
    return f"M {x1:.2f} {y1:.2f} A {r} {r} 0 {large_arc} 1 {x2:.2f} {y2:.2f}"

def describe_fender_band(cx, cy, r_inner, r_outer, start_angle, end_angle):
    x1_out, y1_out = polar_to_cart(cx, cy, r_outer, start_angle)
    x2_out, y2_out = polar_to_cart(cx, cy, r_outer, end_angle)
    x2_in, y2_in = polar_to_cart(cx, cy, r_inner, end_angle)
    x1_in, y1_in = polar_to_cart(cx, cy, r_inner, start_angle)
    diff = (end_angle - start_angle) % 360
    large_arc = 1 if diff > 180 else 0
    return (
        f"M {x1_out:.2f} {y1_out:.2f} "
        f"A {r_outer} {r_outer} 0 {large_arc} 1 {x2_out:.2f} {y2_out:.2f} "
        f"L {x2_in:.2f} {y2_in:.2f} "
        f"A {r_inner} {r_inner} 0 {large_arc} 0 {x1_in:.2f} {y1_in:.2f} Z"
    )

def make_star_path(cx, cy, r_outer, r_inner, points=5):
    coords = []
    step = math.pi / points
    rot = -math.pi / 2
    for i in range(2 * points):
        r = r_outer if i % 2 == 0 else r_inner
        ang = rot + i * step
        coords.append(f"{cx + r * math.cos(ang):.2f} {cy + r * math.sin(ang):.2f}")
    return "M " + " L ".join(coords) + " Z"

def emit_glint(gx, gy, scale=1.0):
    s = scale
    emit(f'    <g transform="translate({gx}, {gy})">')
    emit(f'      <ellipse cx="0" cy="0" rx="{1.2*s:.2f}" ry="{1.2*s:.2f}" fill="#FFFFFF"/>')
    emit(f'      <path d="M 0 {-10*s:.2f} Q 0 0 {10*s:.2f} 0 Q 0 0 0 {10*s:.2f} Q 0 0 {-10*s:.2f} 0 Q 0 0 0 {-10*s:.2f} Z" fill="#FFFFFF" opacity="0.95" filter="url(#glow_filter)"/>')
    emit(f'      <path d="M {-5*s:.2f} {-5*s:.2f} Q 0 0 {5*s:.2f} {-5*s:.2f} Q 0 0 {5*s:.2f} {5*s:.2f} Q 0 0 {-5*s:.2f} {5*s:.2f} Q 0 0 {-5*s:.2f} {-5*s:.2f} Z" fill="#FEF08A" opacity="0.7"/>')
    emit('    </g>')

def write_header_and_defs():
    emit('<?xml version="1.0" encoding="UTF-8"?>')
    emit('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1200 900" width="1200" height="900" preserveAspectRatio="xMidYMid meet">')
    emit('  <title>A Pelican Riding a Bicycle - Captain Gulliver</title>')
    emit('  <desc>Master SVG artwork of Captain Gulliver riding a vintage coastal cruiser on a seaside boardwalk.</desc>')
    emit('  <defs>')
    emit('''    <linearGradient id="sky_gradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#7DD3FC" stop-opacity="1"/>
      <stop offset="40%" stop-color="#BAE6FD" stop-opacity="1"/>
      <stop offset="70%" stop-color="#FED7AA" stop-opacity="1"/>
      <stop offset="100%" stop-color="#FDE68A" stop-opacity="1"/>
    </linearGradient>
    <linearGradient id="sea_gradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0284C7" stop-opacity="0.95"/>
      <stop offset="50%" stop-color="#0EA5E9" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#38BDF8" stop-opacity="0.75"/>
    </linearGradient>
    <linearGradient id="boardwalk_gradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#E7E5E4" stop-opacity="1"/>
      <stop offset="25%" stop-color="#D6D3D1" stop-opacity="1"/>
      <stop offset="60%" stop-color="#A8A29E" stop-opacity="1"/>
      <stop offset="100%" stop-color="#78716C" stop-opacity="1"/>
    </linearGradient>
    <linearGradient id="bike_frame_teal" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#5EEAD4" stop-opacity="1"/>
      <stop offset="35%" stop-color="#14B8A6" stop-opacity="1"/>
      <stop offset="80%" stop-color="#0F766E" stop-opacity="1"/>
      <stop offset="100%" stop-color="#115E59" stop-opacity="1"/>
    </linearGradient>
    <linearGradient id="bike_tube_shade" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#99F6E4" stop-opacity="0.9"/>
      <stop offset="25%" stop-color="#14B8A6" stop-opacity="1"/>
      <stop offset="80%" stop-color="#0F766E" stop-opacity="1"/>
      <stop offset="100%" stop-color="#042F2E" stop-opacity="1"/>
    </linearGradient>
    <linearGradient id="chrome_luster" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="1"/>
      <stop offset="28%" stop-color="#E2E8F0" stop-opacity="1"/>
      <stop offset="48%" stop-color="#64748B" stop-opacity="1"/>
      <stop offset="68%" stop-color="#F8FAFC" stop-opacity="1"/>
      <stop offset="100%" stop-color="#94A3B8" stop-opacity="1"/>
    </linearGradient>
    <linearGradient id="leather_saddle_grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#D97706" stop-opacity="1"/>
      <stop offset="30%" stop-color="#B45309" stop-opacity="1"/>
      <stop offset="75%" stop-color="#78350F" stop-opacity="1"/>
      <stop offset="100%" stop-color="#451A03" stop-opacity="1"/>
    </linearGradient>
    <linearGradient id="bill_culmen_grad" x1="0%" y1="0%" x2="100%" y2="30%">
      <stop offset="0%" stop-color="#FBBF24" stop-opacity="1"/>
      <stop offset="55%" stop-color="#F59E0B" stop-opacity="1"/>
      <stop offset="88%" stop-color="#EA580C" stop-opacity="1"/>
      <stop offset="100%" stop-color="#C2410C" stop-opacity="1"/>
    </linearGradient>
    <linearGradient id="pelican_pouch_grad" x1="0%" y1="0%" x2="80%" y2="100%">
      <stop offset="0%" stop-color="#FECDD3" stop-opacity="0.95"/>
      <stop offset="40%" stop-color="#FB7185" stop-opacity="0.88"/>
      <stop offset="78%" stop-color="#F43F5E" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="#BE123C" stop-opacity="0.96"/>
    </linearGradient>
    <linearGradient id="pelican_body_shading" x1="20%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="1"/>
      <stop offset="65%" stop-color="#F8FAFC" stop-opacity="1"/>
      <stop offset="85%" stop-color="#E2E8F0" stop-opacity="1"/>
      <stop offset="100%" stop-color="#CBD5E1" stop-opacity="1"/>
    </linearGradient>
    <linearGradient id="brass_bell_grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FEF08A" stop-opacity="1"/>
      <stop offset="35%" stop-color="#FBBF24" stop-opacity="1"/>
      <stop offset="75%" stop-color="#D97706" stop-opacity="1"/>
      <stop offset="100%" stop-color="#78350F" stop-opacity="1"/>
    </linearGradient>
    <linearGradient id="tarsus_gradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FDBA74" stop-opacity="1"/>
      <stop offset="30%" stop-color="#F97316" stop-opacity="1"/>
      <stop offset="100%" stop-color="#C2410C" stop-opacity="1"/>
    </linearGradient>
    <linearGradient id="scarf_grad" x1="0%" y1="0%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#F43F5E" stop-opacity="1"/>
      <stop offset="50%" stop-color="#E11D48" stop-opacity="1"/>
      <stop offset="100%" stop-color="#9F1239" stop-opacity="1"/>
    </linearGradient>
    <radialGradient id="sun_glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95"/>
      <stop offset="25%" stop-color="#FEF08A" stop-opacity="0.75"/>
      <stop offset="65%" stop-color="#FDBA74" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#FDBA74" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="tire_contact_shadow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#0F172A" stop-opacity="0.55"/>
      <stop offset="35%" stop-color="#1E293B" stop-opacity="0.3"/>
      <stop offset="75%" stop-color="#334155" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#0F172A" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="rider_body_shadow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#0F172A" stop-opacity="0.35"/>
      <stop offset="50%" stop-color="#1E293B" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#1E293B" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vignette_grad" cx="50%" cy="50%" r="70%">
      <stop offset="40%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="80%" stop-color="#0F172A" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#020617" stop-opacity="0.24"/>
    </radialGradient>
    <filter id="soft_shadow_filter" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="8"/>
      <feOffset dx="18" dy="24" result="offsetblur"/>
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.28"/>
      </feComponentTransfer>
      <feMerge> 
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="glow_filter" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3.5" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>''')
    emit('  </defs>\n')

def write_layer_01_to_05():
    emit('  <!-- LAYER 01: CANVAS SKY -->')
    emit('  <g id="layer_01_canvas_sky">')
    emit('    <rect x="0" y="0" width="1200" height="900" fill="url(#sky_gradient)"/>')
    emit('    <circle cx="280" cy="180" r="160" fill="url(#sun_glow)"/>')
    emit('    <circle cx="280" cy="180" r="80" fill="url(#sun_glow)" opacity="0.8"/>')
    emit('    <circle cx="280" cy="180" r="36" fill="#FFFDF0" filter="url(#glow_filter)"/>')
    emit('    <path d="M 60 140 C 110 115, 170 125, 220 135 C 270 110, 350 120, 390 145 C 340 160, 260 155, 200 158 C 140 162, 90 155, 60 140 Z" fill="#FFFBEB" opacity="0.65"/>')
    emit('    <path d="M 160 120 C 200 105, 250 110, 280 125 C 320 112, 380 118, 410 132 C 370 142, 310 138, 260 140 C 210 142, 180 135, 160 120 Z" fill="#FFFFFF" opacity="0.5"/>')
    emit('    <path d="M 480 110 C 540 85, 620 95, 690 115 C 750 95, 830 105, 870 125 C 810 138, 730 132, 660 136 C 580 140, 520 128, 480 110 Z" fill="#FEF3C7" opacity="0.55"/>')
    emit('    <path d="M 530 95 C 580 80, 640 88, 690 102 C 730 90, 790 98, 830 112 C 770 122, 710 116, 650 118 C 600 120, 560 112, 530 95 Z" fill="#FFFFFF" opacity="0.45"/>')
    emit('    <path d="M 920 160 C 970 145, 1030 150, 1080 168 C 1120 155, 1170 162, 1195 178 C 1150 188, 1090 184, 1040 186 C 980 188, 940 178, 920 160 Z" fill="#FED7AA" opacity="0.45"/>')
    emit('    <path d="M 180 230 C 240 215, 320 220, 390 238 C 450 225, 520 232, 570 248 C 500 258, 420 255, 350 256 C 270 258, 210 248, 180 230 Z" fill="#FDE68A" opacity="0.4"/>')
    emit('  </g>\n')

    emit('  <!-- LAYER 02: DISTANT COASTLINE -->')
    emit('  <g id="layer_02_distant_coastline">')
    emit('    <path d="M 0 510 L 1200 510 L 1200 625 L 0 625 Z" fill="url(#sea_gradient)"/>')
    emit('    <path d="M 0 522 Q 150 518 300 522 T 600 522 T 900 522 T 1200 522" stroke="#BAE6FD" stroke-width="1.2" opacity="0.45" fill="none"/>')
    emit('    <path d="M 0 538 Q 180 534 360 538 T 720 538 T 1080 538 T 1200 538" stroke="#E0F2FE" stroke-width="1.4" opacity="0.5" fill="none"/>')
    emit('    <path d="M 0 558 Q 200 553 400 558 T 800 558 T 1200 558" stroke="#F0F9FF" stroke-width="1.6" opacity="0.55" fill="none"/>')
    emit('    <path d="M 0 582 Q 220 577 440 582 T 880 582 T 1200 582" stroke="#FFFFFF" stroke-width="1.8" opacity="0.5" fill="none"/>')
    emit('    <path d="M 0 606 Q 240 600 480 606 T 960 606 T 1200 606" stroke="#E0F2FE" stroke-width="2" opacity="0.4" fill="none"/>')
    emit('    <path d="M 0 525 C 40 516, 90 510, 150 512 C 200 514, 240 520, 270 525 L 270 550 L 0 550 Z" fill="#0F766E" opacity="0.55"/>')
    emit('    <path d="M 0 530 C 50 522, 110 518, 170 520 C 210 522, 235 528, 250 532 L 250 555 L 0 555 Z" fill="#042F2E" opacity="0.3"/>')
    emit('    <g id="lighthouse_silhouette" transform="translate(130, 435)">')
    emit('      <rect x="30" y="60" width="34" height="18" fill="#F8FAFC" stroke="#64748B" stroke-width="0.8"/>')
    emit('      <polygon points="28,60 47,46 66,60" fill="#DC2626"/>')
    emit('      <rect x="54" y="46" width="4" height="8" fill="#78716C"/>')
    emit('      <polygon points="6,78 24,78 20,12 10,12" fill="#F8FAFC" stroke="#64748B" stroke-width="0.8"/>')
    emit('      <polygon points="8,58 22,58 21,48 9,48" fill="#E11D48"/>')
    emit('      <polygon points="9.5,34 20.5,34 20,24 10,24" fill="#E11D48"/>')
    emit('      <rect x="7" y="9" width="16" height="3" fill="#334155"/>')
    emit('      <rect x="9" y="0" width="12" height="9" fill="#FEF08A" opacity="0.8" stroke="#334155" stroke-width="0.8"/>')
    emit('      <polygon points="7,0 15,-8 23,0" fill="#B91C1C"/>')
    emit('      <circle cx="15" cy="-9" r="1.5" fill="#F59E0B"/>')
    emit('      <polygon points="15,5 320,-20 300,50" fill="#FEF08A" opacity="0.14"/>')
    emit('    </g>')
    emit('    <g id="distant_sailboat" transform="translate(1040, 506)">')
    emit('      <path d="M -16 12 C -6 16, 12 16, 20 11 C 12 18, -10 18, -16 12 Z" fill="#0369A1"/>')
    emit('      <line x1="2" y1="13" x2="10" y2="-30" stroke="#334155" stroke-width="1"/>')
    emit('      <path d="M 9 -28 L 10 10 L -12 7 Z" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="0.5"/>')
    emit('      <path d="M 10 -24 L 22 10 L 11 10 Z" fill="#E2E8F0" stroke="#94A3B8" stroke-width="0.5"/>')
    emit('    </g>')
    emit('    <g id="pier_railing" opacity="0.85">')
    posts_x = [40, 120, 200, 280, 360, 440, 520, 600, 680, 760, 840, 920, 1000, 1080, 1160]
    for px in posts_x:
        emit(f'      <rect x="{px}" y="578" width="8" height="47" fill="#A8A29E" stroke="#78716C" stroke-width="0.8" rx="1"/>')
        emit(f'      <polygon points="{px-1},578 {px+4},573 {px+9},578" fill="#D6D3D1" stroke="#78716C" stroke-width="0.8"/>')
    emit('      <rect x="0" y="584" width="1200" height="6" fill="#D6D3D1" stroke="#78716C" stroke-width="0.8"/>')
    emit('      <rect x="0" y="604" width="1200" height="5" fill="#A8A29E" stroke="#78716C" stroke-width="0.8"/>')
    emit('    </g>')
    emit('  </g>\n')

    emit('  <!-- LAYER 03: PROMENADE AND GROUND SHADOWS -->')
    emit('  <g id="layer_03_promenade_and_ground_shadows">')
    emit('    <rect x="0" y="625" width="1200" height="275" fill="url(#boardwalk_gradient)"/>')
    plank_ys = [625, 642, 662, 685, 712, 742, 776, 814, 856, 900]
    for i in range(len(plank_ys) - 1):
        y_top = plank_ys[i]
        y_bot = plank_ys[i+1]
        emit(f'    <line x1="0" y1="{y_top}" x2="1200" y2="{y_top}" stroke="#F5F5F4" stroke-width="1.2" opacity="0.6"/>')
        emit(f'    <line x1="0" y1="{y_bot}" x2="1200" y2="{y_bot}" stroke="#57534E" stroke-width="2.2"/>')
        mid_y = (y_top + y_bot) / 2
        emit(f'    <line x1="40" y1="{mid_y}" x2="320" y2="{mid_y}" stroke="#A8A29E" stroke-width="0.8" stroke-dasharray="120, 40, 80" opacity="0.4"/>')
        emit(f'    <line x1="420" y1="{mid_y+2}" x2="780" y2="{mid_y+2}" stroke="#78716C" stroke-width="0.8" stroke-dasharray="90, 50, 110" opacity="0.35"/>')
        emit(f'    <line x1="840" y1="{mid_y-2}" x2="1160" y2="{mid_y-2}" stroke="#A8A29E" stroke-width="0.8" stroke-dasharray="140, 60, 70" opacity="0.4"/>')
        j_x = (i * 270 + 190) % 1100 + 50
        emit(f'    <line x1="{j_x}" y1="{y_top}" x2="{j_x}" y2="{y_bot}" stroke="#57534E" stroke-width="1.8"/>')
        emit(f'    <circle cx="{j_x-8}" cy="{mid_y-4}" r="2" fill="#44403C"/>')
        emit(f'    <circle cx="{j_x-8}" cy="{mid_y+4}" r="2" fill="#44403C"/>')
        emit(f'    <circle cx="{j_x+8}" cy="{mid_y-4}" r="2" fill="#44403C"/>')
        emit(f'    <circle cx="{j_x+8}" cy="{mid_y+4}" r="2" fill="#44403C"/>')

    emit('    <path d="M 350 740 C 440 746, 560 758, 680 755 C 780 752, 880 744, 980 742 C 860 766, 680 774, 520 768 C 420 762, 360 750, 350 740 Z" fill="url(#rider_body_shadow)"/>')
    emit('    <ellipse cx="350" cy="740" rx="52" ry="9" fill="url(#tire_contact_shadow)"/>')
    emit('    <ellipse cx="850" cy="740" rx="52" ry="9" fill="url(#tire_contact_shadow)"/>')
    emit('    <ellipse cx="625" cy="744" rx="26" ry="6" fill="url(#tire_contact_shadow)" opacity="0.6"/>')
    emit('  </g>\n')

    emit('  <!-- LAYER 04: REAR WHEEL ASSEMBLY -->')
    emit('  <g id="layer_04_rear_wheel_assembly">')
    emit('    <circle cx="350" cy="610" r="130" fill="#1E293B" stroke="#0F172A" stroke-width="1"/>')
    emit('    <circle cx="350" cy="610" r="126" fill="none" stroke="#334155" stroke-width="3" stroke-dasharray="3, 5"/>')
    emit('    <circle cx="350" cy="610" r="116" fill="#F8FAFC"/>')
    emit('    <circle cx="350" cy="610" r="115" fill="none" stroke="#E2E8F0" stroke-width="1"/>')
    emit('    <circle cx="350" cy="610" r="102" fill="#475569"/>')
    emit('    <circle cx="350" cy="610" r="96" fill="#14B8A6" opacity="0.05"/>')
    emit('    <circle cx="350" cy="610" r="100" fill="none" stroke="url(#chrome_luster)" stroke-width="3"/>')
    emit('    <circle cx="350" cy="610" r="97" fill="none" stroke="#1E293B" stroke-width="1"/>')
    
    for i in range(24):
        theta = i * 15
        offset = 7.5 if i % 2 == 0 else -7.5
        hx, hy = polar_to_cart(350, 610, 16, theta)
        rx, ry = polar_to_cart(350, 610, 101, theta + offset)
        stroke_c = "#FFFFFF" if i % 4 == 0 else "#E2E8F0"
        emit(f'    <line x1="{hx:.2f}" y1="{hy:.2f}" x2="{rx:.2f}" y2="{ry:.2f}" stroke="{stroke_c}" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>')

    emit('    <circle cx="350" cy="610" r="16" fill="url(#chrome_luster)" stroke="#334155" stroke-width="1.5"/>')
    emit('    <circle cx="350" cy="610" r="8" fill="#F1F5F9" stroke="#64748B" stroke-width="1"/>')
    emit('    <circle cx="350" cy="610" r="4" fill="#0F172A"/>')

    fender_rear_path = describe_fender_band(350, 610, 135, 149, 60, 240)
    emit(f'    <path d="{fender_rear_path}" fill="url(#bike_frame_teal)" stroke="#0F766E" stroke-width="1"/>')
    pinstripe_rear = describe_arc(350, 610, 142, 64, 236)
    emit(f'    <path d="{pinstripe_rear}" fill="none" stroke="#FEF08A" stroke-width="2" stroke-linecap="round"/>')
    x_lip1, y_lip1 = polar_to_cart(350, 610, 142, 60)
    x_lip2, y_lip2 = polar_to_cart(350, 610, 142, 240)
    emit(f'    <circle cx="{x_lip1:.2f}" cy="{y_lip1:.2f}" r="7" fill="url(#bike_frame_teal)" stroke="#0F766E" stroke-width="1"/>')
    emit(f'    <circle cx="{x_lip2:.2f}" cy="{y_lip2:.2f}" r="7" fill="url(#bike_frame_teal)" stroke="#0F766E" stroke-width="1"/>')

    emit('    <line x1="350" y1="610" x2="235" y2="550" stroke="url(#chrome_luster)" stroke-width="3" stroke-linecap="round"/>')
    emit('    <circle cx="235" cy="550" r="4.5" fill="#F8FAFC" stroke="#475569" stroke-width="1"/>')
    emit('    <line x1="350" y1="610" x2="275" y2="690" stroke="url(#chrome_luster)" stroke-width="3" stroke-linecap="round"/>')
    emit('    <circle cx="275" cy="690" r="4.5" fill="#F8FAFC" stroke="#475569" stroke-width="1"/>')
    emit('  </g>\n')

    emit('  <!-- LAYER 05: BACKGROUND DRIVETRAIN AND LEG -->')
    emit('  <g id="layer_05_background_drivetrain_and_leg">')
    emit('    <line x1="580" y1="610" x2="538" y2="560" stroke="#64748B" stroke-width="9" stroke-linecap="round"/>')
    emit('    <line x1="580" y1="610" x2="538" y2="560" stroke="#94A3B8" stroke-width="4" stroke-linecap="round"/>')
    emit('    <circle cx="538" cy="560" r="5" fill="#475569"/>')
    emit('    <rect x="522" y="553" width="32" height="14" rx="3" fill="#334155" stroke="#1E293B" stroke-width="1.5"/>')
    emit('    <rect x="526" y="556" width="6" height="8" rx="1" fill="#F97316" opacity="0.8"/>')
    emit('    <path d="M 535 415 C 515 440, 495 465, 508 485 C 518 490, 528 480, 532 465 C 538 450, 545 430, 535 415 Z" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1"/>')
    emit('    <path d="M 508 485 L 538 560" stroke="#EA580C" stroke-width="12" stroke-linecap="round"/>')
    emit('    <path d="M 508 485 L 538 560" stroke="#C2410C" stroke-width="6" stroke-linecap="round" opacity="0.6"/>')
    emit('    <g id="pelican_left_foot_clamped">')
    emit('      <path d="M 526 550 C 518 554, 514 564, 524 568 C 534 570, 548 566, 552 556 C 546 550, 536 548, 526 550 Z" fill="#EA580C" stroke="#C2410C" stroke-width="1"/>')
    emit('      <path d="M 520 556 C 515 560, 518 566, 524 564" stroke="#334155" stroke-width="2.5" stroke-linecap="round" fill="none"/>')
    emit('      <path d="M 530 558 C 526 564, 532 568, 538 566" stroke="#334155" stroke-width="2.5" stroke-linecap="round" fill="none"/>')
    emit('      <path d="M 542 556 C 540 562, 546 565, 550 562" stroke="#334155" stroke-width="2.5" stroke-linecap="round" fill="none"/>')
    emit('    </g>')
    emit('  </g>\n')
def write_layer_06_to_12():
    emit('  <!-- LAYER 06: BACKGROUND WING AND FAR BAR -->')
    emit('  <g id="layer_06_background_wing_and_far_bar">')
    emit('    <path d="M 742 320 C 725 305, 698 310, 688 322" fill="none" stroke="url(#chrome_luster)" stroke-width="8" stroke-linecap="round" opacity="0.9"/>')
    emit('    <path d="M 688 322 L 670 332" stroke="#9A3412" stroke-width="10" stroke-linecap="round"/>')
    emit('    <circle cx="668" cy="333" r="5" fill="#D97706"/>')
    emit('    <path d="M 570 330 C 605 305, 640 295, 678 308 C 700 315, 715 320, 698 335 C 670 345, 630 348, 585 345 Z" fill="#E2E8F0" stroke="#CBD5E1" stroke-width="1"/>')
    emit('    <path d="M 635 300 C 665 295, 695 305, 712 322 C 695 328, 675 328, 650 322 Z" fill="#334155" stroke="#1E293B" stroke-width="1"/>')
    emit('    <path d="M 648 308 C 678 302, 705 312, 718 326 C 702 332, 682 332, 660 326 Z" fill="#1E293B" stroke="#0F172A" stroke-width="0.8"/>')
    emit('    <path d="M 640 304 Q 675 308 710 322" fill="none" stroke="#F8FAFC" stroke-width="1" opacity="0.7"/>')
    emit('    <path d="M 652 312 Q 682 316 716 326" fill="none" stroke="#F8FAFC" stroke-width="1" opacity="0.7"/>')
    emit('  </g>\n')

    emit('  <!-- LAYER 07: BICYCLE REAR FRAME AND DRIVETRAIN -->')
    emit('  <g id="layer_07_bicycle_rear_frame_and_drivetrain">')
    emit('    <line x1="580" y1="610" x2="350" y2="610" stroke="url(#bike_tube_shade)" stroke-width="11" stroke-linecap="round"/>')
    emit('    <line x1="580" y1="608" x2="350" y2="608" stroke="#FEF08A" stroke-width="1.5" opacity="0.8"/>')
    emit('    <line x1="530" y1="430" x2="350" y2="610" stroke="url(#bike_tube_shade)" stroke-width="10" stroke-linecap="round"/>')
    emit('    <line x1="529" y1="428" x2="351" y2="608" stroke="#FEF08A" stroke-width="1.5" opacity="0.8"/>')
    emit('    <circle cx="350" cy="610" r="18" fill="#64748B" stroke="#334155" stroke-width="1.5"/>')
    emit('    <circle cx="350" cy="610" r="12" fill="#475569"/>')
    emit('    <line x1="580" y1="568" x2="350" y2="592" stroke="#475569" stroke-width="5" stroke-linecap="round"/>')
    emit('    <line x1="580" y1="568" x2="350" y2="592" stroke="#94A3B8" stroke-width="3" stroke-linecap="round" stroke-dasharray="4, 3"/>')
    emit('    <line x1="350" y1="628" x2="580" y2="652" stroke="#475569" stroke-width="5" stroke-linecap="round"/>')
    emit('    <line x1="350" y1="628" x2="580" y2="652" stroke="#94A3B8" stroke-width="3" stroke-linecap="round" stroke-dasharray="4, 3"/>')
    emit('    <rect x="395" y="602" width="24" height="12" rx="2" fill="#334155" stroke="#64748B" stroke-width="1"/>')
    emit('  </g>\n')

    emit('  <!-- LAYER 08: SEATPOST AND SADDLE -->')
    emit('  <g id="layer_08_seatpost_and_saddle">')
    emit('    <line x1="530" y1="430" x2="520" y2="412" stroke="url(#chrome_luster)" stroke-width="10" stroke-linecap="round"/>')
    emit('    <circle cx="530" cy="430" r="7" fill="url(#chrome_luster)" stroke="#475569" stroke-width="1"/>')
    emit('    <g id="saddle_spring_left" transform="translate(495, 412)">')
    for turn in range(4):
        emit(f'      <ellipse cx="0" cy="{turn * 4.5}" rx="7" ry="3" fill="none" stroke="url(#chrome_luster)" stroke-width="2.5"/>')
    emit('    </g>')
    emit('    <g id="saddle_spring_right" transform="translate(515, 413)">')
    for turn in range(4):
        emit(f'      <ellipse cx="0" cy="{turn * 4.5}" rx="7" ry="3" fill="none" stroke="url(#chrome_luster)" stroke-width="2.5"/>')
    emit('    </g>')
    emit('    <path d="M 490 416 L 520 414 L 545 414" fill="none" stroke="url(#chrome_luster)" stroke-width="3" stroke-linecap="round"/>')
    emit('    <path d="M 485 410 C 490 398, 550 398, 568 412 C 555 423, 498 424, 485 410 Z" fill="url(#leather_saddle_grad)" stroke="#78350F" stroke-width="1.5"/>')
    emit('    <path d="M 488 410 C 493 400, 548 400, 564 412 C 552 421, 500 422, 488 410" fill="none" stroke="#FEF08A" stroke-width="0.9" stroke-dasharray="3, 2" opacity="0.7"/>')
    rivets = [(492, 409), (504, 404), (518, 402), (532, 404)]
    for rx, ry in rivets:
        emit(f'    <circle cx="{rx}" cy="{ry}" r="2.5" fill="#FBBF24" stroke="#78350F" stroke-width="0.6"/>')
        emit(f'    <circle cx="{rx-0.6}" cy="{ry-0.6}" r="0.8" fill="#FFFFFF"/>')
    emit('  </g>\n')

    emit('  <!-- LAYER 09: PELICAN TORSO AND TAIL -->')
    emit('  <g id="layer_09_pelican_torso_and_tail">')
    emit('    <path d="M 460 395 C 430 380, 410 405, 435 418 Z" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1"/>')
    emit('    <path d="M 435 418 C 420 410, 410 404, 425 392 Z" fill="#1E293B" opacity="0.9"/>')
    emit('    <path d="M 460 402 C 425 398, 405 425, 438 432 Z" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1"/>')
    emit('    <path d="M 438 432 C 418 424, 408 416, 422 408 Z" fill="#1E293B" opacity="0.9"/>')
    emit('    <path d="M 460 412 C 435 420, 415 445, 448 444 Z" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1"/>')
    emit('    <path d="M 448 444 C 430 440, 418 434, 430 426 Z" fill="#334155" opacity="0.85"/>')
    emit('    <path d="M 460 395 C 475 350, 520 325, 595 335 C 635 342, 645 385, 620 425 C 590 450, 520 445, 480 430 Z" fill="url(#pelican_body_shading)" stroke="#CBD5E1" stroke-width="1.5"/>')
    emit('    <path d="M 495 422 C 515 432, 545 428, 565 416 C 555 426, 520 436, 495 422 Z" fill="#CBD5E1" opacity="0.6"/>')
    emit('    <path d="M 575 355 C 585 365, 605 365, 615 355" stroke="#E2E8F0" stroke-width="1.5" fill="none" stroke-linecap="round"/>')
    emit('    <path d="M 565 375 C 580 388, 605 385, 615 375" stroke="#E2E8F0" stroke-width="1.5" fill="none" stroke-linecap="round"/>')
    emit('    <path d="M 550 395 C 565 408, 590 405, 602 395" stroke="#CBD5E1" stroke-width="1.5" fill="none" stroke-linecap="round"/>')
    emit('  </g>\n')

    emit('  <!-- LAYER 10: PELICAN NECK AND HEAD -->')
    emit('  <g id="layer_10_pelican_neck_and_head">')
    emit('    <path d="M 595 335 C 625 295, 650 245, 640 190 L 658 200 C 680 270, 660 325, 625 360 Z" fill="url(#pelican_body_shading)" stroke="#E2E8F0" stroke-width="1"/>')
    emit('    <circle cx="645" cy="175" r="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1"/>')
    emit('    <path d="M 632 165 C 605 152, 595 168, 620 174 Z" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1"/>')
    emit('    <path d="M 630 172 C 600 168, 592 188, 622 184 Z" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1"/>')
    emit('    <path d="M 635 180 C 608 182, 602 200, 628 194 Z" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1"/>')
    emit('    <path d="M 654 172 C 654 161, 676 161, 683 170 C 681 179, 666 183, 654 172 Z" fill="#FEF08A" stroke="#FBBF24" stroke-width="1"/>')
    emit('    <circle cx="665" cy="172" r="8" fill="#FFFBEB" stroke="#D97706" stroke-width="0.8"/>')
    emit('    <circle cx="666" cy="172" r="5.5" fill="#D97706"/>')
    emit('    <circle cx="667" cy="172" r="3.5" fill="#0F172A"/>')
    emit('    <circle cx="666" cy="170" r="1.5" fill="#FFFFFF"/>')
    emit('    <circle cx="668" cy="173" r="0.8" fill="#FFFFFF"/>')
    emit('    <path d="M 656 165 C 665 161, 674 163, 679 167" stroke="#475569" stroke-width="2" stroke-linecap="round" fill="none"/>')
    emit('  </g>\n')

    emit('  <!-- LAYER 11: PELICAN BILL AND GULAR POUCH -->')
    emit('  <g id="layer_11_pelican_bill_and_gular_pouch">')
    emit('    <path d="M 678 198 C 665 242, 685 305, 745 292 C 802 280, 832 238, 836 227 Z" fill="url(#pelican_pouch_grad)" opacity="0.88" stroke="#F43F5E" stroke-width="1.2"/>')
    emit('    <path d="M 690 220 C 700 250, 720 280, 745 292" stroke="#E11D48" stroke-width="1.8" opacity="0.45" fill="none" stroke-linecap="round"/>')
    emit('    <path d="M 715 210 C 730 240, 755 270, 780 278" stroke="#E11D48" stroke-width="1.8" opacity="0.45" fill="none" stroke-linecap="round"/>')
    emit('    <path d="M 745 205 C 765 230, 790 252, 810 255" stroke="#E11D48" stroke-width="1.8" opacity="0.45" fill="none" stroke-linecap="round"/>')
    
    emit('    <g id="barnaby_the_sardine" transform="translate(752, 248)">')
    emit('      <path d="M -8 10 C -4 -4, 10 -6, 16 2 C 12 12, -2 16, -8 10 Z" fill="#38BDF8" stroke="#0284C7" stroke-width="1"/>')
    emit('      <path d="M -4 8 C 2 3, 10 3, 14 6 C 10 10, 0 12, -4 8 Z" fill="#BAE6FD" opacity="0.8"/>')
    emit('      <path d="M 12 -2 C 20 -8, 23 0, 16 4 Z" fill="#7DD3FC"/>')
    emit('      <circle cx="6" cy="-1" r="2.5" fill="#FFFFFF" stroke="#0284C7" stroke-width="0.5"/>')
    emit('      <circle cx="6.5" cy="-1" r="1.5" fill="#0F172A"/>')
    emit('      <circle cx="6" cy="-1.6" r="0.6" fill="#FFFFFF"/>')
    emit('      <ellipse cx="6" cy="-1" rx="3.8" ry="3.2" fill="none" stroke="#A3E635" stroke-width="1.2"/>')
    emit('      <path d="M 2.2 -1 L -3 0" stroke="#A3E635" stroke-width="1" stroke-linecap="round"/>')
    emit('      <path d="M 4.5 -2.5 L 7.5 0.5" stroke="#FFFFFF" stroke-width="0.8" opacity="0.8"/>')
    emit('      <path d="M 0 5 C 4 7, 8 6, 10 3" fill="none" stroke="#0F172A" stroke-width="0.9" stroke-linecap="round"/>')
    emit('    </g>')

    emit('    <path d="M 675 178 C 730 184, 790 196, 838 212 C 846 216, 844 225, 836 227 C 785 218, 725 204, 678 198 Z" fill="url(#bill_culmen_grad)" stroke="#D97706" stroke-width="1"/>')
    emit('    <path d="M 678 180 C 732 186, 790 198, 836 214" fill="none" stroke="#FEF08A" stroke-width="2.2" stroke-linecap="round" opacity="0.9"/>')
    emit('    <path d="M 838 212 C 846 215, 848 224, 842 227 C 838 226, 836 222, 838 212 Z" fill="#EA580C" stroke="#9A3412" stroke-width="1"/>')
    emit('  </g>\n')

    emit('  <!-- LAYER 12: PELICAN ACCESSORIES -->')
    emit('  <g id="layer_12_pelican_accessories">')
    emit('    <g id="cycling_cap" transform="rotate(-8 640 156)">')
    emit('      <path d="M 618 165 C 620 142, 655 138, 668 152 C 672 158, 668 168, 658 172 C 642 170, 626 170, 618 165 Z" fill="#1E3A8A" stroke="#172554" stroke-width="1.2"/>')
    emit('      <path d="M 632 142 C 638 140, 646 140, 652 143 L 648 171 L 638 171 Z" fill="#EF4444" stroke="#FFFFFF" stroke-width="0.8"/>')
    emit('      <path d="M 658 162 C 670 150, 688 152, 692 165 C 682 168, 668 170, 658 162 Z" fill="#172554" stroke="#0F172A" stroke-width="1"/>')
    emit('      <path d="M 662 164 C 672 154, 684 156, 688 165 Z" fill="#F8FAFC"/>')
    emit('      <path d="M 670 162 L 675 158 L 680 162" fill="none" stroke="#EF4444" stroke-width="1.2" stroke-linecap="round"/>')
    emit('      <circle cx="644" cy="140" r="2.8" fill="#FEF08A" stroke="#D97706" stroke-width="0.6"/>')
    emit('    </g>')
    emit('    <g id="flying_scarf">')
    emit('      <path d="M 630 250 C 642 245, 656 248, 662 258 C 654 266, 638 264, 630 250 Z" fill="#BE123C"/>')
    emit('      <circle cx="642" cy="255" r="8" fill="#E11D48" stroke="#9F1239" stroke-width="1"/>')
    emit('      <circle cx="640" cy="253" r="3" fill="#F43F5E"/>')
    emit('      <path d="M 642 255 C 590 238, 510 248, 430 230 C 495 258, 570 268, 642 265 Z" fill="url(#scarf_grad)" stroke="#9F1239" stroke-width="1"/>')
    emit('      <path d="M 638 262 C 585 272, 525 300, 460 292 C 520 308, 585 288, 638 272 Z" fill="url(#scarf_grad)" stroke="#9F1239" stroke-width="1"/>')
    dots_primary = [(608, 248), (568, 252), (528, 251), (488, 247), (452, 238)]
    for dx, dy in dots_primary:
        emit(f'      <circle cx="{dx}" cy="{dy}" r="3.5" fill="#FFFFFF" opacity="0.95"/>')
    dots_secondary = [(600, 273), (560, 285), (520, 296), (485, 298)]
    for dx, dy in dots_secondary:
        emit(f'      <circle cx="{dx}" cy="{dy}" r="3.5" fill="#FFFFFF" opacity="0.95"/>')
    emit('    </g>')
    emit('  </g>\n')
def write_layer_13_to_18():
    emit('  <!-- LAYER 13: BICYCLE MAIN FRAME AND CHAINRING -->')
    emit('  <g id="layer_13_bicycle_main_frame_and_chainring">')
    emit('    <line x1="580" y1="610" x2="530" y2="430" stroke="url(#bike_tube_shade)" stroke-width="14" stroke-linecap="round"/>')
    emit('    <line x1="578" y1="610" x2="528" y2="430" stroke="#FEF08A" stroke-width="1.8" opacity="0.85"/>')
    emit('    <path d="M 790 440 C 730 520, 650 590, 580 610" fill="none" stroke="url(#bike_tube_shade)" stroke-width="16" stroke-linecap="round"/>')
    emit('    <path d="M 790 438 C 730 518, 650 588, 580 608" fill="none" stroke="#FEF08A" stroke-width="2" opacity="0.85"/>')
    emit('    <path d="M 770 380 Q 640 405, 530 430" fill="none" stroke="url(#bike_tube_shade)" stroke-width="13" stroke-linecap="round"/>')
    emit('    <path d="M 770 378 Q 640 403, 530 428" fill="none" stroke="#FEF08A" stroke-width="1.8" opacity="0.85"/>')
    emit('    <path d="M 776 405 Q 650 430, 538 455" fill="none" stroke="url(#bike_tube_shade)" stroke-width="11" stroke-linecap="round"/>')
    emit('    <path d="M 776 403 Q 650 428, 538 453" fill="none" stroke="#FEF08A" stroke-width="1.5" opacity="0.85"/>')
    emit('    <line x1="770" y1="365" x2="790" y2="440" stroke="url(#bike_tube_shade)" stroke-width="20" stroke-linecap="round"/>')
    emit('    <rect x="759" y="360" width="22" height="6" rx="2" fill="url(#chrome_luster)" stroke="#475569" stroke-width="0.8" transform="rotate(15 770 365)"/>')
    emit('    <rect x="779" y="437" width="22" height="6" rx="2" fill="url(#chrome_luster)" stroke="#475569" stroke-width="0.8" transform="rotate(15 790 440)"/>')
    emit('    <polygon points="774,395 784,398 782,415 772,412" fill="#FBBF24" stroke="#B45309" stroke-width="0.8"/>')
    emit('    <circle cx="580" cy="610" r="18" fill="#0F766E" stroke="url(#chrome_luster)" stroke-width="3"/>')
    emit('    <circle cx="580" cy="610" r="42" fill="none" stroke="#CBD5E1" stroke-width="3" stroke-dasharray="3, 2.5"/>')
    chainring_star = make_star_path(580, 610, 38, 16, points=5)
    emit(f'    <path d="{chainring_star}" fill="url(#chrome_luster)" stroke="#64748B" stroke-width="1.2"/>')
    for p in range(5):
        h_ang = -math.pi / 2 + p * (2 * math.pi / 5)
        hx = 580 + 26 * math.cos(h_ang)
        hy = 610 + 26 * math.sin(h_ang)
        emit(f'    <circle cx="{hx:.2f}" cy="{hy:.2f}" r="4.5" fill="#1E293B" stroke="#64748B" stroke-width="1"/>')
    emit('    <circle cx="580" cy="610" r="12" fill="url(#chrome_luster)" stroke="#475569" stroke-width="1"/>')
    emit('    <circle cx="580" cy="610" r="6" fill="#1E293B"/>')
    emit('    <path d="M 540 584 C 632 584, 632 636, 540 636 L 415 620 L 415 598 Z" fill="url(#bike_frame_teal)" stroke="#0F766E" stroke-width="1.5"/>')
    emit('    <path d="M 536 592 C 615 592, 615 628, 536 628 L 420 615 L 420 603 Z" fill="none" stroke="#FEF08A" stroke-width="1.8" opacity="0.9"/>')
    emit('    <line x1="430" y1="609" x2="550" y2="609" stroke="#FFFFFF" stroke-width="1.5" opacity="0.8"/>')
    emit('  </g>\n')

    emit('  <!-- LAYER 14: FRONT FORK AND WHEEL -->')
    emit('  <g id="layer_14_front_fork_and_wheel">')
    emit('    <rect x="780" y="440" width="20" height="8" rx="3" fill="url(#chrome_luster)" stroke="#475569" stroke-width="1" transform="rotate(12 790 444)"/>')
    emit('    <path d="M 790 440 C 802 490, 822 555, 850 610" fill="none" stroke="url(#bike_tube_shade)" stroke-width="12" stroke-linecap="round"/>')
    emit('    <path d="M 792 440 C 804 490, 824 555, 852 610" fill="none" stroke="#FEF08A" stroke-width="1.8" stroke-linecap="round" opacity="0.85"/>')
    emit('    <circle cx="850" cy="610" r="8" fill="url(#chrome_luster)" stroke="#334155" stroke-width="1"/>')
    emit('    <circle cx="850" cy="610" r="130" fill="#1E293B" stroke="#0F172A" stroke-width="1"/>')
    emit('    <circle cx="850" cy="610" r="126" fill="none" stroke="#334155" stroke-width="3" stroke-dasharray="3, 5"/>')
    emit('    <circle cx="850" cy="610" r="116" fill="#F8FAFC"/>')
    emit('    <circle cx="850" cy="610" r="115" fill="none" stroke="#E2E8F0" stroke-width="1"/>')
    emit('    <circle cx="850" cy="610" r="102" fill="#475569"/>')
    emit('    <circle cx="850" cy="610" r="96" fill="#14B8A6" opacity="0.05"/>')
    emit('    <circle cx="850" cy="610" r="100" fill="none" stroke="url(#chrome_luster)" stroke-width="3"/>')
    emit('    <circle cx="850" cy="610" r="97" fill="none" stroke="#1E293B" stroke-width="1"/>')
    for i in range(24):
        theta = i * 15
        offset = 7.5 if i % 2 == 0 else -7.5
        hx, hy = polar_to_cart(850, 610, 16, theta)
        rx, ry = polar_to_cart(850, 610, 101, theta + offset)
        stroke_c = "#FFFFFF" if i % 4 == 0 else "#E2E8F0"
        emit(f'    <line x1="{hx:.2f}" y1="{hy:.2f}" x2="{rx:.2f}" y2="{ry:.2f}" stroke="{stroke_c}" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>')
    emit('    <circle cx="850" cy="610" r="16" fill="url(#chrome_luster)" stroke="#334155" stroke-width="1.5"/>')
    emit('    <circle cx="850" cy="610" r="8" fill="#F1F5F9" stroke="#64748B" stroke-width="1"/>')
    emit('    <circle cx="850" cy="610" r="4" fill="#0F172A"/>')
    fender_front_path = describe_fender_band(850, 610, 135, 149, 30, 170)
    emit(f'    <path d="{fender_front_path}" fill="url(#bike_frame_teal)" stroke="#0F766E" stroke-width="1"/>')
    pinstripe_front = describe_arc(850, 610, 142, 34, 166)
    emit(f'    <path d="{pinstripe_front}" fill="none" stroke="#FEF08A" stroke-width="2" stroke-linecap="round"/>')
    xf_lip, yf_lip = polar_to_cart(850, 610, 142, 30)
    emit(f'    <circle cx="{xf_lip:.2f}" cy="{yf_lip:.2f}" r="7" fill="url(#bike_frame_teal)" stroke="#0F766E" stroke-width="1"/>')
    emit('    <line x1="850" y1="610" x2="950" y2="675" stroke="url(#chrome_luster)" stroke-width="3" stroke-linecap="round"/>')
    emit('    <circle cx="950" cy="675" r="4.5" fill="#F8FAFC" stroke="#475569" stroke-width="1"/>')
    emit('  </g>\n')

    emit('  <!-- LAYER 15: STEERING CONTROLS AND BELL -->')
    emit('  <g id="layer_15_steering_controls_and_bell">')
    emit('    <line x1="770" y1="365" x2="760" y2="325" stroke="url(#chrome_luster)" stroke-width="12" stroke-linecap="round"/>')
    emit('    <line x1="760" y1="325" x2="742" y2="320" stroke="url(#chrome_luster)" stroke-width="12" stroke-linecap="round"/>')
    emit('    <circle cx="742" cy="320" r="7" fill="url(#chrome_luster)" stroke="#475569" stroke-width="1"/>')
    emit('    <circle cx="758" cy="323" r="3" fill="#1E293B"/>')
    emit('    <path d="M 742 320 C 715 305, 680 325, 672 355" fill="none" stroke="url(#chrome_luster)" stroke-width="9" stroke-linecap="round"/>')
    emit('    <path d="M 672 355 L 658 395" stroke="#B45309" stroke-width="11" stroke-linecap="round"/>')
    emit('    <path d="M 670 362 L 664 366 M 667 372 L 661 376 M 664 382 L 658 386" stroke="#FEF08A" stroke-width="1.2" stroke-linecap="round"/>')
    emit('    <circle cx="657" cy="397" r="5.5" fill="#F59E0B" stroke="#78350F" stroke-width="1"/>')
    emit('    <circle cx="728" cy="308" r="14" fill="url(#brass_bell_grad)" stroke="#78350F" stroke-width="1"/>')
    emit('    <ellipse cx="724" cy="304" rx="7" ry="4" fill="#FFFFFF" opacity="0.55"/>')
    emit('    <path d="M 720 310 L 712 314" stroke="#78350F" stroke-width="3" stroke-linecap="round"/>')
    emit('    <circle cx="711" cy="314" r="2.5" fill="#FBBF24"/>')
    emit('    <path d="M 718 290 A 20 20 0 0 0 710 305" fill="none" stroke="#F59E0B" stroke-width="2.2" stroke-linecap="round"/>')
    emit('    <path d="M 710 280 A 30 30 0 0 0 698 300" fill="none" stroke="#F59E0B" stroke-width="2.2" stroke-linecap="round"/>')
    emit('    <path d="M 700 274 L 702 270 L 704 274 L 708 276 L 704 278 L 702 282 L 700 278 L 696 276 Z" fill="#FEF08A"/>')
    emit('    <path d="M 735 324 C 750 350, 775 390, 792 450" fill="none" stroke="#334155" stroke-width="3" stroke-linecap="round"/>')
    emit('    <path d="M 735 324 C 700 370, 620 420, 520 435" fill="none" stroke="#334155" stroke-width="3" stroke-linecap="round"/>')
    emit('    <path d="M 678 348 C 670 352, 658 350, 650 344" fill="none" stroke="url(#chrome_luster)" stroke-width="3" stroke-linecap="round"/>')
    emit('  </g>\n')

    emit('  <!-- LAYER 16: FOREGROUND LEG AND CRANK -->')
    emit('  <g id="layer_16_foreground_leg_and_crank">')
    emit('    <line x1="580" y1="610" x2="625" y2="660" stroke="url(#chrome_luster)" stroke-width="11" stroke-linecap="round"/>')
    emit('    <line x1="580" y1="608" x2="625" y2="658" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity="0.9"/>')
    emit('    <circle cx="625" cy="660" r="6" fill="#64748B"/>')
    emit('    <rect x="610" y="652" width="34" height="16" rx="4" fill="#334155" stroke="#1E293B" stroke-width="1.5"/>')
    emit('    <line x1="614" y1="656" x2="640" y2="656" stroke="#64748B" stroke-width="1.5"/>')
    emit('    <line x1="614" y1="664" x2="640" y2="664" stroke="#64748B" stroke-width="1.5"/>')
    emit('    <rect x="615" y="656" width="8" height="8" rx="1" fill="#F97316" stroke="#C2410C" stroke-width="0.8"/>')
    emit('    <path d="M 555 425 C 540 450, 550 480, 570 495 C 585 490, 595 470, 590 445 C 585 430, 570 422, 555 425 Z" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.2"/>')
    emit('    <path d="M 560 475 C 570 485, 582 485, 588 475" stroke="#E2E8F0" stroke-width="1.5" fill="none"/>')
    emit('    <path d="M 580 535 L 625 660" stroke="url(#tarsus_gradient)" stroke-width="14" stroke-linecap="round"/>')
    emit('    <path d="M 581 538 L 624 656" stroke="#FEF08A" stroke-width="2.5" stroke-linecap="round" opacity="0.9"/>')
    for sc in range(5):
        sy = 555 + sc * 20
        sx = 588 + sc * 7.5
        emit(f'    <line x1="{sx-4}" y1="{sy}" x2="{sx+4}" y2="{sy}" stroke="#C2410C" stroke-width="1.2" stroke-linecap="round"/>')
    emit('    <g id="pelican_right_webbed_foot">')
    emit('      <path d="M 622 654 L 595 658 Q 602 668 610 676 Q 624 680 638 682 Q 652 678 662 670 L 628 654 Z" fill="#FB923C" stroke="#EA580C" stroke-width="1"/>')
    emit('      <path d="M 622 658 Q 612 668 604 666" stroke="#C2410C" stroke-width="1.2" fill="none" opacity="0.7"/>')
    emit('      <path d="M 624 660 Q 625 672 622 678" stroke="#C2410C" stroke-width="1.2" fill="none" opacity="0.7"/>')
    emit('      <path d="M 626 658 Q 642 670 650 672" stroke="#C2410C" stroke-width="1.2" fill="none" opacity="0.7"/>')
    emit('      <line x1="620" y1="656" x2="595" y2="658" stroke="#F97316" stroke-width="4" stroke-linecap="round"/>')
    emit('      <path d="M 595 658 C 590 660, 592 664, 597 662" stroke="#475569" stroke-width="2.5" stroke-linecap="round" fill="none"/>')
    emit('      <line x1="622" y1="658" x2="610" y2="676" stroke="#F97316" stroke-width="4.5" stroke-linecap="round"/>')
    emit('      <path d="M 610 676 C 606 680, 609 684, 614 680" stroke="#475569" stroke-width="2.5" stroke-linecap="round" fill="none"/>')
    emit('      <line x1="625" y1="660" x2="638" y2="682" stroke="#F97316" stroke-width="4.5" stroke-linecap="round"/>')
    emit('      <path d="M 638 682 C 636 688, 642 688, 643 682" stroke="#475569" stroke-width="2.5" stroke-linecap="round" fill="none"/>')
    emit('      <line x1="626" y1="658" x2="662" y2="670" stroke="#F97316" stroke-width="4" stroke-linecap="round"/>')
    emit('      <path d="M 662 670 C 666 672, 668 668, 664 666" stroke="#475569" stroke-width="2.5" stroke-linecap="round" fill="none"/>')
    emit('    </g>')
    emit('  </g>\n')

    emit('  <!-- LAYER 17: FOREGROUND WING -->')
    emit('  <g id="layer_17_foreground_wing">')
    emit('    <path d="M 565 350 C 585 330, 620 338, 645 355 C 640 375, 610 385, 580 375 Z" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1"/>')
    emit('    <path d="M 580 375 C 605 388, 635 385, 658 362 C 655 380, 630 395, 600 392 Z" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1"/>')
    emit('    <path d="M 575 358 C 585 366, 600 366, 610 358" stroke="#E2E8F0" stroke-width="1.5" fill="none"/>')
    emit('    <path d="M 590 370 C 602 378, 618 378, 628 370" stroke="#E2E8F0" stroke-width="1.5" fill="none"/>')
    emit('    <path d="M 610 385 C 635 400, 660 395, 678 375 C 665 370, 645 372, 625 380 Z" fill="#334155" stroke="#1E293B" stroke-width="1"/>')
    emit('    <path d="M 622 390 C 645 408, 670 400, 685 380 C 672 376, 655 378, 635 386 Z" fill="#1E293B" stroke="#0F172A" stroke-width="1"/>')
    emit('    <path d="M 630 395 C 655 412, 678 405, 692 385 C 680 382, 662 384, 642 392 Z" fill="#0F172A" stroke="#020617" stroke-width="1"/>')
    emit('    <path d="M 618 386 Q 650 392 682 378" fill="none" stroke="#F8FAFC" stroke-width="1.2" opacity="0.8"/>')
    emit('    <path d="M 628 392 Q 658 398 688 383" fill="none" stroke="#F8FAFC" stroke-width="1.2" opacity="0.8"/>')
    emit('    <path d="M 660 360 C 675 352, 688 360, 680 375 C 670 380, 658 375, 660 360 Z" fill="#334155" stroke="#1E293B" stroke-width="1.2"/>')
    emit('    <path d="M 665 368 C 678 360, 688 368, 682 382 C 672 385, 662 380, 665 368 Z" fill="#1E293B" stroke="#0F172A" stroke-width="1"/>')
    emit('    <path d="M 668 355 C 685 340, 705 325, 718 312 C 710 322, 692 342, 674 362 Z" fill="#0F172A" stroke="#334155" stroke-width="0.8"/>')
    emit('    <path d="M 670 356 Q 696 332 717 313" fill="none" stroke="#F8FAFC" stroke-width="1" opacity="0.9"/>')
    emit('  </g>\n')

    emit('  <!-- LAYER 18: FOREGROUND LIGHTING AND ATMOSPHERE -->')
    emit('  <g id="layer_18_foreground_lighting_and_atmosphere">')
    emit_glint(734, 302, 1.2)
    emit_glint(742, 316, 0.9)
    emit_glint(850, 508, 1.1)
    emit_glint(350, 508, 1.0)
    emit_glint(518, 402, 0.8)
    emit_glint(850, 610, 0.9)
    emit_glint(540, 584, 0.9)
    emit('    <path d="M 560 145 Q 610 142 630 144" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.45"/>')
    emit('    <path d="M 870 215 Q 920 218 970 215" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" fill="none" opacity="0.5"/>')
    emit('    <path d="M 890 230 Q 940 232 990 228" stroke="#FED7AA" stroke-width="1.6" stroke-linecap="round" fill="none" opacity="0.4"/>')
    emit('    <path d="M 380 235 Q 430 230 460 232" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.4"/>')
    emit('    <path d="M 980 590 Q 1030 590 1080 595" stroke="#FFFFFF" stroke-width="2.0" stroke-linecap="round" fill="none" opacity="0.4"/>')
    emit('    <path d="M 950 630 Q 1010 632 1060 638" stroke="#BAE6FD" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.35"/>')
    emit('    <g id="dust_puff" transform="translate(315, 735)">')
    emit('      <path d="M 0 0 C -12 -5, -18 -15, -10 -20 C -2 -24, 6 -16, 2 -8 C -4 -4, -8 -2, 0 0 Z" fill="#FED7AA" opacity="0.65"/>')
    emit('      <path d="M -15 -2 C -24 -8, -28 -18, -20 -24 C -14 -28, -6 -20, -10 -12 Z" fill="#FDE68A" opacity="0.5"/>')
    emit('      <circle cx="-25" cy="-10" r="3.5" fill="#FED7AA" opacity="0.6"/>')
    emit('      <circle cx="-32" cy="-18" r="2.5" fill="#FDE68A" opacity="0.5"/>')
    emit('    </g>')
    emit('    <rect x="0" y="0" width="1200" height="900" fill="url(#vignette_grad)" pointer-events="none"/>')
    emit('  </g>\n')
    emit('</svg>')

def generate_svg():
    write_header_and_defs()
    write_layer_01_to_05()
    write_layer_06_to_12()
    write_layer_13_to_18()
    return '\n'.join(lines)

if __name__ == '__main__':
    svg_content = generate_svg()
    out_path = 'Riding Pelican/shot01/pelican_draft.svg'
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(svg_content)
    print(f'Successfully generated {out_path} ({len(svg_content)} bytes).')
