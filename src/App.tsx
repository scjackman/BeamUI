import { useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import './BeamApp.css'

function IBeamMesh({ value }: { value: number }) {
  const beamDepth = value
  const flangeWidth = 3.2
  const flangeThickness = 0.25
  const webWidth = 0.25
  const webHeight = 2.5
  const beamOpacity = 0.5
  const coneRadius = 0.5
  const coneHeight = 1.0

  const totalHeight = webHeight + flangeThickness*2
  const topFlangeY = totalHeight - flangeThickness/2
  const bottomFlangeY = flangeThickness/2
  const webMidHeight = totalHeight/2 - flangeThickness/2 - coneHeight/2
  
  return (
    <group>
      {/* Top flange */}
      <mesh position={[0, topFlangeY, 0]}>
        <boxGeometry args={[flangeWidth, flangeThickness, beamDepth]} />
        <meshStandardMaterial color="#b0b9c8" metalness={0.15} roughness={0.55} transparent opacity={beamOpacity} />
      </mesh>

      {/* Web */}
      <mesh position={[0, totalHeight/2, 0]}>
        <boxGeometry args={[webWidth, webHeight, beamDepth]} />
        <meshStandardMaterial color="#96a2b4" metalness={0.1} roughness={0.6} transparent opacity={beamOpacity} />
      </mesh>

      {/* Bottom flange */}
      <mesh position={[0, bottomFlangeY, 0]}>
        <boxGeometry args={[flangeWidth, flangeThickness, beamDepth]} />
        <meshStandardMaterial color="#b0b9c8" metalness={0.15} roughness={0.55} transparent opacity={beamOpacity} />
      </mesh>

      {/* Cones with apex (tip) at web ends */}
      <mesh position={[0, webMidHeight, -value/2]}>
        <coneGeometry args={[coneRadius, coneHeight, 28]} />
        <meshStandardMaterial color="#f5b971" metalness={0.05} roughness={0.45} />
      </mesh>
      <mesh position={[0, webMidHeight, value/2]}>
        <coneGeometry args={[coneRadius, coneHeight, 28]} />
        <meshStandardMaterial color="#f5b971" metalness={0.05} roughness={0.45} />
      </mesh>
    </group>
  )
}

type DiagramKind = 'shear' | 'moment' | 'axial'

function diagramValue(kind: DiagramKind, t: number, amplitude: number) {
  if (kind === 'shear') {
    // Dummy simply supported beam with UDL: linear shear.
    return 0.75 - 1.5 * t
  }
  if (kind === 'moment') {
    // Dummy simply supported beam with UDL: parabolic bending moment.
    return 2 * amplitude * t - 2 * amplitude * t ** 2
  }
  // Dummy axial force: near-constant compression.
  return 0.35
}

function computeStructuralDiagramPlacement({
  beamLength,
  beamUndersideY,
  value,
  samples,
}: {
  beamLength: number
  beamUndersideY: number
  value: number
  samples: number
}) {
  const amp = value * 0.1
  const half = beamLength / 2
  const gapToBeam = 1
  const kinds: DiagramKind[] = ['shear', 'moment', 'axial']

  let maxLocalY = -Infinity
  let minLocalY = Infinity

  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples
    for (const kind of kinds) {
      const localY = -amp * diagramValue(kind, t, amp)
      maxLocalY = Math.max(maxLocalY, localY)
      minLocalY = Math.min(minLocalY, localY)
    }
  }

  const baselineY = beamUndersideY - gapToBeam - maxLocalY

  return {
    amp,
    half,
    baselineY,
    worldMaxY: baselineY + maxLocalY,
    worldMinY: baselineY + minLocalY,
  }
}

function DiagramCurve({
  kind,
  color,
  length,
  amplitude,
  opacity,
}: {
  kind: DiagramKind
  color: string
  length: number
  amplitude: number
  opacity: number
}) {
  const segments = 48
  const half = length / 2
  const points: [number, number, number][] = []

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments
    const z = -half + length * t
    const y = - amplitude * diagramValue(kind, t, amplitude)
    points.push([0, y, z])
  }

  return (
    <Line points={points} color={color} lineWidth={2} transparent opacity={opacity} />
  )
}

