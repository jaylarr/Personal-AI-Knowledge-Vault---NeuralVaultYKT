import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, type ReactNode, useEffect, useRef, useState } from "react";
import { MOUSE, PerspectiveCamera, TOUCH, Vector3 } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { GRAPH_THEME } from "./graph-theme.js";
import { QUALITY_PROFILES, type RenderQuality } from "./render-quality.js";

export type CameraCommand = {
  kind: "fit" | "reset" | "focus" | "zoom" | "reveal" | "restore";
  position?: [number, number, number];
  point?: [number, number, number];
  radius?: number;
  factor?: number;
  serial: number;
};

class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function CameraRig({
  command,
  radius,
  reduced,
  pan,
  rotate,
  onControls,
}: {
  command: CameraCommand;
  radius: number;
  reduced: boolean;
  pan: boolean;
  rotate: boolean;
  onControls: (controls: OrbitControls | null) => void;
}) {
  const { camera, gl, invalidate, size } = useThree();
  const controls = useRef<OrbitControls | null>(null);
  const applied = useRef(-1);
  const transition = useRef<{
    start: number;
    from: Vector3;
    to: Vector3;
    fromTarget: Vector3;
    toTarget: Vector3;
  } | null>(null);
  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.06;
    orbit.rotateSpeed = 0.45;
    orbit.zoomSpeed = 0.7;
    orbit.minDistance = 4;
    orbit.maxDistance = Math.max(100, radius * 8);
    orbit.screenSpacePanning = true;
    controls.current = orbit;
    onControls(orbit);
    const start = () => {
      transition.current = null;
      invalidate();
    };
    const change = () => invalidate();
    orbit.addEventListener("start", start);
    orbit.addEventListener("change", change);
    return () => {
      orbit.removeEventListener("start", start);
      orbit.removeEventListener("change", change);
      orbit.dispose();
      controls.current = null;
      onControls(null);
    };
  }, [camera, gl, invalidate, onControls, radius]);
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    c.mouseButtons.LEFT = pan ? MOUSE.PAN : MOUSE.ROTATE;
    c.touches.ONE = pan ? TOUCH.PAN : TOUCH.ROTATE;
    c.touches.TWO = TOUCH.DOLLY_PAN;
    c.enableDamping = !reduced;
  }, [pan, reduced]);
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    if (applied.current === command.serial && command.kind !== "fit" && command.kind !== "reset")
      return;
    applied.current = command.serial;
    if (command.kind === "restore" && command.position && command.point) {
      transition.current = null;
      camera.position.fromArray(command.position);
      c.target.fromArray(command.point);
      const distance = camera.position.distanceTo(c.target);
      c.maxDistance = Math.max(100, distance * 4, radius * 8);
      if (camera instanceof PerspectiveCamera) {
        camera.far = Math.max(500, distance + radius * 4);
        camera.updateProjectionMatrix();
      }
      c.update();
      invalidate();
      return;
    }
    const target = new Vector3(...(command.point ?? [0, 0, 0]));
    const direction =
      command.kind === "reset"
        ? new Vector3(0, 3, 38).normalize()
        : camera.position.clone().sub(c.target).normalize();
    const distance =
      command.kind === "zoom"
        ? camera.position.distanceTo(c.target) / (command.factor ?? 1)
        : command.kind === "reveal"
          ? camera.position.distanceTo(c.target)
          : command.kind === "focus"
            ? Math.max(8, Math.min(radius, 16))
            : Math.max(
                10,
                ((command.radius ?? radius) /
                  Math.sin(
                    Math.min(
                      (55 * Math.PI) / 360,
                      Math.atan(
                        Math.tan((55 * Math.PI) / 360) *
                          Math.max(0.1, size.width / Math.max(1, size.height)),
                      ),
                    ),
                  )) *
                  1.12,
              );
    if (camera instanceof PerspectiveCamera) {
      camera.far = Math.max(500, distance + (command.radius ?? radius) * 4);
      camera.updateProjectionMatrix();
    }
    c.maxDistance = Math.max(100, distance * 4, radius * 8);
    if (command.kind === "zoom") target.copy(c.target);
    const to = target.clone().addScaledVector(direction, distance);
    if (reduced) {
      camera.position.copy(to);
      c.target.copy(target);
      c.update();
      transition.current = null;
    } else
      transition.current = {
        start: performance.now(),
        from: camera.position.clone(),
        to,
        fromTarget: c.target.clone(),
        toTarget: target,
      };
    invalidate();
  }, [command, camera, radius, reduced, invalidate, size.width, size.height]);
  useFrame((_, delta) => {
    const c = controls.current;
    if (!c) return;
    c.autoRotate = rotate && !reduced;
    c.autoRotateSpeed = 0.01;
    const t = transition.current;
    if (t) {
      const p = Math.min(1, (performance.now() - t.start) / 650);
      const ease = p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
      camera.position.lerpVectors(t.from, t.to, ease);
      c.target.lerpVectors(t.fromTarget, t.toTarget, ease);
      if (p === 1) transition.current = null;
      invalidate();
    }
    c.update(delta);
    if (rotate && !reduced) invalidate();
  });
  return null;
}

export function GraphCanvas({
  children,
  quality,
  running,
  fallback,
  onLost,
  onRestore,
}: {
  children: ReactNode;
  quality: RenderQuality;
  running: boolean;
  fallback: ReactNode;
  onLost: () => void;
  onRestore: () => void;
}) {
  const [supported] = useState(() => {
    try {
      const probe = document.createElement("canvas");
      const context = probe.getContext("webgl2");
      context?.getExtension("WEBGL_lose_context")?.loseContext();
      return Boolean(context);
    } catch {
      return false;
    }
  });
  if (!supported) return fallback;
  return (
    <SceneBoundary fallback={fallback}>
      <Canvas
        camera={{ fov: 55, near: 0.1, far: 500, position: [0, 3, 38] }}
        dpr={[1, QUALITY_PROFILES[quality].dprCap]}
        frameloop={running ? "always" : "demand"}
        gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
        fallback={fallback}
      >
        <ContextEvents onLost={onLost} onRestore={onRestore} />
        <color attach="background" args={[GRAPH_THEME.background]} />
        <fogExp2 attach="fog" args={[GRAPH_THEME.fog, 0.004]} />
        {children}
      </Canvas>
    </SceneBoundary>
  );
}

function ContextEvents({ onLost, onRestore }: { onLost: () => void; onRestore: () => void }) {
  const { gl } = useThree();
  useEffect(() => {
    const c = gl.domElement;
    c.setAttribute("aria-label", "Interactive 3D knowledge graph");
    const priorError = gl.debug.onShaderError;
    gl.debug.onShaderError = () => onLost();
    const lost = (event: Event) => {
      event.preventDefault();
      onLost();
    };
    c.addEventListener("webglcontextlost", lost);
    c.addEventListener("webglcontextrestored", onRestore);
    return () => {
      gl.debug.onShaderError = priorError;
      c.removeEventListener("webglcontextlost", lost);
      c.removeEventListener("webglcontextrestored", onRestore);
    };
  }, [gl, onLost, onRestore]);
  return null;
}
