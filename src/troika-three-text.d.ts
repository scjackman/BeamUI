declare module 'troika-three-text' {
  export class Text {
    text: string
    font: string
    fontSize: number
    anchorX: 'left' | 'center' | 'right'
    anchorY: 'top' | 'middle' | 'bottom'
    color: string | number

    sync: () => void
    dispose: () => void
  }
}

