"""
Hakka Tulou Village Diorama - Numba-Accelerated Voxel Raymarcher & Renderer
Produces high-resolution, cinema-quality Voxel Art renders with:
- Warm golden directional sun lighting with real-time raymarched voxel shadows
- Ambient occlusion (crevice and corner darkening)
- Water specular highlights & surface shimmer
- Voxel edge highlighting for handcrafted diorama aesthetics
- Atmospheric depth haze
- Multiple camera configurations:
  1. shot01_isometric_main.png (3/4 Elevated Isometric View)
  2. shot01_full_diorama.png (Full Village Landscape Diorama)
  3. shot01_tulou_detail.png (Core Tulou #1 Close-up)
  4. shot01_village_relations.png (Spatial Settlement Relations View)
"""

import os
import math
import time
import numpy as np
from PIL import Image
from numba import njit, prange

import generate_village as gv

# Pre-convert Palette to NumPy array for fast JIT access
PALETTE_ARRAY = np.zeros((256, 3), dtype=np.float32)
for mat_id, (r, g, b, _, _) in gv.PALETTE.items():
    if 0 <= mat_id < 256:
        PALETTE_ARRAY[mat_id] = [r / 255.0, g / 255.0, b / 255.0]


@njit(fastmath=True)
def ray_box_intersection(ox, oy, oz, dx, dy, dz, sx, sy, sz):
    t_min = 0.0
    t_max = 1e9

    if abs(dx) < 1e-8:
        if ox < 0.0 or ox > sx:
            return False, 0.0, 0.0
    else:
        inv_d = 1.0 / dx
        t1 = (0.0 - ox) * inv_d
        t2 = (sx - ox) * inv_d
        if t1 > t2:
            t1, t2 = t2, t1
        t_min = max(t_min, t1)
        t_max = min(t_max, t2)
        if t_min > t_max:
            return False, 0.0, 0.0

    if abs(dy) < 1e-8:
        if oy < 0.0 or oy > sy:
            return False, 0.0, 0.0
    else:
        inv_d = 1.0 / dy
        t1 = (0.0 - oy) * inv_d
        t2 = (sy - oy) * inv_d
        if t1 > t2:
            t1, t2 = t2, t1
        t_min = max(t_min, t1)
        t_max = min(t_max, t2)
        if t_min > t_max:
            return False, 0.0, 0.0

    if abs(dz) < 1e-8:
        if oz < 0.0 or oz > sz:
            return False, 0.0, 0.0
    else:
        inv_d = 1.0 / dz
        t1 = (0.0 - oz) * inv_d
        t2 = (sz - oz) * inv_d
        if t1 > t2:
            t1, t2 = t2, t1
        t_min = max(t_min, t1)
        t_max = min(t_max, t2)
        if t_min > t_max:
            return False, 0.0, 0.0

    return True, max(0.0, t_min), t_max


@njit(fastmath=True)
def trace_shadow_ray(grid, sx, sy, sz, ox, oy, oz, lx, ly, lz, max_dist=120.0):
    hit, t0, t1 = ray_box_intersection(ox, oy, oz, lx, ly, lz, sx, sy, sz)
    if not hit:
        return 1.0

    t_start = max(0.01, t0)
    cur_x = ox + lx * t_start
    cur_y = oy + ly * t_start
    cur_z = oz + lz * t_start

    ix = int(math.floor(cur_x))
    iy = int(math.floor(cur_y))
    iz = int(math.floor(cur_z))

    if ix < 0 or ix >= sx or iy < 0 or iy >= sy or iz < 0 or iz >= sz:
        return 1.0

    step_x = 1 if lx > 0 else (-1 if lx < 0 else 0)
    step_y = 1 if ly > 0 else (-1 if ly < 0 else 0)
    step_z = 1 if lz > 0 else (-1 if lz < 0 else 0)

    inv_lx = 1.0 / lx if abs(lx) > 1e-8 else 1e9
    inv_ly = 1.0 / ly if abs(ly) > 1e-8 else 1e9
    inv_lz = 1.0 / lz if abs(lz) > 1e-8 else 1e9

    t_max_x = ((ix + 1 if step_x > 0 else ix) - ox) * inv_lx if step_x != 0 else 1e9
    t_max_y = ((iy + 1 if step_y > 0 else iy) - oy) * inv_ly if step_y != 0 else 1e9
    t_max_z = ((iz + 1 if step_z > 0 else iz) - oz) * inv_lz if step_z != 0 else 1e9

    t_delta_x = abs(inv_lx)
    t_delta_y = abs(inv_ly)
    t_delta_z = abs(inv_lz)

    traveled = t_start
    for _ in range(160):
        if t_max_x < t_max_y:
            if t_max_x < t_max_z:
                ix += step_x
                traveled = t_max_x
                t_max_x += t_delta_x
            else:
                iz += step_z
                traveled = t_max_z
                t_max_z += t_delta_z
        else:
            if t_max_y < t_max_z:
                iy += step_y
                traveled = t_max_y
                t_max_y += t_delta_y
            else:
                iz += step_z
                traveled = t_max_z
                t_max_z += t_delta_z

        if ix < 0 or ix >= sx or iy < 0 or iy >= sy or iz < 0 or iz >= sz or traveled > max_dist:
            break

        if grid[ix, iy, iz] > 0:
            return 0.22  # Crisp, deep shadow

    return 1.0


