import { Component } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { RecaptchaComponent, RecaptchaService } from 'recaptcha-angular'

/**
 * Example: a contact form that requires a solved reCAPTCHA before submitting.
 * The verified token is bound with [(ngModel)]; RecaptchaService tracks state.
 */
@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [RecaptchaComponent, FormsModule],
  providers: [RecaptchaService],
  template: `
    <form (ngSubmit)="submit()">
      <textarea [(ngModel)]="message" name="message" required></textarea>

      <recaptcha-v2
        #captcha
        [sitekey]="siteKey"
        [(ngModel)]="token"
        name="captcha"
        (verify)="recaptcha.onVerify($event)"
        (expire)="recaptcha.onExpire()"
        (error)="recaptcha.onError()"
      ></recaptcha-v2>

      <button type="submit" [disabled]="!recaptcha.isVerified()">Send</button>
    </form>
  `,
})
export class ContactComponent {
  siteKey = 'YOUR_SITE_KEY'
  message = ''
  token = ''

  constructor(public recaptcha: RecaptchaService) {}

  async submit(): Promise<void> {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: this.message, 'g-recaptcha-response': this.token }),
    })

    if (res.ok) {
      this.message = ''
      this.recaptcha.reset()
    }
  }
}
