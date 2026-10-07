"""
Hakka Tulou Village (大型客家土楼村落) - Voxel Scene Generator
Generates a complete, high-fidelity Hakka mountain settlement diorama.
Produces OBJ+MTL, GLB, and VOX formats.
"""

import os
import math
import random
import numpy as np

# Grid dimensions
GRID_X = 160
GRID_Y = 160
GRID_Z = 50

# Seed for reproducible organic variety
np.random.seed(42)
random.seed(42)

# Voxel Material Palette Definition
# ID -> (R, G, B, Name, Category)
PALETTE = {
    0: (0, 0, 0, "Air", "Air"),
    # Terrain & Rocks
    1: (95, 134, 68, "Grass_Light", "Terrain"),
    2: (80, 116, 56, "Grass_Mid", "Terrain"),
    3: (68, 98, 48, "Grass_Dark", "Terrain"),
    4: (120, 114, 104, "Rock_Gray", "Terrain"),
    5: (98, 92, 84, "Rock_Dark", "Terrain"),
    6: (145, 122, 94, "Dirt_Bank", "Terrain"),
    7: (65, 60, 55, "Plinth_Carved_Base", "Terrain"),
    # Water
    10: (84, 142, 156, "Water_Stream", "Water"),
    11: (70, 122, 136, "Water_Pond", "Water"),
    12: (96, 144, 130, "Water_Paddy", "Water"),
    13: (56, 102, 68, "Lotus_Pad", "Water"),
    # Agriculture & Crops
    15: (112, 172, 84, "Rice_Young", "Agriculture"),
    16: (128, 190, 96, "Rice_Lush", "Agriculture"),
    17: (88, 142, 60, "Vegetable_Crop", "Agriculture"),
    18: (148, 120, 80, "Tilled_Soil", "Agriculture"),
    19: (108, 86, 60, "Terrace_Wall", "Agriculture"),
    20: (62, 112, 46, "Tea_Bush", "Agriculture"),
    # Roads & Stone Paving
    25: (166, 162, 156, "Stone_Road_Light", "Road"),
    26: (144, 140, 134, "Stone_Road_Mid", "Road"),
    27: (124, 120, 115, "Stone_Road_Dark", "Road"),
    28: (145, 132, 116, "Dirt_Road", "Road"),
    # Rammed Earth (Tulou 1 - Core Large Round, 振成/承启楼型)
    30: (212, 164, 98, "Earth_Tulou1_Main", "Tulou_Main"),
    31: (195, 148, 88, "Earth_Tulou1_Mid", "Tulou_Main"),
    32: (228, 178, 112, "Earth_Tulou1_Light", "Tulou_Main"),
    33: (178, 132, 78, "Earth_Tulou1_Dark", "Tulou_Main"),
    34: (145, 140, 132, "Earth_Plinth_Stone", "Tulou_Main"),
    # Rammed Earth (Tulou 2 - Medium Round, Weathered/Older, 集庆楼型)
    40: (188, 124, 78, "Earth_Tulou2_Main", "Tulou_Secondary"),
    41: (172, 112, 68, "Earth_Tulou2_Mid", "Tulou_Secondary"),
    42: (204, 138, 90, "Earth_Tulou2_Light", "Tulou_Secondary"),
    43: (156, 100, 60, "Earth_Tulou2_Dark", "Tulou_Secondary"),
    # Rammed Earth (Tulou 3 - Hakka Square Tulou, 方楼, 和贵/奎聚楼型)
    50: (218, 174, 114, "Earth_Tulou3_Main", "Tulou_Small"),
    51: (202, 158, 102, "Earth_Tulou3_Mid", "Tulou_Small"),
    52: (230, 186, 126, "Earth_Tulou3_Light", "Tulou_Small"),
    # Vernacular Houses & Ancestral Hall
    60: (196, 156, 106, "House_Wall_Buff", "Houses"),
    61: (180, 140, 94, "House_Wall_Ochre", "Houses"),
    62: (166, 150, 136, "House_Wall_Gray", "Houses"),
    63: (224, 204, 174, "Hall_Wall_WhiteBuff", "Houses"),
    # Traditional Chinese Roofs (灰瓦坡屋顶)
    70: (52, 56, 62, "Roof_Slate_Main", "Roof"),
    71: (40, 44, 48, "Roof_Slate_Dark", "Roof"),
    72: (68, 72, 78, "Roof_Slate_Light", "Roof"),
    73: (86, 90, 96, "Roof_Ridge", "Roof"),
    74: (74, 86, 70, "Roof_Moss", "Roof"),
    # Timber Structures (Corridors, Posts, Railings, Doors)
    80: (94, 62, 44, "Wood_Beam_Dark", "Wood"),
    81: (116, 80, 58, "Wood_Plank_Floor", "Wood"),
    82: (136, 96, 70, "Wood_Railing", "Wood"),
    83: (74, 46, 32, "Wood_Door_Trim", "Wood"),
    84: (156, 118, 86, "Wood_Light_Fence", "Wood"),
    # Bamboo & Trees & Foliage
    90: (92, 144, 62, "Bamboo_Stalk", "Vegetation"),
    91: (70, 122, 48, "Bamboo_Leaf_Light", "Vegetation"),
    92: (54, 100, 38, "Bamboo_Leaf_Dark", "Vegetation"),
    93: (42, 78, 46, "Pine_Needle", "Vegetation"),
    94: (32, 60, 36, "Pine_Dark", "Vegetation"),
    95: (80, 56, 38, "Tree_Trunk", "Vegetation"),
    96: (100, 156, 70, "Foliage_Bright", "Vegetation"),
    97: (220, 110, 40, "Persimmon_Fruit", "Vegetation"),
    # Life Props & Characters
    100: (195, 155, 68, "Straw_Grain", "Props"),
    101: (110, 74, 48, "Firewood_Stack", "Props"),
    102: (134, 90, 60, "Ceramic_Jar", "Props"),
    103: (164, 159, 154, "Stone_Mill_Well", "Props"),
    104: (40, 60, 98, "Villager_Cloth_Blue", "Characters"),
    105: (224, 184, 144, "Villager_Skin", "Characters"),
    106: (206, 180, 116, "Villager_Hat_Straw", "Characters"),
    107: (190, 44, 38, "Lantern_Red", "Props"),
    108: (100, 95, 90, "Water_Buffalo", "Characters")
}


class VoxelWorld:
    def __init__(self, size_x=GRID_X, size_y=GRID_Y, size_z=GRID_Z):
        self.sx = size_x
        self.sy = size_y
        self.sz = size_z
        self.grid = np.zeros((size_x, size_y, size_z), dtype=np.uint8)
        self.heightfield = np.zeros((size_x, size_y), dtype=np.int32)

    def set_voxel(self, x, y, z, mat_id):
        if 0 <= x < self.sx and 0 <= y < self.sy and 0 <= z < self.sz:
            self.grid[x, y, z] = mat_id

    def get_voxel(self, x, y, z):
        if 0 <= x < self.sx and 0 <= y < self.sy and 0 <= z < self.sz:
            return self.grid[x, y, z]
        return 0