function DiagramSpokes({
  kind,
  length,
  amplitude,
  color,
  opacity,
  samples,
}: {
  kind: DiagramKind
  length: number
  amplitude: number
  color: string
  opacity: number
  samples: number
}) {
  const spokes = samples/2
  const half = length / 2

  const spokeLines: ReactElement[] = []
  for (let i = 0; i <= spokes; i += 1) {
    const t = i / spokes
    const z = -half + length * t
    const y = -amplitude * diagramValue(kind, t, amplitude)

    spokeLines.push(
      <Line
        key={`${kind}-${i}`}
        points={[
          [0, 0, z],
          [0, y, z],
        ]}
        color={color}
        lineWidth={1}
        transparent
        opacity={opacity}
      />,
    )
  }

  return <group>{spokeLines}</group>
}

function StructuralDiagrams({
  beamLength,
  beamUndersideY,
  value,
  samples,
  activeDiagramKind,
}: {
  beamLength: number
  beamUndersideY: number
  value: number
  samples: number
  activeDiagramKind: DiagramKind
}) {
  const { amp, half, baselineY } = computeStructuralDiagramPlacement({
    beamLength,
    beamUndersideY,
    value,
    samples,
  })

  const curveActiveOpacity = 1
  const curveInactiveOpacity = 0.1
  const spokesActiveOpacity = 0.22
  const spokesInactiveOpacity = 0.08

  const curveOpacityFor = (kind: DiagramKind) =>
    kind === activeDiagramKind ? curveActiveOpacity : curveInactiveOpacity

  const spokesOpacityFor = (kind: DiagramKind) =>
    kind === activeDiagramKind ? spokesActiveOpacity : spokesInactiveOpacity

  return (
    <group position={[0, baselineY, 0]}>
      {/* Shared baseline axis (parallel to beam axis / z-axis) */}
      <Line points={[[0, 0, -half], [0, 0, half]]} color="#9aa4b2" lineWidth={1} />

      {/* Three result curves using the same baseline axis */}
      {/* Faint spokes perpendicular to the baseline, extending to each curve outline */}
      <DiagramSpokes
        kind="shear"
        length={beamLength}
        amplitude={amp}
        color="#f97316"
        opacity={spokesOpacityFor('shear')}
        samples={samples}
      />
      <DiagramSpokes
        kind="moment"
        length={beamLength}
        amplitude={amp}
        color="#22c55e"
        opacity={spokesOpacityFor('moment')}
        samples={samples}
      />
      <DiagramSpokes
        kind="axial"
        length={beamLength}
        amplitude={amp}
        color="#60a5fa"
        opacity={spokesOpacityFor('axial')}
        samples={samples}
      />

      <DiagramCurve
        kind="shear"
        color="#f97316"
        length={beamLength}
        amplitude={amp}
        opacity={curveOpacityFor('shear')}
      />
      <DiagramCurve
        kind="moment"
        color="#22c55e"
        length={beamLength}
        amplitude={amp}
        opacity={curveOpacityFor('moment')}
      />
      <DiagramCurve
        kind="axial"
        color="#60a5fa"
        length={beamLength}
        amplitude={amp}
        opacity={curveOpacityFor('axial')}
      />
    </group>
  )
}

function HoverPanelAnchor({
  enabled,
  worldX,
  worldY,
  worldZ,
  onScreenPos,
}: {
  enabled: boolean
  worldX: number
  worldY: number
  worldZ: number
  onScreenPos: (pos: { x: number; y: number }) => void
}) {
  const { camera, size } = useThree()
  const v = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    if (!enabled) return

    v.set(worldX, worldY, worldZ).project(camera)

    const x = (v.x * 0.5 + 0.5) * size.width
    const y = (-v.y * 0.5 + 0.5) * size.height

    onScreenPos({ x, y })
  })

  return null
}

