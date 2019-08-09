import * as chai from 'chai';
import { assert } from 'chai';
import * as chaiAsPromised from "chai-as-promised";
import * as desec from '../src/desec';

chai.use(chaiAsPromised);

const TEST_ACCOUNT_EMAIL = 'desec_testing@tmailservices.com';
const TEST_ACCOUNT_PASSWORD = 'winkle-guano-sphinx-equator';
const TEST_ACCOUNT_TOKEN = 'kBg-lv0KIQctimYG2zjT.uEaqBkZ';

describe('desec.io API tests', () => {

  let newToken: string | undefined;

  it('registration - email already taken', async () => {
    const registerPromise = desec.register(TEST_ACCOUNT_EMAIL, TEST_ACCOUNT_PASSWORD);
    await assert.isRejected(registerPromise, desec.EmailAlreadyRegisteredError);
  });

  it('login', async () => {
    const result = await desec.login(TEST_ACCOUNT_EMAIL, TEST_ACCOUNT_PASSWORD);
    newToken = result.auth_token;
    assert.isString(newToken);
    assert.isAbove(newToken.length, 1);
  })

  it('[logout] destroy new token', async () => {
    if (newToken) {
      const logoutResult = await desec.logout(newToken);
    } else {
      throw new Error('No new auth token to destroy');
    }
  });

  it('get account info', async () => {
    const info = await desec.getAccountInfo(TEST_ACCOUNT_TOKEN);
    assert.equal(info.email, TEST_ACCOUNT_EMAIL);
    assert.equal(info.limit_domains, 5);
    assert.equal(info.locked, false);
  });

  it('create domain', async () => {
    const createDomainPromise = desec.createDomain(TEST_ACCOUNT_TOKEN, 'desec_testing_winkle');
    await assert.isRejected(createDomainPromise, desec.DomainNameAlreadyExistsError);
  });

  it('list domains', async () => {
    const domainList = await desec.listDomains(TEST_ACCOUNT_TOKEN);
    const domain = domainList.find(d => d.name === 'desec_testing_winkle.dedyn.io');
    if (!domain) {
      throw new Error('Should have found domain');
    }
  })

});
