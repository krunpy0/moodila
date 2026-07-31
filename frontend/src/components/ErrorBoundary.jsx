import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled React render error caught by ErrorBoundary:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, resetErrorBoundary: this.handleReset })
      }

      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-container-margin py-xl text-center text-on-background">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-error-container text-error">
            <span className="material-symbols-outlined text-[36px]">warning</span>
          </div>
          <h1 className="mt-md text-headline-md font-bold text-on-surface">Что-то пошло не так</h1>
          <p className="mt-xs max-w-xs text-body-sm text-on-surface-variant">
            Произошла ошибка при отображении этой страницы. Попробуйте снова или обновите страницу.
          </p>
          {this.state.error && (
            <details className="mt-md max-w-sm rounded-xl bg-surface-container-low p-sm text-left font-mono text-label-sm text-error overflow-auto max-h-32">
              <summary className="cursor-pointer font-sans font-semibold">Детали ошибки</summary>
              <pre className="mt-xs whitespace-pre-wrap">{this.state.error.toString()}</pre>
            </details>
          )}
          <div className="mt-lg flex gap-sm">
            <button
              type="button"
              onClick={this.handleReset}
              className="rounded-full bg-surface-container-high px-md py-xs text-label-md font-semibold text-on-surface transition-colors hover:bg-surface-container-highest"
            >
              Попробовать снова
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full bg-primary px-md py-xs text-label-md font-semibold text-on-primary transition-opacity hover:opacity-90"
            >
              Обновить страницу
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
