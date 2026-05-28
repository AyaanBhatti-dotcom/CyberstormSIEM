import { cn } from '@/lib/utils';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type DottedSurfaceTheme = 'dark' | 'light';

type DottedSurfaceProps = Omit<React.ComponentProps<'div'>, 'ref'> & {
  /** Matches Cyberstorm SIEM default; light available for future use */
  surfaceTheme?: DottedSurfaceTheme;
};

function particleColor(ix: number, iy: number, surfaceTheme: DottedSurfaceTheme): [number, number, number] {
  if (surfaceTheme === 'light') {
    return [20, 20, 20];
  }
  const mix = (ix + iy) % 6;
  if (mix === 0) return [220, 38, 38];
  if (mix === 1) return [255, 255, 255];
  if (mix === 2) return [185, 28, 28];
  return [90, 90, 90];
}

export function DottedSurface({
  className,
  surfaceTheme = 'dark',
  ...props
}: DottedSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    animationId: number;
  } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const SEPARATION = 150;
    const AMOUNTX = 40;
    const AMOUNTY = 60;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(surfaceTheme === 'dark' ? 0x000000 : 0xffffff, 2000, 10000);

    const camera = new THREE.PerspectiveCamera(60, 1, 1, 10000);
    camera.position.set(0, 355, 1220);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(scene.fog.color, 0);

    container.appendChild(renderer.domElement);

    const positions: number[] = [];
    const colors: number[] = [];

    const geometry = new THREE.BufferGeometry();

    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        const x = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2;
        const z = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2;
        positions.push(x, 0, z);
        const [r, g, b] = particleColor(ix, iy, surfaceTheme);
        colors.push(r, g, b);
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 6,
      vertexColors: true,
      transparent: true,
      opacity: surfaceTheme === 'dark' ? 0.55 : 0.75,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    let count = 0;
    let animationId = 0;

    const setSize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    setSize();

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      const positionAttribute = geometry.attributes.position;
      const posArray = positionAttribute.array as Float32Array;

      let i = 0;
      for (let ix = 0; ix < AMOUNTX; ix++) {
        for (let iy = 0; iy < AMOUNTY; iy++) {
          const index = i * 3;
          posArray[index + 1] =
            Math.sin((ix + count) * 0.3) * 50 + Math.sin((iy + count) * 0.5) * 50;
          i++;
        }
      }

      positionAttribute.needsUpdate = true;
      renderer.render(scene, camera);
      count += 0.1;
    };

    animate();

    const handleResize = () => setSize();
    window.addEventListener('resize', handleResize);

    sceneRef.current = { renderer, animationId };

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);

      geometry.dispose();
      material.dispose();
      renderer.dispose();

      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }

      sceneRef.current = null;
    };
  }, [surfaceTheme]);

  return (
    <div
      ref={containerRef}
      className={cn('pointer-events-none fixed inset-0 -z-10', className)}
      aria-hidden
      {...props}
    />
  );
}