@njit(fastmath=True)
def calculate_ambient_occlusion(grid, sx, sy, sz, ix, iy, iz, nx, ny, nz):
    occlusion = 0
    if abs(nz) > 0.5:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                nx_vox = ix + dx
                ny_vox = iy + dy
                nz_vox = iz + int(nz)
                if 0 <= nx_vox < sx and 0 <= ny_vox < sy and 0 <= nz_vox < sz:
                    if grid[nx_vox, ny_vox, nz_vox] > 0:
                        occlusion += 1
    elif abs(nx) > 0.5:
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                if dy == 0 and dz == 0:
                    continue
                nx_vox = ix + int(nx)
                ny_vox = iy + dy
                nz_vox = iz + dz
                if 0 <= nx_vox < sx and 0 <= ny_vox < sy and 0 <= nz_vox < sz:
                    if grid[nx_vox, ny_vox, nz_vox] > 0:
                        occlusion += 1
    else:
        for dx in (-1, 0, 1):
            for dz in (-1, 0, 1):
                if dx == 0 and dz == 0:
                    continue
                nx_vox = ix + dx
                ny_vox = iy + int(ny)
                nz_vox = iz + dz
                if 0 <= nx_vox < sx and 0 <= ny_vox < sy and 0 <= nz_vox < sz:
                    if grid[nx_vox, ny_vox, nz_vox] > 0:
                        occlusion += 1

    ao_factor = 1.0 - min(0.68, occlusion * 0.085)
    return ao_factor


