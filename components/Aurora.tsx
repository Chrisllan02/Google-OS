import React, { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Color, Triangle } from 'ogl';

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;
uniform float uDarkMode;

out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

struct ColorStop { vec3 color; float position; };

#define COLOR_RAMP(colors, factor, finalColor) { \
  int index = 0; \
  for (int i = 0; i < 2; i++) { \
     ColorStop currentColor = colors[i]; \
     bool isInBetween = currentColor.position <= factor; \
     index = int(mix(float(index), float(i), float(isInBetween))); \
  } \
  ColorStop currentColor = colors[index]; \
  ColorStop nextColor = colors[index + 1]; \
  float range = nextColor.position - currentColor.position; \
  float lerpFactor = (factor - currentColor.position) / range; \
  finalColor = mix(currentColor.color, nextColor.color, lerpFactor); \
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  ColorStop colors[3];
  colors[0] = ColorStop(uColorStops[0], 0.0);
  colors[1] = ColorStop(uColorStops[1], 0.5);
  colors[2] = ColorStop(uColorStops[2], 1.0);
  vec3 rampColor;
  COLOR_RAMP(colors, uv.x, rampColor);

  float n = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  float height = exp(n);
  height = (uv.y * 2.0 - height + 0.25);
  float intensity = 0.7 * height;

  float midPoint = 0.20;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);
  auroraAlpha = clamp(auroraAlpha, 0.0, 1.0);

  // No modo escuro (uDarkMode = 1.0), o tom base que se mistura à onda é preto (vec3(0.0)).
  // No modo claro (uDarkMode = 0.0), o tom base vira branco puro (vec3(1.0)).
  vec3 baseTone = mix(vec3(1.0), vec3(0.0), uDarkMode);
  float colorMix = clamp(intensity, 0.0, 1.0);
  vec3 auroraColor = mix(baseTone, rampColor, colorMix);

  fragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);
}
`;

interface AuroraProps {
  colorStops?: string[];
  amplitude?: number;
  blend?: number;
  time?: number;
  speed?: number;
  darkMode?: boolean;
}

const DEFAULT_COLOR_STOPS = ['#4285F4', '#34A853', '#EA4335'];

function parseColorStops(stops: string[]): number[][] {
  return stops.slice(0, 3).map((hex) => {
    const c = new Color(hex);
    return [c.r, c.g, c.b];
  });
}

const Aurora = React.memo(function Aurora(props: AuroraProps) {
  const {
    colorStops = DEFAULT_COLOR_STOPS,
    amplitude = 1.0,
    blend = 0.5,
    speed = 1.0,
    darkMode = false,
  } = props;

  const ctnDom = useRef<HTMLDivElement>(null);

  // Store mutable animation targets in a ref so React state/prop updates
  // never trigger WebGL context recreation or per-frame heap allocations.
  const stateRef = useRef({
    amplitude,
    blend,
    speed,
    time: props.time,
    darkMode: darkMode ? 1.0 : 0.0,
    colorStopsKey: colorStops.join(','),
    parsedStops: parseColorStops(colorStops),
    stopsDirty: false,
  });

  // Update ref targets synchronously on prop change without re-running WebGL effect
  const nextStopsKey = colorStops.join(',');
  if (stateRef.current.colorStopsKey !== nextStopsKey) {
    stateRef.current.colorStopsKey = nextStopsKey;
    stateRef.current.parsedStops = parseColorStops(colorStops);
    stateRef.current.stopsDirty = true;
  }
  stateRef.current.amplitude = amplitude;
  stateRef.current.blend = blend;
  stateRef.current.speed = speed;
  stateRef.current.time = props.time;
  stateRef.current.darkMode = darkMode ? 1.0 : 0.0;

  useEffect(() => {
    const ctn = ctnDom.current;
    if (!ctn) return;

    const renderer = new Renderer({
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      dpr: Math.min(window.devicePixelRatio || 1, 1.5),
      powerPreference: 'high-performance',
    });

    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.canvas.style.backgroundColor = 'transparent';
    gl.canvas.style.width = '100%';
    gl.canvas.style.height = '100%';
    gl.canvas.style.display = 'block';

    const geometry = new Triangle(gl);
    if (geometry.attributes.uv) delete geometry.attributes.uv;

    const resolutionBuffer = new Float32Array([ctn.offsetWidth || 1, ctn.offsetHeight || 1]);

    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: stateRef.current.amplitude },
        uColorStops: { value: stateRef.current.parsedStops },
        uResolution: { value: resolutionBuffer },
        uBlend: { value: stateRef.current.blend },
        uDarkMode: { value: stateRef.current.darkMode },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });
    ctn.appendChild(gl.canvas);

    let lastWidth = 0;
    let lastHeight = 0;
    const resize = () => {
      if (!ctn) return;
      const width = ctn.offsetWidth;
      const height = ctn.offsetHeight;
      if (width === 0 || height === 0 || (width === lastWidth && height === lastHeight)) return;
      lastWidth = width;
      lastHeight = height;
      renderer.setSize(width, height);
      resolutionBuffer[0] = width;
      resolutionBuffer[1] = height;
    };

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(resize)
      : null;
    if (resizeObserver) {
      resizeObserver.observe(ctn);
    } else {
      window.addEventListener('resize', resize, { passive: true });
    }
    resize();

    let animateId = 0;
    let isRunning = !document.hidden;
    let currentDark = stateRef.current.darkMode;
    let currentAmplitude = stateRef.current.amplitude;
    let currentBlend = stateRef.current.blend;
    let accumulatedTime = 0;
    let lastFrameTime = performance.now();

    const update = (now: number) => {
      if (!isRunning) return;
      animateId = requestAnimationFrame(update);

      const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameTime) * 0.001));
      lastFrameTime = now;

      const s = stateRef.current;

      // Smooth exponential interpolation for theme, amplitude, and blend
      const smoothFactor = 1.0 - Math.exp(-dt * 8.0);
      currentDark += (s.darkMode - currentDark) * smoothFactor;
      if (Math.abs(s.darkMode - currentDark) < 0.0005) currentDark = s.darkMode;

      currentAmplitude += (s.amplitude - currentAmplitude) * smoothFactor;
      currentBlend += (s.blend - currentBlend) * smoothFactor;

      if (s.time !== undefined) {
        accumulatedTime = s.time * s.speed * 0.1;
      } else {
        accumulatedTime += dt * s.speed;
      }

      program.uniforms.uTime.value = accumulatedTime;
      program.uniforms.uAmplitude.value = currentAmplitude;
      program.uniforms.uBlend.value = currentBlend;
      program.uniforms.uDarkMode.value = currentDark;

      if (s.stopsDirty) {
        program.uniforms.uColorStops.value = s.parsedStops;
        s.stopsDirty = false;
      }

      renderer.render({ scene: mesh });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        isRunning = false;
        cancelAnimationFrame(animateId);
      } else if (!isRunning) {
        isRunning = true;
        lastFrameTime = performance.now();
        animateId = requestAnimationFrame(update);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    if (isRunning) {
      animateId = requestAnimationFrame(update);
    }

    return () => {
      isRunning = false;
      cancelAnimationFrame(animateId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', resize);
      }
      if (ctn && gl.canvas.parentNode === ctn) {
        ctn.removeChild(gl.canvas);
      }
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    };
  }, []);

  return <div ref={ctnDom} className="w-full h-full will-change-transform" />;
});

export default Aurora;