declare module 'react-pptx' {
  import { Component } from 'react'

  interface PPTXViewerProps {
    file?: File | null
    url?: string
    width?: string | number
    height?: string | number
    showSlideNum?: boolean
    showTotalSlideNum?: boolean
    showControls?: boolean
    readOnly?: boolean
    onSlideChange?: (slideIndex: number) => void
    onError?: (error: Error) => void
    onLoadStart?: () => void
    onLoadEnd?: () => void
  }

  export class PPTXViewer extends Component<PPTXViewerProps> {}
}
