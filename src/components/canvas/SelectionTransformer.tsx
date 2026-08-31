import React, { useEffect, useRef } from 'react'
import { Transformer } from 'react-konva'
import Konva from 'konva'

interface Props {
  selectedIds: string[]
}

export const SelectionTransformer: React.FC<Props> = ({ selectedIds }) => {
  const transformerRef = useRef<Konva.Transformer>(null)

  useEffect(() => {
    if (transformerRef.current) {
      const stage = transformerRef.current.getStage()
      if (!stage) return

      const selectedNodes = selectedIds.map(id => stage.findOne(`#${id}`)).filter(node => node !== undefined)
      
      transformerRef.current.nodes(selectedNodes as Konva.Node[])
      transformerRef.current.getLayer()?.batchDraw()
    }
  }, [selectedIds])

  if (selectedIds.length === 0) return null

  return (
    <Transformer
      ref={transformerRef}
      boundBoxFunc={(oldBox, newBox) => {
        // limit resize
        if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
          return oldBox
        }
        return newBox
      }}
      padding={5}
      anchorSize={8}
      anchorCornerRadius={4}
      borderStroke="#0ea5e9"
      anchorStroke="#0ea5e9"
      anchorFill="#ffffff"
    />
  )
}