def generate_terrain(world):
    """
    Generates realistic southeastern Chinese mountain terrain:
    - Northern mountain ridge (靠山) rising smoothly from Z=6 to Z=28
    - Northwest forested hill slope (Z=8 to 18)
    - Central valley basin (Z=6 to 8)
    - Southern terraced hillside descending towards Z=3..4
    - Clean cut diorama base
    """
    print("Generating mountain terrain and topography...")
    hfield = np.zeros((GRID_X, GRID_Y), dtype=np.float32)

    for x in range(GRID_X):
        for y in range(GRID_Y):
            h = 6.0

            # Northern mountain ridge (靠山)
            if y > 85:
                ny = (y - 85) / 75.0
                mountain_shape = (
                    0.65 * math.sin(ny * math.pi * 0.5) ** 1.8
                    + 0.25 * math.sin(x * 0.04) ** 2
                    + 0.15 * math.sin((x + y) * 0.03)
                )
                h += mountain_shape * 22.0

            # Northwest foothill (behind Tulou 2)
            if x < 70 and y > 80:
                dist_nw = math.sqrt((x - 10)**2 + (y - 130)**2)
                nw_factor = max(0.0, 1.0 - dist_nw / 80.0)
                h += nw_factor * 8.0

            # Eastern mountain ridge (origin of brook)
            if x > 115 and y > 60:
                nx = (x - 115) / 45.0
                h += (nx ** 1.5) * 14.0

            # Southern slope descending to terraced fields
            if y < 45:
                sy = (45 - y) / 45.0
                h -= sy * 2.8

            h += 0.4 * math.sin(x * 0.2) * math.cos(y * 0.2)
            hfield[x, y] = max(2.0, h)

    # Flatten building platforms for organic settlement terraces
    # Tulou 1 platform
    cx1, cy1, r1 = 78, 86, 21
    for x in range(cx1 - r1, cx1 + r1 + 1):
        for y in range(cy1 - r1, cy1 + r1 + 1):
            if math.sqrt((x - cx1)**2 + (y - cy1)**2) <= r1:
                hfield[x, y] = 7.0

    # Tulou 2 platform (elevated northwest terrace)
    cx2, cy2, r2 = 44, 116, 16
    for x in range(cx2 - r2, cx2 + r2 + 1):
        for y in range(cy2 - r2, cy2 + r2 + 1):
            if math.sqrt((x - cx2)**2 + (y - cy2)**2) <= r2:
                hfield[x, y] = 10.0

    # Tulou 3 platform (eastern flat terrace)
    for x in range(106, 138):
        for y in range(50, 80):
            hfield[x, y] = 6.0

    # Village Plaza & Ancestral Hall platform
    for x in range(64, 94):
        for y in range(40, 72):
            hfield[x, y] = 6.0

    world.heightfield = np.round(hfield).astype(np.int32)

    # Fill voxels in world
    for x in range(GRID_X):
        for y in range(GRID_Y):
            zh = world.heightfield[x, y]
            # Deep bedrock
            for z in range(0, max(1, zh - 2)):
                world.set_voxel(x, y, z, 5 if random.random() < 0.3 else 4)
            # Subsoil
            if zh >= 2:
                world.set_voxel(x, y, zh - 2, 6)
                world.set_voxel(x, y, zh - 1, 6)
            # Surface grass with natural shade variation
            r = random.random()
            grass_mat = 1 if r < 0.6 else (2 if r < 0.9 else 3)
            if zh >= 18 and random.random() < 0.35:
                grass_mat = 4 if random.random() < 0.5 else 5
            world.set_voxel(x, y, zh, grass_mat)

            # Diorama clean cut outer borders
            if x == 0 or x == GRID_X - 1 or y == 0 or y == GRID_Y - 1:
                for z in range(0, zh + 1):
                    world.set_voxel(x, y, z, 7)  # Carved plinth base


def generate_water_and_terraces(world):
    """
    Generates:
    - Mountain brook cascading from northeast peak to south
    - Stepped waterfalls & stepping stones
    - Fengshui Half-Moon Pond (半月塘) with stone balustrade, lotus pads, and washing dock
    - Terraced rice paddies, tea bush plantations, and vegetable patches
    """
    print("Carving water system, terraced paddies, and tea plantations...")

    # 1. Mountain Brook (小溪)
    stream_pts = [
        (150, 150), (142, 138), (135, 122), (128, 108), (120, 94),
        (112, 82), (102, 68), (92, 52), (84, 38), (78, 25)
    ]

    stream_voxels = set()
    for i in range(len(stream_pts) - 1):
        p0, p1 = stream_pts[i], stream_pts[i+1]
        dist = int(math.hypot(p1[0] - p0[0], p1[1] - p0[1]) * 1.5) + 1
        for step in range(dist + 1):
            t = step / dist
            bx = int(p0[0] + (p1[0] - p0[0]) * t)
            by = int(p0[1] + (p1[1] - p0[1]) * t)
            for dx in range(-1, 2):
                for dy in range(-1, 2):
                    if dx*dx + dy*dy <= 2:
                        stream_voxels.add((bx + dx, by + dy))

    for sx, sy in stream_voxels:
        if 0 <= sx < GRID_X and 0 <= sy < GRID_Y:
            zh = world.heightfield[sx, sy]
            world.set_voxel(sx, sy, zh, 10)  # Water_Stream
            world.set_voxel(sx, sy, zh - 1, 5)  # Rock bed
            for ndx, ndy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nx, ny = sx + ndx, sy + ndy
                if (nx, ny) not in stream_voxels and 0 <= nx < GRID_X and 0 <= ny < GRID_Y:
                    if random.random() < 0.4:
                        world.set_voxel(nx, ny, world.heightfield[nx, ny], 4)

    # Stepping stones across shallow brook section
    for step_y in [66, 67]:
        world.set_voxel(101, step_y, world.heightfield[101, step_y], 26)

    # Stone footbridge across stream (at secondary road crossing)
    bridge_x, bridge_y = 115, 90
    bridge_z = world.heightfield[bridge_x, bridge_y] + 1
    for bx in range(bridge_x - 1, bridge_x + 2):
        for by in range(bridge_y - 2, bridge_y + 3):
            world.set_voxel(bx, by, bridge_z, 26)  # Stone bridge deck
    for by in range(bridge_y - 2, bridge_y + 3):
        world.set_voxel(bridge_x - 1, by, bridge_z + 1, 27)
        world.set_voxel(bridge_x + 1, by, bridge_z + 1, 27)

    # 2. Fengshui Half-Moon Pond (半月塘)
    pond_cx, pond_cy, pond_r = 78, 26, 10
    pond_z = 5
    for x in range(pond_cx - pond_r - 2, pond_cx + pond_r + 3):
        for y in range(pond_cy - pond_r - 2, pond_cy + 2):
            d = math.hypot(x - pond_cx, y - pond_cy)
            if y <= pond_cy + 1:
                if d <= pond_r:
                    for z in range(pond_z, pond_z + 5):
                        world.set_voxel(x, y, z, 0)
                    # Water with floating lotus pads
                    mat_water = 13 if (random.random() < 0.12 and d > 3) else 11
                    world.set_voxel(x, y, pond_z, mat_water)
                    world.set_voxel(x, y, pond_z - 1, 4)
                elif d <= pond_r + 1.2:
                    # Carved stone coping rim
                    world.set_voxel(x, y, pond_z + 1, 25)

    # Stone washing dock steps (埠头) leading into pond
    for wx in range(pond_cx - 2, pond_cx + 3):
        world.set_voxel(wx, pond_cy + 1, pond_z, 26)
        world.set_voxel(wx, pond_cy, pond_z, 25)

    # 3. Terraced Fields (山地梯田与茶园)
    # Tiered terraces in southwest: (X: 12..58, Y: 10..42)
    terrace_tiers = [
        (10, 17, 3, "paddy"),
        (18, 25, 4, "paddy"),
        (26, 33, 5, "tea"),
        (34, 42, 6, "vegetable"),
    ]

    for y0, y1, tz, field_type in terrace_tiers:
        for x in range(12, 58):
            for y in range(y0, y1 + 1):
                for z in range(tz + 1, tz + 6):
                    world.set_voxel(x, y, z, 0)
                world.set_voxel(x, y, tz - 1, 18)

                if field_type == "paddy":
                    world.set_voxel(x, y, tz, 12)  # Water_Paddy
                    if (x + y) % 2 == 0 and random.random() < 0.8:
                        world.set_voxel(x, y, tz + 1, 15 if random.random() < 0.6 else 16)
                elif field_type == "tea":
                    world.set_voxel(x, y, tz, 1)  # Grass under tea
                    # Contour rows of rounded tea bushes
                    if x % 3 == 0 and y % 2 == 0:
                        world.set_voxel(x, y, tz + 1, 20)  # Tea_Bush
                        world.set_voxel(x + 1, y, tz + 1, 20)
                else:
                    world.set_voxel(x, y, tz, 18)  # Tilled soil
                    if x % 2 == 0:
                        world.set_voxel(x, y, tz + 1, 17)  # Vegetable crop

            # Terrace retaining wall
            for x in range(12, 58):
                world.set_voxel(x, y0, tz, 19)
                world.set_voxel(x, y0, tz - 1, 19)

    # Low wooden fences around vegetable gardens
    for x in range(12, 58, 2):
        world.set_voxel(x, 43, 7, 84)


