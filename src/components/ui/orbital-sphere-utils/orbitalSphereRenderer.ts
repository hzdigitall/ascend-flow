export type OrbitalSphereOptions = {
  /** Number of particles on the sphere surface */
  particleCount: number;
  /** Number of orbital rings */
  ringCount: number;
  /** Particles per ring */
  ringParticles: number;
  /** Sphere radius as a fraction of the smallest canvas side */
  radiusRatio: number;
  /** Rotation speed in radians per frame */
  speed: number;
  /** Main particle color */
  color: string;
  /** Secondary / ring color */
  accentColor: string;
  /** Bright node color */
  nodeColor: string;
  /** Global opacity multiplier */
  opacity: number;
};

export const ORBITAL_SPHERE_DEFAULTS: OrbitalSphereOptions = {
  particleCount: 900,
  ringCount: 3,
  ringParticles: 160,
  radiusRatio: 0.36,
  speed: 0.0022,
  color: "#FB096E",
  accentColor: "#9F0B35",
  nodeColor: "#FA238A",
  opacity: 0.9,
};

type Point3 = { x: number; y: number; z: number; node: boolean; ring: boolean };

function buildPoints(options: OrbitalSphereOptions): Point3[] {
  const points: Point3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < options.particleCount; i++) {
    const y = 1 - (i / Math.max(1, options.particleCount - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    points.push({
      x: Math.cos(theta) * r,
      y,
      z: Math.sin(theta) * r,
      node: i % 37 === 0,
      ring: false,
    });
  }

  for (let ring = 0; ring < options.ringCount; ring++) {
    const tilt = (Math.PI / (options.ringCount + 1)) * (ring + 1) - Math.PI / 2;
    const scale = 1.18 + ring * 0.1;
    for (let i = 0; i < options.ringParticles; i++) {
      const a = (i / options.ringParticles) * Math.PI * 2;
      const x = Math.cos(a) * scale;
      const z = Math.sin(a) * scale;
      points.push({
        x,
        y: z * Math.sin(tilt),
        z: z * Math.cos(tilt),
        node: i % 24 === 0,
        ring: true,
      });
    }
  }

  return points;
}

export function createOrbitalSphereRenderer(
  canvas: HTMLCanvasElement,
  getOptions: () => OrbitalSphereOptions,
) {
  const ctx = canvas.getContext("2d");
  let width = 0;
  let height = 0;
  let dpr = 1;
  let angle = 0;
  let points = buildPoints(getOptions());
  let signature = pointSignature(getOptions());

  function pointSignature(o: OrbitalSphereOptions) {
    return `${o.particleCount}-${o.ringCount}-${o.ringParticles}`;
  }

  return {
    resize(nextWidth: number, nextHeight: number) {
      // Limita a resolução do canvas: 1.5x já é nítido e reduz muito o custo por frame no mobile.
      dpr = Math.min(1.5, globalThis.devicePixelRatio || 1);
      width = Math.max(1, nextWidth);
      height = Math.max(1, nextHeight);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    },
    render() {
      if (!ctx) return;
      const options = getOptions();
      const nextSignature = pointSignature(options);
      if (nextSignature !== signature) {
        signature = nextSignature;
        points = buildPoints(options);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * options.radiusRatio;

      angle += options.speed;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const tiltCos = Math.cos(0.42);
      const tiltSin = Math.sin(0.42);

      for (const p of points) {
        // rotate around Y then tilt around X
        const rx = p.x * cosA - p.z * sinA;
        const rz = p.x * sinA + p.z * cosA;
        const ry = p.y * tiltCos - rz * tiltSin;
        const rz2 = p.y * tiltSin + rz * tiltCos;

        const perspective = 1 / (2.6 - rz2);
        const sx = cx + rx * radius * perspective * 2.6;
        const sy = cy + ry * radius * perspective * 2.6;

        const depth = (rz2 + 1.4) / 2.8;
        const alpha = Math.max(0, Math.min(1, depth * depth)) * options.opacity;
        const size = (p.node ? 1.9 : p.ring ? 0.9 : 1.1) * (0.5 + depth);

        ctx.globalAlpha = p.ring ? alpha * 0.75 : alpha;
        ctx.fillStyle = p.node ? options.nodeColor : p.ring ? options.accentColor : options.color;

        if (p.node) {
          ctx.shadowBlur = 12 * depth;
          ctx.shadowColor = options.nodeColor;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    },
    dispose() {
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
