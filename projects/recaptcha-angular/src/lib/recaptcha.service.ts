import { computed, Injectable, signal } from '@angular/core'

/**
 * Tracks reCAPTCHA verification state with signals. Mirrors the Vue
 * `useRecaptcha` composable / React `useRecaptcha` hook.
 *
 * Not a root singleton on purpose: provide it at the component level so each
 * form gets its own state.
 *
 * @example
 * ```ts
 * @Component({
 *   selector: 'app-contact',
 *   standalone: true,
 *   imports: [RecaptchaComponent],
 *   providers: [RecaptchaService],
 *   template: `
 *     <recaptcha-v2 sitekey="..."
 *       (verify)="captcha.onVerify($event)"
 *       (expire)="captcha.onExpire()"
 *       (error)="captcha.onError()"></recaptcha-v2>
 *     <button [disabled]="!captcha.isVerified()">Submit</button>
 *   `,
 * })
 * export class ContactComponent {
 *   constructor(public captcha: RecaptchaService) {}
 * }
 * ```
 */
@Injectable()
export class RecaptchaService {
  private readonly _token = signal('')

  /** Current token, updated on verify / cleared on expire / error / reset */
  readonly token = this._token.asReadonly()

  /** True once a valid token exists */
  readonly isVerified = computed(() => this._token() !== '')

  /** Call when (verify) fires */
  onVerify(token: string): void {
    this._token.set(token)
  }

  /** Call when (expire) fires */
  onExpire(): void {
    this._token.set('')
  }

  /** Call when (error) fires */
  onError(): void {
    this._token.set('')
  }

  /** Clears the tracked state (does NOT reset the widget, call component.reset() for that) */
  reset(): void {
    this._token.set('')
  }
}
