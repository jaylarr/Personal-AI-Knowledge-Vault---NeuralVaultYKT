import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { HalfFloatType, UnsignedByteType, Vector2, WebGLRenderTarget } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { QUALITY_PROFILES, type RenderQuality } from "./render-quality.js";

export function GraphPostProcessing({
  quality,
  intensity,
}: {
  quality: RenderQuality;
  intensity: number;
}) {
  const { gl, scene, camera, size, invalidate, viewport } = useThree();
  const pipeline = useMemo(() => {
    if (quality === "low") return null;
    const halfFloat = gl.extensions.has("EXT_color_buffer_float");
    const target = new WebGLRenderTarget(1, 1, {
      type: halfFloat ? HalfFloatType : UnsignedByteType,
      samples: Math.min(QUALITY_PROFILES[quality].samples, gl.capabilities.maxSamples),
      depthBuffer: true,
      stencilBuffer: false,
    });
    const composer = new EffectComposer(gl, target),
      render = new RenderPass(scene, camera),
      output = new OutputPass();
    const bloom = halfFloat ? new UnrealBloomPass(new Vector2(1, 1), 0.65, 0.35, 0.45) : null;
    composer.addPass(render);
    if (bloom) composer.addPass(bloom);
    composer.addPass(output);
    return { composer, render, bloom, output, target };
  }, [gl, scene, camera, quality]);
  useEffect(() => {
    gl.info.autoReset = false;
    return () => {
      gl.info.autoReset = true;
      pipeline?.bloom?.dispose();
      pipeline?.render.dispose();
      pipeline?.output.dispose();
      pipeline?.composer.dispose();
    };
  }, [gl, pipeline]);
  useEffect(() => {
    if (pipeline) {
      pipeline.composer.setPixelRatio(viewport.dpr);
      pipeline.composer.setSize(size.width, size.height);
      if (pipeline.bloom) pipeline.bloom.strength = intensity;
    }
    const host = gl.domElement.closest<HTMLElement>(".neural-graph");
    if (host) {
      const buffer = gl.getDrawingBufferSize(new Vector2());
      host.dataset.effectiveDpr = String(viewport.dpr);
      host.dataset.bufferWidth = String(buffer.x);
      host.dataset.bufferHeight = String(buffer.y);
      host.dataset.composerWidth = String(pipeline?.composer.renderTarget1.width ?? 0);
      host.dataset.composerHeight = String(pipeline?.composer.renderTarget1.height ?? 0);
      host.dataset.composerSamples = String(pipeline?.target.samples ?? 0);
    }
    invalidate();
  }, [pipeline, size, viewport.dpr, gl, intensity, invalidate]);
  useFrame(() => {
    gl.info.reset();
    if (pipeline) pipeline.composer.render();
    else gl.render(scene, camera);
  }, 1);
  return null;
}
