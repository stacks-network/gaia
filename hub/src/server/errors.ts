

export class ValidationError extends Error {
  constructor (message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

export class AuthTokenTimestampValidationError extends Error {
  oldestValidTokenTimestamp: number;
  constructor (message: string, oldestValidTokenTimestamp: number) {
    super(message)
    this.name = this.constructor.name
    this.oldestValidTokenTimestamp = oldestValidTokenTimestamp
  }
}

export class DoesNotExist extends Error {
  constructor (message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
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
