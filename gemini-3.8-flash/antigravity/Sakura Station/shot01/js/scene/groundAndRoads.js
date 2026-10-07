import * as THREE from 'three';
import { ToonMaterialFactory } from '../materials/toonShader.js';
import { TextureGenerator } from '../materials/textureGenerator.js';

// Ground, Curving Asphalt Streets, Sidewalks, Drainage Gutters & Markings
export class GroundAndRoads {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'ground_and_roads';

    this.init();
  }

  init() {
    this.createBaseTerrain();
    this.createEmbankmentSlope();
    this.createMainStreet();
    this.createSidewalksAndCurbs();
    this.createDrainageGutters();
    this.createRoadMarkings();
    this.createManholes();

    this.scene.add(this.group);
  }

  createBaseTerrain() {
    // Vast grassy base ground with soft anime matcha/spring green
    const groundMat = ToonMaterialFactory.getToonMaterial({
      color: 0x93be72, // Soft anime spring green
      side: THREE.DoubleSide
    });

    const groundGeo = new THREE.PlaneGeometry(320, 320);
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  createEmbankmentSlope() {
    // Green riverbank / slope north of the railway tracks (Z < -25)
    const slopeMat = ToonMaterialFactory.getToonMaterial({
      color: 0x7fae61,
      side: THREE.DoubleSide
    });

    // Tiered green hill embankment
    const slopeGeo = new THREE.BoxGeometry(260, 10, 45);
    const slope = new THREE.Mesh(slopeGeo, slopeMat);
    slope.position.set(0, 1.5, -44);
    slope.receiveShadow = true;
    this.group.add(slope);

    // Stone retaining wall base (拥壁)
    const wallMat = ToonMaterialFactory.getToonMaterial({
      color: 0xb8bcc4,
      side: THREE.DoubleSide
    });
    const wallGeo = new THREE.BoxGeometry(260, 2.5, 1.5);
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(0, 1.0, -21.5);
    wall.receiveShadow = true;
    this.group.add(wall);
  }

  createMainStreet() {
    // Deep anime asphalt material (DoubleSide, robust rendering)
    const roadMat = ToonMaterialFactory.getToonMaterial({
      color: 0x383c44, // Deep weathered asphalt gray
      side: THREE.DoubleSide
    });

    // Street segment curve: From South foreground (Z = 58) past Crossing (Z = -16.5) to Embankment (Z = -40)
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(8.5, 0.04, 60),
      new THREE.Vector3(9.0, 0.04, 40),
      new THREE.Vector3(11.5, 0.04, 18),
      new THREE.Vector3(16.5, 0.04, 0),
      new THREE.Vector3(22.0, 0.04, -16.5), // Railroad Crossing
      new THREE.Vector3(23.5, 0.04, -36)   // Past crossing
    ]);

    const points = curve.getPoints(60);
    const roadWidth = 7.6;
    const vertices = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      let tangent;
      if (i < points.length - 1) {
        tangent = new THREE.Vector3().subVectors(points[i + 1], p).normalize();
      } else {
        tangent = new THREE.Vector3().subVectors(p, points[i - 1]).normalize();
      }
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      // Left vertex
      const leftP = new THREE.Vector3().addVectors(p, normal.clone().multiplyScalar(roadWidth / 2));
      // Right vertex
      const rightP = new THREE.Vector3().addVectors(p, normal.clone().multiplyScalar(-roadWidth / 2));

      vertices.push(leftP.x, leftP.y, leftP.z);
      vertices.push(rightP.x, rightP.y, rightP.z);

      const v = i / (points.length - 1);
      uvs.push(0, v * 15);
      uvs.push(1, v * 15);

      if (i < points.length - 1) {
        const row1 = i * 2;
        const row2 = (i + 1) * 2;
        // Counter-clockwise winding so normal faces UP (+Y)
        indices.push(row1, row2, row1 + 1);
        indices.push(row1 + 1, row2, row2 + 1);
      }
    }

    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    roadGeo.setIndex(indices);
    roadGeo.computeVertexNormals();

    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.receiveShadow = true;
    this.group.add(roadMesh);

    // Feeder road connecting Station Plaza to Main Street
    const feederGeo = new THREE.PlaneGeometry(16, 7.6);
    const feeder = new THREE.Mesh(feederGeo, roadMat);
    feeder.rotation.x = -Math.PI / 2;
    feeder.position.set(3.5, 0.041, 7.0);
    feeder.receiveShadow = true;
    this.group.add(feeder);

    // Yellow / Orange Center Line (DoubleSide, CCW winding)
    const centerMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });
    const centerLineGeo = new THREE.BufferGeometry();
    const cVerts = [];
    const cIndices = [];

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      let tangent = (i < points.length - 1)
        ? new THREE.Vector3().subVectors(points[i + 1], p).normalize()
        : new THREE.Vector3().subVectors(p, points[i - 1]).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      const l = new THREE.Vector3().addVectors(p, normal.clone().multiplyScalar(0.1));
      const r = new THREE.Vector3().addVectors(p, normal.clone().multiplyScalar(-0.1));
      cVerts.push(l.x, l.y + 0.005, l.z);
      cVerts.push(r.x, r.y + 0.005, r.z);

      if (i < points.length - 1) {
        const row1 = i * 2;
        const row2 = (i + 1) * 2;
        cIndices.push(row1, row2, row1 + 1);
        cIndices.push(row1 + 1, row2, row2 + 1);
      }
    }
    centerLineGeo.setAttribute('position', new THREE.Float32BufferAttribute(cVerts, 3));
    centerLineGeo.setIndex(cIndices);
    const centerLine = new THREE.Mesh(centerLineGeo, centerMat);
    this.group.add(centerLine);

    // White Edge Lines
    const whiteLineMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc, side: THREE.DoubleSide });
    [-roadWidth / 2 + 0.35, roadWidth / 2 - 0.35].forEach(offsetDist => {
      const edgeGeo = new THREE.BufferGeometry();
      const eVerts = [];
      const eIndices = [];

      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        let tangent = (i < points.length - 1)
          ? new THREE.Vector3().subVectors(points[i + 1], p).normalize()
          : new THREE.Vector3().subVectors(p, points[i - 1]).normalize();
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        const center = new THREE.Vector3().addVectors(p, normal.clone().multiplyScalar(offsetDist));

        const l = new THREE.Vector3().addVectors(center, normal.clone().multiplyScalar(0.08));
        const r = new THREE.Vector3().addVectors(center, normal.clone().multiplyScalar(-0.08));
        eVerts.push(l.x, l.y + 0.005, l.z);
        eVerts.push(r.x, r.y + 0.005, r.z);

        if (i < points.length - 1) {
          const row1 = i * 2;
          const row2 = (i + 1) * 2;
          eIndices.push(row1, row2, row1 + 1);
          eIndices.push(row1 + 1, row2, row2 + 1);
        }
      }
      edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(eVerts, 3));
      edgeGeo.setIndex(eIndices);
      const edgeLine = new THREE.Mesh(edgeGeo, whiteLineMat);
      this.group.add(edgeLine);
    });
  }

  createSidewalksAndCurbs() {
    const sidewalkMat = ToonMaterialFactory.getToonMaterial({
      color: 0xcbd5e1, // Concrete sidewalk
      side: THREE.DoubleSide
    });

    const curbMat = ToonMaterialFactory.getToonMaterial({
      color: 0x94a3b8,
      side: THREE.DoubleSide
    });

    // West Sidewalk (X = 3.6 to 5.2, Z = 12 to 58)
    const swWest = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.16, 46),
      sidewalkMat
    );
    swWest.position.set(3.8, 0.08, 35);
    swWest.receiveShadow = true;
    this.group.add(swWest);

    // East Sidewalk (X = 13.8 to 15.6, Z = 12 to 58)
    const swEast = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.16, 46),
      sidewalkMat
    );
    swEast.position.set(14.0, 0.08, 35);
    swEast.receiveShadow = true;
    this.group.add(swEast);

    // Curbs
    const curbW = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 46), curbMat);
    curbW.position.set(4.95, 0.09, 35);
    this.group.add(curbW);

    const curbE = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 46), curbMat);
    curbE.position.set(12.85, 0.09, 35);
    this.group.add(curbE);
  }

  createDrainageGutters() {
    const gutterMat = ToonMaterialFactory.getToonMaterial({ color: 0x475569 });
    const grateMat = ToonMaterialFactory.getToonMaterial({ color: 0x1e293b });

    [-1, 1].forEach(side => {
      const posX = side === -1 ? 5.15 : 12.65;

      const channel = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 44), gutterMat);
      channel.position.set(posX, 0.04, 35);
      this.group.add(channel);

      // Grates spaced periodically
      for (let z = 16; z <= 54; z += 6) {
        const grate = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.9), grateMat);
        grate.position.set(posX, 0.085, z);
        this.group.add(grate);

        // Fallen sakura petals caught in grate
        const trapped = new THREE.Mesh(
          new THREE.PlaneGeometry(0.22, 0.5),
          new THREE.MeshBasicMaterial({ color: 0xf472b6, side: THREE.DoubleSide })
        );
        trapped.rotation.x = -Math.PI / 2;
        trapped.position.set(posX, 0.108, z + 0.1);
        this.group.add(trapped);
      }
    });
  }

  createRoadMarkings() {
    // 1. "止まれ" Road Marking
    const tomareTex = TextureGenerator.createTomareRoadTexture();
    const tomareMat = new THREE.MeshBasicMaterial({
      map: tomareTex,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const tomareMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 7.2),
      tomareMat
    );
    tomareMesh.rotation.x = -Math.PI / 2;
    tomareMesh.rotation.z = -0.28;
    tomareMesh.position.set(20.0, 0.052, -7.0);
    this.group.add(tomareMesh);

    // 2. Crosswalk (Zebra stripes) near Plaza entrance
    const crosswalkTex = TextureGenerator.createCrosswalkTexture();
    const crosswalkMat = new THREE.MeshBasicMaterial({
      map: crosswalkTex,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const crosswalkMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(7.2, 3.6),
      crosswalkMat
    );
    crosswalkMesh.rotation.x = -Math.PI / 2;
    crosswalkMesh.rotation.z = -0.15;
    crosswalkMesh.position.set(11.5, 0.052, 12);
    this.group.add(crosswalkMesh);
  }

  createManholes() {
    const manholeTex = TextureGenerator.createManholeTexture();
    const manholeMat = new THREE.MeshBasicMaterial({
      map: manholeTex,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const positions = [
      { x: 7.2, z: 28 },
      { x: 13.8, z: 42 },
      { x: 15.2, z: 2 }
    ];

    positions.forEach(pos => {
      const mh = new THREE.Mesh(new THREE.CircleGeometry(0.48, 24), manholeMat);
      mh.rotation.x = -Math.PI / 2;
      mh.position.set(pos.x, 0.051, pos.z);
      this.group.add(mh);
    });
  }
}
