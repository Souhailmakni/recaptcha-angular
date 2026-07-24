export type RecaptchaVersion = 'v2' | 'v3'
export type RecaptchaTheme = 'light' | 'dark'
export type RecaptchaSize = 'normal' | 'compact'
export type RecaptchaBadge = 'bottomright' | 'bottomleft' | 'inline'

/** Shape of the grecaptcha global */
export interface Grecaptcha {
  render(container: HTMLElement, params: Record<string, unknown>): number
  reset(widgetId?: number): void
  getResponse(widgetId?: number): string
  /** v3: run the challenge for an action and resolve with a token */
  execute(siteKey: string, options: { action: string }): Promise<string>
  /** v2 invisible: trigger the challenge for a widget */
  execute(widgetId?: number): void
  /** v3: run the callback once grecaptcha is ready */
  ready(callback: () => void): void
}

declare global {
  interface Window {
    grecaptcha?: Grecaptcha
  }
}
