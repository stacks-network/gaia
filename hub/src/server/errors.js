/* @flow */

export class ValidationError extends Error {
  constructor (message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

export class AuthTokenNumberValidationError extends Error {
  correctAuthNumber: number;
  constructor (message: string, correctAuthNumber: number) {
    super(message)
    this.name = this.constructor.name
    this.correctAuthNumber = correctAuthNumber
  }
}

export class BadPathError extends Error {
  constructor (message: string) {
    super(message)
    this.name = this.constructor.name
  }
}
export class NotEnoughProofError extends Error {
  constructor (message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

export class InvalidInputError extends Error {
  constructor (message: string) {
    super(message)
    this.name = this.constructor.name
  }
}
