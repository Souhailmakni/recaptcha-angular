import { Component, ViewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { RecaptchaComponent } from 'recaptcha-angular'

/**
 * Example: reCAPTCHA v3 (score-based, no widget). A fresh token is fetched at
 * submit time via execute(action) and sent to the server for verification.
 */
@Component({
  selector: 'app-login-v3',
  standalone: true,
  imports: [RecaptchaComponent, FormsModule],
  template: `
    <form (ngSubmit)="submit()">
      <input [(ngModel)]="email" name="email" type="email" required />
      <input [(ngModel)]="password" name="password" type="password" required />

      <!-- No visible widget on v3, just the floating badge. -->
      <recaptcha-v2 #captcha [sitekey]="siteKey" version="v3"></recaptcha-v2>

      <button type="submit">Log in</button>
    </form>
  `,
})
export class LoginV3Component {
  @ViewChild('captcha') captcha!: RecaptchaComponent
  siteKey = 'YOUR_V3_SITE_KEY'
  email = ''
  password = ''

  async submit(): Promise<void> {
    // Always execute right before submitting: v3 tokens are single-use and
    // expire after about 2 minutes.
    const token = await this.captcha.execute('login')

    await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: this.email,
        password: this.password,
        'g-recaptcha-response': token,
      }),
    })
  }
}
