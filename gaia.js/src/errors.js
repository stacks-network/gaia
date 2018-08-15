type ErrorType = {
  code: string,
  parameter?: string,
  message: string
}

export class GaiaError extends Error {
  message: string

  code: string

  parameter: ?string

  constructor(error: ErrorType) {
    super(error.message)
    this.code = error.code
    this.parameter = error.parameter ? error.parameter : null
  }

  toString() {
    return `${super.toString()}
    code: ${this.code} param: ${this.parameter ? this.parameter : 'n/a'}`
  }
}

export class SignatureVerificationError extends GaiaError {
  constructor(reason: string) {
    const message = `Failed to verify signature: ${reason}`
    super({ code: 'signature_verification_failure', message })
    this.message = message
    this.name = 'SignatureVerificationError'
  }
}