export default function App() {
  const [value, setValue] = useState(40)
  const beamCenterY = 0
  const beamUndersideY = beamCenterY
  const samples = value * 2

  const {
    worldMinY: diagramsWorldMinY,
    worldMaxY: diagramsWorldMaxY,
    baselineY: diagramsBaselineY,
  } =
    computeStructuralDiagramPlacement({
      beamLength: value,
      beamUndersideY,
      value,
      samples,
    })

  const panelAnchorWorldY = diagramsBaselineY + 0.15

  // Hover-driven UI panel (M/N/V buttons). We'll hook up diagram interactivity later.
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 })
  const [activeButton, setActiveButton] = useState<'M' | 'N' | 'V'>('M')
  const [hoveringHitbox, setHoveringHitbox] = useState(false)
  const [panelHovered, setPanelHovered] = useState(false)
  const panelVisible = hoveringHitbox || panelHovered

  const activeDiagramKind: DiagramKind =
    activeButton === 'M'
      ? 'moment'
      : activeButton === 'N'
        ? 'axial'
        : 'shear'

  // Beam extents (used for a single combined invisible hitbox).
  const webHeight = 2.5
  const flangeThickness = 0.25
  const totalHeight = webHeight + flangeThickness * 2
  const bottomFlangeY = flangeThickness / 2
  const topFlangeY = totalHeight - flangeThickness / 2
  const beamWorldMinY = beamCenterY + bottomFlangeY
  const beamWorldMaxY = beamCenterY + topFlangeY

  const hitboxPadding = 0.35
  const hitboxMinY = Math.min(beamWorldMinY, diagramsWorldMinY) - hitboxPadding
  const hitboxMaxY = Math.max(beamWorldMaxY, diagramsWorldMaxY) + hitboxPadding
  const hitboxCenterY = (hitboxMinY + hitboxMaxY) / 2
  const hitboxHeight = hitboxMaxY - hitboxMinY
  const hitboxWidth = 4.2
  const hitboxDepth = value * 1.05

  return (
    <div className="beamApp">
      <div className="menuBar">
        <div className="menuRow">
          <label className="menuLabel">
            Span: <span className="menuValue">{value}</span>
          </label>
          <input
            className="menuSlider"
            type="range"
            min={30}
            max={50}
            step={1}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            aria-label="3D number value"
          />
        </div>
        <div className="menuHint">Drag to rotate (mouse/touch).</div>
      </div>

      <Canvas
        className="canvas"
        camera={{ position: [100, 50, -25], fov: 35 }}
        onCreated={({ gl }) => {
          gl.setClearColor('#0f172a')
        }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[4, 6, 3]} intensity={1.1} />

        {/* Placeholder 3D I-beam cross section */}
        <group position={[0, beamCenterY, 0]} rotation={[0, 0, 0]}>
          <IBeamMesh value={value} />
        </group>

        {/* Dummy structural result diagrams below the beam */}
        <StructuralDiagrams
          beamLength={value}
          beamUndersideY={beamUndersideY}
          value={value}
          samples={samples}
          activeDiagramKind={activeDiagramKind}
        />

        {/* Invisible hover region for the overlay UI */}
        <mesh
          position={[0, hitboxCenterY, 0]}
          onPointerEnter={() => {
            setHoveringHitbox(true)
          }}
          onPointerLeave={() => {
            setHoveringHitbox(false)
          }}
        >
          <boxGeometry args={[hitboxWidth, hitboxHeight, hitboxDepth]} />
          <meshBasicMaterial transparent opacity={0.0} depthWrite={false} />
        </mesh>

        {/* Projects a fixed 3D anchor point into screen space for the hover UI */}
        <HoverPanelAnchor
          enabled={panelVisible}
          worldX={0}
          worldY={panelAnchorWorldY}
          worldZ={-value / 2}
          onScreenPos={setPanelPos}
        />

        <OrbitControls target={[0, beamCenterY, 0]} enablePan={false} />
      </Canvas>

      <div
        className={`hoverPanel ${panelVisible ? 'visible' : ''}`}
        onMouseEnter={() => setPanelHovered(true)}
        onMouseLeave={() => {
          setPanelHovered(false)
        }}
        style={{
          left: panelPos.x,
          top: panelPos.y,
        }}
      >
          <button
            type="button"
            className={`hoverButton ${activeButton === 'M' ? 'active' : ''}`}
            onClick={() => setActiveButton('M')}
          >
            M
          </button>
          <button
            type="button"
            className={`hoverButton ${activeButton === 'V' ? 'active' : ''}`}
            onClick={() => setActiveButton('V')}
          >
            V
          </button>
          <button
            type="button"
            className={`hoverButton ${activeButton === 'N' ? 'active' : ''}`}
            onClick={() => setActiveButton('N')}
          >
            N
          </button>
      </div>
    </div>
  )
}