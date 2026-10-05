"use client";

import { useEffect, useRef } from "react";
import type { HeroGlassConfig } from "@/lib/ui-lab/hero-glass";

const vertexSource = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() { vUv = aPosition * .5 + .5; gl_Position = vec4(aPosition, 0., 1.); }
`;

const fragmentSource = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uImage;
uniform vec2 uStage, uRectPosition, uRectSize, uImageSize, uPointer;
uniform float uSaturation, uRefraction;
vec2 sourceUv(vec2 local) {
  vec2 stage = uRectPosition + vec2(local.x, 1. - local.y) * uRectSize;
  float scale = max(uStage.x / uImageSize.x, uStage.y / uImageSize.y);
  vec2 drawn = uImageSize * scale;
  vec2 offset = (uStage - drawn) * .5;
  return vec2((stage.x - offset.x) / drawn.x, 1. - (stage.y - offset.y) / drawn.y);
}
void main() {
  vec2 p = (vUv - .5) * uRectSize;
  vec2 pointer = (uPointer - .5) * uRectSize;
  float radius = length(p / vec2(uRectSize.x * .75, uRectSize.y * .75));
  float envelope = pow(max(0., 1. - radius), 1.5);
  vec2 direction = normalize(p - pointer * .18 + vec2(.001));
  vec2 warped = vUv + direction * (uRefraction * envelope) / uRectSize;
  vec3 rgb = texture2D(uImage, clamp(sourceUv(warped), 0., 1.)).rgb;
  float gray = dot(rgb, vec3(.2126, .7152, .0722));
  rgb = mix(vec3(gray), rgb, uSaturation);
  float shade = mix(.70, .38, clamp((uRectPosition.x + vUv.x * uRectSize.x) / uStage.x, 0., 1.));
  float alpha = .3 * sqrt(clamp(uRefraction / 20., 0., 1.));
  gl_FragColor = vec4(rgb * shade, alpha);
}
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** A translucent refraction layer. CSS backdrop blur remains underneath as a fallback. */
export function HeroGlassShaderLayer({ imageUrl, config }: { imageUrl: string; config: HeroGlassConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (config.mode !== "shader") return;
    const canvas = canvasRef.current;
    const card = canvas?.parentElement;
    const hero = card?.closest<HTMLElement>(".dashboard-hero");
    if (!canvas || !card || !hero) return;
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: false });
    if (!gl) return;
    const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    const uniforms = Object.fromEntries(
      ["uImage", "uStage", "uRectPosition", "uRectSize", "uImageSize", "uPointer", "uSaturation", "uRefraction"]
        .map((name) => [name, gl.getUniformLocation(program, name)]),
    );
    gl.uniform1i(uniforms.uImage, 0);
    const image = new Image();
    image.crossOrigin = "anonymous";
    let active = true;
    let ready = false;
    let frame = 0;
    let pointerX = .5;
    let pointerY = .5;
    const draw = () => {
      frame = 0;
      if (!active || !ready) return;
      const stage = hero.getBoundingClientRect();
      const rect = card.getBoundingClientRect();
      if (!stage.width || !stage.height || !rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.round(rect.width * dpr);
      const height = Math.round(rect.height * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform2f(uniforms.uStage, stage.width, stage.height);
      gl.uniform2f(uniforms.uRectPosition, rect.left - stage.left, rect.top - stage.top);
      gl.uniform2f(uniforms.uRectSize, rect.width, rect.height);
      gl.uniform2f(uniforms.uImageSize, image.naturalWidth, image.naturalHeight);
      gl.uniform2f(uniforms.uPointer, pointerX, pointerY);
      gl.uniform1f(uniforms.uSaturation, config.saturation / 100);
      gl.uniform1f(uniforms.uRefraction, config.refraction);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(draw); };
    const onPointerMove = (event: Event) => {
      const point = event as PointerEvent;
      const rect = card.getBoundingClientRect();
      pointerX = (point.clientX - rect.left) / rect.width;
      pointerY = (point.clientY - rect.top) / rect.height;
      schedule();
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(hero);
    observer.observe(card);
    card.addEventListener("pointermove", onPointerMove);
    window.addEventListener("resize", schedule);
    image.onload = () => {
      if (!active) return;
      try {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        ready = true;
        schedule();
      } catch { /* CSS backdrop remains visible. */ }
    };
    image.src = imageUrl;
    return () => {
      active = false;
      image.onload = null;
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      card.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", schedule);
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, [imageUrl, config]);

  if (config.mode !== "shader") return null;
  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-0 h-full w-full" aria-hidden="true" />;
}