def generate_roads_and_plaza(world):
    """
    Generates:
    - Village Entrance Gatehouse (村口门楼/牌坊) at (32, 16)
    - Main road (宽3~4) connecting gate -> plaza -> Tulou 1
    - Secondary roads connecting Tulou 2, Tulou 3, Ancestral Hall
    - Village Plaza (村落广场) with flagstone paving
    """
    print("Laying out road circulation system and village plaza...")

    def stamp_road(pts, width=3, mat_light=25, mat_mid=26):
        for i in range(len(pts) - 1):
            p0, p1 = pts[i], pts[i+1]
            dist = int(math.hypot(p1[0] - p0[0], p1[1] - p0[1]) * 1.5) + 1
            for step in range(dist + 1):
                t = step / dist
                rx = int(p0[0] + (p1[0] - p0[0]) * t)
                ry = int(p0[1] + (p1[1] - p0[1]) * t)
                half_w = width // 2
                for dx in range(-half_w, half_w + 1):
                    for dy in range(-half_w, half_w + 1):
                        px, py = rx + dx, ry + dy
                        if 0 <= px < GRID_X and 0 <= py < GRID_Y:
                            pz = world.heightfield[px, py]
                            m = mat_light if random.random() < 0.6 else mat_mid
                            world.set_voxel(px, py, pz, m)

    # 1. Main Road: Village Gate (32, 16) -> Plaza (78, 60) -> Tulou 1 (78, 70)
    main_road_pts = [
        (30, 10), (32, 16), (38, 24), (46, 34), (56, 44),
        (68, 54), (78, 60), (78, 70)
    ]
    stamp_road(main_road_pts, width=3)

    # 2. Secondary Road: Plaza (78, 60) -> Tulou 2 (44, 104)
    road_tulou2_pts = [
        (72, 60), (62, 70), (52, 82), (46, 94), (44, 104)
    ]
    stamp_road(road_tulou2_pts, width=2)

    # 3. Secondary Road: Plaza (78, 60) -> Stone Bridge (115, 90) -> Tulou 3 (122, 52)
    road_tulou3_pts = [
        (84, 60), (96, 68), (108, 80), (115, 90), (124, 82), (122, 68), (122, 52)
    ]
    stamp_road(road_tulou3_pts, width=2)

    # 4. Village Plaza (村落广场) - centered at (78, 62)
    for x in range(68, 89):
        for y in range(54, 70):
            pz = world.heightfield[x, y]
            r = random.random()
            m = 25 if r < 0.65 else (26 if r < 0.9 else 27)
            world.set_voxel(x, y, pz, m)

    # 5. Village Entrance Gatehouse (村口牌坊/门楼) at (32, 16)
    gx, gy, gz = 32, 16, world.heightfield[32, 16]
    for dx in [-2, 2]:
        world.set_voxel(gx + dx, gy, gz, 27)
        for z in range(gz + 1, gz + 5):
            world.set_voxel(gx + dx, gy, z, 80)
    for x in range(gx - 3, gx + 4):
        world.set_voxel(x, gy, gz + 4, 80)
        world.set_voxel(x, gy, gz + 5, 83)
    for x in range(gx - 4, gx + 5):
        world.set_voxel(x, gy - 1, gz + 5, 70)
        world.set_voxel(x, gy, gz + 6, 73)
        world.set_voxel(x, gy + 1, gz + 5, 70)
    world.set_voxel(gx - 2, gy - 1, gz + 3, 107)
    world.set_voxel(gx + 2, gy - 1, gz + 3, 107)

    # Village Boundary Stele (村界石碑)
    world.set_voxel(gx - 4, gy + 2, gz, 27)
    world.set_voxel(gx - 4, gy + 2, gz + 1, 26)
    world.set_voxel(gx - 4, gy + 2, gz + 2, 25)


