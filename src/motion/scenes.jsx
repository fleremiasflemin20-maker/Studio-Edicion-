import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { Audio } from '@remotion/media';
const colors = ['#ff7c8f', '#ffbc72', '#eadb82', '#8de49f', '#7adbd8', '#87b9f5', '#c79dec'];
const ramp = (f, a, b) =>
  interpolate(f, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
function TextPanel({ title, subtitle, cta, accent, style = {} }) {
  const f = useCurrentFrame(),
    { fps, width, height } = useVideoConfig();
  const k = spring({ frame: f, fps, config: { damping: 20 } });
  const size = Math.min(width, height) * 0.092;
  return (
    <div
      style={{
        position: 'absolute',
        left: '9%',
        right: '9%',
        top: '55%',
        color: '#f3f7f3',
        transform: `translateY(${(1 - k) * 45}px)`,
        opacity: k,
        ...style,
      }}
    >
      <div
        style={{
          fontSize: size,
          fontWeight: 800,
          lineHeight: 1.05,
          letterSpacing: -size * 0.035,
          overflowWrap: 'break-word',
        }}
      >
        {title}
      </div>
      <div
        style={{ fontSize: size * 0.32, lineHeight: 1.5, marginTop: size * 0.32, color: '#becfc3' }}
      >
        {subtitle}
      </div>
      <div style={{ marginTop: size * 0.52, color: accent, fontWeight: 700, fontSize: size * 0.3 }}>
        {cta} ↗
      </div>
    </div>
  );
}
function Mark({ accent }) {
  const { width } = useVideoConfig();
  return (
    <div
      style={{
        position: 'absolute',
        top: '6%',
        left: '9%',
        fontSize: width * 0.019,
        letterSpacing: width * 0.003,
        color: accent,
        fontWeight: 700,
      }}
    >
      FLEREMAHIAS / MOTION
    </div>
  );
}
function Kinetic(props) {
  const f = useCurrentFrame(),
    { width, height, durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        backgroundColor: props.background,
        fontFamily: 'Arial, sans-serif',
        overflow: 'hidden',
      }}
    >
      <Mark {...props} />
      {colors.map((color, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: width * 0.48,
            height: height * 0.025,
            backgroundColor: color,
            left: width * 0.25 + i * width * 0.02,
            top: height * 0.25 + i * height * 0.025,
            transform: `rotate(-18deg) translateX(${(1 - ramp(f, i * 2, 20 + i * 2)) * width}px)`,
          }}
        />
      ))}
      <TextPanel {...props} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          height: 8,
          width: `${(100 * f) / (durationInFrames - 1 || 1)}%`,
          backgroundColor: props.accent,
        }}
      />
    </AbsoluteFill>
  );
}
function Product(props) {
  const f = useCurrentFrame(),
    { width, height, fps } = useVideoConfig();
  const enter = spring({ frame: f - 3, fps, config: { damping: 16 } });
  return (
    <AbsoluteFill
      style={{
        backgroundColor: props.background,
        fontFamily: 'Arial, sans-serif',
        overflow: 'hidden',
      }}
    >
      <Mark {...props} />
      <div
        style={{
          position: 'absolute',
          top: '19%',
          left: '17%',
          width: '66%',
          height: '26%',
          backgroundColor: props.accent,
          borderRadius: width * 0.04,
          transform: `translateY(${(1 - enter) * height * 0.2}px) rotate(${Math.sin(f / 22) * 3}deg)`,
        }}
      >
        <div
          style={{
            fontSize: width * 0.17,
            fontWeight: 800,
            color: props.background,
            position: 'absolute',
            left: '10%',
            top: '18%',
          }}
        >
          01
        </div>
        <div
          style={{
            position: 'absolute',
            right: '10%',
            bottom: '15%',
            fontSize: width * 0.025,
            color: props.background,
          }}
        >
          {props.cta}
        </div>
      </div>
      <TextPanel {...props} />
    </AbsoluteFill>
  );
}
function Stories(props) {
  const f = useCurrentFrame(),
    { durationInFrames, width, height } = useVideoConfig();
  const section = Math.min(2, Math.floor(f / (durationInFrames / 3)));
  const message = [props.title, props.subtitle, props.cta][section];
  const local = f - (section * durationInFrames) / 3;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: props.background,
        fontFamily: 'Arial, sans-serif',
        color: '#f3f7f3',
      }}
    >
      <Mark {...props} />
      <div
        style={{
          position: 'absolute',
          top: '25%',
          left: '9%',
          fontSize: width * 0.11,
          color: props.accent,
          fontWeight: 700,
        }}
      >
        0{section + 1}
      </div>
      <div
        style={{
          position: 'absolute',
          left: '9%',
          right: '9%',
          top: '43%',
          fontSize: Math.min(width, height) * 0.09,
          fontWeight: 800,
          lineHeight: 1.1,
          transform: `translateY(${(1 - ramp(local, 0, 10)) * 50}px)`,
          opacity: ramp(local, 0, 6),
        }}
      >
        {message}
      </div>
      <div
        style={{
          position: 'absolute',
          left: '9%',
          right: '9%',
          bottom: '12%',
          height: 8,
          display: 'flex',
          gap: 8,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{ flex: 1, backgroundColor: i <= section ? props.accent : '#34473c' }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
}
function Objects({ type, accent }) {
  const f = useCurrentFrame(),
    { fps } = useVideoConfig();
  const t = f / fps;
  if (type === 'data3d')
    return (
      <group rotation={[0.12, -0.5, 0]} position={[-1.4, -0.6, 0]}>
        {[0.7, 1.3, 1.8, 1.1].map((h, i) => {
          const height = h * ramp(f, i * 5, 30 + i * 5) + 0.03;
          return (
            <mesh key={i} position={[i * 0.9, height / 2, 0]}>
              <boxGeometry args={[0.57, height, 0.57]} />
              <meshStandardMaterial color={colors[i + 2]} metalness={0.3} roughness={0.25} />
            </mesh>
          );
        })}
      </group>
    );
  if (type === 'orbit3d')
    return (
      <group rotation={[t * 0.3, t * 0.55, t * 0.14]}>
        <mesh>
          <torusKnotGeometry args={[0.82, 0.22, 128, 20]} />
          <meshStandardMaterial color={accent} metalness={0.65} roughness={0.24} />
        </mesh>
        {colors.slice(0, 5).map((c, i) => (
          <mesh
            key={i}
            position={[
              Math.cos(t + i * 1.25) * 1.65,
              Math.sin(t + i * 1.25) * 1.35,
              0.35 * Math.sin(i + t),
            ]}
          >
            <sphereGeometry args={[0.11, 20, 20]} />
            <meshStandardMaterial color={c} />
          </mesh>
        ))}
      </group>
    );
  return (
    <group rotation={[0.2 + Math.sin(t) * 0.1, t * 0.6, 0.05]}>
      <mesh>
        <boxGeometry args={[1.55, 1.8, 0.75]} />
        <meshStandardMaterial color={accent} roughness={0.28} metalness={0.35} />
      </mesh>
      <mesh position={[0, 0.2, 0.39]}>
        <boxGeometry args={[0.9, 0.16, 0.02]} />
        <meshStandardMaterial color="#10251b" />
      </mesh>
      <mesh position={[0, -0.15, 0.39]}>
        <boxGeometry args={[0.6, 0.08, 0.02]} />
        <meshStandardMaterial color="#10251b" />
      </mesh>
    </group>
  );
}
function ThreeScene(props) {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        backgroundColor: props.background,
        fontFamily: 'Arial, sans-serif',
        overflow: 'hidden',
      }}
    >
      <ThreeCanvas
        width={width}
        height={height}
        style={{ width, height, position: 'absolute', top: -height * 0.12 }}
        camera={{ position: [0, 1, 6], fov: 42 }}
        gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true }}
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[3, 4, 5]} intensity={3} />
        <pointLight position={[-3, 0, 3]} color="#8cbcff" intensity={12} />
        <Objects type={props.preset} accent={props.accent} />
      </ThreeCanvas>
      <Mark {...props} />
      <TextPanel {...props} style={{ top: '65%' }} />
    </AbsoluteFill>
  );
}
export const components = {
  kinetic: Kinetic,
  product: Product,
  stories: Stories,
  product3d: ThreeScene,
  orbit3d: ThreeScene,
  data3d: ThreeScene,
};
export function withAudio(Component, props, audioURL) {
  return function RenderScene() {
    return (
      <AbsoluteFill>
        <Component {...props} />
        {audioURL ? <Audio src={audioURL} volume={0.7} /> : null}
      </AbsoluteFill>
    );
  };
}
export const starter = `import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, spring} from 'remotion';

export default function MyVideo({title, subtitle, accent, background, cta}) {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const entrance = spring({frame, fps, config: {damping: 20}});
  return <AbsoluteFill style={{backgroundColor: background, color: '#f5f8f5', fontFamily: 'Arial', justifyContent: 'center', padding: width * 0.1}}>
    <div style={{opacity: entrance, transform: 'translateY(' + (1-entrance)*60 + 'px)'}}>
      <div style={{color: accent, fontSize: width*.035}}>FLEREMAHIAS / MOTION</div>
      <h1 style={{fontSize: width*.1, lineHeight: 1.05}}>{title}</h1>
      <p style={{fontSize: width*.035}}>{subtitle}</p>
      <p style={{fontSize: width*.03, color: accent}}>{cta}</p>
    </div>
  </AbsoluteFill>;
}`;
