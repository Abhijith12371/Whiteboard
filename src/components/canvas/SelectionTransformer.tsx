import { useEffect, useRef } from 'react'
import { Transformer } from 'react-konva'
import Konva from 'konva'
import { useBoardStore } from '../../store/boardStore'

interface Props {
  selectedIds: string[]
}

export const SelectionTransformer: React.FC<Props> = ({ selectedIds }) => {
  const transformerRef = useRef<Konva.Transformer>(null)
  const objects = useBoardStore((state) => state.objects)

  const isGroupSelection =
    selectedIds.length === 1 && objects[selectedIds[0]]?.type === 'group'

  const isMultiSelection = selectedIds.length > 1

  // The three variants below are distinct <Transformer> elements, so switching
  // between them remounts and leaves the new one with no nodes until this runs.
  const variant = isGroupSelection ? 'group' : isMultiSelection ? 'multi' : 'single'

  useEffect(() => {
    if (transformerRef.current) {
      const stage = transformerRef.current.getStage()
      if (!stage) return

      const selectedNodes = selectedIds
        .map(id => stage.findOne(`#${id}`))
        .filter(node => node !== undefined)

      transformerRef.current.nodes(selectedNodes as Konva.Node[])
      transformerRef.current.getLayer()?.batchDraw()
    }
  }, [selectedIds, variant])

  if (selectedIds.length === 0) return null

  // Group selection: dashed purple border, bold handles
  if (isGroupSelection) {
    return (
      <Transformer
        ref={transformerRef}
        boundBoxFunc={(oldBox, newBox) => {
          if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) return oldBox
          return newBox
        }}
        padding={8}
        anchorSize={12}
        anchorCornerRadius={6}
        borderStroke="#a855f7"
        borderDash={[6, 4]}
        borderStrokeWidth={2.5}
        anchorStroke="#a855f7"
        anchorStrokeWidth={2}
        anchorFill="#ffffff"
        anchorOpacity={0.95}
      />
    )
  }

  // Multi-selection: orange dashed border, bold handles
  if (isMultiSelection) {
    return (
      <Transformer
        ref={transformerRef}
        boundBoxFunc={(oldBox, newBox) => {
          if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) return oldBox
          return newBox
        }}
        padding={8}
        anchorSize={12}
        anchorCornerRadius={6}
        borderStroke="#f97316"
        borderDash={[6, 4]}
        borderStrokeWidth={2.5}
        anchorStroke="#f97316"
        anchorStrokeWidth={2}
        anchorFill="#ffffff"
        anchorOpacity={0.95}
      />
    )
  }

  // Normal single selection: solid sky-blue border, bold handles
  return (
    <Transformer
      ref={transformerRef}
      boundBoxFunc={(oldBox, newBox) => {
        if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) return oldBox
        return newBox
      }}
      padding={5}
      anchorSize={12}
      anchorCornerRadius={6}
      borderStroke="#0ea5e9"
      borderStrokeWidth={2}
      anchorStroke="#0ea5e9"
      anchorStrokeWidth={2}
      anchorFill="#ffffff"
      anchorOpacity={0.95}
    />
  )
}