def build_tulou_1_main(world):
    """
    Core Large Circular Tulou (核心大型圆楼 - 承启楼/振成楼型):
    - Center: (78, 86)
    - Outer diameter: 34 (Radius 17)
    - Inner courtyard diameter: 14 (Radius 7)
    - Height: 15 voxels (Base Z=7 to Z=22)
    - 4 floors structure:
      * Base stone plinth (Z=7..8)
      * Massive rammed earth outer wall (Z=9..18)
      * Windows with timber frames on floors 3 & 4
      * Grand South entrance portal facing village plaza
      * 3 tiers of internal annular wooden corridors with balustrades & pillars
      * Central open courtyard with cobblestones, ancestral pavilion (祖堂), and well
      * Stepped concentric Chinese tile roof extending beyond outer wall
    """
    print("Constructing Tulou #1: Core Large Circular Tulou (承启/振成楼型)...")
    cx, cy, base_z = 78, 86, 7
    r_out = 17.0
    r_in = 7.0
    wall_height = 12

    # 1. Base Stone Plinth (2 voxels)
    for x in range(int(cx - r_out - 1), int(cx + r_out + 2)):
        for y in range(int(cy - r_out - 1), int(cy + r_out + 2)):
            dist = math.hypot(x - cx, y - cy)
            if r_in - 0.5 <= dist <= r_out + 0.5:
                for z in range(base_z, base_z + 2):
                    world.set_voxel(x, y, z, 34)

    # 2. Rammed Earth Outer Wall
    for x in range(int(cx - r_out - 1), int(cx + r_out + 2)):
        for y in range(int(cy - r_out - 1), int(cy + r_out + 2)):
            dist = math.hypot(x - cx, y - cy)
            if r_out - 3.0 <= dist <= r_out + 0.4:
                for z in range(base_z + 2, base_z + wall_height):
                    rnd = random.random()
                    mat = 30 if rnd < 0.65 else (31 if rnd < 0.85 else (32 if rnd < 0.95 else 33))
                    world.set_voxel(x, y, z, mat)

    # 3. Outer Windows on Upper Floors (Floors 3 & 4: Z=14, 16)
    num_windows = 18
    for i in range(num_windows):
        angle = i * (2.0 * math.pi / num_windows)
        if -0.7 * math.pi < angle < -0.3 * math.pi:
            continue
        wx = int(round(cx + r_out * math.cos(angle)))
        wy = int(round(cy + r_out * math.sin(angle)))
        for wz in [base_z + 8, base_z + 10]:
            world.set_voxel(wx, wy, wz, 83)

    # 4. Grand South Entrance Portal
    for x in range(cx - 2, cx + 3):
        for y in range(int(cy - r_out - 2), int(cy - r_out + 4)):
            for z in range(base_z, base_z + 5):
                world.set_voxel(x, y, z, 0)
    for z in range(base_z, base_z + 5):
        world.set_voxel(cx - 2, int(cy - r_out - 1), z, 27)
        world.set_voxel(cx + 2, int(cy - r_out - 1), z, 27)
    for x in range(cx - 2, cx + 3):
        world.set_voxel(x, int(cy - r_out - 1), base_z + 4, 80)
        world.set_voxel(x, int(cy - r_out - 2), base_z + 5, 70)
    for z in range(base_z, base_z + 4):
        world.set_voxel(cx - 1, int(cy - r_out), z, 83)
        world.set_voxel(cx + 1, int(cy - r_out), z, 83)
    # Red lanterns hanging at entrance
    world.set_voxel(cx - 2, int(cy - r_out - 2), base_z + 3, 107)
    world.set_voxel(cx + 2, int(cy - r_out - 2), base_z + 3, 107)

    # 5. Internal Annular Wooden Corridors (3 Floors: Z=base_z+3, +6, +9)
    corridor_floors = [base_z + 3, base_z + 6, base_z + 9]
    for fz in corridor_floors:
        for x in range(int(cx - r_out), int(cx + r_out + 1)):
            for y in range(int(cy - r_out), int(cy + r_out + 1)):
                dist = math.hypot(x - cx, y - cy)
                if r_in + 0.2 <= dist <= r_out - 3.0:
                    world.set_voxel(x, y, fz, 81)

        # Balustrade railing on inner edge
        for x in range(int(cx - r_in - 2), int(cx + r_in + 3)):
            for y in range(int(cy - r_in - 2), int(cy + r_in + 3)):
                dist = math.hypot(x - cx, y - cy)
                if abs(dist - (r_in + 0.4)) < 0.6:
                    world.set_voxel(x, y, fz + 1, 82)

    # Wooden structural pillars around inner courtyard rim
    num_pillars = 20
    for i in range(num_pillars):
        angle = i * (2.0 * math.pi / num_pillars)
        px = int(round(cx + (r_in + 0.5) * math.cos(angle)))
        py = int(round(cy + (r_in + 0.5) * math.sin(angle)))
        for z in range(base_z, base_z + 11):
            world.set_voxel(px, py, z, 80)

    # 6. Central Courtyard (中央天井与祖堂)
    for x in range(int(cx - r_in), int(cx + r_in + 1)):
        for y in range(int(cy - r_in), int(cy + r_in + 1)):
            dist = math.hypot(x - cx, y - cy)
            if dist <= r_in:
                for z in range(base_z, base_z + 16):
                    world.set_voxel(x, y, z, 0)
                world.set_voxel(x, y, base_z, 26 if random.random() < 0.7 else 25)

    # Central Ancestral Shrine Pavilion (祖堂) in courtyard
    shrine_r = 3.0
    for x in range(int(cx - shrine_r), int(cx + shrine_r + 1)):
        for y in range(int(cy - shrine_r), int(cy + shrine_r + 1)):
            if math.hypot(x - cx, y - cy) <= shrine_r:
                world.set_voxel(x, y, base_z + 1, 63)
    for sx, sy in [(-2, -2), (2, -2), (-2, 2), (2, 2)]:
        for z in range(base_z + 1, base_z + 4):
            world.set_voxel(cx + sx, cy + sy, z, 80)
    for x in range(cx - 3, cx + 4):
        for y in range(cy - 3, cy + 4):
            world.set_voxel(x, y, base_z + 4, 70)
    world.set_voxel(cx, cy, base_z + 5, 73)

    # Central Water Well (天井水井) & Jar
    wx, wy = cx + 4, cy - 1
    world.set_voxel(wx, wy, base_z + 1, 103)
    world.set_voxel(wx, wy + 1, base_z + 1, 102)

    # 7. Traditional Chinese Hipped Circular Roof (环形灰瓦屋顶)
    top_z = base_z + wall_height
    roof_tiers = [
        (19.5, 16.0, 0, 70),   # Wide outer overhang eave
        (18.5, 15.0, 1, 71),   # Stepped tile layer
        (17.5, 14.0, 2, 70),   # Main roof tier
        (16.5, 12.5, 3, 73),   # Ridge crest ring
        (14.5, 9.5, 2, 72),    # Inward courtyard slope
        (12.5, 8.0, 1, 70),    # Inward eave
    ]

    for r_max, r_min, dz, mat in roof_tiers:
        rz = top_z + dz
        for x in range(int(cx - r_max - 1), int(cx + r_max + 2)):
            for y in range(int(cy - r_max - 1), int(cy + r_max + 2)):
                dist = math.hypot(x - cx, y - cy)
                if r_min <= dist <= r_max:
                    world.set_voxel(x, y, rz, mat)


def build_tulou_2_secondary(world):
    """
    Secondary Medium Circular Tulou (中型圆楼 - 集庆楼型):
    - Center: (44, 116)
    - Outer diameter: 24 (Radius 12)
    - Inner courtyard diameter: 10 (Radius 5)
    - Height: 11 voxels (Base Z=10 to Z=21)
    - 3 floors structure:
      * Older weathered terracotta rammed earth
      * Hillside terraced stone base
      * Southeast entrance
      * 2 tiers of internal galleries
      * Stepped circular tile roof with moss patches
    """
    print("Constructing Tulou #2: Medium Weathered Round Tulou (集庆楼型)...")
    cx, cy, base_z = 44, 116, 10
    r_out = 12.0
    r_in = 5.0
    wall_height = 9

    # 1. Terraced Stone Base
    for x in range(int(cx - r_out - 1), int(cx + r_out + 2)):
        for y in range(int(cy - r_out - 1), int(cy + r_out + 2)):
            dist = math.hypot(x - cx, y - cy)
            if dist <= r_out + 1.0:
                world.set_voxel(x, y, base_z, 34)

    # 2. Weathered Rammed Earth Wall
    for x in range(int(cx - r_out - 1), int(cx + r_out + 2)):
        for y in range(int(cy - r_out - 1), int(cy + r_out + 2)):
            dist = math.hypot(x - cx, y - cy)
            if r_out - 2.5 <= dist <= r_out + 0.3:
                for z in range(base_z + 1, base_z + wall_height):
                    rnd = random.random()
                    mat = 40 if rnd < 0.65 else (41 if rnd < 0.85 else (42 if rnd < 0.95 else 43))
                    world.set_voxel(x, y, z, mat)

    # 3. Small Windows on Floor 3
    num_windows = 12
    for i in range(num_windows):
        angle = i * (2.0 * math.pi / num_windows)
        if -0.8 * math.pi < angle < -0.4 * math.pi:
            continue
        wx = int(round(cx + r_out * math.cos(angle)))
        wy = int(round(cy + r_out * math.sin(angle)))
        world.set_voxel(wx, wy, base_z + 6, 83)

    # 4. Entrance Portal (Southeast)
    for x in range(cx + 1, cx + 5):
        for y in range(int(cy - r_out - 1), int(cy - r_out + 2)):
            for z in range(base_z + 1, base_z + 4):
                world.set_voxel(x, y, z, 0)
    world.set_voxel(cx + 2, int(cy - r_out), base_z + 1, 83)
    world.set_voxel(cx + 3, int(cy - r_out), base_z + 1, 83)

    # 5. Internal Corridors (2 Floors: Z=base_z+3, +6)
    for fz in [base_z + 3, base_z + 6]:
        for x in range(int(cx - r_out), int(cx + r_out + 1)):
            for y in range(int(cy - r_out), int(cy + r_out + 1)):
                dist = math.hypot(x - cx, y - cy)
                if r_in + 0.2 <= dist <= r_out - 2.5:
                    world.set_voxel(x, y, fz, 81)
        for x in range(int(cx - r_in - 2), int(cx + r_in + 3)):
            for y in range(int(cy - r_in - 2), int(cy + r_in + 3)):
                dist = math.hypot(x - cx, y - cy)
                if abs(dist - (r_in + 0.3)) < 0.5:
                    world.set_voxel(x, y, fz + 1, 82)

    # 6. Courtyard
    for x in range(int(cx - r_in), int(cx + r_in + 1)):
        for y in range(int(cy - r_in), int(cy + r_in + 1)):
            dist = math.hypot(x - cx, y - cy)
            if dist <= r_in:
                for z in range(base_z + 1, base_z + 12):
                    world.set_voxel(x, y, z, 0)
                world.set_voxel(x, y, base_z, 26)

    world.set_voxel(cx - 1, cy - 1, base_z + 1, 103)
    world.set_voxel(cx + 1, cy + 1, base_z + 1, 102)

    # 7. Stepped Tile Roof with Moss Patches
    top_z = base_z + wall_height
    roof_tiers = [
        (14.0, 11.0, 0, 70),
        (13.0, 10.0, 1, 71),
        (12.0, 8.5, 2, 73),
        (10.0, 6.0, 1, 74 if random.random() < 0.4 else 70),
    ]
    for r_max, r_min, dz, mat in roof_tiers:
        rz = top_z + dz
        for x in range(int(cx - r_max - 1), int(cx + r_max + 2)):
            for y in range(int(cy - r_max - 1), int(cy + r_max + 2)):
                dist = math.hypot(x - cx, y - cy)
                if r_min <= dist <= r_max:
                    world.set_voxel(x, y, rz, mat)


