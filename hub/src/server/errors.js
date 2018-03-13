export class ValidationError {
  constructor (message) {
    this.name = 'ValidationError'
    this.message = message
    this.stack = (new Error(message)).stack
  }
}

export class BadPathError {
  constructor (message) {
    this.name = 'BadPathError'
    this.message = message
    this.stack = (new Error(message)).stack
  }
}
export class NotEnoughProofError {
  constructor (message) {
    this.name = 'NotEnoughProofError'
    this.message = message
    this.stack = (new Error(message)).stack
  }
}


