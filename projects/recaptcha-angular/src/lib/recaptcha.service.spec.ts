import { RecaptchaService } from './recaptcha.service'

describe('RecaptchaService', () => {
  let service: RecaptchaService

  beforeEach(() => {
    service = new RecaptchaService()
  })

  it('starts empty and unverified', () => {
    expect(service.token()).toBe('')
    expect(service.isVerified()).toBe(false)
  })

  it('marks verified on onVerify', () => {
    service.onVerify('abc')
    expect(service.token()).toBe('abc')
    expect(service.isVerified()).toBe(true)
  })

  it('clears on onExpire', () => {
    service.onVerify('abc')
    service.onExpire()
    expect(service.token()).toBe('')
    expect(service.isVerified()).toBe(false)
  })

  it('clears on onError', () => {
    service.onVerify('abc')
    service.onError()
    expect(service.token()).toBe('')
    expect(service.isVerified()).toBe(false)
  })

  it('clears on reset', () => {
    service.onVerify('abc')
    service.reset()
    expect(service.token()).toBe('')
    expect(service.isVerified()).toBe(false)
  })
})
