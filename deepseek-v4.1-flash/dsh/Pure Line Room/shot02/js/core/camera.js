// camera.js — orbit camera for looking into the cut-away room.
//
// The camera lives OUTSIDE the room box and always looks at a point inside it.
// Because the room shell is drawn with back-face culling against the camera,
// the walls between us and the room simply disappear — a doll-house section.

import { m4lookAt } from './math3d.js';
import { clamp, lerp } from './math3d.js';
import { damp } from './anim.js';

export class OrbitCamera {
  constructor(opts) {
    const o = opts || {};
    this.target = o.target ? o.target.slice() : [0, 1.32, 0];
    this.yaw = o.yaw === undefined ? 0.62 : o.yaw;
    this.pitch = o.pitch === undefined ? 0.37 : o.pitch;
    this.radius = o.radius === undefined ? 12.4 : o.radius;
    this.fov = o.fov === undefined ? 30 : o.fov;

    // smoothed values actually used for rendering
    this.sYaw = this.yaw;
    this.sPitch = this.pitch;
    this.sRadius = this.radius;
    this.sTarget = this.target.slice();

    this.minPitch = o.minPitch === undefined ? 0.045 : o.minPitch;
    this.maxPitch = o.maxPitch === undefined ? 1.02 : o.maxPitch;
    this.minRadius = o.minRadius === undefined ? 7.4 : o.minRadius;
    this.maxRadius = o.maxRadius === undefined ? 19.5 : o.maxRadius;
    this.minYaw = -2.6;
    this.maxYaw = 2.6;

    this.eye = [0, 0, 0];
    this.view = m4lookAt([0, 0, 12], [0, 0, 0], [0, 1, 0]);
    this.k = 400;
    this.w = 1; this.h = 1;

    // idle drift
    this.driftAmp = o.driftAmp === undefined ? 0.028 : o.driftAmp;
    this.idle = 0;
    this.now = 0;
  }

  /** instantaneous (unsmoothed) eye position */
  _eye(yaw, pitch, radius) {
    const cp = Math.cos(pitch);
    return [
      this.target[0] + radius * cp * Math.sin(yaw),
      this.target[1] + radius * Math.sin(pitch),
      this.target[2] + radius * cp * Math.cos(yaw),
    ];
  }

  orbit(dyaw, dpitch) {
    this.yaw = clamp(this.yaw + dyaw, this.minYaw, this.maxYaw);
    this.pitch = clamp(this.pitch + dpitch, this.minPitch, this.maxPitch);
    this.idle = 0;
  }

  zoom(factor) {
    this.radius = clamp(this.radius * factor, this.minRadius, this.maxRadius);
    this.idle = 0;
  }

  pan(dx, dy) {
    // slide the look-at point along the camera's right / up axes, clamped to the room
    const cp = Math.cos(this.sPitch);
    const fx = -cp * Math.sin(this.sYaw), fy = -Math.sin(this.sPitch), fz = -cp * Math.cos(this.sYaw);
    let rx = fz, ry = 0, rz = -fx;
    const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
    const ux = -fy * rz, uy = fx * rz - fz * rx, uz = fy * rx;
    this.target[0] = clamp(this.target[0] + rx * dx + ux * dy, -2.2, 2.2);
    this.target[1] = clamp(this.target[1] + ry * dx + uy * dy, 0.5, 2.2);
    this.target[2] = clamp(this.target[2] + rz * dx + uz * dy, -1.8, 1.8);
    this.idle = 0;
  }

  update(dt, cssW, cssH, opts) {
    const o = opts || {};
    this.now += dt;
    this.idle += dt;
    const settled = this.idle > 3.2 && !o.busy;
    const drift = settled ? this.driftAmp : 0;

    const tYaw = this.yaw + Math.sin(this.now * 0.11) * drift;
    const tPitch = this.pitch + Math.sin(this.now * 0.083 + 1.7) * drift * 0.55;

    const lam = o.snap ? 1000 : 7.5;
    this.sYaw = damp(this.sYaw, tYaw, lam, dt);
    this.sPitch = damp(this.sPitch, tPitch, lam, dt);
    this.sRadius = damp(this.sRadius, this.radius, lam, dt);
    for (let i = 0; i < 3; i++) this.sTarget[i] = damp(this.sTarget[i], this.target[i], lam, dt);

    const cp = Math.cos(this.sPitch);
    const r = this.sRadius;
    this.eye[0] = this.sTarget[0] + r * cp * Math.sin(this.sYaw);
    this.eye[1] = this.sTarget[1] + r * Math.sin(this.sPitch);
    this.eye[2] = this.sTarget[2] + r * cp * Math.cos(this.sYaw);

    this.view = m4lookAt(this.eye, this.sTarget, [0, 1, 0]);
    this.w = cssW; this.h = cssH;
    this.k = (cssH / 2) / Math.tan((this.fov * Math.PI / 180) / 2);
  }

  /** frame a point: smoothly aim the camera at a world position */
  lookAtPoint(p, radius) {
    this.target[0] = clamp(p[0], -2.2, 2.2);
    this.target[1] = clamp(p[1], 0.5, 2.2);
    this.target[2] = clamp(p[2], -1.8, 1.8);
    if (radius !== undefined) this.radius = clamp(radius, this.minRadius, this.maxRadius);
  }
}

export default OrbitCamera;