@njit(fastmath=True)
def cast_ray(grid, palette, sx, sy, sz, ox, oy, oz, dx, dy, dz, lx, ly, lz):
    hit, t0, t1 = ray_box_intersection(ox, oy, oz, dx, dy, dz, sx, sy, sz)
    if not hit:
        # Misty mountain atmosphere sky gradient
        t_sky = 0.5 * (dz + 1.0)
        r_sky = 0.74 * (1.0 - t_sky) + 0.88 * t_sky
        g_sky = 0.80 * (1.0 - t_sky) + 0.92 * t_sky
        b_sky = 0.86 * (1.0 - t_sky) + 0.96 * t_sky
        return r_sky, g_sky, b_sky

    cur_x = ox + dx * t0
    cur_y = oy + dy * t0
    cur_z = oz + dz * t0

    ix = min(sx - 1, max(0, int(math.floor(cur_x))))
    iy = min(sy - 1, max(0, int(math.floor(cur_y))))
    iz = min(sz - 1, max(0, int(math.floor(cur_z))))

    step_x = 1 if dx > 0 else (-1 if dx < 0 else 0)
    step_y = 1 if dy > 0 else (-1 if dy < 0 else 0)
    step_z = 1 if dz > 0 else (-1 if dz < 0 else 0)

    inv_dx = 1.0 / dx if abs(dx) > 1e-8 else 1e9
    inv_dy = 1.0 / dy if abs(dy) > 1e-8 else 1e9
    inv_dz = 1.0 / dz if abs(dz) > 1e-8 else 1e9

    t_max_x = ((ix + 1 if step_x > 0 else ix) - ox) * inv_dx if step_x != 0 else 1e9
    t_max_y = ((iy + 1 if step_y > 0 else iy) - oy) * inv_dy if step_y != 0 else 1e9
    t_max_z = ((iz + 1 if step_z > 0 else iz) - oz) * inv_dz if step_z != 0 else 1e9

    t_delta_x = abs(inv_dx)
    t_delta_y = abs(inv_dy)
    t_delta_z = abs(inv_dz)

    normal_x = 0.0
    normal_y = 0.0
    normal_z = 0.0

    hit_voxel = 0
    traveled_dist = t0

    if grid[ix, iy, iz] > 0:
        hit_voxel = grid[ix, iy, iz]
        normal_z = 1.0
    else:
        for _ in range(450):
            if t_max_x < t_max_y:
                if t_max_x < t_max_z:
                    ix += step_x
                    traveled_dist = t_max_x
                    t_max_x += t_delta_x
                    normal_x = -step_x
                    normal_y = 0.0
                    normal_z = 0.0
                else:
                    iz += step_z
                    traveled_dist = t_max_z
                    t_max_z += t_delta_z
                    normal_x = 0.0
                    normal_y = 0.0
                    normal_z = -step_z
            else:
                if t_max_y < t_max_z:
                    iy += step_y
                    traveled_dist = t_max_y
                    t_max_y += t_delta_y
                    normal_x = 0.0
                    normal_y = -step_y
                    normal_z = 0.0
                else:
                    iz += step_z
                    traveled_dist = t_max_z
                    t_max_z += t_delta_z
                    normal_x = 0.0
                    normal_y = 0.0
                    normal_z = -step_z

            if ix < 0 or ix >= sx or iy < 0 or iy >= sy or iz < 0 or iz >= sz:
                break

            val = grid[ix, iy, iz]
            if val > 0:
                hit_voxel = val
                break

    if hit_voxel == 0:
        t_sky = 0.5 * (dz + 1.0)
        r_sky = 0.74 * (1.0 - t_sky) + 0.88 * t_sky
        g_sky = 0.80 * (1.0 - t_sky) + 0.92 * t_sky
        b_sky = 0.86 * (1.0 - t_sky) + 0.96 * t_sky
        return r_sky, g_sky, b_sky

    hit_px = ox + dx * traveled_dist
    hit_py = oy + dy * traveled_dist
    hit_pz = oz + dz * traveled_dist

    base_r = palette[hit_voxel, 0]
    base_g = palette[hit_voxel, 1]
    base_b = palette[hit_voxel, 2]

    # Diffuse lighting
    n_dot_l = normal_x * lx + normal_y * ly + normal_z * lz
    diffuse = max(0.0, n_dot_l)

    # Shadow ray
    shadow = 1.0
    if diffuse > 0.01:
        shadow = trace_shadow_ray(
            grid, sx, sy, sz,
            hit_px + normal_x * 0.02,
            hit_py + normal_y * 0.02,
            hit_pz + normal_z * 0.02,
            lx, ly, lz
        )

    # Ambient Occlusion
    ao = calculate_ambient_occlusion(grid, sx, sy, sz, ix, iy, iz, normal_x, normal_y, normal_z)

    # Skylight hemisphere (cool blue/slate ambient fill)
    skylight = 0.40 + 0.60 * max(0.0, normal_z)

    # Water specular shimmer (mat 10, 11, 12)
    specular = 0.0
    if hit_voxel in (10, 11, 12) and normal_z > 0.5 and shadow > 0.5:
        # Halfway vector
        hx = lx - dx
        hy = ly - dy
        hz = lz - dz
        h_len = math.sqrt(hx*hx + hy*hy + hz*hz)
        if h_len > 1e-6:
            n_dot_h = max(0.0, hz / h_len)
            specular = (n_dot_h ** 18.0) * 0.45

    # Voxel edge highlighting: subtle bevel brightness on top horizontal edges
    edge_highlight = 1.0
    if normal_z > 0.5:
        frac_x = abs(cur_x - math.floor(cur_x) - 0.5)
        frac_y = abs(cur_y - math.floor(cur_y) - 0.5)
        if frac_x > 0.46 or frac_y > 0.46:
            edge_highlight = 1.08

    # Final color computation
    amb_r = 0.32 * base_r * skylight * ao
    amb_g = 0.35 * base_g * skylight * ao
    amb_b = 0.40 * base_b * skylight * ao

    sun_factor = diffuse * shadow
    # Warm golden direct sunlight
    sun_r = 0.88 * base_r * sun_factor * 1.08 * edge_highlight
    sun_g = 0.82 * base_g * sun_factor * 1.00 * edge_highlight
    sun_b = 0.70 * base_b * sun_factor * 0.88 * edge_highlight

    final_r = amb_r + sun_r + specular
    final_g = amb_g + sun_g + specular
    final_b = amb_b + sun_b + specular

    # Distance haze (warm mountain mist)
    haze_factor = min(0.30, traveled_dist / 350.0)
    haze_r, haze_g, haze_b = 0.76, 0.81, 0.86
    final_r = final_r * (1.0 - haze_factor) + haze_r * haze_factor
    final_g = final_g * (1.0 - haze_factor) + haze_g * haze_factor
    final_b = final_b * (1.0 - haze_factor) + haze_b * haze_factor

    return min(1.0, final_r), min(1.0, final_g), min(1.0, final_b)


