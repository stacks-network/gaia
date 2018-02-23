export class ValidationError {
  constructor (message) {
    this.name = this.constructor.name
    this.message = message
    this.stack = (new Error(message)).stack
  }
}

export class BadPathError {
  constructor (message) {
    this.name = this.constructor.name
    this.message = message
    this.stack = (new Error(message)).stack
  }
}
export class NotEnoughProofError {
  constructor (message) {
    this.name = this.constructor.name
    this.message = message
    this.stack = (new Error(message)).stack
  }
}


