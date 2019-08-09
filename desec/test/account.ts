import * as chai from 'chai';
import { assert } from 'chai';
import * as chaiAsPromised from "chai-as-promised";
import * as desec from '../src/desec';

chai.use(chaiAsPromised);

const TEST_ACCOUNT_EMAIL = 'desec_testing@tmailservices.com';
const TEST_ACCOUNT_PASSWORD = 'winkle-guano-sphinx-equator';
const TEST_ACCOUNT_TOKEN = 'kBg-lv0KIQctimYG2zjT.uEaqBkZ';
const TEST_DOMAIN_NAME = 'desec_testing_winkle';

describe('desec.io API tests', () => {

  let newToken: string | undefined;

  it('registration - email already taken', async () => {
    const registerPromise = desec.register({
      email: TEST_ACCOUNT_EMAIL, 
      password: TEST_ACCOUNT_PASSWORD
    });
    await assert.isRejected(registerPromise, desec.EmailAlreadyRegisteredError);
  });

  it('login', async () => {
    const result = await desec.login({
      email: TEST_ACCOUNT_EMAIL, 
      password: TEST_ACCOUNT_PASSWORD
    });
    newToken = result.auth_token;
    assert.isString(newToken);
    assert.isAbove(newToken.length, 1);
  })

  it('[logout] destroy new token', async () => {
    if (newToken) {
      await desec.logout({
        authToken: newToken
      });
    } else {
      throw new Error('No new auth token to destroy');
    }
  });

  it('get account info', async () => {
    const info = await desec.getAccountInfo({
      authToken: TEST_ACCOUNT_TOKEN
    });
    assert.equal(info.email, TEST_ACCOUNT_EMAIL);
    assert.equal(info.limit_domains, 5);
    assert.equal(info.locked, false);
  });

  it('create domain', async () => {
    const createDomainPromise = desec.createDomain({
      authToken: TEST_ACCOUNT_TOKEN, 
      name: TEST_DOMAIN_NAME
    });
    await assert.isRejected(createDomainPromise, desec.DomainNameAlreadyExistsError);
  });

  it('list domains', async () => {
    const domainList = await desec.listDomains({
      authToken: TEST_ACCOUNT_TOKEN
    });
    const domain = domainList.find(d => d.name === `${TEST_DOMAIN_NAME}.dedyn.io`);
    if (!domain) {
      throw new Error('Should have found domain');
    }
  });

  it('get domain info', async () => {
    const domainInfo = await desec.getDomainInfo({
      authToken: TEST_ACCOUNT_TOKEN,
      name: TEST_DOMAIN_NAME
    });
    assert.strictEqual(domainInfo.created, '2019-08-09T02:17:30Z');
    assert.strictEqual(domainInfo.name, `${TEST_DOMAIN_NAME}.dedyn.io`);
    // assert.strictEqual(domainInfo.published, '2019-08-09T02:17:30.375201Z');
  });

  it('get domain records', async () => {
    const records = await desec.getDomainRecordSets({
      authToken: TEST_ACCOUNT_TOKEN,
      name: TEST_DOMAIN_NAME
    });
    assert.ok(records);
  });

  it('create record set', async () => {
    await desec.createDomainRecordSet({
      authToken: TEST_ACCOUNT_TOKEN,
      name: TEST_DOMAIN_NAME,
      recordSet: {
        ttl: 60,
        type: 'A',
        records: ['1.2.3.4']
      }
    });
    // await assert.isRejected(createPromise, /same subdomain and type exists for this domain/);
  });

  it('update record set', async () => {
    await desec.updateDomainRecordSet({
      authToken: TEST_ACCOUNT_TOKEN,
      name: TEST_DOMAIN_NAME,
      recordSet: {
        ttl: 60,
        type: 'A',
        records: ['2.2.2.2']
      }
    });
    const recordSets = await desec.getDomainRecordSets({
      authToken: TEST_ACCOUNT_TOKEN,
      name: TEST_DOMAIN_NAME,
      filterType: 'A'
    });
    assert.isArray(recordSets);
    assert.lengthOf(recordSets, 1);
    assert.sameMembers(recordSets[0].records, ['2.2.2.2']);
  });

  it('delete record set', async () => {
    await desec.deleteDomainRecordSet({
      authToken: TEST_ACCOUNT_TOKEN,
      name: TEST_DOMAIN_NAME,
      recordSet: {
        type: 'A'
      }
    });
    const records = await desec.getDomainRecordSets({
      authToken: TEST_ACCOUNT_TOKEN,
      name: TEST_DOMAIN_NAME,
      filterType: 'A'
    });
    assert.isArray(records);
    assert.lengthOf(records, 0);
  });

});
