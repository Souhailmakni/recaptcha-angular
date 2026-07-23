import * as api from '../public-api'
import { RecaptchaComponent } from './recaptcha.component'
import { RecaptchaService } from './recaptcha.service'

describe('public API', () => {
  it('re-exports the component and the service', () => {
    expect(api.RecaptchaComponent).toBe(RecaptchaComponent)
    expect(api.RecaptchaService).toBe(RecaptchaService)
  })
})
