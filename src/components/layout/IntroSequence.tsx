import { useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import {
  MousePointer2, Hand, Pen, Eraser, Type, Square, Circle, Triangle,
  Image as ImageIcon, StickyNote, Minus, ArrowRight
} from 'lucide-react'
import { useBoardStore } from '../../store/boardStore'
import logoUrl from '../../assets/icon.png'

interface IntroSequenceProps {
  onComplete: () => void
}

/**
 * Resolve a design token to a concrete colour. Needed for the Konva scene,
 * which paints to a canvas and therefore cannot use CSS custom properties.
 */
function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

export function IntroSequence({ onComplete }: IntroSequenceProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Scene 1-3: Logo Materialization
  const dotRef = useRef<HTMLDivElement>(null)
  const rippleRef = useRef<HTMLDivElement>(null)
  const logoWrapperRef = useRef<HTMLDivElement>(null)
  const logoImgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  // Scene 4-8: Infinite Canvas & Handoff
  const cameraRef = useRef<HTMLDivElement>(null)
  const canvasPlaneRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  
  // Individual Tools
  const toolRefs = useRef<(HTMLDivElement | null)[]>([])

  // Individual Canvas Elements
  const sketchPathRef = useRef<SVGPathElement>(null)
  const arrowPathRef = useRef<SVGPathElement>(null)
  const shapeRef = useRef<HTMLDivElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)

  const [showSkip, setShowSkip] = useState(false)
  const masterTlRef = useRef<gsap.core.Timeline | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const isFinishedRef = useRef(false)

  // -------------------------------------------------------------------
  // Advanced Particle Engine (Orbital Mechanics -> Burst)
  // -------------------------------------------------------------------
  const particlesRef = useRef<any[]>([])
  
  // This physics object is animated entirely by GSAP
  const physicsRef = useRef({
    orbitRadius: 20,
    orbitSpeed: 0.02,
    burstVelocity: 0,
    globalAlpha: 0,
    swirlPower: 0,
    scale: 1
  })

  const initParticles = () => {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    
    canvasRef.current.width = window.innerWidth
    canvasRef.current.height = window.innerHeight

    const particleCount = window.matchMedia('(max-width: 768px)').matches ? 250 : 500
    // Neutrals follow the theme so light particles stay visible on a light board.
    const neutral = cssVar('--foreground', '#09090b')
    const colors = ['#8b5cf6', '#3b82f6', neutral, neutral]

    for (let i = 0; i < particleCount; i++) {
      particlesRef.current.push({
        angle: Math.random() * Math.PI * 2,
        distanceOffset: (Math.random() - 0.5) * 40, // random spread around the orbit ring
        speedMult: Math.random() * 0.5 + 0.5,
        burstMult: Math.random() * 2 + 1,
        size: Math.random() * 3.5 + 0.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: 0,
        vy: 0,
        x: 0,
        y: 0,
        isBursting: false,
        life: 1
      })
    }
  }

  const drawParticles = () => {
    if (!canvasRef.current || isFinishedRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    
    const centerX = window.innerWidth / 2
    const centerY = window.innerHeight / 2
    const physics = physicsRef.current
    
    if (physics.globalAlpha <= 0 && physics.burstVelocity > 0) {
      // Complete fade out during burst phase, we can stop the loop
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      return
    }

    let activeParticles = 0
    
    ctx.globalAlpha = physics.globalAlpha
    
    particlesRef.current.forEach(p => {
      if (p.life <= 0) return
      activeParticles++

      // Orbit Phase
      if (physics.burstVelocity === 0) {
        p.angle += physics.orbitSpeed * p.speedMult
        
        // Swirl inward/outward noise
        const currentRadius = physics.orbitRadius + p.distanceOffset * physics.swirlPower
        
        p.x = centerX + Math.cos(p.angle) * currentRadius
        p.y = centerY + Math.sin(p.angle) * currentRadius
      } 
      // Burst Phase (Handled organically)
      else {
        if (!p.isBursting) {
          // Lock in the explosion trajectory exactly tangent or outward from orbit
          p.isBursting = true
          p.vx = Math.cos(p.angle) * physics.burstVelocity * p.burstMult
          p.vy = Math.sin(p.angle) * physics.burstVelocity * p.burstMult
        }
        
        p.x += p.vx
        p.y += p.vy
        
        // Slight air resistance
        p.vx *= 0.95
        p.vy *= 0.95
        
        // Fade out individually on top of global alpha
        p.life -= 0.02
      }

      ctx.fillStyle = p.color
      if (p.color === '#8b5cf6' || p.color === '#3b82f6') {
        ctx.shadowBlur = 12
        ctx.shadowColor = p.color
      } else {
        ctx.shadowBlur = 0
      }

      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * physics.scale, 0, Math.PI * 2)
      ctx.fill()
    })

    if (activeParticles > 0) {
      animationFrameRef.current = requestAnimationFrame(drawParticles)
    }
  }

  useLayoutEffect(() => {
    const skipIntro = localStorage.getItem('digiboard_intro_done') === 'true'
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (skipIntro || reducedMotion) {
      // Fast transition if disabled
      gsap.to(containerRef.current, {
        opacity: 0,
        duration: 0.4,
        ease: 'power2.inOut',
        onComplete: finishIntro
      })
      return
    }

    setShowSkip(true)

    // Reset SVG paths
    const prepareSVG = (el: SVGPathElement | null) => {
      if (el) {
        const length = el.getTotalLength()
        gsap.set(el, { strokeDasharray: length, strokeDashoffset: length, opacity: 0 })
      }
    }
    prepareSVG(sketchPathRef.current)
    prepareSVG(arrowPathRef.current)

    // Initial 3D & Setup states
    gsap.set(cameraRef.current, { z: -800, rotationX: 25, rotationY: -15 })
    gsap.set(canvasPlaneRef.current, { opacity: 0 })
    toolRefs.current.forEach(tool => {
      if (tool) gsap.set(tool, { opacity: 0, x: -20, scale: 0.8 })
    })

    const masterTl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: finishIntro
    })
    masterTlRef.current = masterTl

    // Boot the particle loop immediately but keep alpha at 0
    initParticles()
    drawParticles()

    // --------------------------------------------------
    // SCENE 1: The Spark & Ripple (Energy Gathering)
    // --------------------------------------------------
    gsap.set(containerRef.current, { opacity: 1 })
    
    masterTl.to(dotRef.current, {
      opacity: 1,
      scale: 1,
      duration: 0.8,
      ease: 'expo.out'
    }, 0.2)
    .to(rippleRef.current, {
      opacity: 0.8,
      scale: 2,
      duration: 1.0,
      ease: 'power2.out'
    }, 0.5)
    .to(rippleRef.current, {
      opacity: 0,
      scale: 3,
      duration: 0.8
    }, 1.0)
    .to(dotRef.current, {
      scale: 2.5,
      opacity: 0,
      duration: 0.5,
      ease: 'power2.in'
    }, 1.2)

    // --------------------------------------------------
    // SCENE 2: Hero Logo Materialization
    // --------------------------------------------------
    masterTl.fromTo(logoImgRef.current, 
      { opacity: 0, scale: 0.5, filter: 'blur(20px) drop-shadow(0 0 0px rgba(139,92,246,0))' },
      { 
        opacity: 1, 
        scale: 1, 
        filter: 'blur(0px) drop-shadow(0 20px 40px rgba(139,92,246,0.4))', 
        duration: 1.5, 
        ease: 'expo.out' 
      }, 
      1.3
    )

    // --------------------------------------------------
    // SCENE 3: Particle Orbital Swirl
    // --------------------------------------------------
    masterTl.to(physicsRef.current, {
      globalAlpha: 1,
      orbitRadius: 70, // Swirl tightly around the logo
      orbitSpeed: 0.08, // Spin fast
      swirlPower: 1, // Add noise
      scale: 1.2,
      duration: 2.0,
      ease: 'power1.inOut'
    }, 1.5)

    // The logo pulses gently as it gathers energy
    masterTl.to(logoImgRef.current, {
      scale: 1.05,
      filter: 'blur(0px) drop-shadow(0 0 80px rgba(139,92,246,0.6))',
      duration: 1.2,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: 1
    }, 2.0)

    // --------------------------------------------------
    // SCENE 4: The Spectacular Burst
    // --------------------------------------------------
    // Logo violently shrinks out of existence
    masterTl.to(logoImgRef.current, {
      scale: 0,
      opacity: 0,
      filter: 'blur(10px)',
      duration: 0.3,
      ease: 'back.in(2)'
    }, 3.8)

    // Particles explode outward like a supernova
    masterTl.to(physicsRef.current, {
      burstVelocity: 25, // Triggers burst logic in canvas
      globalAlpha: 0, // Fade out as they shoot
      duration: 1.5,
      ease: 'power3.out'
    }, 3.9)

    // --------------------------------------------------
    // SCENE 5 & 6: Creation of the Whiteboard Ideas
    // --------------------------------------------------
    // As particles fade, the whiteboard plane fades in
    masterTl.to(canvasPlaneRef.current, { opacity: 1, duration: 1.5 }, 4.0)

    // 1. A handwritten sketch (Underline) appears -> Pen tool appears
    masterTl.to(sketchPathRef.current, { opacity: 1, duration: 0.1 }, 4.1)
      .to(sketchPathRef.current, { strokeDashoffset: 0, duration: 1.0, ease: 'power2.out' }, 4.1)
      .to(toolRefs.current[2], { opacity: 1, x: 0, scale: 1, duration: 0.5, ease: 'back.out(1.5)' }, 4.3) // Pen Tool (index 2)

    // 2. A rectangle shape pops in -> Shape tool appears
    masterTl.fromTo(shapeRef.current, 
      { opacity: 0, scale: 0.5, rotation: -20 },
      { opacity: 1, scale: 1, rotation: 0, duration: 0.8, ease: 'elastic.out(1, 0.6)' },
      4.5
    ).to(toolRefs.current[6], { opacity: 1, x: 0, scale: 1, duration: 0.5, ease: 'back.out(1.5)' }, 4.6) // Square Tool (index 6)

    // 3. Arrow is drawn connecting them -> Arrow tool appears
    masterTl.to(arrowPathRef.current, { opacity: 1, duration: 0.1 }, 4.8)
      .to(arrowPathRef.current, { strokeDashoffset: 0, duration: 0.8, ease: 'power2.out' }, 4.8)
      .to(toolRefs.current[10], { opacity: 1, x: 0, scale: 1, duration: 0.5, ease: 'back.out(1.5)' }, 4.9) // Arrow Tool (index 10)

    // 4. Sticky note floats in -> Sticky tool appears
    masterTl.fromTo(stickyRef.current,
      { opacity: 0, y: 50, rotation: 10, filter: 'drop-shadow(0 0px 0px rgba(0,0,0,0))' },
      { opacity: 1, y: 0, rotation: -4, filter: 'drop-shadow(0 20px 25px rgba(0,0,0,0.15))', duration: 1.0, ease: 'power3.out' },
      5.2
    ).to(toolRefs.current[5], { opacity: 1, x: 0, scale: 1, duration: 0.5, ease: 'back.out(1.5)' }, 5.3) // Sticky Tool (index 5)

    // 5. Text appears -> Text tool appears
    masterTl.fromTo(textRef.current,
      { opacity: 0, y: 20, scale: 0.9 },
      { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'power2.out' },
      5.6
    ).to(toolRefs.current[4], { opacity: 1, x: 0, scale: 1, duration: 0.5, ease: 'back.out(1.5)' }, 5.7) // Text Tool (index 4)

    // Bring in the rest of the tools quickly
    masterTl.to(toolRefs.current, {
      opacity: 1, x: 0, scale: 1, duration: 0.4, stagger: 0.03, ease: 'back.out(1.2)'
    }, 6.1)

    // --------------------------------------------------
    // SCENE 7 & 8: Cinematic Morph to Real App
    // --------------------------------------------------
    // 1. Flatten the 3D camera to face the user perfectly (Z=0, rotation=0)
    masterTl.to(cameraRef.current, {
      z: 0,
      rotationX: 0,
      rotationY: 0,
      duration: 1.5,
      ease: 'power3.inOut'
    }, 6.5)

    // 2. Hide the canvas items we drew smoothly
    masterTl.to(canvasPlaneRef.current, {
      opacity: 0,
      duration: 0.8,
      ease: 'power2.in'
    }, 7.0)

    // 3. Perfect Handoff - INSTANT ZERO FLICKER OPACITY DROP
    masterTl.set(containerRef.current, { opacity: 0 }, 8.0)

    return () => {
      if (masterTlRef.current) masterTlRef.current.kill()
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    }
  }, [onComplete])

  const finishIntro = () => {
    isFinishedRef.current = true

    // Mark intro as done so it never plays again (user's saved work should
    // always be what they see when they reopen the app).
    localStorage.setItem('digiboard_intro_done', 'true')

    // Inject the intro's ideas into the real board ONLY on a genuine first-ever
    // launch — i.e. when IndexedDB has no board data at all.
    // We check the in-memory store AND a localStorage sentinel to avoid racing
    // with the async DB load (which may not have resolved yet).
    const isFirstLaunch = localStorage.getItem('digiboard_has_launched') !== 'true'
    const boardState = useBoardStore.getState()
    if (isFirstLaunch && boardState.objectIds.length === 0) {
      localStorage.setItem('digiboard_has_launched', 'true')
      const addObj = boardState.addObject
      const w = window.innerWidth
      const h = window.innerHeight

      addObj({
        id: crypto.randomUUID(),
        type: 'path',
        x: w * 0.34,
        y: h * 0.33,
        width: 300,
        height: 40,
        points: [10, 20, 100, 5, 200, 15, 290, 10],
        stroke: '#8b5cf6',
        strokeWidth: 6,
        rotation: 0, opacity: 1, locked: false, zIndex: 1
      } as any)

      addObj({
        id: crypto.randomUUID(),
        type: 'rectangle',
        x: w * 0.60,
        y: h * 0.42,
        width: 160,
        height: 160,
        fill: 'rgba(59, 130, 246, 0.1)',
        stroke: '#3b82f6',
        strokeWidth: 6,
        cornerRadius: 24,
        rotation: 0, opacity: 1, locked: false, zIndex: 2
      } as any)

      addObj({
        id: crypto.randomUUID(),
        type: 'text',
        x: w * 0.60,
        y: h * 0.42 + 65,
        width: 160,
        height: 40,
        text: 'Launch',
        fontSize: 28,
        fontFamily: 'Inter, sans-serif',
        fill: cssVar('--info', '#1d4ed8'),
        fontWeight: 'bold',
        fontStyle: 'normal',
        align: 'center',
        rotation: 0, opacity: 1, locked: false, zIndex: 3
      } as any)

      addObj({
        id: crypto.randomUUID(),
        type: 'arrow',
        x: w * 0.46,
        y: h * 0.50,
        width: 200,
        height: 100,
        points: [10, 80, 180, 20],
        stroke: '#ef4444',
        strokeWidth: 4,
        rotation: 0, opacity: 1, locked: false, zIndex: 4
      } as any)

      addObj({
        id: crypto.randomUUID(),
        type: 'sticky',
        x: w * 0.32,
        y: h * 0.45,
        width: 200,
        height: 200,
        text: 'Design\nthe\nfuture',
        fontSize: 32,
        fontFamily: 'Caveat, cursive',
        color: '#fef08a',
        rotation: -4, opacity: 1, locked: false, zIndex: 5
      } as any)

      addObj({
        id: crypto.randomUUID(),
        type: 'text',
        x: w * 0.35,
        y: h * 0.25,
        width: 320,
        height: 60,
        text: 'DigiBoard 2.0',
        fontSize: 48,
        fontFamily: 'Inter, sans-serif',
        fill: cssVar('--foreground', '#0f172a'),
        fontWeight: 'bold',
        fontStyle: 'normal',
        align: 'left',
        rotation: 0, opacity: 1, locked: false, zIndex: 6
      } as any)
    } else {
      // Not first launch — mark has_launched in case it wasn't set yet
      localStorage.setItem('digiboard_has_launched', 'true')
    }

    onComplete()
  }

  const handleSkip = () => {
    if (masterTlRef.current) masterTlRef.current.kill()
    gsap.to(containerRef.current, {
      opacity: 0,
      duration: 0.3,
      onComplete: finishIntro
    })
  }

  const TOOLS = [
    MousePointer2, Hand, Pen, Eraser, Type, StickyNote, Square, Circle, Triangle, Minus, ArrowRight, ImageIcon
  ]

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'var(--background)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        perspective: '2000px',
      }}
    >
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }} />

      {/* The Central Stage for Hero Logo Materialization */}
      <div 
        ref={logoWrapperRef}
        style={{ position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}
      >
        {/* The Initial Spark */}
        <div 
          ref={dotRef} 
          style={{ position: 'absolute', width: '4px', height: '4px', backgroundColor: 'var(--foreground)', borderRadius: '50%', boxShadow: '0 0 30px 10px var(--foreground)', opacity: 0, scale: 0 }} 
        />
        
        {/* The Expanding Energy Ripple */}
        <div 
          ref={rippleRef} 
          style={{ position: 'absolute', width: '100px', height: '100px', borderRadius: '50%', border: '2px solid rgba(139, 92, 246, 0.8)', boxShadow: 'inset 0 0 20px rgba(139, 92, 246, 0.4), 0 0 40px rgba(59, 130, 246, 0.6)', opacity: 0, scale: 0 }} 
        />

        {/* The DigiBoard Hero Logo */}
        {/* Imported (not a /icon.png path) so Vite emits a hashed asset URL.
            A root-absolute path resolves to the filesystem root under file://,
            which is why the logo was missing in the packaged .appx. */}
        <img
          ref={logoImgRef}
          src={logoUrl}
          alt="DigiBoard"
          style={{ 
            width: '120px', 
            height: '115px', 
            opacity: 0, 
            scale: 0.5,
            willChange: 'transform, opacity, filter'
          }}
          draggable={false}
        />
      </div>

      {/* Fake Toolbar perfectly mirroring the real LeftToolbar.tsx */}
      {/* Moved OUTSIDE of the 3D camera so it doesn't tilt backward in 3D space, matching the real 2D UI */}
      <div
        ref={toolbarRef}
        style={{
          position: 'absolute',
          left: '1rem',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
          padding: '0.5rem',
          backgroundColor: 'var(--card, #ffffff)',
          borderRadius: '0.75rem',
          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
          border: '1px solid var(--border, #e2e8f0)',
          zIndex: 100
        }}
      >
        {TOOLS.map((Icon, idx) => (
          <div
            key={idx}
            ref={el => { if (el) toolRefs.current[idx] = el }}
            style={{ padding: '0.5rem', borderRadius: '0.5rem', color: 'var(--muted-foreground)' }}
          >
            <Icon size={20} />
          </div>
        ))}
      </div>

      {/* The 3D Camera Container (Scenes 5-8) */}
      <div 
        ref={cameraRef}
        style={{
          position: 'absolute',
          inset: 0,
          transformStyle: 'preserve-3d',
          pointerEvents: 'none'
        }}
      >
        {/* The Whiteboard Plane floating in 3D */}
        <div
          ref={canvasPlaneRef}
          style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: 'translateZ(-200px)' }}
        >
          {/* Crisp Text Typography */}
          <div ref={textRef} style={{ position: 'absolute', top: '25%', left: '35%', fontFamily: '"Inter", system-ui, sans-serif', fontWeight: 800, fontSize: '48px', color: 'var(--foreground)', letterSpacing: '-1.5px' }}>
            DigiBoard 2.0
          </div>

          {/* Hand-drawn Underline for the Title */}
          <svg style={{ position: 'absolute', top: '33%', left: '34%', overflow: 'visible', width: 300, height: 40 }}>
            <path ref={sketchPathRef} d="M10,20 Q100,5 200,15 T290,10" fill="none" stroke="#8b5cf6" strokeWidth="6" strokeLinecap="round" style={{ filter: 'drop-shadow(0 4px 6px rgba(139,92,246,0.3))' }} />
          </svg>

          {/* Premium Sticky Note */}
          <div ref={stickyRef} style={{ position: 'absolute', top: '45%', left: '32%', width: '200px', height: '200px', backgroundColor: '#fef08a', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', fontFamily: '"Nanum Pen Script", "Caveat", "Inter", cursive', fontSize: '32px', color: '#334155', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', lineHeight: 1.2, transform: 'rotate(-4deg)' }}>
            Design the future
          </div>

          {/* Drawn Arrow from Sticky to Square */}
          <svg style={{ position: 'absolute', top: '50%', left: '46%', overflow: 'visible', width: 200, height: 100 }}>
            <path ref={arrowPathRef} d="M10,80 L180,20 L165,25 M180,20 L170,35" fill="none" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          {/* Clean Vector Square with Text inside */}
          <div ref={shapeRef} style={{ position: 'absolute', top: '42%', left: '60%', width: '160px', height: '160px', border: '6px solid #3b82f6', borderRadius: '24px', backgroundColor: 'rgba(59, 130, 246, 0.1)', boxShadow: '0 0 40px rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: '"Inter", system-ui, sans-serif', fontWeight: 800, fontSize: '28px', color: 'var(--info)', letterSpacing: '-0.5px' }}>
              Launch
            </span>
          </div>
        </div>
      </div>

      {/* Skip Button */}
      {showSkip && (
        <button
          onClick={handleSkip}
          style={{
            position: 'absolute',
            bottom: '30px',
            right: '40px',
            padding: '8px 20px',
            background: 'color-mix(in srgb, var(--card) 75%, transparent)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--border)',
            borderRadius: '99px',
            color: 'var(--muted-foreground)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            zIndex: 10000,
            transition: 'all 0.2s',
            boxShadow: 'var(--shadow-sm)'
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--foreground)'; e.currentTarget.style.borderColor = 'var(--foreground)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted-foreground)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          Skip
        </button>
      )}
    </div>
  )
}