def build_tulou_3_square(world):
    """
    Third Tulou: Hakka Square Tulou (客家方形土楼 / 方楼 - 和贵楼/奎聚楼型):
    - Center: (122, 64)
    - Footprint: 24 x 24 voxels (X in [110, 134], Y in [52, 76])
    - Inner courtyard: 10 x 10 voxels (X in [117, 127], Y in [59, 69])
    - Height: 12 voxels (Base Z=6 to Z=18)
    - 3 floors structure:
      * Rammed earth square exterior with thick corners
      * South entrance gate
      * Perimeter wooden corridor galleries
      * Hipped square tile roof with corner pavilions (角楼飞檐)
    """
    print("Constructing Tulou #3: Hakka Square Tulou (和贵/奎聚方楼型)...")
    cx, cy, base_z = 122, 64, 6
    half_out = 12
    half_in = 5
    wall_height = 10

    # 1. Stone Plinth Base
    for x in range(cx - half_out - 1, cx + half_out + 2):
        for y in range(cy - half_out - 1, cy + half_out + 2):
            world.set_voxel(x, y, base_z, 34)

    # 2. Rammed Earth Square Walls (3 voxels thick)
    for x in range(cx - half_out, cx + half_out + 1):
        for y in range(cy - half_out, cy + half_out + 1):
            is_wall = (
                (abs(x - cx) >= half_in and abs(y - cy) <= half_out) or
                (abs(y - cy) >= half_in and abs(x - cx) <= half_out)
            )
            if is_wall:
                for z in range(base_z + 1, base_z + wall_height):
                    rnd = random.random()
                    mat = 50 if rnd < 0.65 else (51 if rnd < 0.85 else 52)
                    world.set_voxel(x, y, z, mat)

    # 3. Outer Windows on Floor 3
    for wx in range(cx - half_out + 3, cx + half_out - 2, 4):
        world.set_voxel(wx, cy - half_out, base_z + 7, 83)
        world.set_voxel(wx, cy + half_out, base_z + 7, 83)
    for wy in range(cy - half_out + 3, cy + half_out - 2, 4):
        world.set_voxel(cx - half_out, wy, base_z + 7, 83)
        world.set_voxel(cx + half_out, wy, base_z + 7, 83)

    # 4. South Entrance Portal
    for x in range(cx - 1, cx + 2):
        for y in range(cy - half_out - 1, cy - half_in + 1):
            for z in range(base_z + 1, base_z + 4):
                world.set_voxel(x, y, z, 0)
    world.set_voxel(cx, cy - half_out, base_z + 1, 83)
    world.set_voxel(cx, cy - half_out, base_z + 2, 83)
    for x in range(cx - 2, cx + 3):
        world.set_voxel(x, cy - half_out - 1, base_z + 4, 70)

    # 5. Inner Wooden Corridors (2 Floors: Z=base_z+3, +6)
    for fz in [base_z + 3, base_z + 6]:
        for x in range(cx - half_out + 1, cx + half_out):
            for y in range(cy - half_out + 1, cy + half_out):
                if (half_in <= abs(x - cx) <= half_in + 2 and abs(y - cy) < half_out) or \
                   (half_in <= abs(y - cy) <= half_in + 2 and abs(x - cx) < half_out):
                    world.set_voxel(x, y, fz, 81)
        for x in range(cx - half_in, cx + half_in + 1):
            world.set_voxel(x, cy - half_in, fz + 1, 82)
            world.set_voxel(x, cy + half_in, fz + 1, 82)
        for y in range(cy - half_in, cy + half_in + 1):
            world.set_voxel(cx - half_in, y, fz + 1, 82)
            world.set_voxel(cx + half_in, y, fz + 1, 82)

    # 6. Central Courtyard
    for x in range(cx - half_in, cx + half_in + 1):
        for y in range(cy - half_in, cy + half_in + 1):
            for z in range(base_z + 1, base_z + 12):
                world.set_voxel(x, y, z, 0)
            world.set_voxel(x, y, base_z, 25)

    world.set_voxel(cx + 2, cy + 2, base_z + 1, 103)

    # 7. Traditional Chinese Hipped Square Roof with Corner Eaves
    top_z = base_z + wall_height
    for x in range(cx - half_out - 2, cx + half_out + 3):
        for y in range(cy - half_out - 2, cy + half_out + 3):
            dx = abs(x - cx)
            dy = abs(y - cy)
            if half_in - 1 <= max(dx, dy) <= half_out + 2:
                world.set_voxel(x, y, top_z, 70)
    for x in range(cx - half_out - 1, cx + half_out + 2):
        for y in range(cy - half_out - 1, cy + half_out + 2):
            dx = abs(x - cx)
            dy = abs(y - cy)
            if half_in <= max(dx, dy) <= half_out + 1:
                world.set_voxel(x, y, top_z + 1, 71)
    for x in range(cx - half_out, cx + half_out + 1):
        for y in range(cy - half_out, cy + half_out + 1):
            dx = abs(x - cx)
            dy = abs(y - cy)
            if half_in + 1 <= max(dx, dy) <= half_out:
                world.set_voxel(x, y, top_z + 2, 73)
    # Raised corner pavilions (飞檐翘角)
    for sx in [-1, 1]:
        for sy in [-1, 1]:
            px = cx + sx * (half_out + 1)
            py = cy + sy * (half_out + 1)
            world.set_voxel(px, py, top_z + 2, 73)
            world.set_voxel(px, py, top_z + 3, 73)