@njit(parallel=True, fastmath=True)
def render_image_jit(grid, palette, sx, sy, sz, width, height,
                     cam_pos, cam_target, cam_up, fov_deg, is_ortho, ortho_scale,
                     sun_dir):
    img = np.zeros((height, width, 3), dtype=np.uint8)

    c_pos_x, c_pos_y, c_pos_z = cam_pos[0], cam_pos[1], cam_pos[2]
    t_pos_x, t_pos_y, t_pos_z = cam_target[0], cam_target[1], cam_target[2]

    fwd_x = t_pos_x - c_pos_x
    fwd_y = t_pos_y - c_pos_y
    fwd_z = t_pos_z - c_pos_z
    fwd_len = math.sqrt(fwd_x*fwd_x + fwd_y*fwd_y + fwd_z*fwd_z)
    fwd_x /= fwd_len
    fwd_y /= fwd_len
    fwd_z /= fwd_len

    up_x, up_y, up_z = cam_up[0], cam_up[1], cam_up[2]
    right_x = fwd_y * up_z - fwd_z * up_y
    right_y = fwd_z * up_x - fwd_x * up_z
    right_z = fwd_x * up_y - fwd_y * up_x
    r_len = math.sqrt(right_x*right_x + right_y*right_y + right_z*right_z)
    right_x /= r_len
    right_y /= r_len
    right_z /= r_len

    true_up_x = right_y * fwd_z - right_z * fwd_y
    true_up_y = right_z * fwd_x - right_x * fwd_z
    true_up_z = right_x * fwd_y - right_y * fwd_x

    aspect = width / height
    fov_rad = fov_deg * (math.pi / 180.0)
    tan_half_fov = math.tan(fov_rad * 0.5)

    lx, ly, lz = sun_dir[0], sun_dir[1], sun_dir[2]
    sun_len = math.sqrt(lx*lx + ly*ly + lz*lz)
    lx /= sun_len
    ly /= sun_len
    lz /= sun_len

    for y in prange(height):
        v = (1.0 - 2.0 * (y + 0.5) / height) * tan_half_fov
        for x in range(width):
            u = (2.0 * (x + 0.5) / width - 1.0) * aspect * tan_half_fov

            if is_ortho:
                uo = (2.0 * (x + 0.5) / width - 1.0) * aspect * ortho_scale
                vo = (1.0 - 2.0 * (y + 0.5) / height) * ortho_scale
                ro_x = c_pos_x + right_x * uo + true_up_x * vo
                ro_y = c_pos_y + right_y * uo + true_up_y * vo
                ro_z = c_pos_z + right_z * uo + true_up_z * vo
                rd_x = fwd_x
                rd_y = fwd_y
                rd_z = fwd_z
            else:
                ro_x = c_pos_x
                ro_y = c_pos_y
                ro_z = c_pos_z
                rd_x = fwd_x + right_x * u + true_up_x * v
                rd_y = fwd_y + right_y * u + true_up_y * v
                rd_z = fwd_z + right_z * u + true_up_z * v
                d_len = math.sqrt(rd_x*rd_x + rd_y*rd_y + rd_z*rd_z)
                rd_x /= d_len
                rd_y /= d_len
                rd_z /= d_len

            r, g, b = cast_ray(
                grid, palette, sx, sy, sz,
                ro_x, ro_y, ro_z,
                rd_x, rd_y, rd_z,
                lx, ly, lz
            )

            img[y, x, 0] = int(r * 255.0)
            img[y, x, 1] = int(g * 255.0)
            img[y, x, 2] = int(b * 255.0)

    return img


