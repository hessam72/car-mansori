'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class PartErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log to console but don't crash the app
    console.warn('[PartErrorBoundary] Failed to load part:', error.message)
  }

  render() {
    if (this.state.hasError) {
      // Return null to hide the part silently, or return custom fallback
      return this.props.fallback || null
    }

    return this.props.children
  }
}
