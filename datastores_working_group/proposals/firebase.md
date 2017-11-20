# Firebase API for devs

One way to add a higher level abstraction to Gaia would be to wrap a JSON object in the firebase API and then abstract the `getFile` and `putFile` calls from the devs. This would have the advantage of giving developers a higher level api to work with that they are familiar with, in addition to being potentially easy to implement.

The firebase js sdk is open source:
https://github.com/firebase/firebase-js-sdk

Here is an implementation of the mongo API in localStorage: https://github.com/mWater/minimongo