def render_view(world, filename, width=1920, height=1080,
                cam_pos=(180, -40, 140), cam_target=(80, 75, 10),
                cam_up=(0, 0, 1), fov_deg=45.0, is_ortho=False, ortho_scale=70.0,
                sun_dir=(0.55, -0.40, 0.75)):
    print(f"Rendering {filename} ({width}x{height})...")
    t0 = time.time()

    cam_pos_arr = np.array(cam_pos, dtype=np.float32)
    cam_target_arr = np.array(cam_target, dtype=np.float32)
    cam_up_arr = np.array(cam_up, dtype=np.float32)
    sun_dir_arr = np.array(sun_dir, dtype=np.float32)

    img_data = render_image_jit(
        world.grid, PALETTE_ARRAY,
        world.sx, world.sy, world.sz,
        width, height,
        cam_pos_arr, cam_target_arr, cam_up_arr,
        fov_deg, is_ortho, ortho_scale,
        sun_dir_arr
    )

    im = Image.fromarray(img_data)
    out_dir = os.path.dirname(os.path.abspath(__file__))
    out_path = os.path.join(out_dir, filename)
    im.save(out_path, format="PNG", quality=95)
    t1 = time.time()
    print(f"Saved {out_path} in {t1 - t0:.2f} seconds.")


def main():
    print("Initializing Hakka Tulou Village Voxel Scene for rendering...")
    world = gv.VoxelWorld(gv.GRID_X, gv.GRID_Y, gv.GRID_Z)

    gv.generate_terrain(world)
    gv.generate_water_and_terraces(world)
    gv.generate_roads_and_plaza(world)
    gv.build_tulou_1_main(world)
    gv.build_tulou_2_secondary(world)
    gv.build_tulou_3_square(world)
    gv.build_ancestral_hall(world)
    gv.build_hakka_houses(world)
    gv.add_vegetation(world)
    gv.add_props_and_characters(world)

    print("Compiling Numba JIT kernels...")
    _ = render_image_jit(
        world.grid, PALETTE_ARRAY,
        world.sx, world.sy, world.sz,
        64, 36,
        np.array([100, -20, 80], dtype=np.float32),
        np.array([80, 80, 10], dtype=np.float32),
        np.array([0, 0, 1], dtype=np.float32),
        45.0, False, 70.0,
        np.array([0.5, -0.4, 0.7], dtype=np.float32)
    )
    print("Numba JIT compilation ready!")

    # 1. Main Display View: 3/4 Elevated Isometric View (shot01_isometric_main.png)
    # Perfect isometric diorama framing with warm sunlight and crisp shadows
    render_view(
        world,
        "shot01_isometric_main.png",
        width=1920, height=1080,
        cam_pos=(220, -50, 155),
        cam_target=(80, 75, 8),
        cam_up=(0, 0, 1),
        fov_deg=38.0,
        is_ortho=True,
        ortho_scale=76.0,
        sun_dir=(0.58, -0.40, 0.72)
    )

    # 2. Full Diorama Overview (shot01_full_diorama.png)
    # Wide 3/4 elevated perspective highlighting the entire valley settlement
    render_view(
        world,
        "shot01_full_diorama.png",
        width=1920, height=1080,
        cam_pos=(195, -55, 140),
        cam_target=(78, 70, 6),
        cam_up=(0, 0, 1),
        fov_deg=44.0,
        is_ortho=False,
        ortho_scale=75.0,
        sun_dir=(0.60, -0.38, 0.70)
    )

    # 3. Tulou Close-Up Detail (shot01_tulou_detail.png)
    # Intimate 3/4 elevated view looking right into Core Tulou #1:
    # Rammed earth walls, tile roofs, entrance portal, 3-tier wooden corridors, central ancestral shrine, well
    render_view(
        world,
        "shot01_tulou_detail.png",
        width=1920, height=1080,
        cam_pos=(102, 46, 38),
        cam_target=(78, 86, 12),
        cam_up=(0, 0, 1),
        fov_deg=46.0,
        is_ortho=False,
        ortho_scale=38.0,
        sun_dir=(0.38, -0.58, 0.72)
    )

    # 4. Village Relations View (shot01_village_relations.png)
    # High 3/4 axonometric perspective from the south showing the clear spatial relationship:
    # 3 Tulou + Ancestral Hall + Plaza + House clusters + Road network + River
    render_view(
        world,
        "shot01_village_relations.png",
        width=1920, height=1080,
        cam_pos=(80, -35, 125),
        cam_target=(80, 78, 8),
        cam_up=(0, 0, 1),
        fov_deg=42.0,
        is_ortho=False,
        ortho_scale=72.0,
        sun_dir=(0.56, -0.38, 0.74)
    )

    print("All 4 diorama renders completed successfully!")


if __name__ == "__main__":
    main()