def build_ancestral_hall(world):
    """
    Hakka Ancestral Hall (客家宗祠) - Central civic / spiritual node
    - Location: (78, 50), Base Z=6
    - Symmetrical 3-bay ancestral hall with courtyard, stone drum door rests,
      raised ridge with swept eaves (燕尾脊), front gatehouse, and ceremonial porch
    """
    print("Constructing Hakka Ancestral Hall (客家宗祠)...")
    cx, cy, base_z = 78, 50, 6
    w, d, h = 14, 10, 6

    for x in range(cx - w//2, cx + w//2 + 1):
        for y in range(cy - d//2, cy + d//2 + 1):
            world.set_voxel(x, y, base_z, 27)

    for x in range(cx - w//2, cx + w//2 + 1):
        for y in range(cy - d//2, cy + d//2 + 1):
            if x in [cx - w//2, cx + w//2] or y in [cy - d//2, cy + d//2]:
                for z in range(base_z + 1, base_z + h):
                    world.set_voxel(x, y, z, 63)

    for x in range(cx - 2, cx + 3):
        for z in range(base_z + 1, base_z + 4):
            world.set_voxel(x, cy - d//2, z, 0)
    world.set_voxel(cx - 1, cy - d//2, base_z + 1, 83)
    world.set_voxel(cx + 1, cy - d//2, base_z + 1, 83)
    world.set_voxel(cx - 2, cy - d//2 - 1, base_z + 1, 103)
    world.set_voxel(cx + 2, cy - d//2 - 1, base_z + 1, 103)
    world.set_voxel(cx - 2, cy - d//2 - 1, base_z + 3, 107)
    world.set_voxel(cx + 2, cy - d//2 - 1, base_z + 3, 107)

    # Ceremonial altar inside
    world.set_voxel(cx, cy + 3, base_z + 1, 80)
    world.set_voxel(cx, cy + 3, base_z + 2, 107)

    top_z = base_z + h
    for y in range(cy - d//2 - 1, cy + d//2 + 2):
        dist_y = abs(y - cy)
        rz = top_z + (3 - dist_y // 2)
        for x in range(cx - w//2 - 1, cx + w//2 + 2):
            world.set_voxel(x, y, rz, 70)
    for x in range(cx - w//2 - 2, cx + w//2 + 3):
        world.set_voxel(x, cy, top_z + 4, 73)
    world.set_voxel(cx - w//2 - 2, cy, top_z + 5, 73)
    world.set_voxel(cx + w//2 + 2, cy, top_z + 5, 73)


def build_hakka_houses(world):
    """
    Generates 13 distinct traditional Hakka vernacular dwellings (客家民居):
    - Varied dimensions, orientations, heights, and roof pitches
    - Vernacular rammed earth / brick walls, stone plinth, pitched tile roofs
    - Grouped into organic hamlets responding to roads and topography
    """
    print("Constructing 13 Hakka vernacular residential buildings...")

    houses_spec = [
        # (x, y, width, depth, height, orientation, wall_mat, desc)
        # Cluster A: Northwest hamlet (near Tulou 2)
        (26, 88, 12, 8, 5, "EW", 60, "2-story Farmhouse with courtyard"),
        (44, 88, 9, 7, 4, "NS", 61, "Pitched-roof cottage"),
        (60, 104, 8, 6, 4, "EW", 62, "Raised-floor granary barn"),

        # Cluster B: Central Civic hamlet (flanking Ancestral Hall & Plaza)
        (58, 48, 10, 8, 4, "NS", 60, "Traditional Hakka cottage"),
        (98, 48, 10, 8, 4, "NS", 61, "Courtyard homestead"),
        (60, 64, 11, 8, 5, "EW", 60, "Village teahouse with verandah"),
        (96, 64, 10, 7, 4, "NS", 62, "Village artisan workshop"),

        # Cluster C: East hamlet (near Square Tulou & Brook)
        (138, 90, 12, 9, 5, "EW", 61, "2-story courtyard residence"),
        (118, 98, 9, 7, 4, "NS", 60, "Riverside homestead"),
        (138, 44, 9, 8, 4, "EW", 62, "Miller's dwelling near brook"),

        # Cluster D: Southern agricultural outbuildings
        (46, 34, 10, 7, 4, "EW", 61, "Tea-processing workshop"),
        (102, 32, 8, 6, 3, "NS", 60, "Woodcutter's storehouse"),
        (124, 26, 11, 7, 4, "EW", 62, "Open granary with livestock shed"),
    ]

    for hx, hy, hw, hd, hh, orient, wall_mat, desc in houses_spec:
        base_z = world.heightfield[hx, hy]
        for x in range(hx - hw//2, hx + hw//2 + 1):
            for y in range(hy - hd//2, hy + hd//2 + 1):
                world.set_voxel(x, y, base_z, 27)

        for x in range(hx - hw//2, hx + hw//2 + 1):
            for y in range(hy - hd//2, hy + hd//2 + 1):
                if x in [hx - hw//2, hx + hw//2] or y in [hy - hd//2, hy + hd//2]:
                    for z in range(base_z + 1, base_z + hh):
                        world.set_voxel(x, y, z, wall_mat)

        if orient == "NS":
            world.set_voxel(hx, hy - hd//2, base_z + 1, 83)
            world.set_voxel(hx, hy - hd//2, base_z + 2, 83)
            world.set_voxel(hx + hw//2, hy, base_z + 2, 83)
        else:
            world.set_voxel(hx - hw//2, hy, base_z + 1, 83)
            world.set_voxel(hx - hw//2, hy, base_z + 2, 83)
            world.set_voxel(hx, hy - hd//2, base_z + 2, 83)

        top_z = base_z + hh
        if orient == "NS":
            for x in range(hx - hw//2 - 1, hx + hw//2 + 2):
                dist_x = abs(x - hx)
                rz = top_z + (hw//4 + 1) - dist_x // 2
                for y in range(hy - hd//2 - 1, hy + hd//2 + 2):
                    world.set_voxel(x, y, rz, 70)
            for y in range(hy - hd//2 - 1, hy + hd//2 + 2):
                world.set_voxel(hx, y, top_z + hw//4 + 2, 73)
        else:
            for y in range(hy - hd//2 - 1, hy + hd//2 + 2):
                dist_y = abs(y - hy)
                rz = top_z + (hd//4 + 1) - dist_y // 2
                for x in range(hx - hw//2 - 1, hx + hw//2 + 2):
                    world.set_voxel(x, y, rz, 70)
            for x in range(hx - hw//2 - 1, hx + hw//2 + 2):
                world.set_voxel(x, hy, top_z + hd//4 + 2, 73)


def add_vegetation(world):
    """
    Adds hierarchical vegetation system:
    - 3 dense bamboo groves with segmented stalks and leafy canopies
    - Native Chinese mountain pines with stepped branches
    - Twin ancient banyans at Village Gate
    - Persimmon fruit trees with orange dots
    """
    print("Planting vegetation: bamboo groves, ancient banyans, persimmons, and mountain pines...")

    def plant_bamboo(bx, by, height):
        if not (0 <= bx < GRID_X and 0 <= by < GRID_Y):
            return
        bz = world.heightfield[bx, by]
        if world.get_voxel(bx, by, bz) in [10, 11, 12]:
            return
        for z in range(bz + 1, bz + height + 1):
            world.set_voxel(bx, by, z, 90)
        top = bz + height
        for dx in range(-1, 2):
            for dy in range(-1, 2):
                world.set_voxel(bx + dx, by + dy, top, 91)
        world.set_voxel(bx, by, top + 1, 92)

    groves = [
        (38, 136, 16, 40),   # Grove A: NW slope behind Tulou 2
        (134, 126, 14, 32),  # Grove B: NE brook ravine
        (22, 60, 12, 26),    # Grove C: West hill boundary
    ]
    for gcx, gcy, gr, gcount in groves:
        for _ in range(gcount):
            ang = random.random() * 2 * math.pi
            rad = random.random() * gr
            bx = int(gcx + rad * math.cos(ang))
            by = int(gcy + rad * math.sin(ang))
            bh = random.randint(5, 8)
            plant_bamboo(bx, by, bh)

    def plant_pine(px, py, height=7):
        if not (0 <= px < GRID_X and 0 <= py < GRID_Y):
            return
        pz = world.heightfield[px, py]
        if world.get_voxel(px, py, pz) in [10, 11, 12, 25, 26, 27]:
            return
        for z in range(pz + 1, pz + height - 2):
            world.set_voxel(px, py, z, 95)
        for tier, r_crown in [(pz + height - 4, 3), (pz + height - 2, 2), (pz + height, 1)]:
            for dx in range(-r_crown, r_crown + 1):
                for dy in range(-r_crown, r_crown + 1):
                    if dx*dx + dy*dy <= r_crown*r_crown + 1:
                        mat = 93 if random.random() < 0.75 else 94
                        world.set_voxel(px + dx, py + dy, tier, mat)
        world.set_voxel(px, py, pz + height + 1, 93)

    pine_locs = [
        (65, 140), (82, 145), (100, 138), (115, 148), (145, 140),
        (50, 148), (28, 142), (92, 152), (130, 150), (152, 110),
        (148, 75), (15, 105), (18, 120), (105, 120), (74, 130)
    ]
    for px, py in pine_locs:
        plant_pine(px, py, random.randint(6, 9))

    # Twin Ancient Banyan Trees at Village Gate (32, 16)
    def plant_banyan(tx, ty):
        tz = world.heightfield[tx, ty]
        for z in range(tz + 1, tz + 4):
            for dx in range(-1, 2):
                for dy in range(-1, 2):
                    world.set_voxel(tx + dx, ty + dy, z, 95)
        top_z = tz + 4
        for dz, r in [(0, 4), (1, 4), (2, 3), (3, 2)]:
            for dx in range(-r, r + 1):
                for dy in range(-r, r + 1):
                    if dx*dx + dy*dy <= r*r + 1:
                        world.set_voxel(tx + dx, ty + dy, top_z + dz, 96 if random.random() < 0.7 else 91)

    plant_banyan(27, 16)
    plant_banyan(37, 16)

    # Persimmon Fruit Trees near houses
    def plant_persimmon(tx, ty):
        tz = world.heightfield[tx, ty]
        for z in range(tz + 1, tz + 4):
            world.set_voxel(tx, ty, z, 95)
        for dx in range(-2, 3):
            for dy in range(-2, 3):
                if dx*dx + dy*dy <= 4:
                    world.set_voxel(tx + dx, ty + dy, tz + 4, 96)
                    # Orange persimmon fruits!
                    if random.random() < 0.25:
                        world.set_voxel(tx + dx, ty + dy, tz + 3, 97)
        world.set_voxel(tx, ty, tz + 5, 96)

    plant_persimmon(48, 80)
    plant_persimmon(130, 84)


def add_props_and_characters(world):
    """
    Adds Hakka cultural life props and voxel villagers:
    - Village plaza life: stone well, stone table, grain drying racks, water jars, firewood
    - 6 voxel Hakka characters engaged in daily activities
    - Water buffalo resting by paddy
    - Voxel chickens pecking in courtyards
    """
    print("Scattering village life props, water buffalo, livestock, and characters...")

    # Communal Well & Table
    world.set_voxel(73, 64, 7, 103)
    world.set_voxel(73, 64, 8, 80)
    world.set_voxel(82, 64, 7, 103)
    for sx, sy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
        world.set_voxel(82 + sx, 64 + sy, 7, 27)

    # Grain Drying Mats (晒谷场)
    for x in range(74, 80):
        for y in range(56, 59):
            world.set_voxel(x, y, 7, 100)

    # Firewood Stacks (木柴堆) against houses
    for x in range(65, 68):
        world.set_voxel(x, 60, 7, 101)
        world.set_voxel(x, 60, 8, 101)

    # Ceramic Water Jars (大水缸)
    for jx, jy in [(70, 62), (86, 62), (77, 71), (43, 85), (99, 45), (120, 52)]:
        world.set_voxel(jx, jy, world.heightfield[jx, jy] + 1, 102)

    # Voxel Characters
    def add_character(cx, cy, activity="standing"):
        cz = world.heightfield[cx, cy]
        world.set_voxel(cx, cy, cz + 1, 104)
        world.set_voxel(cx, cy, cz + 2, 104)
        world.set_voxel(cx, cy, cz + 3, 105)
        for dx in range(-1, 2):
            for dy in range(-1, 2):
                world.set_voxel(cx + dx, cy + dy, cz + 4, 106)
        if activity == "carrying":
            world.set_voxel(cx - 1, cy, cz + 3, 80)
            world.set_voxel(cx + 1, cy, cz + 3, 80)
            world.set_voxel(cx - 2, cy, cz + 2, 100)
            world.set_voxel(cx + 2, cy, cz + 2, 100)

    add_character(50, 38, activity="carrying")
    add_character(34, 24, activity="standing")
    add_character(76, 57, activity="standing")
    add_character(76, 73, activity="standing")
    add_character(115, 90, activity="standing")
    add_character(122, 55, activity="standing")  # Guarding square tulou

    # Voxel Water Buffalo (水牛) resting near paddy
    bx, by, bz = 24, 30, 5
    for dx in range(0, 3):
        for dy in range(0, 2):
            world.set_voxel(bx + dx, by + dy, bz + 1, 108)
    world.set_voxel(bx - 1, by, bz + 2, 108)  # Head
    world.set_voxel(bx - 1, by + 1, bz + 3, 4)  # Horn

    # Small Voxel Chickens (公鸡母鸡)
    for chx, chy in [(75, 60), (77, 61), (80, 58), (81, 88), (43, 114)]:
        chz = world.heightfield[chx, chy] + 1
        world.set_voxel(chx, chy, chz, 100)


def export_obj_and_mtl(world, filepath_obj, filepath_mtl):
    print(f"Exporting OBJ mesh to {filepath_obj}...")
    sx, sy, sz = world.sx, world.sy, world.sz
    grid = world.grid

    with open(filepath_mtl, 'w', encoding='utf-8') as f_mtl:
        f_mtl.write("# Hakka Tulou Village MTL Material Definition\n\n")
        for mat_id, (r, g, b, name, cat) in PALETTE.items():
            if mat_id == 0:
                continue
            rf, gf, bf = r / 255.0, g / 255.0, b / 255.0
            f_mtl.write(f"newmtl mat_{mat_id}_{name}\n")
            f_mtl.write(f"Kd {rf:.4f} {gf:.4f} {bf:.4f}\n")
            f_mtl.write(f"Ka {rf*0.3:.4f} {gf*0.3:.4f} {bf*0.3:.4f}\n")
            f_mtl.write("Ks 0.05 0.05 0.05\n")
            f_mtl.write("Ns 10.0\n")
            f_mtl.write("d 1.0\n")
            f_mtl.write("illum 2\n\n")

    face_dirs = [
        (1, 0, 0,  [(1,0,0), (1,1,0), (1,1,1), (1,0,1)], (1,0,0)),
        (-1, 0, 0, [(0,1,0), (0,0,0), (0,0,1), (0,1,1)], (-1,0,0)),
        (0, 1, 0,  [(1,1,0), (0,1,0), (0,1,1), (1,1,1)], (0,1,0)),
        (0, -1, 0, [(0,0,0), (1,0,0), (1,0,1), (0,0,1)], (0,-1,0)),
        (0, 0, 1,  [(0,0,1), (1,0,1), (1,1,1), (0,1,1)], (0,0,1)),
        (0, 0, -1, [(0,1,0), (1,1,0), (1,0,0), (0,0,0)], (0,0,-1))
    ]

    mat_faces = {mat_id: [] for mat_id in PALETTE if mat_id != 0}

    for x in range(sx):
        for y in range(sy):
            for z in range(sz):
                val = grid[x, y, z]
                if val == 0:
                    continue
                for dx, dy, dz, quad_offsets, norm in face_dirs:
                    nx, ny, nz = x + dx, y + dy, z + dz
                    is_exposed = False
                    if 0 <= nx < sx and 0 <= ny < sy and 0 <= nz < sz:
                        if grid[nx, ny, nz] == 0:
                            is_exposed = True
                    else:
                        is_exposed = True

                    if is_exposed:
                        quad = [(x + ox, y + oy, z + oz) for ox, oy, oz in quad_offsets]
                        mat_faces[val].append((quad, norm))

    # Write OBJ file with standard Y-up centered coordinates (X=x-80, Y=z, Z=80-y)
    mtl_basename = os.path.basename(filepath_mtl)
    with open(filepath_obj, 'w', encoding='utf-8') as f_obj:
        f_obj.write("# Hakka Tulou Village (大型客家土楼村落) 3D Model (Y-Up Centered)\n")
        f_obj.write(f"mtllib {mtl_basename}\n\n")

        categories = {}
        for mat_id, faces in mat_faces.items():
            if not faces:
                continue
            cat = PALETTE[mat_id][4]
            if cat not in categories:
                categories[cat] = []
            categories[cat].append((mat_id, faces))

        vert_offset = 1
        for cat, mat_list in categories.items():
            f_obj.write(f"o {cat}\n")
            f_obj.write(f"g {cat}\n")
            for mat_id, faces in mat_list:
                mat_name = PALETTE[mat_id][3]
                f_obj.write(f"usemtl mat_{mat_id}_{mat_name}\n")
                for quad, norm in faces:
                    for vx, vy, vz in quad:
                        # Transform to Y-Up centered: X' = vx - 80, Y' = vz, Z' = 80 - vy
                        f_obj.write(f"v {vx - 80.0:.2f} {vz:.2f} {80.0 - vy:.2f}\n")
                    f_obj.write(f"f {vert_offset} {vert_offset+1} {vert_offset+2} {vert_offset+3}\n")
                    vert_offset += 4

    print(f"OBJ export complete. Total vertices: {vert_offset - 1}")


def export_glb(world, filepath_glb):
    import trimesh
    print(f"Exporting GLB model to {filepath_glb}...")
    sx, sy, sz = world.sx, world.sy, world.sz
    grid = world.grid

    face_dirs = [
        (1, 0, 0,  [(1,0,0), (1,1,0), (1,1,1), (1,0,1)]),
        (-1, 0, 0, [(0,1,0), (0,0,0), (0,0,1), (0,1,1)]),
        (0, 1, 0,  [(1,1,0), (0,1,0), (0,1,1), (1,1,1)]),
        (0, -1, 0, [(0,0,0), (1,0,0), (1,0,1), (0,0,1)]),
        (0, 0, 1,  [(0,0,1), (1,0,1), (1,1,1), (0,1,1)]),
        (0, 0, -1, [(0,1,0), (1,1,0), (1,0,0), (0,0,0)])
    ]

    all_vertices = []
    all_faces = []
    all_colors = []
    v_idx = 0

    for x in range(sx):
        for y in range(sy):
            for z in range(sz):
                val = grid[x, y, z]
                if val == 0:
                    continue
                r, g, b, _, _ = PALETTE[val]
                rgba = [r, g, b, 255]

                for dx, dy, dz, quad_offsets in face_dirs:
                    nx, ny, nz = x + dx, y + dy, z + dz
                    is_exposed = False
                    if 0 <= nx < sx and 0 <= ny < sy and 0 <= nz < sz:
                        if grid[nx, ny, nz] == 0:
                            is_exposed = True
                    else:
                        is_exposed = True

                    if is_exposed:
                        for ox, oy, oz in quad_offsets:
                            # Standard Y-Up Centered: X' = x+ox - 80, Y' = z+oz, Z' = 80 - (y+oy)
                            all_vertices.append([x + ox - 80.0, z + oz, 80.0 - (y + oy)])
                            all_colors.append(rgba)
                        all_faces.append([v_idx, v_idx + 1, v_idx + 2])
                        all_faces.append([v_idx, v_idx + 2, v_idx + 3])
                        v_idx += 4

    vertices = np.array(all_vertices, dtype=np.float32)
    faces = np.array(all_faces, dtype=np.uint32)
    colors = np.array(all_colors, dtype=np.uint8)

    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, vertex_colors=colors, process=False)
    mesh.export(filepath_glb)
    print(f"GLB export complete: {len(faces)} triangles.")


def export_vox(world, filepath_vox):
    print(f"Exporting MagicaVoxel .VOX to {filepath_vox}...")
    filled = []
    for x in range(world.sx):
        for y in range(world.sy):
            for z in range(world.sz):
                val = world.grid[x, y, z]
                if val > 0:
                    vox_id = min(255, val)
                    filled.append((x, y, z, vox_id))

    num_voxels = len(filled)
    with open(filepath_vox, 'wb') as f:
        f.write(b'VOX ')
        f.write((150).to_bytes(4, byteorder='little'))

        size_chunk = b'SIZE' + (12).to_bytes(4, 'little') + (0).to_bytes(4, 'little') + \
                     (world.sx).to_bytes(4, 'little') + (world.sy).to_bytes(4, 'little') + (world.sz).to_bytes(4, 'little')

        xyzi_content = num_voxels.to_bytes(4, 'little')
        for vx, vy, vz, vi in filled:
            xyzi_content += bytes([vx, vy, vz, vi])
        xyzi_chunk = b'XYZI' + len(xyzi_content).to_bytes(4, 'little') + (0).to_bytes(4, 'little') + xyzi_content

        rgba_content = bytearray(256 * 4)
        for mat_id, (r, g, b, _, _) in PALETTE.items():
            if 0 < mat_id < 256:
                idx = (mat_id - 1) * 4
                rgba_content[idx:idx+4] = bytes([r, g, b, 255])
        rgba_chunk = b'RGBA' + len(rgba_content).to_bytes(4, 'little') + (0).to_bytes(4, 'little') + rgba_content

        main_children = size_chunk + xyzi_chunk + rgba_chunk
        main_header = b'MAIN' + (0).to_bytes(4, 'little') + len(main_children).to_bytes(4, 'little')

        f.write(main_header)
        f.write(main_children)

    print(f"VOX export complete: {num_voxels} voxels.")


def main():
    out_dir = os.path.dirname(os.path.abspath(__file__))
    print(f"Generating Hakka Tulou Village in: {out_dir}")

    world = VoxelWorld(GRID_X, GRID_Y, GRID_Z)

    generate_terrain(world)
    generate_water_and_terraces(world)
    generate_roads_and_plaza(world)

    build_tulou_1_main(world)
    build_tulou_2_secondary(world)
    build_tulou_3_square(world)

    build_ancestral_hall(world)
    build_hakka_houses(world)

    add_vegetation(world)
    add_props_and_characters(world)

    obj_path = os.path.join(out_dir, "tulou_village.obj")
    mtl_path = os.path.join(out_dir, "tulou_village.mtl")
    glb_path = os.path.join(out_dir, "tulou_village.glb")
    vox_path = os.path.join(out_dir, "tulou_village.vox")

    export_obj_and_mtl(world, obj_path, mtl_path)
    export_glb(world, glb_path)
    export_vox(world, vox_path)

    print("Village generation and 3D exports successfully finished!")


if __name__ == "__main__":
    main()
