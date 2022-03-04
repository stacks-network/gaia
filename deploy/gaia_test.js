/*
 * This script will test your GAIA hub by connecting to it,
 * uploading a test file and then downloading it.
 * It requieres a GAIA Hub URL as input to test.
 * Usage from the command line is: node gaia_test.js https://yourgaiadomain.com
 */

//Import required dependencies
const { makeECPrivateKey, getPublicKeyFromPrivate, publicKeyToAddress } = require('@stacks/encryption');
const { connectToGaiaHub, uploadToGaiaHub } = require('@stacks/storage');

//Set my GAIA HUB domain
const args = process.argv.slice(2); //Get domain to test from the command line
const myDomain = args[0];
if(myDomain == undefined) {
  console.log(`No domain defined.`);
  console.log(`To run the test, please type a valid GAIA HUB: "node gaia_test https://yourgaiadomain.com"`);
  process.exit();
}
else {
  console.log('Will run a test for the GAIA HUB:',myDomain); 
}

//Generate my privateKey, publicKey and address
console.log(`Generating some test keys...`);
const privateKey = makeECPrivateKey();
const publicKey = getPublicKeyFromPrivate(privateKey);
const address = publicKeyToAddress(publicKey);
console.log('Private key: ',privateKey);
console.log('Public key:  ',publicKey);
console.log('Address:     ',address);

//Connect to my GAIA hub using my privateKey
  connectToGaiaHub(myDomain, privateKey)
  .then((hubConfig) => {
      //Upload a test file
      return uploadToGaiaHub('testing.txt', 'GAIA ROCKS!', hubConfig)
      .then((writtenFile) => {
          console.log(`File uploaded successfully.`);
          console.log(`Upload to gaia hub thinks it can read it from: ${writtenFile.publicURL}`);
          console.log(`Hub info thinks it can read it from          : ${hubConfig.url_prefix}${hubConfig.address}/testing.txt`);
          console.log(`Let's now try to fetch the uploaded file...`);
          return fetch(`${hubConfig.url_prefix}${hubConfig.address}/testing.txt`)
            .then(resp => resp.text())
            .then(x => console.log(`File fetched successfully. Contents of file: ${x}`))
      })
  })
