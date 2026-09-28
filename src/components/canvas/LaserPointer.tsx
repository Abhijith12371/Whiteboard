import { useRef, useEffect } from 'react'
import { Line, Circle, Group } from 'react-konva'
import Konva from 'konva'

interface LaserPointerProps {
  /** Flat array of [x0, y0, x1, y1, …] canvas-space coords */
  trail: number[]
  /** Called when the fade-out animation finishes so parent can clear the trail */
  onFadeComplete: () => void
  /** Whether the pointer is currently being dragged (trail is live) */
  active: boolean
}

const LASER_COLOR = '#ff2244'
const LASER_GLOW  = '#ff6680'

/**
 * A laser-pointer trail rendered in Konva.
 *
 * When `active` is true the trail renders at full opacity with a shimmer dot
 * at the tip. When `active` becomes false (mouse up) a smooth fade-out
 * animation runs via Konva's built-in `to()` tween, then `onFadeComplete` is
 * called so the parent can discard the trail coordinates.
 */
export function LaserPointer({ trail, onFadeComplete, active }: LaserPointerProps) {
  const groupRef  = useRef<Konva.Group>(null)
  const fadingRef = useRef(false)

  // ── fade-out when the pointer is released ─────────────────────────────────
  useEffect(() => {
    if (active) {
      // Pointer became active again mid-fade — cancel any ongoing fade
      fadingRef.current = false
      if (groupRef.current) {
        groupRef.current.opacity(1)
      }
      return
    }
    if (trail.length < 2) return
    if (fadingRef.current) return

    fadingRef.current = true
    const node = groupRef.current
    if (!node) { onFadeComplete(); return }

    node.to({
      opacity: 0,
      duration: 0.45,       // 450 ms smooth dissolve
      easing: Konva.Easings.EaseOut,
      onFinish: () => {
        fadingRef.current = false
        node.opacity(1)     // reset so next stroke starts fresh
        onFadeComplete()
      },
    })
  }, [active, trail.length, onFadeComplete])

  if (trail.length < 2) return null

  const tipX = trail[trail.length - 2]
  const tipY = trail[trail.length - 1]

  return (
    <Group ref={groupRef} listening={false}>

      {/* ── Glow halo (wide, very soft) ── */}
      <Line
        points={trail}
        stroke={LASER_GLOW}
        strokeWidth={14}
        lineCap="round"
        lineJoin="round"
        opacity={0.18}
        listening={false}
        shadowColor={LASER_COLOR}
        shadowBlur={20}
        shadowOpacity={0.4}
      />

      {/* ── Mid bloom ── */}
      <Line
        points={trail}
        stroke={LASER_COLOR}
        strokeWidth={7}
        lineCap="round"
        lineJoin="round"
        opacity={0.45}
        listening={false}
        shadowColor={LASER_COLOR}
        shadowBlur={10}
        shadowOpacity={0.6}
      />

      {/* ── Bright core ── */}
      <Line
        points={trail}
        stroke="#ffffff"
        strokeWidth={2.5}
        lineCap="round"
        lineJoin="round"
        opacity={0.85}
        listening={false}
      />

      {/* ── Tip: outer glow ring ── */}
      {active && (
        <Circle
          x={tipX}
          y={tipY}
          radius={10}
          fill="transparent"
          stroke={LASER_COLOR}
          strokeWidth={2}
          opacity={0.5}
          listening={false}
          shadowColor={LASER_COLOR}
          shadowBlur={12}
          shadowOpacity={0.8}
        />
      )}

      {/* ── Tip: bright hot dot ── */}
      {active && (
        <Circle
          x={tipX}
          y={tipY}
          radius={5}
          fill="#ffffff"
          opacity={1}
          listening={false}
          shadowColor={LASER_COLOR}
          shadowBlur={18}
          shadowOpacity={1}
        />
      )}

      {/* ── Tip: coloured centre ── */}
      {active && (
        <Circle
          x={tipX}
          y={tipY}
          radius={3}
          fill={LASER_COLOR}
          opacity={1}
          listening={false}
        />
      )}
    </Group>
  )
}
