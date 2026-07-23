export type RecaptchaTheme = 'light' | 'dark'
export type RecaptchaSize = 'normal' | 'compact'
export type RecaptchaBadge = 'bottomright' | 'bottomleft' | 'inline'

/** Shape of the grecaptcha global */
export interface Grecaptcha {
  render(container: HTMLElement, params: Record<string, unknown>): number
  reset(widgetId?: number): void
  execute(widgetId?: number): void
  getResponse(widgetId?: number): string
}

declare global {
  interface Window {
    grecaptcha?: Grecaptcha
  }
}
